// Supabase Edge Function: NuPay DebiCheck Settlement & Collection Report
// Deploy: supabase functions deploy nupay-settlement-report
//
// This function retrieves settlement and collection reports from NuPay.
// Used by admins to track collections, settlements, and payment status.
//
// Required env vars (set via Supabase Dashboard → Edge Functions → Secrets):
//   NUPAY_API_URL       — e.g. https://api.nupay.co.za/v1
//   NUPAY_MERCHANT_ID   — Your NuPay Merchant ID
//   NUPAY_TERMINAL_ID   — Your NuPay Terminal ID
//   NUPAY_API_KEY       — Your NuPay API secret/key for JWT generation
//   SUPABASE_SERVICE_ROLE_KEY — Auto-injected by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── NuPay JWT Authentication ──────────────────────────────────────────
async function getNuPayToken(): Promise<string> {
  const merchantId = Deno.env.get('NUPAY_MERCHANT_ID') || '';
  const terminalId = Deno.env.get('NUPAY_TERMINAL_ID') || '';
  const apiKey = Deno.env.get('NUPAY_API_KEY') || '';
  const apiUrl = Deno.env.get('NUPAY_API_URL') || 'https://api.nupay.co.za/v1';

  const authResponse = await fetch(`${apiUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      MerchantID: merchantId,
      TerminalID: terminalId,
      APIKey: apiKey,
    }),
  });

  if (!authResponse.ok) {
    const errText = await authResponse.text();
    throw new Error(`NuPay auth failed (${authResponse.status}): ${errText}`);
  }

  const authData = await authResponse.json();
  return authData.Token || authData.token || '';
}

// ── Main handler ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      report_type = 'settlement', // 'settlement' or 'collection'
      start_date,
      end_date,
      contract_ref,
      mandate_id,
    } = await req.json();

    // Validate inputs
    if (!start_date || !end_date) {
      return new Response(
        JSON.stringify({
          error: 'start_date and end_date are required (format: YYYY-MM-DD)',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
      return new Response(
        JSON.stringify({
          error: 'Dates must be in YYYY-MM-DD format',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Authenticate with NuPay
    const token = await getNuPayToken();
    const apiUrl = Deno.env.get('NUPAY_API_URL') || 'https://api.nupay.co.za/v1';

    // 2. Build query parameters
    const params = new URLSearchParams();
    params.append('StartDate', start_date);
    params.append('EndDate', end_date);
    if (contract_ref) params.append('ContractRef', contract_ref);
    if (mandate_id) params.append('MandateID', mandate_id);

    // 3. Determine endpoint based on report type
    let endpoint = 'settlement';
    if (report_type === 'collection') {
      endpoint = 'collection';
    } else if (report_type === 'instalment') {
      endpoint = 'instalment';
    }

    const reportUrl = `${apiUrl}/debicheck/${endpoint}/report?${params.toString()}`;

    // 4. Fetch report from NuPay
    const nuPayResponse = await fetch(reportUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const nuPayResult = await nuPayResponse.json();

    if (!nuPayResponse.ok) {
      const errorMsg = nuPayResult.Message || nuPayResult.message || JSON.stringify(nuPayResult);
      const responseCode = nuPayResult.ResponseCode || nuPayResult.responseCode || String(nuPayResponse.status);

      return new Response(
        JSON.stringify({
          error: `NuPay API error: ${errorMsg}`,
          response_code: responseCode,
          report_type,
          date_range: { start_date, end_date },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Process and store report data
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // Extract report data (structure depends on NuPay response format)
    const reportData = nuPayResult.Data || nuPayResult.data || nuPayResult.Report || [];
    const reportMetadata = {
      report_type,
      start_date,
      end_date,
      generated_at: new Date().toISOString(),
      record_count: Array.isArray(reportData) ? reportData.length : 0,
      response_code: nuPayResult.ResponseCode || nuPayResult.responseCode || '00',
    };

    // 6. Store report in database for audit trail
    const { data: storedReport, error: storeErr } = await supabase
      .from('debicheck_reports')
      .insert({
        report_type,
        start_date,
        end_date,
        report_data: reportData,
        metadata: reportMetadata,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (storeErr) {
      console.error('Failed to store report:', storeErr.message);
      // Don't fail the request, still return the data
    }

    // 7. Return report data
    return new Response(
      JSON.stringify({
        success: true,
        report_type,
        date_range: { start_date, end_date },
        record_count: Array.isArray(reportData) ? reportData.length : 0,
        data: reportData,
        metadata: reportMetadata,
        stored_report_id: storedReport?.id || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
