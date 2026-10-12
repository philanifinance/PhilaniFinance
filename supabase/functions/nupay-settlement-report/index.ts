// Supabase Edge Function: NuPay DebiCheck Settlement Report
// Deploy: supabase functions deploy nupay-settlement-report
//
// Implements the real NuPay "DebiCheck Settlement Report" webservice
// (see NuPayment Integration/DebiCheck Settlement Report_Version1.4.pdf).
// POST https://btm.nupay.co.za/wsDebiCheck/report/settlement_report
//
// Used by admins to retrieve settlement/invoice and dispute-reversal data.
//
// Required env vars (set via Supabase Dashboard → Edge Functions → Secrets):
//   NUPAY_USERNAME, NUPAY_PASSWORD, NUPAY_MERCHANT_ID
//   SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { nupayPost, merchantNumber } from '../_shared/nupay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toCompactDate(isoDate: string): string {
  // NuPay wants YYYYMMDD (no dashes); accept plain YYYY-MM-DD input.
  return isoDate.replace(/-/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      start_date,
      end_date,
      filter_type,  // "MID" (Mandate ID) | "CR" (Contract Reference) | "IID" (Invoice ID)
      filter_value,
    } = await req.json();

    if (!start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: 'start_date and end_date are required (format: YYYY-MM-DD)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
      return new Response(
        JSON.stringify({ error: 'Dates must be in YYYY-MM-DD format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: Record<string, unknown> = {
      merchantNumber: merchantNumber(),
      accessLvl: 'M',
      dateFrom: toCompactDate(start_date),
      dateTo: toCompactDate(end_date),
    };
    if (filter_type && filter_value) {
      body.filterType = filter_type;
      body.filterValue = filter_value;
    }

    let result: Record<string, unknown>;
    try {
      result = await nupayPost<Record<string, unknown>>('/report/settlement_report', body);
    } catch (apiErr) {
      const message = apiErr instanceof Error ? apiErr.message : 'NuPay request failed';
      return new Response(
        JSON.stringify({ error: message, date_range: { start_date, end_date } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invoiceDetails = Array.isArray(result.invoiceDetails) ? result.invoiceDetails : [];

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const metadata = {
      start_date,
      end_date,
      filter_type: filter_type || null,
      filter_value: filter_value || null,
      generated_at: new Date().toISOString(),
      record_count: invoiceDetails.length,
    };

    const { data: storedReport, error: storeErr } = await supabase
      .from('debicheck_reports')
      .insert({
        report_type: 'settlement',
        start_date,
        end_date,
        report_data: result,
        metadata,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (storeErr) {
      console.error('Failed to store settlement report:', storeErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date_range: { start_date, end_date },
        record_count: invoiceDetails.length,
        data: result,
        stored_report_id: storedReport?.id || null,
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
