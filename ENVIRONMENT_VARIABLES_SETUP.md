# Environment Variables Setup Guide

> **⚠️ DEPRECATED:** The 5 variables below (`NUPAY_API_URL`, `NUPAY_TERMINAL_ID`,
> `NUPAY_API_KEY`, `NUPAY_WEBHOOK_SECRET`, and the Base64-encoded "API key")
> don't match what the edge functions actually use now. The real requirement
> is just `NUPAY_USERNAME`, `NUPAY_PASSWORD`, and `NUPAY_MERCHANT_ID` — see
> [`NUPAY_DEBICHECK_INTEGRATION.md`](./NUPAY_DEBICHECK_INTEGRATION.md).
> Safe to delete this file.

This guide explains where to find each environment variable and how to configure them.

## Overview

You need to set 5 environment variables in Supabase. Here's where to find each one:

| Variable | Where to Find | Status |
|----------|---------------|--------|
| `NUPAY_API_URL` | Fixed value | ✅ Ready |
| `NUPAY_MERCHANT_ID` | From credentials | ✅ Ready |
| `NUPAY_TERMINAL_ID` | From NuPay portal | ⏳ Need to obtain |
| `NUPAY_API_KEY` | Encode credentials | ✅ Ready |
| `NUPAY_WEBHOOK_SECRET` | Create yourself | ⏳ Need to create |

---

## 1. NUPAY_API_URL

**Value**: `https://api.nupay.co.za/v1`

This is the NuPay API endpoint. It's the same for all merchants.

```
NUPAY_API_URL=https://api.nupay.co.za/v1
```

---

## 2. NUPAY_MERCHANT_ID

**Value**: `25500019658`

This is your NuPay merchant number. You already have this from the credentials provided.

```
NUPAY_MERCHANT_ID=25500019658
```

---

## 3. NUPAY_TERMINAL_ID ⏳ ACTION REQUIRED

**Where to find it**: NuPay Merchant Portal

### Steps to obtain:

1. **Log in to NuPay Merchant Portal**
   - URL: https://merchant.nupay.co.za/ (or similar)
   - Username: `NSK25500019658`
   - Password: `M%@Dm4618E`

2. **Navigate to Settings/Configuration**
   - Look for "Terminal Settings" or "Terminal Configuration"
   - Or check "API Settings" or "Integration Settings"

3. **Find Terminal ID**
   - It should be listed as:
     - "Terminal ID"
     - "Terminal Number"
     - "POS Terminal ID"
     - "Device ID"

4. **Copy the value**
   - It's usually a numeric or alphanumeric code
   - Example: `12345678` or `TERM001`

5. **If you can't find it**:
   - Contact NuPay Support: support@nupay.co.za
   - Ask: "What is my Terminal ID for merchant 25500019658?"

### Set in Supabase:
```
NUPAY_TERMINAL_ID=<your-terminal-id>
```

---

## 4. NUPAY_API_KEY ✅ READY

**Where to find it**: Encode the provided credentials

### You have:
- Username: `NSK25500019658`
- Password: `M%@Dm4618E`

### How to encode:

**Option 1: Using Command Line (Mac/Linux/Windows PowerShell)**

```bash
# On Mac/Linux:
echo -n "NSK25500019658:M%@Dm4618E" | base64

# On Windows PowerShell:
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("NSK25500019658:M%@Dm4618E"))
```

**Option 2: Using Online Base64 Encoder**
1. Go to https://www.base64encode.org/
2. Enter: `NSK25500019658:M%@Dm4618E`
3. Click "Encode"
4. Copy the result

**Option 3: Using Python**
```python
import base64
credentials = "NSK25500019658:M%@Dm4618E"
encoded = base64.b64encode(credentials.encode()).decode()
print(encoded)
# Output: TlNLMjU1MDAwMTk2NTg6TSVARG00NjE4RQ==
```

### Expected Output:
```
TlNLMjU1MDAwMTk2NTg6TSVARG00NjE4RQ==
```

### Set in Supabase:
```
NUPAY_API_KEY=TlNLMjU1MDAwMTk2NTg6TSVARG00NjE4RQ==
```

---

## 5. NUPAY_WEBHOOK_SECRET ⏳ ACTION REQUIRED

