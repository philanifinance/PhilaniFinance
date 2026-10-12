// Supabase Edge Function: NuPay DebiCheck Status Poll (cron)
// Deploy: supabase functions deploy nupay-status-poll
//
// Schedule via Supabase Dashboard → Database → Cron Jobs:
//   SELECT cron.schedule(
//     'nupay-status-poll',
//     '*/15 * * * *',  -- Every 15 minutes
//     $$
//     SELECT net.http_post(
//       url := '<your-project-url>/functions/v1/nupay-status-poll',
//       headers := jsonb_build_object(
//         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
//         'Content-Type', 'application/json'
//       ),
//       body := '{}'::jsonb
//     );
//     $$
//   );
//
// Why this exists: none of the NuPay DebiCheck webservices (see the specs in
// the "NuPayment Integration" folder) offer a webhook/push notification for
// status changes — every one of them is a synchronous request/response call
// that the merchant initiates. The only way to learn that a debtor has
// authenticated (or rejected) a mandate is to poll the Mandate Status
// webservice. This job does that for every mandate still awaiting an
// outcome, so status updates don't depend on someone clicking "Refresh".
//
// Required env vars: NUPAY_USERNAME, NUPAY_PASSWORD, NUPAY_MERCHANT_ID,
// SUPABASE_SERVICE_ROLE_KEY (auto-injected).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { nupayPost, merchantNumber, mapNuPayStatusGrouping, describeResponseCode } from '../_shared/nupay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MandateRow {
  id: string;
  nupay_mandate_id: string | null;
  nupay_contract_reference: string | null;
  nupay_mandate_request_tran_id: string | null;
  contract_ref: string;
  status: string;
  initiated_by: string;
}

interface StatusResponse {
  mandate_request_tran_id?: string;
  status_reason_code?: string;
  mandate_status?: string;
  mandateStatusGrouping?: string;
}

const AWAITING_OUTCOME_STATUSES = ['mandate_submitted', 'pending_bank'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: mandates, error: queryErr } = await supabase
      .from('debicheck_mandates')
      .select('id, nupay_mandate_id, nupay_contract_reference, nupay_mandate_request_tran_id, contract_ref, status, initiated_by')
      .in('status', AWAITING_OUTCOME_STATUSES)
      .not('nupay_mandate_id', 'is', null);

    if (queryErr) {
      return new Response(
        JSON.stringify({ error: 'Query failed', details: queryErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let checked = 0;
    let updated = 0;
    const errors: Array<{ mandate_id: string; error: string }> = [];

    for (const mandate of (mandates || []) as MandateRow[]) {
      checked++;
      try {
        const result = await nupayPost<StatusResponse>('/mandate_status', {
          access_id: merchantNumber(),
          access_lvl: 'M',
          search_type: 'mandate_id',
          search_ref: mandate.nupay_mandate_id,
        });

        const nuPayStatus = result.mandate_status || '';
        const internalStatus = mapNuPayStatusGrouping(nuPayStatus, result.mandateStatusGrouping);

        if (internalStatus !== mandate.status) {
          const description = describeResponseCode(result.status_reason_code);
          await supabase.from('debicheck_mandates').update({
            status: internalStatus,
            nupay_response_code: result.status_reason_code || null,
            nupay_response_message: [nuPayStatus, description].filter(Boolean).join(' — ') || nuPayStatus,
            nupay_status_reason_code: result.status_reason_code || null,
            status_updated_at: new Date().toISOString(),
          }).eq('id', mandate.id);

          await supabase.from('audit_logs').insert({
            actor_id: mandate.initiated_by,
            action: 'debicheck_status_sync',
            target_type: 'debicheck_mandate',
            target_id: mandate.id,
            details: {
              previous_status: mandate.status,
              new_status: internalStatus,
              nupay_status: nuPayStatus,
              status_reason_code: result.status_reason_code,
              source: 'scheduled_poll',
            },
          });

          updated++;
        }
      } catch (err) {
        errors.push({ mandate_id: mandate.id, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked, updated, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
