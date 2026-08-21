# DebiCheck Integration Deployment Checklist

This checklist ensures all components of the DebiCheck integration are properly deployed and configured.

## Pre-Deployment

- [ ] Review all PDF specifications in `/Documents/NuPayment Integration/`
- [ ] Obtain NuPay merchant credentials and API key
- [ ] Encode credentials to base64
- [ ] Prepare test account details
- [ ] Review security requirements and compliance

## Database Migrations

- [ ] Run migration `012_debicheck_collections_settlement.sql`
  - Creates `debicheck_reports` table
  - Creates `debicheck_collections` table
  - Creates `debicheck_settlements` table
  - Creates `debicheck_instalments` table
  - Adds columns to `debicheck_mandates` table

**Deployment Steps**:
```bash
# In Supabase Dashboard → SQL Editor
# Copy and paste the migration SQL
# Execute the migration
# Verify tables created: SELECT * FROM information_schema.tables WHERE table_name LIKE 'debicheck%';
```

## Edge Functions Deployment

### 1. Deploy `nupay-mandate-status`

```bash
supabase functions deploy nupay-mandate-status
```

**Verify**:
- Function appears in Supabase Dashboard → Edge Functions
- No deployment errors in logs
- Test with sample request

### 2. Deploy `nupay-mandate-cancel`

```bash
supabase functions deploy nupay-mandate-cancel
```

**Verify**:
- Function appears in Supabase Dashboard → Edge Functions
- No deployment errors in logs
- Test with sample request

### 3. Deploy `nupay-settlement-report`

```bash
supabase functions deploy nupay-settlement-report
```

**Verify**:
- Function appears in Supabase Dashboard → Edge Functions
- No deployment errors in logs
- Test with sample request

### 4. Verify Existing Functions

- [ ] `nupay-initiate` - Already deployed
- [ ] `nupay-callback` - Already deployed
- [ ] `debicheck-reminder` - Already deployed

## Environment Variables

Set in Supabase Dashboard → Edge Functions → Secrets:

```
NUPAY_API_URL=https://api.nupay.co.za/v1
NUPAY_MERCHANT_ID=25500019658
NUPAY_TERMINAL_ID=<your-terminal-id>
NUPAY_API_KEY=<base64-encoded-username:password>
NUPAY_WEBHOOK_SECRET=<shared-secret>
```

**Deployment Steps**:
1. Go to Supabase Dashboard → Edge Functions
2. Click "Secrets" tab
3. Add each environment variable
4. Verify all functions can access secrets

**Verify**:
- [ ] All secrets added
- [ ] No typos in secret names
- [ ] Secrets match across all functions

## Frontend Components

### 1. Add New Components

- [ ] `src/components/MandateManagementPanel.tsx` - Created
- [ ] `src/components/ClientMandateStatus.tsx` - Created

**Verify**:
```bash
# Check files exist
ls -la src/components/MandateManagementPanel.tsx
ls -la src/components/ClientMandateStatus.tsx

# Check for syntax errors
npm run typecheck
```

### 2. Update Existing Components

- [ ] `src/components/AdminDashboard.tsx` - Updated with MandateManagementPanel import and integration
- [ ] `src/components/ClientDashboard.tsx` - Updated with ClientMandateStatus import and integration

**Verify**:
```bash
# Check for TypeScript errors
npm run typecheck

# Check for linting errors
npm run lint
```

### 3. Build and Test

```bash
# Build the project
npm run build

# Start development server
npm run dev

# Test in browser
# Navigate to admin dashboard and client dashboard
# Verify new components render without errors
```

## Webhook Configuration

### 1. Register Webhook URL with NuPay

1. Log in to NuPay merchant portal
2. Navigate to Webhook Settings
3. Register webhook URL: `https://<project-ref>.supabase.co/functions/v1/nupay-callback`
4. Set webhook secret (must match `NUPAY_WEBHOOK_SECRET`)
5. Enable webhook for mandate status updates

**Verify**:
- [ ] Webhook URL registered
- [ ] Webhook secret set
- [ ] Test webhook sent from NuPay dashboard
- [ ] Webhook received and processed (check Edge Function logs)

### 2. Test Webhook

```bash
# Manually test webhook from NuPay dashboard
# Or use curl:
curl -X POST https://<project-ref>.supabase.co/functions/v1/nupay-callback \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <NUPAY_WEBHOOK_SECRET>" \
  -d '{
    "ContractRef": "PF-TEST-12345",
    "MandateID": "NuPay-TEST-ID",
    "Status": "ACCEPTED",
    "ResponseCode": "00",
    "Message": "Success"
  }'
```

## Testing

### 1. Unit Tests

```bash
# Run existing tests
npm run test

# Verify no test failures
```

### 2. Integration Tests

#### Test Mandate Initiation
1. Create test loan application
2. Approve application
3. Create and sign contract
4. Click "Initiate NuPay DebiCheck"
5. Submit mandate with TT1 type
6. Verify mandate created in database
7. Verify NuPay API called successfully
8. Verify response stored in database