**Where to find it**: You create this yourself

This is a shared secret between your application and NuPay for webhook verification.

### How to create:

**Option 1: Generate a random string**
```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows PowerShell:
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Option 2: Use an online generator**
1. Go to https://www.random.org/strings/
2. Generate a random string (at least 32 characters)
3. Copy the result

**Option 3: Create manually**
- Use a combination of uppercase, lowercase, numbers, and special characters
- Example: `MySecureWebhookSecret123!@#$%^&*()`
- Make it at least 32 characters long

### Example:
```
NUPAY_WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Important:
- **Remember this secret** - you'll need it when registering the webhook with NuPay
- Keep it secure - don't share it
- Use the same value in both:
  1. Supabase environment variables
  2. NuPay webhook registration

---

## How to Set Variables in Supabase

### Step-by-Step:

1. **Go to Supabase Dashboard**
   - URL: https://app.supabase.com
   - Log in with your account

2. **Select Your Project**
   - Click on "PhilaniFinance" project

3. **Navigate to Edge Functions**
   - Left sidebar → "Edge Functions"
   - Or: Settings → Edge Functions

4. **Click "Secrets" Tab**
   - You should see a "Secrets" button or tab

5. **Add Each Secret**
   - Click "New Secret" or "Add Secret"
   - Enter the variable name (e.g., `NUPAY_API_URL`)
   - Enter the value
   - Click "Save"

6. **Repeat for all 5 variables**:
   ```
   NUPAY_API_URL=https://api.nupay.co.za/v1
   NUPAY_MERCHANT_ID=25500019658
   NUPAY_TERMINAL_ID=<your-terminal-id>
   NUPAY_API_KEY=TlNLMjU1MDAwMTk2NTg6TSVARG00NjE4RQ==
   NUPAY_WEBHOOK_SECRET=<your-webhook-secret>
   ```

7. **Verify**
   - All 5 secrets should appear in the list
   - No typos in variable names

---

## Checklist

- [ ] **NUPAY_API_URL**: Set to `https://api.nupay.co.za/v1`
- [ ] **NUPAY_MERCHANT_ID**: Set to `25500019658`
- [ ] **NUPAY_TERMINAL_ID**: Obtained from NuPay portal
- [ ] **NUPAY_API_KEY**: Encoded from `NSK25500019658:M%@Dm4618E`
  - Result: `TlNLMjU1MDAwMTk2NTg6TSVARG00NjE4RQ==`
- [ ] **NUPAY_WEBHOOK_SECRET**: Created and noted down
- [ ] All 5 variables added to Supabase Secrets
- [ ] No typos in variable names
- [ ] Webhook secret saved for later (NuPay registration)

---

## Troubleshooting

### "Can't find Terminal ID"
- Check NuPay merchant portal under different sections:
  - Settings → Terminal Settings
  - API → Terminal Configuration
  - Integration → API Credentials
- Contact NuPay support if still not found

### "Base64 encoding looks wrong"
- Make sure you're encoding: `NSK25500019658:M%@Dm4618E`
- Include the colon (`:`) between username and password
- Don't include quotes or spaces
- Expected result: `TlNLMjU1MDAwMTk2NTg6TSVARG00NjE4RQ==`

### "Secrets not appearing in Supabase"
- Refresh the page
- Check you're in the correct project
- Make sure you clicked "Save"
- Try adding again

### "Edge Functions can't access secrets"
- Verify variable names match exactly (case-sensitive)
- Redeploy the functions after adding secrets
- Check Supabase documentation for your region

---

## Next Steps

1. **Obtain NUPAY_TERMINAL_ID** from NuPay portal
2. **Create NUPAY_WEBHOOK_SECRET** (random string)
3. **Set all 5 variables** in Supabase
4. **Deploy Edge Functions** (they will use these secrets)
5. **Register webhook** with NuPay (using the webhook URL and secret)

---

## Support

- **NuPay Support**: support@nupay.co.za
- **Supabase Docs**: https://supabase.com/docs/guides/functions
- **Base64 Encoding**: https://www.base64encode.org/

---

**Last Updated**: August 21, 2026
**Status**: Ready to Configure
