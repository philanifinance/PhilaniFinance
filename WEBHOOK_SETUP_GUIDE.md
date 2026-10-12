# Webhook Setup Guide

> **⚠️ DEPRECATED — this webhook does not exist.** None of the NuPay
> DebiCheck webservice specs document a push/webhook notification; every
> method is a synchronous request the merchant calls, and status changes
> are discovered by polling (see `nupay-mandate-status` /
> `nupay-status-poll`). There is nothing to register in the NuPay portal.
> See [`NUPAY_DEBICHECK_INTEGRATION.md`](./NUPAY_DEBICHECK_INTEGRATION.md).
> Safe to delete this file.

This guide explains what a webhook is and how to set it up with NuPay.

## What is a Webhook?

A webhook is a way for NuPay to **send you notifications** when something happens with a mandate.

### How it works:

```
Timeline of Events:

1. You initiate a mandate with NuPay
   ↓
2. Client authenticates the mandate in their banking app
   ↓
3. NuPay's system detects the status change
   ↓
4. NuPay sends an HTTP POST request to YOUR webhook URL
   ↓
5. Your system receives the notification and updates the database
   ↓
6. Client sees "Approved" status in the portal
```

### Why you need it:

Without a webhook, you would have to:
- Manually check NuPay every few minutes
- Call an API to ask "has the status changed?"
- Miss real-time updates

With a webhook, NuPay **automatically notifies you** when something changes.

---

## Your Webhook URL

### The URL:

```
https://<project-ref>.supabase.co/functions/v1/nupay-callback
```

### What is `<project-ref>`?

This is your Supabase project reference. You can find it:

1. **Go to Supabase Dashboard**
   - https://app.supabase.com

2. **Select your project** (PhilaniFinance)

3. **Look at the URL in your browser**
   - Example: `https://app.supabase.com/project/wmpfweskrnliqwkqkpoq/...`
   - The `wmpfweskrnliqwkqkpoq` is your project reference

4. **Or check Settings**
   - Click Settings (bottom left)
   - Look for "Project URL" or "API URL"
   - Example: `https://wmpfweskrnliqwkqkpoq.supabase.co`

### Your Complete Webhook URL:

```
https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-callback
```

(Replace `wmpfweskrnliqwkqkpoq` with your actual project reference)

---

## NUPAY_WEBHOOK_SECRET

This is a **shared secret** between you and NuPay for security.

### What it does:

When NuPay sends you a webhook notification, it includes a secret in the header:
```
x-webhook-secret: your-secret-here
```

Your system verifies this secret matches what you configured, ensuring the notification is really from NuPay.

### How to create it:

**Option 1: Generate a random string**
```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows PowerShell:
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Option 2: Use an online generator**
- Go to https://www.random.org/strings/
- Generate a random string
- Copy it

**Option 3: Create manually**
```
MySecureWebhookSecret123!@#$%^&*()
```

### Example:
```
NUPAY_WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Important:
- **Remember this secret** - you'll need it in two places
- Keep it secure - don't share it
- Use the same value in:
  1. Supabase environment variables
  2. NuPay webhook registration

---

## How to Register Webhook with NuPay

### Step 1: Log in to NuPay Merchant Portal

- URL: https://merchant.nupay.co.za/
- Username: `NSK25500019658`
- Password: `M%@Dm4618E`

### Step 2: Find Webhook Settings

Look for:
- Settings → Webhook Configuration
- Integration → Webhooks
- API → Webhook Settings
- Notifications → Webhook

### Step 3: Add New Webhook

Click "Add Webhook" or "New Webhook"

### Step 4: Enter Details

Fill in:

| Field | Value |
|-------|-------|
| **Webhook URL** | `https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-callback` |
| **Webhook Secret** | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |
| **Event Type** | Mandate Status Updates (or similar) |
| **Active** | Yes/Enabled |

### Step 5: Save

Click "Save" or "Create"

### Step 6: Test (Optional)

