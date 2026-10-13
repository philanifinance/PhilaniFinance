// Supabase Edge Function: NuPay DebiCheck Mandate & Instalment Reporting
// Deploy: supabase functions deploy nupay-reports
//
// Implements the real NuPay "DebiCheck Mandate and Instalment Reporting"
// webservice (NuPayment Integration/DebiCheck Mandate and Instalment
// Reporting_Version2.6.pdf):
//   mandate    → POST /report/mandate_report
//   instalment → POST /report/instalment_report
//
// Reports are paginated in blocks of up to 1000 records via tokenID/blockID
// — pass "0" for both on a new report, then the returned tokenID/blockID to
// fetch the next block of the same report.
//
// Required env vars: NUPAY_USERNAME, NUPAY_PASSWORD, NUPAY_MERCHANT_ID
// SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase

import { nupayPost, merchantNumber, toCompactDate } from '../_shared/nupay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReportKind = 'mandate' | 'instalment';

const ENDPOINT: Record<ReportKind, string> = {
  mandate: '/report/mandate_report',
  instalment: '/report/instalment_report',
};

// Mandate report types (01-07) and instalment report types (01-07) share
// the same numeric range but mean different things per kind — see spec §4.
const VALID_REPORT_TYPES = ['01', '02', '03', '04', '05', '06', '07'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      report_kind,       // 'mandate' | 'instalment'
      report_type,       // '01'-'07', meaning depends on report_kind (see spec §4)
      start_date,        // YYYY-MM-DD
      end_date,          // YYYY-MM-DD
      filter_type,       // 'MID' | 'CR' | 'ID' (mandate report only)
      filter_value,
      token_id = '0',    // '0' for a new report, else continue a prior one
      block_id = '0',
    }: {
      report_kind: ReportKind;
      report_type: string;
      start_date: string;
      end_date: string;
      filter_type?: string;
      filter_value?: string;
      token_id?: string;
      block_id?: string;
    } = await req.json();

    if (!report_kind || !ENDPOINT[report_kind]) {
      return new Response(JSON.stringify({ error: 'report_kind must be "mandate" or "instalment"' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!report_type || !VALID_REPORT_TYPES.includes(report_type)) {
      return new Response(JSON.stringify({ error: 'report_type must be one of 01-07' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'start_date and end_date are required (YYYY-MM-DD)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: Record<string, unknown> = {
      merchantNumber: merchantNumber(),
      accessLvl: 'M',
      username: Deno.env.get('NUPAY_USERNAME') || '',
      reportType: report_type,
      dateFrom: toCompactDate(start_date),
      dateTo: toCompactDate(end_date),
      tokenID: token_id,
      blockID: block_id,
    };
    if (filter_type && filter_value) {
      payload.filterType = filter_type;
      payload.filterValue = filter_value;
    }

    let result: Record<string, unknown>;
    try {
      result = await nupayPost<Record<string, unknown>>(ENDPOINT[report_kind], payload);
    } catch (apiErr) {
      const message = apiErr instanceof Error ? apiErr.message : 'NuPay request failed';
      return new Response(
        JSON.stringify({ error: message, report_kind, report_type, date_range: { start_date, end_date } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reportDetails = Array.isArray(result.reportDetails) ? result.reportDetails : [];

    return new Response(
      JSON.stringify({
        success: true,
        report_kind,
        report_type,
        date_range: { start_date, end_date },
        record_count: reportDetails.length,
        data: result,
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
