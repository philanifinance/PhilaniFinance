// Supabase Edge Function: NuPay DebiCheck Mandate Status Check
// Deploy: supabase functions deploy nupay-mandate-status
//
// This function queries the current status of a DebiCheck mandate from NuPay.
// It can be called manually by admins to sync mandate status or by scheduled jobs.
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
  nupay_mandate_id: string | null;
  debicheck_type: string;
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

// ── NuPay status → internal status mapping ────────────────────────────
function mapNuPayStatus(nuPayStatus: string): string {
  const normalized = nuPayStatus.toUpperCase().trim();
  const mapping: Record<string, string> = {
    'PENDING':               'pending_bank',
    'PENDING_BANK':          'pending_bank',
    'SUBMITTED':             'mandate_submitted',
    'ACCEPTED':              'accepted',
    'AUTHENTICATED':         'accepted',
    'APPROVED':              'accepted',
    'REJECTED':              'rejected',
    'DECLINED':              'rejected',
    'TIMEOUT':               'rejected',
    'EXPIRED':               'rejected',
    'CANCELLED':             'cancelled',
    'ERROR':                 'error',
    'FAILED':                'error',
  };
  return mapping[normalized] || 'pending_bank';
}

// ── Main handler ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mandate_id, contract_ref } = await req.json();
    
    if (!mandate_id && !contract_ref) {
      return new Response(
        JSON.stringify({ error: 'Either mandate_id or contract_ref is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create a Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch the mandate record from database
    let query = supabase.from('debicheck_mandates').select('*');
    if (mandate_id) {
      query = query.eq('id', mandate_id);
    } else {
      query = query.eq('contract_ref', contract_ref);
    }
    
    const { data: mandate, error: fetchErr } = await query.single();

    if (fetchErr || !mandate) {
      return new Response(
        JSON.stringify({ error: 'Mandate not found in database' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const m = mandate as MandateRow;

    // 2. If mandate hasn't been submitted yet, return current status
    if (!m.nupay_mandate_id || ['draft', 'error'].includes(m.status)) {
      return new Response(
        JSON.stringify({
          mandate_id: m.id,
          contract_ref: m.contract_ref,
          status: m.status,
          nupay_mandate_id: m.nupay_mandate_id,
          message: 'Mandate not yet submitted to NuPay',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Authenticate with NuPay
    const token = await getNuPayToken();

    // 4. Query NuPay for mandate status
    const apiUrl = Deno.env.get('NUPAY_API_URL') || 'https://api.nupay.co.za/v1';
    const nuPayResponse = await fetch(
      `${apiUrl}/debicheck/mandate/status?ContractRef=${encodeURIComponent(m.contract_ref)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const nuPayResult = await nuPayResponse.json();

    if (!nuPayResponse.ok) {
      // NuPay returned an error
      const errorMsg = nuPayResult.Message || nuPayResult.message || JSON.stringify(nuPayResult);
      const responseCode = nuPayResult.ResponseCode || nuPayResult.responseCode || String(nuPayResponse.status);

      return new Response(
        JSON.stringify({
          error: `NuPay API error: ${errorMsg}`,
          response_code: responseCode,
          mandate_id: m.id,
          contract_ref: m.contract_ref,
        }),
        {
          status: 200, // Return 200 even on NuPay errors to avoid client-side issues
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Map NuPay status and update database if changed
    const nuPayStatus = nuPayResult.Status || nuPayResult.status || '';
    const internalStatus = mapNuPayStatus(nuPayStatus);
    const responseCode = nuPayResult.ResponseCode || nuPayResult.responseCode || '00';
    const responseMessage = nuPayResult.Message || nuPayResult.message || '';

    // Only update if status has changed
    if (internalStatus !== m.status) {
      await supabase.from('debicheck_mandates').update({
        status: internalStatus,
        nupay_response_code: responseCode,
        nupay_response_message: responseMessage,
        status_updated_at: new Date().toISOString(),
      }).eq('id', m.id);

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: m.initiated_by,
        action: 'debicheck_status_sync',
        target_type: 'debicheck_mandate',
        target_id: m.id,
        details: {
          previous_status: m.status,
          new_status: internalStatus,
          nupay_status: nuPayStatus,
          response_code: responseCode,
        },
      });
    }

    // 6. Return updated mandate status
    return new Response(
      JSON.stringify({
        mandate_id: m.id,
        contract_ref: m.contract_ref,
        status: internalStatus,
        nupay_mandate_id: m.nupay_mandate_id,
        nupay_status: nuPayStatus,
        response_code: responseCode,
        response_message: responseMessage,
        synced: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
