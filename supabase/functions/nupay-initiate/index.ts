// Supabase Edge Function: NuPay DebiCheck Mandate Initiation
// Deploy: supabase functions deploy nupay-initiate
//
// Required env vars (set via Supabase Dashboard → Edge Functions → Secrets):
//   NUPAY_API_URL       — e.g. https://api.nupay.co.za/v1
//   NUPAY_MERCHANT_ID   — Your NuPay Merchant ID
//   NUPAY_TERMINAL_ID   — Your NuPay Terminal ID
//   NUPAY_API_KEY       — Your NuPay API secret/key for JWT generation
//   SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MandateRow {
  id: string;
  application_id: string;
  contract_ref: string;
  debicheck_type: string;
  instalment_amount: number;
  num_instalments: number;
  frequency: string;
  first_strike_date: string;
  tracking_days: number;
  client_name: string;
  client_id_number: string;
  client_mobile: string;
  client_bank: string;
  client_account_number: string;
  client_account_type: string;
  client_branch_code: string;
  status: string;
  initiated_by: string;
}

// ── NuPay JWT Authentication ──────────────────────────────────────────
async function getNuPayToken(): Promise<string> {
  const merchantId = Deno.env.get('NUPAY_MERCHANT_ID') || '';
  const terminalId = Deno.env.get('NUPAY_TERMINAL_ID') || '';
  const apiKey = Deno.env.get('NUPAY_API_KEY') || '';
  const apiUrl = Deno.env.get('NUPAY_API_URL') || 'https://api.nupay.co.za/v1';

  const authResponse = await fetch(`${apiUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      MerchantID: merchantId,
      TerminalID: terminalId,
      APIKey: apiKey,
    }),
  });

  if (!authResponse.ok) {
    const errText = await authResponse.text();
    throw new Error(`NuPay auth failed (${authResponse.status}): ${errText}`);
  }

  const authData = await authResponse.json();
  return authData.Token || authData.token || '';
}

// ── Map frequency to NuPay schema ─────────────────────────────────────
function mapFrequency(freq: string): string {
  const map: Record<string, string> = {
    'once-off': 'ONCE_OFF',
    'weekly': 'WEEKLY',
    'monthly': 'MONTHLY',
  };
  return map[freq] || 'ONCE_OFF';
}

// ── Map account type ──────────────────────────────────────────────────
function mapAccountType(type: string): string {
  const map: Record<string, string> = {
    'cheque': 'CHEQUE',
    'savings': 'SAVINGS',
    'transmission': 'TRANSMISSION',
  };
  return map[type.toLowerCase()] || 'CHEQUE';
}

// ── Main handler ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mandate_id } = await req.json();
    if (!mandate_id) {
      return new Response(JSON.stringify({ error: 'mandate_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch the mandate record
    const { data: mandate, error: fetchErr } = await supabase
      .from('debicheck_mandates')
      .select('*')
      .eq('id', mandate_id)
      .single();

    if (fetchErr || !mandate) {
      return new Response(JSON.stringify({ error: 'Mandate not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const m = mandate as MandateRow;

    // 2. Idempotency check — don't re-send if already submitted
    if (!['draft', 'error'].includes(m.status)) {
      return new Response(JSON.stringify({ error: `Mandate already in status: ${m.status}` }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Authenticate with NuPay
    const token = await getNuPayToken();

    // 4. Build the NuPay DebiCheck payload
    const apiUrl = Deno.env.get('NUPAY_API_URL') || 'https://api.nupay.co.za/v1';
    const nuPayPayload = {
      ContractRef: m.contract_ref,
      MandateType: m.debicheck_type,                     // TT1 or TT2
      DebtorName: m.client_name,
      DebtorIDNumber: m.client_id_number,
      DebtorContactNumber: m.client_mobile,
      DebtorAccountNumber: m.client_account_number,
      DebtorAccountType: mapAccountType(m.client_account_type),
      DebtorBranchCode: m.client_branch_code,
      InstalmentAmount: m.instalment_amount * 100,       // NuPay expects cents
      NumberOfInstalments: m.num_instalments,
      Frequency: mapFrequency(m.frequency),
      FirstCollectionDate: m.first_strike_date,           // YYYY-MM-DD
      TrackingDays: m.tracking_days,
      // Creditor details are auto-filled from MerchantID on NuPay's side
    };

    // 5. Submit to NuPay
    const nuPayResponse = await fetch(`${apiUrl}/debicheck/mandate/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(nuPayPayload),
    });

    const nuPayResult = await nuPayResponse.json();

    if (!nuPayResponse.ok) {
      // NuPay returned an error
      const errorMsg = nuPayResult.Message || nuPayResult.message || JSON.stringify(nuPayResult);
      const responseCode = nuPayResult.ResponseCode || nuPayResult.responseCode || String(nuPayResponse.status);

      await supabase.from('debicheck_mandates').update({
        status: 'error',
        nupay_response_code: responseCode,
        nupay_response_message: errorMsg,
        error_details: `HTTP ${nuPayResponse.status}: ${errorMsg}`,
        status_updated_at: new Date().toISOString(),
      }).eq('id', m.id);

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: m.initiated_by,
        action: 'debicheck_api_error',
        target_type: 'debicheck_mandate',
        target_id: m.id,
        details: { response_code: responseCode, message: errorMsg },
      });

      const { data: updated } = await supabase
        .from('debicheck_mandates').select('*').eq('id', m.id).single();

      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Success — update mandate record
    const nupayMandateId = nuPayResult.MandateID || nuPayResult.mandateId || nuPayResult.ReferenceNumber || '';
    const responseCode = nuPayResult.ResponseCode || nuPayResult.responseCode || '00';
    const responseMessage = nuPayResult.Message || nuPayResult.message || 'Mandate submitted successfully';

    await supabase.from('debicheck_mandates').update({
      status: 'mandate_submitted',
      nupay_mandate_id: nupayMandateId,
      nupay_response_code: responseCode,
      nupay_response_message: responseMessage,
      status_updated_at: new Date().toISOString(),
    }).eq('id', m.id);

    // Audit log
    await supabase.from('audit_logs').insert({
      actor_id: m.initiated_by,
      action: 'debicheck_initiated',
      target_type: 'debicheck_mandate',
      target_id: m.id,
      details: {
        contract_ref: m.contract_ref,
        nupay_mandate_id: nupayMandateId,
        response_code: responseCode,
        debicheck_type: m.debicheck_type,
        amount: m.instalment_amount,
      },
    });

    // Return updated mandate
    const { data: updated } = await supabase
      .from('debicheck_mandates').select('*').eq('id', m.id).single();

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
