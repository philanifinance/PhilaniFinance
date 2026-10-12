// Supabase Edge Function: NuPay DebiCheck Mandate Cancellation
// Deploy: supabase functions deploy nupay-mandate-cancel
//
// Implements the real NuPay "Mandate Cancellation" webservice
// (see NuPayment Integration/DebiCheck Mandate Maintenance Specification_Version 3.pdf, §1.2).
// POST https://btm.nupay.co.za/wsDebiCheck/mandate_cancellation
//
// Required env vars (set via Supabase Dashboard → Edge Functions → Secrets):
//   NUPAY_USERNAME, NUPAY_PASSWORD, NUPAY_MERCHANT_ID
//   SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { nupayPost, merchantNumber, describeResponseCode, mapNuPayStatusGrouping, CANCEL_REASON_MERCHANT_REQUESTED } from '../_shared/nupay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MandateRow {
  id: string;
  contract_ref: string;
  nupay_mandate_id: string | null;
  status: string;
  initiated_by: string;
}

interface CancellationResponse {
  referenceNumbers?: {
    mandateRequestTranId?: string;
    clientReference?: string;
    mandate_id?: string;
    contractReference?: string;
  };
  Channel?: string;
  Status?: string;
  ResultCode?: string;
  Date?: string;
}

const CANCELLABLE_STATUSES = ['mandate_submitted', 'pending_bank', 'accepted'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mandate_id, reason } = await req.json();

    if (!mandate_id) {
      return new Response(JSON.stringify({ error: 'mandate_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

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

    if (!CANCELLABLE_STATUSES.includes(m.status)) {
      return new Response(
        JSON.stringify({ error: `Cannot cancel mandate in status: ${m.status}`, current_status: m.status }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Never submitted to NuPay — nothing to cancel upstream, just mark locally.
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
        details: { reason: reason || 'User cancelled', previous_status: m.status, nupay_submitted: false },
      });

      return new Response(
        JSON.stringify({
          success: true,
          mandate_id: m.id,
          contract_ref: m.contract_ref,
          status: 'cancelled',
          message: 'Mandate cancelled locally (not yet submitted to NuPay)',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: CancellationResponse;
    try {
      result = await nupayPost<CancellationResponse>('/mandate_cancellation', {
        cardAcceptor: merchantNumber(),
        mandateID: m.nupay_mandate_id,
        cancelTracking: 'F',
        cancelReason: CANCEL_REASON_MERCHANT_REQUESTED,
      });
    } catch (apiErr) {
      const message = apiErr instanceof Error ? apiErr.message : 'NuPay request failed';
      return new Response(
        JSON.stringify({ error: `NuPay cancellation failed: ${message}`, mandate_id: m.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resultCode = result.ResultCode || '';
    const description = describeResponseCode(resultCode);
    const responseMessage = [result.Status, description].filter(Boolean).join(' — ') || result.Status || '';
    // The cancellation webservice reuses the same Status vocabulary as
    // initiation (Accepted/Rejected/Pending Auth/Suspended/No Response) to
    // describe whether the CANCELLATION REQUEST was accepted — only a
    // "Rejected" grouping means the cancellation itself didn't go through.
    const cancelSucceeded = mapNuPayStatusGrouping(result.Status || '') !== 'rejected';

    if (!cancelSucceeded) {
      await supabase.from('audit_logs').insert({
        actor_id: m.initiated_by,
        action: 'debicheck_cancel_error',
        target_type: 'debicheck_mandate',
        target_id: m.id,
        details: { reason: reason || 'User cancelled', result_code: resultCode, response_message: responseMessage },
      });

      return new Response(
        JSON.stringify({
          success: false,
          mandate_id: m.id,
          contract_ref: m.contract_ref,
          current_status: m.status,
          error: `NuPay rejected the cancellation: ${responseMessage || resultCode}`,
          response_code: resultCode,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('debicheck_mandates').update({
      status: 'cancelled',
      nupay_response_code: resultCode || null,
      nupay_response_message: responseMessage,
      status_updated_at: new Date().toISOString(),
    }).eq('id', m.id);

    await supabase.from('audit_logs').insert({
      actor_id: m.initiated_by,
      action: 'debicheck_cancelled',
      target_type: 'debicheck_mandate',
      target_id: m.id,
      details: { reason: reason || 'User cancelled', previous_status: m.status, result_code: resultCode, response_message: responseMessage },
    });

    return new Response(
      JSON.stringify({
        success: true,
        mandate_id: m.id,
        contract_ref: m.contract_ref,
        status: 'cancelled',
        response_code: resultCode,
        response_message: responseMessage,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
