// Supabase Edge Function: NuPay DebiCheck Mandate Status Check
// Deploy: supabase functions deploy nupay-mandate-status
//
// Implements the real NuPay "DebiCheck Mandate Status" webservice
// (see NuPayment Integration/DebiCheck Mandate Status Specification_Version1.5.pdf).
// POST https://btm.nupay.co.za/wsDebiCheck/mandate_status
//
// NuPay has no push/webhook notification for mandate status changes — this
// is the only way to find out whether a debtor has authenticated a mandate,
// so it is called both on-demand (client/admin "Refresh" button) and on a
// schedule (see nupay-status-poll).
//
// Required env vars (set via Supabase Dashboard → Edge Functions → Secrets):
//   NUPAY_USERNAME, NUPAY_PASSWORD, NUPAY_MERCHANT_ID
//   SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { nupayPost, merchantNumber, mapNuPayStatusGrouping, describeResponseCode, isGatewayErrorCode } from '../_shared/nupay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MandateRow {
  id: string;
  contract_ref: string;
  nupay_mandate_id: string | null;
  nupay_contract_reference: string | null;
  nupay_mandate_request_tran_id: string | null;
  status: string;
  initiated_by: string;
}

interface StatusResponse {
  mandate_id?: string;
  contract_reference?: string;
  mandate_request_tran_id?: string;
  mandate_reference_number?: string;
  status_reason_code?: string;
  mandate_status?: string;
  mandateStatusGrouping?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mandate_id, contract_ref } = await req.json();

    if (!mandate_id && !contract_ref) {
      return new Response(
        JSON.stringify({ error: 'Either mandate_id or contract_ref is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    let query = supabase.from('debicheck_mandates').select('*');
    query = mandate_id ? query.eq('id', mandate_id) : query.eq('contract_ref', contract_ref);
    const { data: mandate, error: fetchErr } = await query.single();

    if (fetchErr || !mandate) {
      return new Response(
        JSON.stringify({ error: 'Mandate not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const m = mandate as MandateRow;

    if (!m.nupay_mandate_id || ['draft', 'error'].includes(m.status)) {
      return new Response(
        JSON.stringify({
          mandate_id: m.id,
          contract_ref: m.contract_ref,
          status: m.status,
          message: 'Mandate not yet submitted to NuPay',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prefer searching by NuPay's own mandate_id; fall back to our contract ref.
    const searchType = m.nupay_mandate_id ? 'mandate_id' : 'contract_ref';
    const searchRef = m.nupay_mandate_id || m.nupay_contract_reference || m.contract_ref;

    let result: StatusResponse;
    try {
      result = await nupayPost<StatusResponse>('/mandate_status', {
        access_id: merchantNumber(),
        access_lvl: 'M',
        search_type: searchType,
        search_ref: searchRef,
      });
    } catch (apiErr) {
      const message = apiErr instanceof Error ? apiErr.message : 'NuPay request failed';
      return new Response(
        JSON.stringify({ error: message, mandate_id: m.id, contract_ref: m.contract_ref }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nuPayStatus = result.mandate_status || '';
    const reasonDescription = describeResponseCode(result.status_reason_code);
    const responseMessage = [nuPayStatus, reasonDescription].filter(Boolean).join(' — ') || nuPayStatus;

    // A gateway error here (e.g. the lookup itself failed) carries no
    // mandate_status at all — don't let an empty status silently flip the
    // mandate back toward "pending_bank"; just report the lookup failure.
    if (isGatewayErrorCode(result.status_reason_code) && !nuPayStatus) {
      return new Response(
        JSON.stringify({
          mandate_id: m.id,
          contract_ref: m.contract_ref,
          status: m.status,
          error: `NuPay status lookup failed: ${responseMessage || result.status_reason_code}`,
          synced: false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const internalStatus = mapNuPayStatusGrouping(nuPayStatus, result.mandateStatusGrouping);

    if (internalStatus !== m.status || result.status_reason_code) {
      await supabase.from('debicheck_mandates').update({
        status: internalStatus,
        nupay_response_code: result.status_reason_code || null,
        nupay_response_message: responseMessage,
        nupay_status_reason_code: result.status_reason_code || null,
        nupay_mandate_request_tran_id: result.mandate_request_tran_id || m.nupay_mandate_request_tran_id,
        status_updated_at: new Date().toISOString(),
      }).eq('id', m.id);

      if (internalStatus !== m.status) {
        await supabase.from('audit_logs').insert({
          actor_id: m.initiated_by,
          action: 'debicheck_status_sync',
          target_type: 'debicheck_mandate',
          target_id: m.id,
          details: {
            previous_status: m.status,
            new_status: internalStatus,
            nupay_status: nuPayStatus,
            status_reason_code: result.status_reason_code,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        mandate_id: m.id,
        contract_ref: m.contract_ref,
        status: internalStatus,
        nupay_mandate_id: m.nupay_mandate_id,
        nupay_status: nuPayStatus,
        status_reason_code: result.status_reason_code,
        response_message: responseMessage,
        synced: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
