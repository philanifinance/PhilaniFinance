// Supabase Edge Function: Multi-Channel Notification Service (Email + SMS)
// Deploy: npx supabase functions deploy send-notification
//
// Required env vars (set via Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY       — Resend.com API key for transactional email
//   BULKSMS_TOKEN_ID     — BulkSMS.com API Token ID
//   BULKSMS_TOKEN_SECRET — BulkSMS.com API Token Secret
//   NOTIFICATION_FROM_EMAIL — Sender email (e.g. noreply@ezaga.co.za)
//   APP_BASE_URL         — Frontend URL (e.g. https://ezaga.co.za)
//
// When provider keys are missing → logs to communication_log with status 'simulated'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── E.164 Phone Formatting for SA Numbers ────────────────────
// Handles: 0821234567, 27821234567, +27821234567, 082 123 4567
function formatE164(phone: string): string {
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // If starts with 0, replace leading 0 with 27
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '27' + digits.slice(1);
  }

  // If doesn't start with country code, prepend 27
  if (!digits.startsWith('27') && digits.length === 9) {
    digits = '27' + digits;
  }

  // Validate SA mobile number (27 + 6x/7x/8x + 7 digits)
  if (digits.length !== 11 || !digits.startsWith('27')) {
    throw new Error(`Invalid SA phone number: ${phone} → ${digits}`);
  }

  return '+' + digits;
}

// ── Email HTML Templates ─────────────────────────────────────

