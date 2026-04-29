// Supabase Edge Function: Credit Bureau Check (Experian / CPB)
// Deploy: supabase functions deploy credit-bureau-check
//
// Required env vars (set via Supabase Dashboard → Edge Functions → Secrets):
//   BUREAU_API_URL       — e.g. https://sandbox-us-api.experian.com/consumerservices/credit-profile/v2
//   BUREAU_CLIENT_ID     — OAuth2 Client ID
//   BUREAU_CLIENT_SECRET — OAuth2 Client Secret
//   BUREAU_USERNAME      — Experian developer portal username (email)
//   BUREAU_PASSWORD      — Experian developer portal password
//   BUREAU_TOKEN_URL     — e.g. https://sandbox-us-api.experian.com/oauth2/v1/token
//   SUPABASE_SERVICE_ROLE_KEY — Auto-injected
//
// When BUREAU_API_URL is NOT set → runs in simulation mode (no real API call).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── OAuth2 Token Management ──────────────────────────────────
let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getBureauToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 30_000) {
    return cachedToken.access_token;
  }

  const tokenUrl = Deno.env.get('BUREAU_TOKEN_URL')!;
  const clientId = Deno.env.get('BUREAU_CLIENT_ID')!;
  const clientSecret = Deno.env.get('BUREAU_CLIENT_SECRET')!;
  const username = Deno.env.get('BUREAU_USERNAME')!;
  const password = Deno.env.get('BUREAU_PASSWORD')!;

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'client_id': clientId,
      'client_secret': clientSecret,
    },
    body: JSON.stringify({
      grant_type: 'password',
      username,
      password,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.access_token;
}

// ── Score Band Classification ────────────────────────────────
function classifyScore(score: number): string {
  if (score >= 767) return 'excellent';
  if (score >= 681) return 'good';
  if (score >= 614) return 'fair';
  if (score >= 583) return 'poor';
  return 'very_poor';
}

// ── Income Matching ──────────────────────────────────────────
function matchIncome(bureauIncome: number | null, userIncome: number): string {
  if (!bureauIncome || bureauIncome <= 0) return 'unavailable';
  const ratio = Math.abs(bureauIncome - userIncome) / Math.max(bureauIncome, userIncome);
  return ratio <= 0.25 ? 'match' : 'mismatch';  // 25% tolerance
}

// ── Main Handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      application_id,
      id_number,
      first_name,
      last_name,
      monthly_income,
      consent_reference,
      consent_timestamp,
    } = body;

    // Validate required fields
    if (!application_id || !id_number || !consent_reference || !consent_timestamp) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: application_id, id_number, consent_reference, consent_timestamp' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the calling user from JWT
    const authHeader = req.headers.get('Authorization') || '';
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller has owner role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: only the site owner can perform credit checks' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up the application for user_id and verify consent
    const { data: appData, error: appError } = await supabase
      .from('loan_applications')
      .select('user_id, monthly_income, credit_consent_given, credit_consent_at')
      .eq('id', application_id)
      .single();

    if (appError || !appData) {
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POPIA: Verify client gave explicit consent during application
    if (!appData.credit_consent_given) {
      return new Response(
        JSON.stringify({ error: 'Credit check cannot proceed: client has not provided credit bureau consent (POPIA requirement)' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pending credit_checks record
    const userIncome = monthly_income || appData.monthly_income;
    const { data: checkRecord, error: insertError } = await supabase
      .from('credit_checks')
      .insert({
        application_id,
        user_id: appData.user_id,
        performed_by: user.id,
        consent_reference,
        consent_timestamp,
        user_monthly_income: userIncome,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !checkRecord) {
      return new Response(
        JSON.stringify({ error: 'Failed to create credit check record', details: insertError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Call the Credit Bureau API ──────────────────────────
    const bureauApiUrl = Deno.env.get('BUREAU_API_URL');

    let bureauResult: Record<string, unknown>;

    if (bureauApiUrl) {
      // PRODUCTION: Real Experian bureau call
      const token = await getBureauToken();

      const bureauRes = await fetch(bureauApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_number,
          first_name,
          last_name,
          consent_flag: true,
          consent_reference,
          report_type: 'full',
        }),
      });

      if (!bureauRes.ok) {
        const errText = await bureauRes.text();
        await supabase
          .from('credit_checks')
          .update({ status: 'error', error_details: `Bureau API ${bureauRes.status}: ${errText}` })
          .eq('id', checkRecord.id);

        return new Response(
          JSON.stringify({ error: 'Credit bureau request failed', check_id: checkRecord.id, bureau_status: bureauRes.status, bureau_error: errText }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      bureauResult = await bureauRes.json();
    } else {
      // DEVELOPMENT: Simulated bureau response for testing
      // Remove this block in production and ensure BUREAU_API_URL is set
      const simScore = 580 + Math.floor(Math.random() * 250);
      const simIncome = userIncome * (0.85 + Math.random() * 0.3);
      bureauResult = {
        reference_id: `SIM-${Date.now()}`,
        identity: {
          status: 'verified',
          full_name: `${first_name} ${last_name}`,
          id_number_match: true,
          details: '[SIMULATED] Identity confirmed against DHA records',
        },
        credit_profile: {
          score: simScore,
          risk_category: classifyScore(simScore) === 'excellent' || classifyScore(simScore) === 'good' ? 'Low' : 'Medium',
        },
        adverse: {
          judgments: 0,
          defaults: 0,
          debt_review: false,
          total: 0,
          summary: 'No adverse records found',
        },
        income: {
          estimated_monthly: Math.round(simIncome),
          debt_obligations: Math.floor(Math.random() * 3000),
        },
      };
    }

    // ── Parse bureau response ──────────────────────────────
    const identity = (bureauResult.identity || {}) as Record<string, unknown>;
    const creditProfile = (bureauResult.credit_profile || {}) as Record<string, unknown>;
    const adverse = (bureauResult.adverse || {}) as Record<string, unknown>;
    const income = (bureauResult.income || {}) as Record<string, unknown>;

    const score = (creditProfile.score as number) || null;
    const scoreBand = score ? classifyScore(score) : null;
    const bureauIncome = (income.estimated_monthly as number) || null;
    const incomeMatchResult = matchIncome(bureauIncome, userIncome);

    const identityStatus = (identity.status as string) || 'unknown';

    // ── Update credit_checks record with summary ───────────
    const updatePayload = {
      status: 'completed',
      bureau_reference: (bureauResult.reference_id as string) || null,
      identity_status: identityStatus,
      identity_details: (identity.details as string) || null,
      credit_score: score,
      credit_score_band: scoreBand,
      risk_category: (creditProfile.risk_category as string) || null,
      has_judgments: ((adverse.judgments as number) || 0) > 0,
      has_defaults: ((adverse.defaults as number) || 0) > 0,
      has_debt_review: (adverse.debt_review as boolean) || false,
      adverse_count: (adverse.total as number) || 0,
      adverse_summary: (adverse.summary as string) || null,
      bureau_monthly_income: bureauIncome,
      bureau_debt_obligations: (income.debt_obligations as number) || null,
      user_monthly_income: userIncome,
      income_match: incomeMatchResult,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('credit_checks')
      .update(updatePayload)
      .eq('id', checkRecord.id);

    // ── Update loan_applications with latest score ─────────
    await supabase
      .from('loan_applications')
      .update({
        last_credit_score: score,
        last_credit_check_id: checkRecord.id,
        credit_check_timestamp: new Date().toISOString(),
      })
      .eq('id', application_id);

    // ── Audit log ──────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'credit_check_performed',
      target_type: 'loan_application',
      target_id: application_id,
      details: {
        check_id: checkRecord.id,
        identity_status: identityStatus,
        credit_score: score,
        income_match: incomeMatchResult,
      },
    });

    // ── Return summary (never return full bureau data) ─────
    return new Response(
      JSON.stringify({
        success: true,
        check_id: checkRecord.id,
        summary: {
          identity_status: identityStatus,
          identity_details: updatePayload.identity_details,
          credit_score: score,
          credit_score_band: scoreBand,
          risk_category: updatePayload.risk_category,
          has_judgments: updatePayload.has_judgments,
          has_defaults: updatePayload.has_defaults,
          has_debt_review: updatePayload.has_debt_review,
          adverse_count: updatePayload.adverse_count,
          adverse_summary: updatePayload.adverse_summary,
          bureau_monthly_income: bureauIncome,
          bureau_debt_obligations: updatePayload.bureau_debt_obligations,
          user_monthly_income: userIncome,
          income_match: incomeMatchResult,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
