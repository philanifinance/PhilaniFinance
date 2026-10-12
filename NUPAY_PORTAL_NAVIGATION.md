# NuPay DebiCheck Portal Navigation Guide

> **⚠️ DEPRECATED:** The Terminal ID and webhook-registration steps below
> describe things that don't exist in NuPay's DebiCheck API — there is no
> Terminal ID field and no webhook to register (see
> [`NUPAY_DEBICHECK_INTEGRATION.md`](./NUPAY_DEBICHECK_INTEGRATION.md)).
> The portal login/credentials section may still be useful for checking your
> merchant account, but don't go hunting for "Terminal Settings" or "Webhook
> Configuration" menus on the strength of this doc. Safe to delete this file.

## Portal URL
```
https://debicheck.nupayments.co.za/
```

## Login Credentials
```
Username: NSK25500019658
Password: M%@Dm4618E
```

---

## What You Need to Find/Configure

### 1. Terminal ID ⏳ PRIORITY
**Where to look:**
- Settings → Terminal Settings
- Settings → Device Management
- API → Terminal Configuration
- Integration → API Credentials

**What it looks like:**
- Numeric: `12345678`
- Alphanumeric: `TERM001` or `POS-001`

**Action:**
- [ ] Find and note your Terminal ID
- [ ] Update `NUPAY_TERMINAL_ID` in Supabase when found

---

### 2. Webhook Registration ✅ NEXT
**Where to look:**
- Settings → Webhook Configuration
- Integration → Webhooks
- API → Webhook Settings
- Notifications → Webhooks

**What to register:**
```
Webhook URL: https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-callback
Webhook Secret: <your-generated-secret>
Event Type: Mandate Status Updates (or DebiCheck Status)
Status: Enable/Active
```

**Action:**
- [ ] Navigate to Webhook Settings
- [ ] Click "Add Webhook" or "New Webhook"
- [ ] Enter the webhook URL
- [ ] Enter the webhook secret
- [ ] Enable the webhook
- [ ] Save/Create
- [ ] (Optional) Test the webhook

---

### 3. API Credentials Verification ✅ OPTIONAL
**Where to look:**
- Settings → API Settings
- Integration → API Credentials
- Developer → API Keys

**What to verify:**
- Merchant ID: `25500019658` ✅
- Username: `NSK25500019658` ✅
- Password: `M%@Dm4618E` ✅

**Action:**
- [ ] Verify credentials are correct
- [ ] Note any additional API endpoints
- [ ] Check for rate limits or restrictions

---

## Step-by-Step Navigation

### Step 1: Log In
1. Go to https://debicheck.nupayments.co.za/
2. Enter Username: `NSK25500019658`
3. Enter Password: `M%@Dm4618E`
4. Click Login

### Step 2: Find Terminal ID
1. Look for **Settings** or **Configuration** menu
2. Find **Terminal Settings** or **Device Management**
3. Look for your Terminal ID
4. **Copy and save it**

### Step 3: Register Webhook
1. Look for **Settings** or **Integration** menu
2. Find **Webhooks** or **Webhook Configuration**
3. Click **Add Webhook** or **New Webhook**
4. Fill in:
   - **URL**: `https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-callback`
   - **Secret**: `<your-generated-secret>`
   - **Event Type**: Mandate Status Updates
   - **Status**: Enable
5. Click **Save** or **Create**
6. (Optional) Click **Test** to verify

### Step 4: Verify API Credentials
1. Look for **Settings** or **API** menu
2. Find **API Credentials** or **API Settings**
3. Verify:
   - Merchant ID: `25500019658`
   - Username: `NSK25500019658`
   - Password: `M%@Dm4618E`

---

## Common Menu Locations

### For Terminal ID:
- Main Menu → Settings → Terminal Settings
- Main Menu → Configuration → Devices
- Main Menu → API → Terminal Configuration
- Main Menu → Integration → Terminal Details

### For Webhooks:
- Main Menu → Settings → Webhooks
- Main Menu → Integration → Webhooks
- Main Menu → API → Webhooks
- Main Menu → Notifications → Webhooks

### For API Credentials:
- Main Menu → Settings → API
- Main Menu → Developer → API Keys
- Main Menu → Integration → API Credentials
- Main Menu → Account → API Settings

---

## What to Do If You Can't Find Something

### If you can't find Terminal ID:
1. Check all Settings/Configuration sections
2. Look for "Device ID" or "POS Terminal ID"
3. Check your onboarding documentation
4. Contact NuPay support: support@nupay.co.za

### If you can't find Webhook Settings:
1. Check Settings, Integration, API, and Notifications menus
2. Look for "Callbacks" or "Event Notifications"
3. Contact NuPay support: support@nupay.co.za

### If you need help:
- Email: support@nupay.co.za
- Subject: "Help with Terminal ID and Webhook Configuration for Merchant 25500019658"

---

## Checklist

- [ ] Logged in to https://debicheck.nupayments.co.za/
- [ ] Found Terminal ID
- [ ] Noted Terminal ID: _______________
- [ ] Found Webhook Settings
- [ ] Registered webhook URL
- [ ] Registered webhook secret
- [ ] Enabled webhook
- [ ] (Optional) Tested webhook
- [ ] Verified API credentials
- [ ] Ready to deploy

---

## Next Steps After Portal Navigation

1. **Update Terminal ID in Supabase**
   - Go to Supabase Dashboard → Edge Functions → Secrets
   - Update `NUPAY_TERMINAL_ID` with the real value

2. **Deploy Edge Functions**
   ```bash
   supabase functions deploy nupay-mandate-status
   supabase functions deploy nupay-mandate-cancel
   supabase functions deploy nupay-settlement-report
   ```

3. **Test Webhook** (optional)
   - In NuPay portal, find the webhook you created
   - Click "Test Webhook" or "Send Test"
   - Check Supabase Edge Function logs for confirmation

4. **Deploy Frontend**
   ```bash
   npm run build
   npm run deploy
   ```

---

**Last Updated**: August 21, 2026
**Portal**: https://debicheck.nupayments.co.za/