function loanApprovedEmailHtml(data: {
  firstName: string;
  loanAmount: number;
  interestAmount: number;
  totalRepayable: number;
  loanTermDays: number;
  dashboardUrl: string;
}): string {
  const fmtZar = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  const interestRate = data.loanAmount > 0
    ? ((data.interestAmount / data.loanAmount) * 100).toFixed(1)
    : '0';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Loan Approved</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:40px 40px 30px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">🎉 Congratulations!</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Your loan has been approved</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px;">
    <p style="margin:0 0 20px;color:#1e293b;font-size:16px;line-height:1.6;">
      Hi <strong>${data.firstName}</strong>,
    </p>
    <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
      Great news! Your ezaga loan application has been <strong style="color:#22c55e;">approved</strong>. Here are your loan details:
    </p>
    <!-- Loan Details Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:0 0 24px;">
      <tr><td style="padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">Approved Amount</td>
            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${fmtZar(data.loanAmount)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">Interest Rate</td>
            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${interestRate}%</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:14px;">Loan Term</td>
            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${data.loanTermDays} days</td>
          </tr>
          <tr>
            <td style="padding:12px 0 0;border-top:1px solid #e2e8f0;color:#64748b;font-size:14px;font-weight:600;">Total Repayable</td>
            <td style="padding:12px 0 0;border-top:1px solid #e2e8f0;color:#22c55e;font-size:18px;font-weight:800;text-align:right;">${fmtZar(data.totalRepayable)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <!-- Next Steps -->
    <p style="margin:0 0 8px;color:#1e293b;font-size:15px;font-weight:700;">What happens next?</p>
    <ol style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;line-height:2;">
      <li>Review and sign your loan contract</li>
      <li>Complete the DebiCheck mandate via your banking app</li>
      <li>Funds will be released to your account within 24 hours</li>
    </ol>
    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:8px 0 24px;">
        <a href="${data.dashboardUrl}" style="display:inline-block;background:#22c55e;color:#ffffff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;">
          View Your Dashboard →
        </a>
      </td></tr>
    </table>
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;text-align:center;">
      If you have any questions, reply to this email or contact us at support@ezaga.co.za
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">
      ezaga Loans (Pty) Ltd &bull; NCR Registered Lender &bull; POPIA Compliant<br>
      This is an automated notification. Please do not reply directly.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function debiCheckEmailHtml(data: {
  firstName: string;
  instalmentAmount: number;
  contractRef: string;
  bankName: string;
  dashboardUrl: string;
}): string {
  const fmtZar = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DebiCheck Action Required</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:40px 40px 30px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">⚡ Action Required: DebiCheck</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">Approve your mandate to release funds</p>
  </td></tr>
  <!-- Urgency Banner -->
  <tr><td style="background:#fef3c7;padding:16px 40px;border-bottom:1px solid #fbbf24;">
    <p style="margin:0;color:#92400e;font-size:14px;font-weight:700;text-align:center;">
      ⏰ TIME SENSITIVE — Please act within the next 30 minutes
    </p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px;">
    <p style="margin:0 0 20px;color:#1e293b;font-size:16px;line-height:1.6;">
      Hi <strong>${data.firstName}</strong>,
    </p>
    <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
      A <strong>DebiCheck debit order mandate</strong> from <strong>ezaga Loans</strong> has been sent to your bank.
      You need to <strong style="color:#2563eb;">approve it on your banking app</strong> so we can release your loan funds.
    </p>
    <!-- Mandate Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;margin:0 0 24px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:14px;">Amount</td>
            <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${fmtZar(data.instalmentAmount)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:14px;">Reference</td>
            <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;font-family:monospace;">${data.contractRef}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:14px;">Your Bank</td>
            <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${data.bankName}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <!-- Steps -->
    <p style="margin:0 0 12px;color:#1e293b;font-size:15px;font-weight:700;">How to approve:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="padding:12px 16px;background:#f8fafc;border-radius:10px;margin-bottom:8px;">
        <p style="margin:0 0 8px;color:#1e293b;font-size:13px;font-weight:700;">📱 Standard Bank / Absa / Nedbank / Capitec:</p>
        <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">Open your banking app → Look for a notification or go to <em>Approvals / Mandates / DebiCheck</em> → Review the amount → Tap <strong>"Approve"</strong></p>
      </td></tr>
      <tr><td style="height:8px;"></td></tr>
      <tr><td style="padding:12px 16px;background:#f8fafc;border-radius:10px;">
        <p style="margin:0 0 8px;color:#1e293b;font-size:13px;font-weight:700;">📱 FNB:</p>
        <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">Open the FNB App → Go to <em>My Products → Accounts → Debit Orders → Pending Approvals</em> → Approve the ezaga mandate</p>
      </td></tr>
      <tr><td style="height:8px;"></td></tr>
      <tr><td style="padding:12px 16px;background:#f8fafc;border-radius:10px;">
        <p style="margin:0 0 8px;color:#1e293b;font-size:13px;font-weight:700;">📞 USSD (if no app):</p>
        <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">Dial <strong>*120*001#</strong> (Capitec) or <strong>*120*321#</strong> (Standard Bank) → Follow prompts to approve pending mandates</p>
      </td></tr>
    </table>
    <!-- Warning -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin:0 0 24px;">
      <tr><td style="padding:16px;">
        <p style="margin:0;color:#991b1b;font-size:13px;font-weight:600;">
          ⚠️ If you don't approve within a few hours, the mandate will expire and we'll need to send a new one — delaying your funds.
        </p>
      </td></tr>
    </table>
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;text-align:center;">
      Need help? Call us at 012 345 6789 or reply to this email.
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">
      ezaga Loans (Pty) Ltd &bull; NCR Registered Lender &bull; POPIA Compliant<br>
      This is an automated notification. Please do not reply directly.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function debiCheckReminderEmailHtml(data: {
  firstName: string;
  instalmentAmount: number;
  bankName: string;
}): string {
  const fmtZar = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DebiCheck Reminder</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <tr><td style="background:#dc2626;padding:30px 40px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">🔔 Reminder: DebiCheck Still Pending</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.6;">
      Hi <strong>${data.firstName}</strong>,
    </p>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
      We noticed you haven't approved the DebiCheck mandate for <strong>${fmtZar(data.instalmentAmount)}</strong> yet.
      Please open your <strong>${data.bankName}</strong> banking app and approve the pending mandate from <strong>ezaga Loans</strong> as soon as possible.
    </p>
    <p style="margin:0 0 20px;color:#dc2626;font-size:14px;font-weight:600;">
      If the mandate expires, we'll need to send a new one — which will delay the release of your funds.
    </p>
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
      Need help? Call us at 012 345 6789 or reply to this email.
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">ezaga Loans (Pty) Ltd &bull; NCR Registered Lender</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ── SMS Templates (max ~160 chars) ───────────────────────────

function loanApprovedSms(firstName: string, dashboardUrl: string): string {
  return `Hi ${firstName}, Great news! Your ezaga loan application has been APPROVED. Check your email for details or log in: ${dashboardUrl}`;
}

function debiCheckSms(firstName: string): string {
  return `URGENT: ${firstName}, a DebiCheck request from ezaga Loans was sent to your bank. Open your banking app NOW to Accept the mandate so we can release your funds.`;
}

function debiCheckReminderSms(firstName: string): string {
  return `REMINDER: ${firstName}, your DebiCheck mandate from ezaga Loans is still pending. Please open your banking app and approve it now to avoid delays.`;
}

// ── Send Email via Resend ────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fromEmail: string,
  apiKey: string,
): Promise<{ success: boolean; providerRef?: string; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `ezaga Loans <${fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || `Resend ${res.status}` };
    }
    return { success: true, providerRef: data.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Send SMS via BulkSMS ─────────────────────────────────────

async function sendSms(
  to: string,
  body: string,
  tokenId: string,
  tokenSecret: string,
): Promise<{ success: boolean; providerRef?: string; error?: string }> {
  try {
    const credentials = btoa(`${tokenId}:${tokenSecret}`);
    const res = await fetch('https://api.bulksms.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        body,
        encoding: 'TEXT',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `BulkSMS ${res.status}: ${errText}` };
    }

    const data = await res.json();
    // BulkSMS returns an array of message objects
    const ref = Array.isArray(data) ? data[0]?.id : data?.id;
    return { success: true, providerRef: ref?.toString() };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Main Handler ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      trigger_event,    // 'loan_approved' | 'debicheck_initiated' | 'debicheck_reminder'
      application_id,
      // Application data passed from caller:
      first_name,
      last_name,
      email,
      mobile_number,
      loan_amount,
      interest_amount,
      total_repayable,
      loan_term_days,
      // DebiCheck-specific:
      instalment_amount,
      contract_ref,
      bank_name,
    } = body;

    if (!trigger_event || !application_id || !email || !mobile_number || !first_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: trigger_event, application_id, email, mobile_number, first_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get caller from JWT
    const authHeader = req.headers.get('Authorization') || '';
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Config
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const bulkSmsTokenId = Deno.env.get('BULKSMS_TOKEN_ID');
    const bulkSmsTokenSecret = Deno.env.get('BULKSMS_TOKEN_SECRET');
    const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'noreply@ezaga.co.za';
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://ezaga.co.za';
    const dashboardUrl = `${appBaseUrl}/dashboard`;

    // Format phone to E.164
    let formattedPhone: string;
    try {
      formattedPhone = formatE164(mobile_number);
    } catch {
      formattedPhone = mobile_number; // fallback, log the original
    }

    // ── Build content based on trigger event ─────────────────
    let emailSubject = '';
    let emailHtml = '';
    let smsText = '';

    switch (trigger_event) {
      case 'loan_approved':
        emailSubject = '🎉 Your ezaga Loan Has Been Approved!';
        emailHtml = loanApprovedEmailHtml({
          firstName: first_name,
          loanAmount: loan_amount || 0,
          interestAmount: interest_amount || 0,
          totalRepayable: total_repayable || 0,
          loanTermDays: loan_term_days || 0,
          dashboardUrl,
        });
        smsText = loanApprovedSms(first_name, dashboardUrl);
        break;

      case 'debicheck_initiated':
        emailSubject = '⚡ Action Required: Approve Your DebiCheck Mandate';
        emailHtml = debiCheckEmailHtml({
          firstName: first_name,
          instalmentAmount: instalment_amount || total_repayable || 0,
          contractRef: contract_ref || 'N/A',
          bankName: bank_name || 'your bank',
          dashboardUrl,
        });
        smsText = debiCheckSms(first_name);
        break;

      case 'debicheck_reminder':
        emailSubject = '🔔 Reminder: Your DebiCheck Mandate is Still Pending';
        emailHtml = debiCheckReminderEmailHtml({
          firstName: first_name,
          instalmentAmount: instalment_amount || total_repayable || 0,
          bankName: bank_name || 'your bank',
        });
        smsText = debiCheckReminderSms(first_name);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown trigger_event: ${trigger_event}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const results: { channel: string; status: string; providerRef?: string; error?: string }[] = [];

    // ── Send Email ───────────────────────────────────────────
    const emailLogBase = {
      application_id,
      user_id: user.id,
      channel: 'email' as const,
      trigger_event,
      recipient: email,
      subject: emailSubject,
      body_preview: emailSubject,
      sent_by: user.id,
    };

    if (resendApiKey) {
      const emailResult = await sendEmail(email, emailSubject, emailHtml, fromEmail, resendApiKey);
      await supabase.from('communication_log').insert({
        ...emailLogBase,
        status: emailResult.success ? 'sent' : 'failed',
        provider: 'resend',
        provider_ref: emailResult.providerRef || null,
        error_details: emailResult.error || null,
      });
      results.push({ channel: 'email', status: emailResult.success ? 'sent' : 'failed', providerRef: emailResult.providerRef, error: emailResult.error });
    } else {
      // Simulation mode
      await supabase.from('communication_log').insert({
        ...emailLogBase,
        status: 'sent',
        provider: 'simulated',
        provider_ref: `SIM-EMAIL-${Date.now()}`,
      });
      results.push({ channel: 'email', status: 'sent (simulated)' });
    }

    // ── Send SMS ─────────────────────────────────────────────
    const smsLogBase = {
      application_id,
      user_id: user.id,
      channel: 'sms' as const,
      trigger_event,
      recipient: formattedPhone,
      subject: null,
      body_preview: smsText.substring(0, 100),
      sent_by: user.id,
    };

    if (bulkSmsTokenId && bulkSmsTokenSecret) {
      const smsResult = await sendSms(formattedPhone, smsText, bulkSmsTokenId, bulkSmsTokenSecret);
      await supabase.from('communication_log').insert({
        ...smsLogBase,
        status: smsResult.success ? 'sent' : 'failed',
        provider: 'bulksms',
        provider_ref: smsResult.providerRef || null,
        error_details: smsResult.error || null,
      });
      results.push({ channel: 'sms', status: smsResult.success ? 'sent' : 'failed', providerRef: smsResult.providerRef, error: smsResult.error });
    } else {
      // Simulation mode
      await supabase.from('communication_log').insert({
        ...smsLogBase,
        status: 'sent',
        provider: 'simulated',
        provider_ref: `SIM-SMS-${Date.now()}`,
      });
      results.push({ channel: 'sms', status: 'sent (simulated)' });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
