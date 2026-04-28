// Supabase Edge Function: Ozow Data API — Bank Statement Retrieval
// Deploy: supabase functions deploy ozow-bank-link
//
// Required env vars (set via Supabase Dashboard → Edge Functions → Secrets):
//   OZOW_API_URL        — e.g. https://api.ozow.com/v1
//   OZOW_API_KEY        — Your Ozow API key
//   OZOW_SITE_CODE      — Your Ozow site code
//   SUPABASE_SERVICE_ROLE_KEY — Auto-injected

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Actions ───────────────────────────────────────────────────────────
// 1. "init"   → Generate an Ozow PIN session URL for the client
// 2. "status" → Check if auth completed, then fetch 90-day transactions

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action as string;
    const userId = body.user_id as string;
    const applicationId = body.application_id as string | undefined;

    if (!action || !userId) {
      return new Response(JSON.stringify({ error: 'action and user_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const ozowApiUrl = Deno.env.get('OZOW_API_URL') || 'https://api.ozow.com/v1';
    const ozowApiKey = Deno.env.get('OZOW_API_KEY') || '';
    const ozowSiteCode = Deno.env.get('OZOW_SITE_CODE') || '';

    if (action === 'init') {
      // ── Initialize Ozow PIN session ──────────────────────────────
      const initResponse = await fetch(`${ozowApiUrl}/data/session/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ApiKey': ozowApiKey,
        },
        body: JSON.stringify({
          SiteCode: ozowSiteCode,
          CountryCode: 'ZA',
          NotifyUrl: `${supabaseUrl}/functions/v1/ozow-bank-link`,
          SuccessUrl: body.success_url || '',
          ErrorUrl: body.error_url || '',
          CancelUrl: body.cancel_url || '',
          // 90 days of transactions
          TransactionDays: 90,
        }),
      });

      if (!initResponse.ok) {
        const errText = await initResponse.text();
        console.error('Ozow init failed:', errText);
        return new Response(JSON.stringify({ error: `Ozow session init failed: ${errText}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const initData = await initResponse.json();
      const transactionId = initData.TransactionId || initData.transactionId || '';
      const redirectUrl = initData.Url || initData.url || '';

      // Save a pending record
      const { data: link, error: insertErr } = await supabase
        .from('ozow_bank_links')
        .insert({
          user_id: userId,
          application_id: applicationId || null,
          ozow_transaction_id: transactionId,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('DB insert error:', insertErr.message);
      }

      return new Response(JSON.stringify({
        redirect_url: redirectUrl,
        transaction_id: transactionId,
        link_id: link?.id || null,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'fetch') {
      // ── Fetch transaction data after client authenticated ────────
      const transactionId = body.transaction_id as string;
      if (!transactionId) {
        return new Response(JSON.stringify({ error: 'transaction_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update status to fetching
      await supabase.from('ozow_bank_links')
        .update({ status: 'fetching', updated_at: new Date().toISOString() })
        .eq('ozow_transaction_id', transactionId);

      // Fetch transactions from Ozow
      const txnResponse = await fetch(`${ozowApiUrl}/data/transactions/${transactionId}`, {
        method: 'GET',
        headers: { 'ApiKey': ozowApiKey },
      });

      if (!txnResponse.ok) {
        const errText = await txnResponse.text();
        await supabase.from('ozow_bank_links')
          .update({ status: 'error', error_details: errText, updated_at: new Date().toISOString() })
          .eq('ozow_transaction_id', transactionId);

        return new Response(JSON.stringify({ error: `Failed to fetch transactions: ${errText}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const txnData = await txnResponse.json();
      const transactions = txnData.Transactions || txnData.transactions || [];
      const bankInfo = txnData.BankAccount || txnData.bankAccount || {};

      // Store the JSON data in Supabase storage
      const storagePath = `${userId}/ozow_${transactionId}.json`;
      await supabase.storage
        .from('loan_documents')
        .upload(storagePath, JSON.stringify(txnData), {
          contentType: 'application/json',
          upsert: true,
        });

      // Calculate date range
      let dateStart: string | null = null;
      let dateEnd: string | null = null;
      if (transactions.length > 0) {
        const dates = transactions
          .map((t: { Date?: string; date?: string }) => t.Date || t.date || '')
          .filter(Boolean)
          .sort();
        dateStart = dates[0] || null;
        dateEnd = dates[dates.length - 1] || null;
      }

      // Update the link record
      await supabase.from('ozow_bank_links')
        .update({
          status: 'complete',
          bank_name: bankInfo.BankName || bankInfo.bankName || '',
          account_holder: bankInfo.AccountHolder || bankInfo.accountHolder || '',
          account_number_masked: bankInfo.AccountNumber || bankInfo.accountNumber || '',
          transactions_count: transactions.length,
          date_range_start: dateStart,
          date_range_end: dateEnd,
          raw_data_path: storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq('ozow_transaction_id', transactionId);

      // Also insert an application_documents record so it appears in Document Vault
      if (applicationId) {
        await supabase.from('application_documents').insert({
          application_id: applicationId,
          user_id: userId,
          category: 'bank_statement',
          file_name: `Ozow Bank Statement (${transactions.length} transactions)`,
          storage_path: storagePath,
          file_size: JSON.stringify(txnData).length,
          mime_type: 'application/json',
        });
      }

      return new Response(JSON.stringify({
        status: 'complete',
        transactions_count: transactions.length,
        bank_name: bankInfo.BankName || bankInfo.bankName || '',
        date_range: { start: dateStart, end: dateEnd },
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Handle Ozow webhook callback (NotifyUrl) ────────────────────
    if (action === 'callback' || body.TransactionId) {
      const transactionId = body.TransactionId || body.transactionId || '';
      const ozowStatus = body.Status || body.status || '';

      if (ozowStatus === 'Complete' || ozowStatus === 'complete') {
        await supabase.from('ozow_bank_links')
          .update({ status: 'authenticated', updated_at: new Date().toISOString() })
          .eq('ozow_transaction_id', transactionId);
      } else if (ozowStatus === 'Error' || ozowStatus === 'Cancelled') {
        await supabase.from('ozow_bank_links')
          .update({
            status: 'error',
            error_details: `Ozow status: ${ozowStatus}`,
            updated_at: new Date().toISOString(),
          })
          .eq('ozow_transaction_id', transactionId);
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Ozow function error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
