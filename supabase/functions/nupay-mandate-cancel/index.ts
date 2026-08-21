// Supabase Edge Function: NuPay DebiCheck Mandate Cancellation
// Deploy: supabase functions deploy nupay-mandate-cancel
//
// This function cancels an active DebiCheck mandate with NuPay.
// Can be called by admins or clients to cancel their mandate.
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
  user_id: string;
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

// ── Main handler ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mandate_id, reason } = await req.json();

    if (!mandate_id) {
      return new Response(
        JSON.stringify({ error: 'mandate_id is required' }),
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

    // 1. Fetch the mandate record
    const { data: mandate, error: fetchErr } = await supabase
      .from('debicheck_mandates')
      .select('*')
      .eq('id', mandate_id)
      .single();

    if (fetchErr || !mandate) {
      return new Response(
        JSON.stringify({ error: 'Mandate not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const m = mandate as MandateRow;

    // 2. Check if mandate can be cancelled
    const cancellableStatuses = ['mandate_submitted', 'pending_bank', 'accepted'];
    if (!cancellableStatuses.includes(m.status)) {
      return new Response(
        JSON.stringify({
          error: `Cannot cancel mandate in status: ${m.status}`,
          current_status: m.status,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. If mandate hasn't been submitted to NuPay yet, just mark as cancelled locally
    if (!m.nupay_mandate_id) {
      await supabase.from('debicheck_mandates').update({
        status: 'cancelled',
        status_updated_at: new Date().toISOString(),
      }).eq('id', m.id);

      await supabase.from('audit_logs').insert({
        actor_id: m.initiated_by,
        action: 'debicheck_cancelled',
        target_type: 'debicheck_mandate',
        target_id: m.id,
        details: {
          reason: reason || 'User cancelled',
          previous_status: m.status,
          nupay_submitted: false,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          mandate_id: m.id,
          contract_ref: m.contract_ref,
          status: 'cancelled',
          message: 'Mandate cancelled locally (not yet submitted to NuPay)',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Authenticate with NuPay
    const token = await getNuPayToken();

    // 5. Call NuPay cancellation endpoint
    const apiUrl = Deno.env.get('NUPAY_API_URL') || 'https://api.nupay.co.za/v1';
    const nuPayPayload = {
      ContractRef: m.contract_ref,
      MandateID: m.nupay_mandate_id,
      Reason: reason || 'Cancelled by user',
    };

    const nuPayResponse = await fetch(`${apiUrl}/debicheck/mandate/cancel`, {
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

      // Still mark as cancelled locally since the request was made
      await supabase.from('debicheck_mandates').update({
        status: 'cancelled',
        nupay_response_code: responseCode,
        nupay_response_message: errorMsg,
        status_updated_at: new Date().toISOString(),
      }).eq('id', m.id);

      await supabase.from('audit_logs').insert({
        actor_id: m.initiated_by,
        action: 'debicheck_cancel_error',
        target_type: 'debicheck_mandate',
        target_id: m.id,
        details: {
          reason: reason || 'User cancelled',
          nupay_error: errorMsg,
          response_code: responseCode,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          mandate_id: m.id,
          contract_ref: m.contract_ref,
          status: 'cancelled',
          warning: `NuPay returned error but mandate marked as cancelled: ${errorMsg}`,
          response_code: responseCode,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Success — update mandate record
    const responseCode = nuPayResult.ResponseCode || nuPayResult.responseCode || '00';
    const responseMessage = nuPayResult.Message || nuPayResult.message || 'Mandate cancelled successfully';

    await supabase.from('debicheck_mandates').update({
      status: 'cancelled',
      nupay_response_code: responseCode,
      nupay_response_message: responseMessage,
      status_updated_at: new Date().toISOString(),
    }).eq('id', m.id);

    // Audit log
    await supabase.from('audit_logs').insert({
      actor_id: m.initiated_by,
      action: 'debicheck_cancelled',
      target_type: 'debicheck_mandate',
      target_id: m.id,
      details: {
        reason: reason || 'User cancelled',
        previous_status: m.status,
        nupay_response_code: responseCode,
        response_message: responseMessage,
      },
    });

    // 7. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        mandate_id: m.id,
        contract_ref: m.contract_ref,
        status: 'cancelled',
        response_code: responseCode,
        response_message: responseMessage,
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
