// Supabase Edge Function: NuPay DebiCheck Mandate Initiation
// Deploy: supabase functions deploy nupay-initiate
//
// Implements the real NuPay "DebiCheck Mandate Initiation" webservice
// (see NuPayment Integration/DebiCheck Mandate Initiation Specification_Version3.7.pdf).
// POST https://btm.nupay.co.za/wsDebiCheck/mandate_initiation
//
// Required env vars (set via Supabase Dashboard → Edge Functions → Secrets):
//   NUPAY_USERNAME            — NuPay merchant portal username
//   NUPAY_PASSWORD            — NuPay merchant portal password
//   NUPAY_MERCHANT_ID         — Your NuPay merchant number (card acceptor)
//   SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase
//
// Note: NuPay's "auth" is a Base64("username:password") string sent as a
// field inside the JSON body — there is no bearer-token auth endpoint and
// no Terminal ID in this webservice.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  nupayPost, merchantNumber, mapAccountType, mapFrequency, deriveCollectionDay,
  formatDebtorPhone, formatZarAmount, mapNuPayStatusGrouping, describeResponseCode,
  isGatewayErrorCode, FINANCIAL_INSTITUTION_ID, UNIVERSAL_BRANCH_CODE, DEBIT_VALUE_TYPE_FIXED,
  ENTRY_CLASS_LOAN_REPAYMENT, type AppFrequency,
} from '../_shared/nupay.ts';

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
  frequency: AppFrequency;
  first_strike_date: string;
  tracking_days: number;
  client_name: string;
  client_id_number: string;
  debtor_id_type: string;
  client_mobile: string;
  client_bank: string;
  client_account_number: string;
  client_account_type: string;
  client_branch_code: string;
  status: string;
  initiated_by: string;
}

interface InitiationResponse {
  referenceNumbers?: {
    mandateRequestTranId?: string;
    clientReference?: string;
    // The spec's documented sample response shape uses "mandateID", but
    // live error responses have been observed returning "mandate_id"
    // instead — accept either.
    mandateID?: string;
    mandate_id?: string;
    contractReference?: string;
  };
  Channel?: string;
  Status?: string;
  ResultCode?: string;
  Date?: string;
}

// A gateway error can still return a referenceNumbers block with a "0"
// placeholder mandate_id — that's not a real NuPay mandate and must never
// be persisted as one (status/cancellation lookups against it would fail).
function extractMandateId(refs: NonNullable<InitiationResponse['referenceNumbers']> | undefined): string | null {
  const raw = refs?.mandateID || refs?.mandate_id || '';
  return raw && raw !== '0' ? raw : null;
}

Deno.serve(async (req) => {
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

    if (!['draft', 'error'].includes(m.status)) {
      return new Response(JSON.stringify({ error: `Mandate already in status: ${m.status}` }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bankId = FINANCIAL_INSTITUTION_ID[m.client_bank];
    if (!bankId) {
      const message = `"${m.client_bank}" is not a DebiCheck-participating bank per NuPay's Financial Institution ID list.`;
      await supabase.from('debicheck_mandates').update({
        status: 'error',
        error_details: message,
        status_updated_at: new Date().toISOString(),
      }).eq('id', m.id);
      return new Response(JSON.stringify({ error: message }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nuPayFrequency = mapFrequency(m.frequency);
    const collectionDay = deriveCollectionDay(nuPayFrequency, m.first_strike_date);
    const isRealTime = m.debicheck_type === 'TT1';

    const payload = {
      cardAcceptor: merchantNumber(),
      frequency: nuPayFrequency,
      collectionDay,
      clientReference: m.contract_ref,
      debtorName: m.client_name,
      debtorIdType: m.debtor_id_type || '2',
      debtorId: m.client_id_number,
      debtorAccountNumber: m.client_account_number,
      debtorAccountType: mapAccountType(m.client_account_type),
      debtorBankId: bankId,
      debtorBranchNumber: m.client_branch_code || UNIVERSAL_BRANCH_CODE[m.client_bank] || '',
      debtorPhoneNumber: formatDebtorPhone(m.client_mobile),
      debtorAuthenticationRequired: isRealTime ? '0230' : '0227',
      firstCollectionAmount: formatZarAmount(m.instalment_amount),
      firstCollectionDate: m.first_strike_date,
      instalmentAmount: formatZarAmount(m.instalment_amount),
      maxCollectionAmount: formatZarAmount(m.instalment_amount),
      adjustmentCategory: 'N',
      startDate: m.first_strike_date,
      dateAdjustmentRule: 'Y',
      debitValueTypeId: DEBIT_VALUE_TYPE_FIXED,
      instalments: String(m.num_instalments),
      trackingIndicator: String(m.tracking_days).padStart(2, '0'),
      authenticationType: isRealTime ? 'REAL TIME' : 'BATCH',
      entryClass: ENTRY_CLASS_LOAN_REPAYMENT,
    };

    let result: InitiationResponse;
    try {
      result = await nupayPost<InitiationResponse>('/mandate_initiation', payload);
    } catch (apiErr) {
      const message = apiErr instanceof Error ? apiErr.message : 'NuPay request failed';
      await supabase.from('debicheck_mandates').update({
        status: 'error',
        error_details: message,
        status_updated_at: new Date().toISOString(),
      }).eq('id', m.id);

      await supabase.from('audit_logs').insert({
        actor_id: m.initiated_by,
        action: 'debicheck_api_error',
        target_type: 'debicheck_mandate',
        target_id: m.id,
        details: { error: message },
      });

      const { data: updated } = await supabase.from('debicheck_mandates').select('*').eq('id', m.id).single();
      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const refs = result.referenceNumbers || {};
    const mandateId = extractMandateId(refs);
    const gatewayError = isGatewayErrorCode(result.ResultCode);
    const internalStatus = gatewayError ? 'error' : mapNuPayStatusGrouping(result.Status || '');
    const responseMessage = [result.Status, describeResponseCode(result.ResultCode)]
      .filter(Boolean)
      .join(' — ') || result.Status || '';
    // 500xxx gateway errors ("Invalid Inputs" etc.) rarely explain which
    // field was wrong — keep the full raw response so it's inspectable
    // without needing to dig through edge function logs.
    const errorDetails = gatewayError
      ? `NuPay rejected the request (${result.ResultCode}): ${responseMessage}. Raw response: ${JSON.stringify(result)}`
      : null;

    await supabase.from('debicheck_mandates').update({
      status: internalStatus,
      nupay_mandate_id: mandateId,
      nupay_contract_reference: refs.contractReference || null,
      nupay_mandate_request_tran_id: refs.mandateRequestTranId || null,
      nupay_response_code: result.ResultCode || null,
      nupay_response_message: responseMessage,
      error_details: errorDetails,
      status_updated_at: new Date().toISOString(),
    }).eq('id', m.id);

    await supabase.from('audit_logs').insert({
      actor_id: m.initiated_by,
      action: 'debicheck_initiated',
      target_type: 'debicheck_mandate',
      target_id: m.id,
      details: {
        contract_ref: m.contract_ref,
        nupay_mandate_id: mandateId,
        nupay_status: result.Status,
        result_code: result.ResultCode,
        debicheck_type: m.debicheck_type,
        amount: m.instalment_amount,
        request_payload: payload,
        raw_response: result,
      },
    });

    const { data: updated } = await supabase.from('debicheck_mandates').select('*').eq('id', m.id).single();
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
