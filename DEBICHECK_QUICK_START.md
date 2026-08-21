# DebiCheck Integration - Quick Start Guide

## For Admins

### Initiating a DebiCheck Mandate

1. Open loan application in Admin Dashboard
2. Click "Initiate NuPay DebiCheck" button
3. Select mandate type:
   - **TT1 (Real-Time)**: Client gets push notification immediately
   - **TT2 (Non-Real-Time)**: Bank processes offline (2-3 days)
4. Configure mandate:
   - Amount (pre-filled from loan)
   - Number of instalments
   - Frequency (once-off, weekly, monthly)
   - First strike date (minimum 3 days from now)
   - Tracking days (10 or 32)
5. Click "Submit Mandate"
6. Verify mandate created in database

### Checking Mandate Status

1. Open application detail view
2. Scroll to "Mandate Management Panel"
3. Click "Sync Status" button
4. Status updates from NuPay
5. View collection history and details

### Cancelling a Mandate

1. Open application detail view
2. Scroll to "Mandate Management Panel"
3. Click "Cancel Mandate" button
4. Enter reason (optional)
5. Confirm cancellation
6. Mandate marked as cancelled

### Viewing Reports

1. Go to Admin Dashboard
2. Use "Settlement Report" feature (coming soon)
3. Select date range
4. View collections and settlements
5. Export for reconciliation

## For Clients

### Viewing Mandate Status

1. Log in to client portal
2. Go to "Application Tracker" tab
3. Scroll to "DebiCheck Mandate Status" section
4. View current status and details

### Understanding Mandate Status

| Status | Meaning | Action |
|--------|---------|--------|
| **Draft** | Being prepared | Wait for submission |
| **Submitted** | Sent to bank | Check banking app |
| **Awaiting Auth** | Need to approve | Open banking app, authenticate |
| **Approved** | Ready for collection | Ensure funds available |
| **Rejected** | Bank declined | Contact support |
| **Cancelled** | No longer active | Apply for new mandate |

### Refreshing Status

1. Click "Refresh" button next to mandate status
2. Status syncs with NuPay
3. Updates displayed immediately

### Cancelling Mandate

1. Click "Cancel Mandate" button
2. Confirm cancellation
3. Mandate cancelled immediately
4. No further collections will be made

## For Support Team

### Common Questions

**Q: How long does mandate approval take?**
A: TT1 (real-time) is instant if client authenticates. TT2 takes 2-3 business days.

**Q: What if client doesn't authenticate?**
A: Mandate stays in "pending_bank" status. After timeout (usually 7 days), it's rejected.

**Q: Can I cancel a mandate?**
A: Yes, if it's in "submitted", "pending_bank", or "accepted" status.

**Q: What if collection fails?**
A: NuPay retries for 10 or 32 days depending on tracking setting.

**Q: How do I check if collection was successful?**
A: Check "Mandate Management Panel" → "Collections" section.

### Troubleshooting

**Mandate stuck in "pending_bank"**
- Ask client to check banking app for push notification
- Verify client's banking app is up to date
- If no notification received, may need to retry

**Collection failed**
- Check if client has sufficient funds
- Verify account is not frozen or closed
- Review NuPay response code for specific error

**Can't sync mandate status**
- Check internet connection
- Verify NuPay API is accessible
- Check Supabase Edge Function logs

**Webhook not working**
- Verify webhook URL in NuPay portal
- Check webhook secret is correct
- Test webhook manually from NuPay dashboard

## API Quick Reference

### Check Mandate Status
```bash
curl -X POST https://project.supabase.co/functions/v1/nupay-mandate-status \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mandate_id": "uuid"}'
```

### Cancel Mandate
```bash
curl -X POST https://project.supabase.co/functions/v1/nupay-mandate-cancel \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mandate_id": "uuid", "reason": "Client requested"}'
```

### Get Settlement Report
```bash
curl -X POST https://project.supabase.co/functions/v1/nupay-settlement-report \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "settlement",
    "start_date": "2026-08-01",
    "end_date": "2026-08-31"
  }'
```

## Database Quick Reference

### Check Mandate Status
```sql
SELECT id, contract_ref, status, nupay_response_message, status_updated_at
FROM debicheck_mandates
WHERE application_id = 'app-uuid'
ORDER BY created_at DESC
LIMIT 1;
```

### View Collections
```sql
SELECT collection_date, collection_amount, collection_status, nupay_response_message
FROM debicheck_collections
WHERE mandate_id = 'mandate-uuid'
ORDER BY collection_date DESC;
```

### View Settlements
```sql
SELECT settlement_date, total_collected, total_settled, total_failed, status
FROM debicheck_settlements
WHERE settlement_date BETWEEN '2026-08-01' AND '2026-08-31'
ORDER BY settlement_date DESC;
```

### View Audit Log
```sql
SELECT action, details, created_at
FROM audit_logs
WHERE target_type = 'debicheck_mandate'
AND target_id = 'mandate-uuid'
ORDER BY created_at DESC;
```

## Key Contacts

- **NuPay Support**: support@nupay.co.za
- **Devin (Developer)**: devin@cognition.ai
- **Admin Dashboard**: https://app.philanifinance.co.za/admin
- **Client Portal**: https://app.philanifinance.co.za

## Important Notes

⚠️ **Testing Environment**
- Testing is done in LIVE environment (no sandbox)
- Use test merchant: 25500019658
- R10.00 load limit to prevent accidental collections
- NuPay will NOT settle test collections
- Cancel test collections before debit date

⚠️ **Security**
- Never share API keys or credentials
- Always use HTTPS for API calls
- Verify webhook signatures
- Log all mandate actions for compliance

⚠️ **Compliance**
- Ensure client consent before initiating mandate
- Keep audit trail of all mandate actions
- Comply with NCA and POPIA requirements
- Regular reconciliation with bank statements

## Next Steps

1. **For Deployment Team**: Follow DEBICHECK_DEPLOYMENT.md
2. **For Developers**: Read DEBICHECK_INTEGRATION.md
3. **For Admins**: Start with "Initiating a DebiCheck Mandate" section
4. **For Support**: Review "Common Questions" section

## Resources

- Full Integration Guide: DEBICHECK_INTEGRATION.md
- Deployment Checklist: DEBICHECK_DEPLOYMENT.md
- Implementation Summary: DEBICHECK_SUMMARY.md
- NuPay API Docs: /Documents/NuPayment Integration/

---

**Last Updated**: August 21, 2026
**Version**: 1.0
**Status**: Ready for Use
