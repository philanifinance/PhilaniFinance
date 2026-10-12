# Your Webhook Configuration

> **⚠️ DEPRECATED — this webhook does not exist.** NuPay's DebiCheck
> webservices have no push/webhook mechanism; the `nupay-callback` function
> this file points to has been removed. See
> [`NUPAY_DEBICHECK_INTEGRATION.md`](./NUPAY_DEBICHECK_INTEGRATION.md).
> Safe to delete this file.

## Your Supabase Project Reference

```
wmpfweskrnliqwkqkpoq
```

## Your Complete Webhook URL

```
https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-callback
```

## Your Webhook Secret (Generate One)

Choose one of these options:

### Option 1: Generate Random (Recommended)
```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows PowerShell:
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Option 2: Use This Example
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## Configuration Summary

Copy and use these values:

### In Supabase Dashboard (Edge Functions → Secrets):
```
NUPAY_WEBHOOK_SECRET=<your-generated-secret>
```

### In NuPay Merchant Portal (Webhook Settings):
```
Webhook URL: https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-callback
Webhook Secret: <your-generated-secret>
Event Type: Mandate Status Updates
Status: Enabled
```

---

## Complete Environment Variables

Now you have all the information to set your environment variables:

```
NUPAY_API_URL=https://api.nupay.co.za/v1
NUPAY_MERCHANT_ID=25500019658
NUPAY_TERMINAL_ID=25500019658          (temporary - update when you get real ID)
NUPAY_API_KEY=TlNLMjU1MDAwMTk2NTg6TSVARG00NjE4RQ==
NUPAY_WEBHOOK_SECRET=<your-generated-secret>
```

---

## Next Steps

1. **Generate your webhook secret** (use openssl command above)
2. **Set all 5 environment variables** in Supabase Dashboard
3. **Register webhook** in NuPay merchant portal with:
   - URL: `https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-callback`
   - Secret: `<your-generated-secret>`
4. **Deploy Edge Functions**
5. **Test webhook** (optional)

---

**Save this file for reference during deployment!**
