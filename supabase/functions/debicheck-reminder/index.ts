// Supabase Edge Function: DebiCheck Reminder Cron
// Deploy: npx supabase functions deploy debicheck-reminder
//
// Schedule via Supabase Dashboard → Database → Cron Jobs:
//   SELECT cron.schedule(
//     'debicheck-reminder',
//     '*/30 * * * *',  -- Every 30 minutes
//     $$
//     SELECT net.http_post(
//       url := 'https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/debicheck-reminder',
//       headers := jsonb_build_object(
//         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
//         'Content-Type', 'application/json'
//       ),
//       body := '{}'::jsonb
//     );
//     $$
//   );
//
// This function checks for DebiCheck mandates that have been in 'sent' status
// for more than 2 hours without a reminder, then triggers reminder notifications.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find mandates that are 'sent' status and older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: pendingMandates, error: queryErr } = await supabase
      .from('debicheck_mandates')
      .select(`
        id, application_id, user_id, client_name, client_mobile,
        client_bank, instalment_amount, contract_ref, created_at,
        status
      `)
      .eq('status', 'sent')
      .lt('created_at', twoHoursAgo);

    if (queryErr) {
      return new Response(
        JSON.stringify({ error: 'Query failed', details: queryErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingMandates || pendingMandates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending mandates need reminders', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let remindersSent = 0;

    for (const mandate of pendingMandates) {
      // Check if we already sent a reminder for this mandate
      const { data: existingReminder } = await supabase
        .from('communication_log')
        .select('id')
        .eq('application_id', mandate.application_id)
        .eq('trigger_event', 'debicheck_reminder')
        .limit(1)
        .maybeSingle();

      if (existingReminder) continue; // Already reminded

      // Fetch the application for email
      const { data: app } = await supabase
        .from('loan_applications')
        .select('email, first_name, last_name, total_repayable, bank_name')
        .eq('id', mandate.application_id)
        .single();

      if (!app) continue;

      // Call send-notification to dispatch reminder
      const notificationPayload = {
        trigger_event: 'debicheck_reminder',
        application_id: mandate.application_id,
        first_name: app.first_name,
        last_name: app.last_name,
        email: app.email,
        mobile_number: mandate.client_mobile,
        total_repayable: app.total_repayable,
        instalment_amount: mandate.instalment_amount,
        contract_ref: mandate.contract_ref,
        bank_name: app.bank_name || mandate.client_bank,
      };

      // Call the send-notification function internally
      const fnUrl = `${supabaseUrl}/functions/v1/send-notification`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
      });

      if (res.ok) {
        remindersSent++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${pendingMandates.length} pending mandates, sent ${remindersSent} reminders`,
        count: remindersSent,
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
