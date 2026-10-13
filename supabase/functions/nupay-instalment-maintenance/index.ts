// Supabase Edge Function: NuPay DebiCheck Instalment Maintenance
// Deploy: supabase functions deploy nupay-instalment-maintenance
//
// Implements all six methods from the real NuPay "DebiCheck Instalment
// Maintenance" webservice spec (NuPayment Integration/DebiCheck Instalment
// Maintenance_Version1.5.pdf):
//   add        → POST /add_instalment
//   maintain   → POST /instalment_maintenance
//   reschedule → POST /instalment_reschedule
//   cancel     → POST /instalment_cancellation
//   reactivate → POST /reactivate_instalment
//   recall     → POST /instalment_recall
//
// Unlike Mandate Initiation, amounts here are in CENTS and dates are plain
// YYYYMMDD (no dashes) — see _shared/nupay.ts randsToCents/toCompactDate.
//
// Required env vars: NUPAY_USERNAME, NUPAY_PASSWORD, NUPAY_MERCHANT_ID
// SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { nupayPost, merchantNumber, randsToCents, centsToRands, toCompactDate, mapInstalmentStatus, describeResponseCode } from '../_shared/nupay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'add' | 'maintain' | 'reschedule' | 'cancel' | 'reactivate' | 'recall';

interface InstalmentOpResponse {
  cardAcceptor?: string;
  mandateID?: string;
  instalment?: string;
  instalmentAmount?: string;
  trackingIndicator?: string;
  cycleDate?: string;
  submitDate?: string;
  disputable?: string;
  instalmentStatus?: string;
  responseCode?: string;
  responseDescription?: string;
}

const ENDPOINT_BY_ACTION: Record<Action, string> = {
  add: '/add_instalment',
  maintain: '/instalment_maintenance',
  reschedule: '/instalment_reschedule',
  cancel: '/instalment_cancellation',
  reactivate: '/reactivate_instalment',
  recall: '/instalment_recall',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      mandate_id,        // our internal debicheck_mandates.id
      action,            // Action
      instalment_number,
      amount,            // rands — converted to cents before sending
      tracking_days,
      submit_date,       // YYYY-MM-DD — converted to YYYYMMDD before sending
      apply_to_all,
    }: {
      mandate_id: string;
      action: Action;
      instalment_number: number;
      amount?: number;
      tracking_days?: number;
      submit_date?: string;
      apply_to_all?: boolean;
    } = body;

    if (!mandate_id || !action || instalment_number === undefined) {
      return new Response(
        JSON.stringify({ error: 'mandate_id, action and instalment_number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ENDPOINT_BY_ACTION[action]) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: mandate, error: fetchErr } = await supabase
      .from('debicheck_mandates')
      .select('id, nupay_mandate_id, initiated_by')
      .eq('id', mandate_id)
      .single();

    if (fetchErr || !mandate) {
      return new Response(JSON.stringify({ error: 'Mandate not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!mandate.nupay_mandate_id) {
      return new Response(
        JSON.stringify({ error: 'This mandate has not been submitted to NuPay yet — nothing to maintain' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the request payload — field names/shape differ slightly per
    // action per the spec (reactivate uses accessID+startDate, recall only
    // needs cardAcceptor/mandateID/instalment).
    let payload: Record<string, unknown>;
    if (action === 'recall') {
      payload = {
        cardAcceptor: merchantNumber(),
        mandateID: mandate.nupay_mandate_id,
        instalment: String(instalment_number),
      };
    } else if (action === 'reactivate') {
      payload = {
        accessID: merchantNumber(),
        mandateID: mandate.nupay_mandate_id,
        instalment: String(instalment_number),
        startDate: submit_date ? toCompactDate(submit_date) : undefined,
      };
    } else {
      payload = {
        cardAcceptor: merchantNumber(),
        mandateID: mandate.nupay_mandate_id,
        instalment: String(instalment_number),
        amount: amount !== undefined ? String(randsToCents(amount)) : undefined,
        trackingIndicator: tracking_days !== undefined ? String(tracking_days).padStart(2, '0') : undefined,
        submitDate: submit_date ? toCompactDate(submit_date) : undefined,
      };
      if (action === 'maintain' && apply_to_all !== undefined) {
        payload.applyToAll = apply_to_all;
      }
    }

    let result: InstalmentOpResponse;
    try {
      result = await nupayPost<InstalmentOpResponse>(ENDPOINT_BY_ACTION[action], payload);
    } catch (apiErr) {
      const message = apiErr instanceof Error ? apiErr.message : 'NuPay request failed';
      return new Response(
        JSON.stringify({ error: message, mandate_id, action }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const description = result.responseDescription || describeResponseCode(result.responseCode);
    const succeeded = result.responseCode === '500000' || !result.responseCode;

    // Reflect the outcome in debicheck_instalments so the admin UI and the
    // reconciliation job both see a consistent picture.
    if (succeeded && result.instalmentStatus !== undefined) {
      await supabase.from('debicheck_instalments').upsert({
        mandate_id,
        instalment_number,
        instalment_amount: result.instalmentAmount ? centsToRands(Number(result.instalmentAmount)) : amount ?? 0,
        due_date: result.cycleDate || result.submitDate || submit_date || new Date().toISOString().slice(0, 10),
        status: mapInstalmentStatus(result.instalmentStatus),
        nupay_response_code: result.responseCode || null,
        nupay_response_message: description || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'mandate_id,instalment_number' });
    }

    await supabase.from('audit_logs').insert({
      actor_id: mandate.initiated_by,
      action: `debicheck_instalment_${action}`,
      target_type: 'debicheck_mandate',
      target_id: mandate_id,
      details: { instalment_number, action, response_code: result.responseCode, response_description: description },
    });

    return new Response(
      JSON.stringify({
        success: succeeded,
        mandate_id,
        action,
        instalment_number,
        instalment_status: result.instalmentStatus ? mapInstalmentStatus(result.instalmentStatus) : undefined,
        response_code: result.responseCode,
        response_description: description,
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