NuPay usually provides a "Test Webhook" button:
- Click it to send a test notification
- Check your Supabase Edge Function logs to verify it was received

---

## Verification Checklist

- [ ] Found your Supabase project reference
- [ ] Created your complete webhook URL
- [ ] Generated a webhook secret
- [ ] Logged in to NuPay merchant portal
- [ ] Found webhook settings in NuPay
- [ ] Registered webhook URL with NuPay
- [ ] Set webhook secret in NuPay
- [ ] Enabled the webhook
- [ ] (Optional) Tested webhook from NuPay dashboard
- [ ] Set `NUPAY_WEBHOOK_SECRET` in Supabase environment variables

---

## How to Find Your Supabase Project Reference

### Method 1: From Dashboard URL

1. Go to https://app.supabase.com
2. Click on your project (PhilaniFinance)
3. Look at the URL: `https://app.supabase.com/project/XXXXX/...`
4. The `XXXXX` is your project reference

### Method 2: From Project Settings

1. Go to Supabase Dashboard
2. Select your project
3. Click Settings (bottom left)
4. Look for "Project URL" or "API URL"
5. It will look like: `https://XXXXX.supabase.co`
6. The `XXXXX` is your project reference

### Method 3: From Environment File

Check your `.env` file in the project:
```
VITE_SUPABASE_URL=https://wmpfweskrnliqwkqkpoq.supabase.co
```

The `wmpfweskrnliqwkqkpoq` is your project reference.

---

## Complete Webhook Setup Example

### Your Details:

```
Supabase Project Reference: wmpfweskrnliqwkqkpoq
Webhook URL: https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-callback
Webhook Secret: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### In Supabase (Environment Variables):

```
NUPAY_WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### In NuPay Merchant Portal:

```
Webhook URL: https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-callback
Webhook Secret: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Event Type: Mandate Status Updates
Status: Enabled
```

---

## Troubleshooting

### "Webhook not updating status"

1. **Verify webhook URL is correct**
   - Check for typos
   - Make sure it includes `/functions/v1/nupay-callback`
   - Test the URL in your browser (should return 405 Method Not Allowed - that's OK)

2. **Verify webhook secret matches**
   - Check in Supabase: `NUPAY_WEBHOOK_SECRET`
   - Check in NuPay: Webhook Secret
   - They must be identical

3. **Check Edge Function logs**
   - Go to Supabase Dashboard
   - Click Edge Functions
   - Click `nupay-callback`
   - Check the logs for errors

4. **Test webhook manually**
   - In NuPay merchant portal
   - Find the webhook you created
   - Click "Test Webhook" or "Send Test"
   - Check Supabase logs to see if it was received

### "Webhook URL not accessible"

- Make sure your Supabase project is deployed
- Make sure the Edge Function `nupay-callback` exists
- Check that your project reference is correct
- Test the URL in your browser

### "Secret mismatch error"

- Copy the secret exactly (case-sensitive)
- No spaces before or after
- Use the same value in both places

---

## What Happens When Webhook is Called

When NuPay sends a webhook notification:

1. **NuPay sends HTTP POST** to your webhook URL
2. **Includes mandate status** in the request body
3. **Includes webhook secret** in the header
4. **Your system verifies** the secret matches
5. **Your system updates** the mandate status in the database
6. **Your system logs** the update in audit logs
7. **Client sees** the updated status in the portal

---

## Next Steps

1. **Find your Supabase project reference**
2. **Create your webhook URL**
3. **Generate a webhook secret**
4. **Set `NUPAY_WEBHOOK_SECRET`** in Supabase environment variables
5. **Register webhook** in NuPay merchant portal
6. **Test webhook** (optional but recommended)

---

## Support

- **Supabase Docs**: https://supabase.com/docs/guides/functions
- **NuPay Support**: support@nupay.co.za
- **Check logs**: Supabase Dashboard → Edge Functions → nupay-callback → Logs

---

**Last Updated**: August 21, 2026
**Status**: Ready to Configure
