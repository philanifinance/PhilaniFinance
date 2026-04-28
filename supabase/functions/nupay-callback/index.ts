// Supabase Edge Function: NuPay DebiCheck Webhook Callback
// Deploy: supabase functions deploy nupay-callback --no-verify-jwt
//
// This endpoint receives status updates from NuPay when a mandate
// status changes (e.g., pending_bank → accepted or rejected).
//
// Required env vars:
//   NUPAY_WEBHOOK_SECRET  — Shared secret for verifying webhook authenticity
//   SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase
//
// Register this URL in your NuPay merchant portal:
//   https://<project-ref>.supabase.co/functions/v1/nupay-callback

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

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

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Verify webhook authenticity
    const webhookSecret = Deno.env.get('NUPAY_WEBHOOK_SECRET') || '';
    if (webhookSecret) {
      const incomingSecret = req.headers.get('x-webhook-secret') || req.headers.get('X-Webhook-Secret') || '';
      if (incomingSecret !== webhookSecret) {
        console.error('Webhook secret mismatch');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. Parse the callback payload
    const payload = await req.json();
    console.log('NuPay callback received:', JSON.stringify(payload));

    // NuPay may send different field names — handle both
    const contractRef = payload.ContractRef || payload.contractRef || payload.contract_ref || '';
    const mandateId = payload.MandateID || payload.mandateId || payload.mandate_id || '';
    const nuPayStatus = payload.Status || payload.status || '';
    const responseCode = payload.ResponseCode || payload.responseCode || '';
    const responseMessage = payload.Message || payload.message || payload.ResponseMessage || '';

    if (!contractRef && !mandateId) {
      console.error('No ContractRef or MandateID in payload');
      return new Response(JSON.stringify({ error: 'Missing identifier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Create service-role Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // 4. Find the mandate by contract_ref or nupay_mandate_id
    let query = supabase.from('debicheck_mandates').select('*');
    if (contractRef) {
      query = query.eq('contract_ref', contractRef);
    } else {
      query = query.eq('nupay_mandate_id', mandateId);
    }
    const { data: mandate, error: findErr } = await query.single();

    if (findErr || !mandate) {
      console.error('Mandate not found for ref:', contractRef || mandateId);
      // Return 200 so NuPay doesn't retry endlessly
      return new Response(JSON.stringify({ error: 'Mandate not found', received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Map status and update
    const internalStatus = mapNuPayStatus(nuPayStatus);
    const previousStatus = mandate.status;

    await supabase.from('debicheck_mandates').update({
      status: internalStatus,
      nupay_mandate_id: mandateId || mandate.nupay_mandate_id,
      nupay_response_code: responseCode || mandate.nupay_response_code,
      nupay_response_message: responseMessage || mandate.nupay_response_message,
      status_updated_at: new Date().toISOString(),
    }).eq('id', mandate.id);

    // 6. Audit log
    await supabase.from('audit_logs').insert({
      actor_id: mandate.initiated_by,
      action: 'debicheck_callback',
      target_type: 'debicheck_mandate',
      target_id: mandate.id,
      details: {
        previous_status: previousStatus,
        new_status: internalStatus,
        nupay_status: nuPayStatus,
        response_code: responseCode,
        response_message: responseMessage,
        contract_ref: mandate.contract_ref,
      },
    });

    console.log(`Mandate ${mandate.id} updated: ${previousStatus} → ${internalStatus}`);

    // 7. Respond to NuPay with success
    return new Response(JSON.stringify({
      success: true,
      mandate_id: mandate.id,
      status: internalStatus,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Webhook handler error:', message);
    // Return 200 to prevent NuPay retries on parse errors
    return new Response(JSON.stringify({ error: message, received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