#### Test Mandate Status Sync
1. Open mandate in admin dashboard
2. Click "Sync Status" button
3. Verify status updated from NuPay
4. Check database for updated status
5. Verify audit log entry created

#### Test Mandate Cancellation
1. Open active mandate in admin dashboard
2. Click "Cancel Mandate"
3. Enter cancellation reason
4. Confirm cancellation
5. Verify mandate marked as "cancelled"
6. Verify NuPay API called
7. Verify audit log entry created

#### Test Client Portal
1. Log in as test client
2. Navigate to application tracker
3. Verify mandate status displayed
4. Click "Refresh" button
5. Verify status synced
6. Test cancellation (if applicable)

### 3. Error Handling Tests

#### Test Invalid Credentials
1. Set invalid `NUPAY_API_KEY`
2. Try to initiate mandate
3. Verify error message displayed
4. Verify error logged in audit trail

#### Test Network Errors
1. Temporarily disable internet
2. Try to sync mandate status
3. Verify graceful error handling
4. Verify user-friendly error message

#### Test Invalid Mandate
1. Try to cancel non-existent mandate
2. Verify 404 error returned
3. Verify error message displayed

## Deployment Verification

### 1. Database

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'debicheck%'
ORDER BY table_name;

-- Expected output:
-- debicheck_collections
-- debicheck_instalments
-- debicheck_mandates
-- debicheck_reports
-- debicheck_settlements

-- Verify columns added to debicheck_mandates
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'debicheck_mandates'
AND column_name IN ('total_collected', 'total_failed', 'last_collection_date', 'next_collection_date', 'collections_count')
ORDER BY column_name;

-- Expected output:
-- collections_count
-- last_collection_date
-- next_collection_date
-- total_collected
-- total_failed
```

### 2. Edge Functions

```bash
# List deployed functions
supabase functions list

# Expected output should include:
# - nupay-initiate
# - nupay-callback
# - nupay-mandate-status
# - nupay-mandate-cancel
# - nupay-settlement-report
# - debicheck-reminder

# Check function logs
supabase functions logs nupay-mandate-status
supabase functions logs nupay-mandate-cancel
supabase functions logs nupay-settlement-report
```

### 3. Frontend

```bash
# Verify components compile
npm run typecheck

# Verify no linting errors
npm run lint

# Build production bundle
npm run build

# Check bundle size
ls -lh dist/
```

### 4. Environment Variables

```bash
# Verify secrets are set
# In Supabase Dashboard → Edge Functions → Secrets
# Should show:
# - NUPAY_API_URL
# - NUPAY_MERCHANT_ID
# - NUPAY_TERMINAL_ID
# - NUPAY_API_KEY
# - NUPAY_WEBHOOK_SECRET
```

## Post-Deployment

### 1. Monitoring

- [ ] Set up error alerting for Edge Functions
- [ ] Monitor webhook delivery in NuPay dashboard
- [ ] Check database for new mandate records
- [ ] Review audit logs for mandate actions

### 2. Documentation

- [ ] Update team wiki/documentation
- [ ] Share DEBICHECK_INTEGRATION.md with team
- [ ] Create user guide for admins
- [ ] Create user guide for clients

### 3. Training

- [ ] Train admins on mandate management
- [ ] Train support team on troubleshooting
- [ ] Create FAQ document
- [ ] Record video walkthrough

### 4. Monitoring & Maintenance

- [ ] Set up daily monitoring of failed collections
- [ ] Set up weekly settlement report review
- [ ] Set up monthly reconciliation process
- [ ] Document any issues and resolutions

## Rollback Plan

If deployment fails:

1. **Database**: 
   - Rollback migration by dropping new tables
   - Restore from backup if needed

2. **Edge Functions**:
   - Disable new functions in Supabase Dashboard
   - Keep old functions active

3. **Frontend**:
   - Revert component imports in AdminDashboard and ClientDashboard
   - Rebuild and redeploy

4. **Environment Variables**:
   - Remove new secrets from Supabase Dashboard

## Success Criteria

- [ ] All database tables created successfully
- [ ] All Edge Functions deployed without errors
- [ ] All frontend components compile without errors
- [ ] Webhook URL registered and tested with NuPay
- [ ] Test mandate initiation works end-to-end
- [ ] Test mandate status sync works
- [ ] Test mandate cancellation works
- [ ] Test client portal displays mandate status
- [ ] All error cases handled gracefully
- [ ] Audit logs record all mandate actions
- [ ] Team trained on new features

## Sign-Off

- [ ] Database Admin: _______________  Date: _______
- [ ] Backend Engineer: _______________  Date: _______
- [ ] Frontend Engineer: _______________  Date: _______
- [ ] QA Engineer: _______________  Date: _______
- [ ] Product Manager: _______________  Date: _______

## Notes

Document any issues encountered during deployment:

```
Issue 1: 
Resolution:

Issue 2:
Resolution:

Issue 3:
Resolution:
```

## Next Steps

1. Monitor production for 24-48 hours
2. Gather feedback from admins and clients
3. Make any necessary adjustments
4. Schedule post-deployment review meeting
5. Plan for future enhancements
