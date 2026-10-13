// Supabase Edge Function: NuPay DebiCheck Instalment Reconciliation (cron)
// Deploy: supabase functions deploy nupay-reconcile-instalments --no-verify-jwt
//
// Scheduled directly via pg_cron + pg_net (already set up in this project —
// see migration 015). Deployed with --no-verify-jwt so pg_net's http_post
// can call it with no Authorization header at all: there is no Postgres
// setting that holds the service_role key by default, and this avoids
// needing to paste the real secret into a SQL migration to fake one.
//   SELECT cron.schedule(
//     'nupay-reconcile-instalments',
//     '0 6 * * *',  -- Daily at 06:00 UTC
//     $$
//     SELECT net.http_post(
//       url := '<your-project-url>/functions/v1/nupay-reconcile-instalments',
//       headers := jsonb_build_object('Content-Type', 'application/json'),
//       body := '{}'::jsonb
//     );
//     $$
//   );
//
// Why this exists: `debicheck_instalments` (planned/actual per-instalment
// outcomes) and the `debicheck_mandates.total_collected`/`collections_count`/
// etc. aggregate columns existed in the schema with nothing populating them
// — there was no automated way to see whether a repayment was actually
// collected after disbursement. This pulls NuPay's "All Instalments"
// report (type 06) for a rolling window, matches each row back to a local
// mandate via its NuPay mandate ID, and upserts the result.
//
// Required env vars: NUPAY_USERNAME, NUPAY_PASSWORD, NUPAY_MERCHANT_ID
// SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { nupayPost, merchantNumber, toCompactDate, mapInstalmentReportStatus } from '../_shared/nupay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// How far back (by instalment create date, per report type 06) to pull on
// each run. Wide enough to catch instalments on longer-term mandates
// without re-pulling the merchant's entire history every day.
const LOOKBACK_DAYS = 90;
const MAX_BLOCKS = 25; // safety cap on pagination per run

interface InstalmentReportHeader {
  tokenID?: string;
  blockID?: string;
}

interface InstalmentReportRow {
  mandateId?: string;
  mandateID?: string;
  instalment?: string;
  instalmentAmount?: string;
  status?: string;
  statusCode?: string;
  statusDescription?: string;
  actionDate?: string;
  cycleDate?: string;
  dateCreated?: string;
}

interface InstalmentReportResponse {
  instalmentReport?: InstalmentReportHeader;
  reportDetails?: InstalmentReportRow[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const end = new Date();
    const start = new Date(end.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const dateFrom = toCompactDate(start.toISOString().slice(0, 10));
    const dateTo = toCompactDate(end.toISOString().slice(0, 10));

    // Fetch every mandate we could possibly match a report row against —
    // keyed by NuPay's own mandate ID, since that's what report rows carry.
    const { data: mandates, error: mandatesErr } = await supabase
      .from('debicheck_mandates')
      .select('id, nupay_mandate_id, initiated_by')
      .not('nupay_mandate_id', 'is', null);

    if (mandatesErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to load mandates', details: mandatesErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mandateByNuPayId = new Map((mandates || []).map(m => [m.nupay_mandate_id as string, m]));

    let tokenId = '0';
    let blockId = '0';
    let blocksFetched = 0;
    let rowsSeen = 0;
    let rowsMatched = 0;
    const touchedMandateIds = new Set<string>();
    const errors: string[] = [];

    while (blocksFetched < MAX_BLOCKS) {
      let result: InstalmentReportResponse;
      try {
        result = await nupayPost<InstalmentReportResponse>('/report/instalment_report', {
          merchantNumber: merchantNumber(),
          accessLvl: 'M',
          username: Deno.env.get('NUPAY_USERNAME') || '',
          reportType: '06', // All Instalments
          dateFrom,
          dateTo,
          tokenID: tokenId,
          blockID: blockId,
        });
      } catch (apiErr) {
        errors.push(apiErr instanceof Error ? apiErr.message : 'NuPay request failed');
        break;
      }

      blocksFetched++;
      const rows = result.reportDetails || [];
      rowsSeen += rows.length;

      for (const row of rows) {
        const nuPayMandateId = row.mandateId || row.mandateID;
        const localMandate = nuPayMandateId ? mandateByNuPayId.get(nuPayMandateId) : undefined;
        if (!localMandate) continue;

        const instalmentNumber = parseInt(row.instalment || '0', 10);
        if (!instalmentNumber && instalmentNumber !== 0) continue;

        const dueDate = row.actionDate || row.cycleDate || row.dateCreated;
        // Confirmed against a live response: unlike the Instalment
        // Maintenance webservice, this report's instalmentAmount is already
        // a decimal rand string (e.g. "10.00"), not cents.
        const amountRands = row.instalmentAmount ? Math.round(Number(row.instalmentAmount)) : 0;
        const status = mapInstalmentReportStatus(row.status);
        await supabase.from('debicheck_instalments').upsert({
          mandate_id: localMandate.id,
          instalment_number: instalmentNumber,
          instalment_amount: amountRands,
          due_date: dueDate ? normalizeDate(dueDate) : new Date().toISOString().slice(0, 10),
          status,
          collected_date: status === 'collected' && dueDate ? normalizeDate(dueDate) : null,
          collected_amount: status === 'collected' ? amountRands : null,
          nupay_response_code: row.statusCode || null,
          nupay_response_message: row.statusDescription || row.status || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'mandate_id,instalment_number' });

        touchedMandateIds.add(localMandate.id);
        rowsMatched++;
      }

      const header = result.instalmentReport;
      tokenId = header?.tokenID || tokenId;
      const nextBlock = parseInt(header?.blockID || '0', 10) - 1;
      if (!rows.length || !header?.tokenID || nextBlock < 1) break;
      blockId = String(nextBlock);
    }

    // Recompute each touched mandate's aggregate collection fields from
    // what's now stored locally, rather than trusting running totals NuPay
    // doesn't actually expose per-mandate.
    for (const mandateId of touchedMandateIds) {
      const { data: instalments } = await supabase
        .from('debicheck_instalments')
        .select('status, collected_amount, collected_date, due_date')
        .eq('mandate_id', mandateId);

      if (!instalments) continue;

      const collected = instalments.filter(i => i.status === 'collected');
      const failed = instalments.filter(i => i.status === 'failed');
      const upcoming = instalments
        .filter(i => i.status === 'pending' && i.due_date)
        .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
      const lastCollected = collected
        .filter(i => i.collected_date)
        .sort((a, b) => (a.collected_date! > b.collected_date! ? -1 : 1))[0];

      await supabase.from('debicheck_mandates').update({
        total_collected: collected.reduce((sum, i) => sum + (i.collected_amount || 0), 0),
        total_failed: failed.length,
        collections_count: collected.length,
        last_collection_date: lastCollected?.collected_date || null,
        next_collection_date: upcoming[0]?.due_date || null,
      }).eq('id', mandateId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date_range: { from: dateFrom, to: dateTo },
        blocks_fetched: blocksFetched,
        rows_seen: rowsSeen,
        rows_matched: rowsMatched,
        mandates_updated: touchedMandateIds.size,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Report dates can come back as YYYYMMDD or YYYY-MM-DD depending on field;
// normalize to YYYY-MM-DD for our `date` columns.
function normalizeDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return value;
}
