# DebiCheck Integration Guide

This document provides a comprehensive guide to the NuPay DebiCheck integration for PhilaniFinance.

## Overview

The DebiCheck integration enables automated debt collection through South African banking channels. It allows clients to authorize recurring or one-time debit orders (mandates) that are processed through NuPay's DebiCheck service.

### Key Features

- **TT1 (Real-Time)**: Immediate push notification to client's banking app for authentication
- **TT2 (Non-Real-Time)**: Bank processes offline; client approves within 2-3 business days
- **Mandate Tracking**: Full lifecycle tracking from draft to accepted/rejected
- **Collection Monitoring**: Track collections, settlements, and failed attempts
- **Admin Controls**: Sync status, cancel mandates, view reports
- **Client Portal**: Clients can view mandate status and cancel if needed

## Architecture

### Edge Functions

#### 1. `nupay-initiate` (Existing)
Initiates a new DebiCheck mandate with NuPay.

**Endpoint**: `POST /functions/v1/nupay-initiate`

**Request Body**:
```json
{
  "mandate_id": "uuid"
}
```

**Response**:
```json
{
  "id": "uuid",
  "contract_ref": "PF-XXXXX-XXXXX",
  "status": "mandate_submitted",
  "nupay_mandate_id": "NuPay-ID",
  "nupay_response_code": "00",
  "nupay_response_message": "Success"
}
```

#### 2. `nupay-mandate-status` (New)
Checks the current status of a mandate with NuPay and syncs it to the database.

**Endpoint**: `POST /functions/v1/nupay-mandate-status`

**Request Body**:
```json
{
  "mandate_id": "uuid"  // or "contract_ref": "PF-XXXXX-XXXXX"
}
```

**Response**:
```json
{
  "mandate_id": "uuid",
  "contract_ref": "PF-XXXXX-XXXXX",
  "status": "accepted",
  "nupay_mandate_id": "NuPay-ID",
  "nupay_status": "ACCEPTED",
  "response_code": "00",
  "response_message": "Success",
  "synced": true
}
```

#### 3. `nupay-mandate-cancel` (New)
Cancels an active mandate with NuPay.

**Endpoint**: `POST /functions/v1/nupay-mandate-cancel`

**Request Body**:
```json
{
  "mandate_id": "uuid",
  "reason": "Optional cancellation reason"
}
```

**Response**:
```json
{
  "success": true,
  "mandate_id": "uuid",
  "contract_ref": "PF-XXXXX-XXXXX",
  "status": "cancelled",
  "response_code": "00",
  "response_message": "Mandate cancelled successfully"
}
```

#### 4. `nupay-settlement-report` (New)
Retrieves settlement and collection reports from NuPay.

**Endpoint**: `POST /functions/v1/nupay-settlement-report`

**Request Body**:
```json
{
  "report_type": "settlement",  // or "collection", "instalment"
  "start_date": "2026-08-01",
  "end_date": "2026-08-31",
  "contract_ref": "PF-XXXXX-XXXXX",  // optional
  "mandate_id": "uuid"  // optional
}
```

**Response**:
```json
{
  "success": true,
  "report_type": "settlement",
  "date_range": {
    "start_date": "2026-08-01",
    "end_date": "2026-08-31"
  },
  "record_count": 10,
  "data": [
    {
      "ContractRef": "PF-XXXXX-XXXXX",
      "CollectionDate": "2026-08-15",
      "Amount": 50000,
      "Status": "COLLECTED"
    }
  ],
  "stored_report_id": "uuid"
}
```

#### 5. `nupay-callback` (Existing)
Webhook endpoint that receives status updates from NuPay when mandate status changes.

**Endpoint**: `POST /functions/v1/nupay-callback` (no JWT required)

**Webhook Headers**: Include `x-webhook-secret` header for verification

## Database Schema

### Tables

#### `debicheck_mandates`
Main table for tracking DebiCheck mandates.

```sql
- id (UUID, PK)
- application_id (UUID, FK)
- user_id (UUID, FK)
- contract_ref (TEXT, UNIQUE)
- nupay_mandate_id (TEXT)
- debicheck_type (TEXT: 'TT1' or 'TT2')
- instalment_amount (INTEGER)
- num_instalments (INTEGER)
- frequency (TEXT: 'once-off', 'weekly', 'monthly')
- first_strike_date (DATE)
- tracking_days (INTEGER: 10 or 32)
- client_* (TEXT: name, id_number, mobile, bank, account_number, account_type, branch_code)
- status (TEXT: 'draft', 'mandate_submitted', 'pending_bank', 'accepted', 'rejected', 'cancelled', 'error')
- nupay_response_code (TEXT)
- nupay_response_message (TEXT)
- error_details (TEXT)
- total_collected (INTEGER)
- total_failed (INTEGER)
- last_collection_date (DATE)
- next_collection_date (DATE)
- collections_count (INTEGER)
- initiated_at (TIMESTAMPTZ)
- status_updated_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
```

#### `debicheck_collections`
Tracks individual collection attempts.

```sql
- id (UUID, PK)
- mandate_id (UUID, FK)
- collection_date (DATE)
- collection_amount (INTEGER)
- collection_status (TEXT: 'pending', 'collected', 'failed', 'reversed', 'cancelled')
- nupay_collection_id (TEXT)
- nupay_response_code (TEXT)
- nupay_response_message (TEXT)
- retry_count (INTEGER)
- last_retry_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

#### `debicheck_settlements`
Tracks settlement batches from NuPay.

```sql
- id (UUID, PK)
- settlement_date (DATE)
- settlement_period (TEXT)
- total_collected (INTEGER)
- total_settled (INTEGER)
- total_failed (INTEGER)
- total_reversed (INTEGER)
- nupay_settlement_id (TEXT)
- nupay_response_code (TEXT)
- nupay_response_message (TEXT)
- status (TEXT: 'pending', 'settled', 'failed', 'partial')
- settlement_data (JSONB)
- created_at (TIMESTAMPTZ)
- settled_at (TIMESTAMPTZ)
```

#### `debicheck_instalments`
Tracks individual instalments for multi-instalment mandates.

```sql
- id (UUID, PK)
- mandate_id (UUID, FK)
- instalment_number (INTEGER)
- instalment_amount (INTEGER)
- due_date (DATE)
- status (TEXT: 'pending', 'collected', 'failed', 'waived', 'cancelled')
- collected_date (DATE)
- collected_amount (INTEGER)
- nupay_collection_id (TEXT)
- nupay_response_code (TEXT)
- nupay_response_message (TEXT)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

#### `debicheck_reports`
Stores settlement and collection reports from NuPay.

```sql
- id (UUID, PK)
- report_type (TEXT: 'settlement', 'collection', 'instalment')
- start_date (DATE)
- end_date (DATE)
- report_data (JSONB)
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
```

## Environment Variables

Set these in Supabase Dashboard → Edge Functions → Secrets:

```
NUPAY_API_URL=https://api.nupay.co.za/v1
NUPAY_MERCHANT_ID=25500019658
NUPAY_TERMINAL_ID=<your-terminal-id>
NUPAY_API_KEY=<base64-encoded-username:password>
NUPAY_WEBHOOK_SECRET=<shared-secret-for-webhook-verification>
```

### Encoding Credentials

NuPay requires base64-encoded credentials for the API key:

```bash
# Encode username:password
echo -n "NSK25500019658:M%@Dm4618E" | base64
# Output: TlNLMjU1MDAwMTk2NTg6TSVARG00NjE4RQ==
```

Set `NUPAY_API_KEY` to the base64-encoded value.

## UI Components

### Admin Dashboard

#### `MandateManagementPanel`
Displays mandate details and provides admin controls.

**Features**:
- View mandate status and details
- Sync status with NuPay
- Cancel mandate with reason
- View collection history
- Display NuPay response messages

**Props**:
```typescript
interface MandateManagementPanelProps {
  mandate: MandateRecord | null;
  applicationId: string;
  onMandateUpdate?: (mandate: MandateRecord) => void;
}
```

**Usage**:
```tsx
<MandateManagementPanel
  mandate={mandate}
  applicationId={app.id}
  onMandateUpdate={(updated) => setMandate(updated)}
/>
```

### Client Dashboard

#### `ClientMandateStatus`
Displays mandate status to clients with self-service options.

**Features**:
- View mandate status with clear descriptions
- Refresh status from NuPay
- Cancel mandate (if active)
- View collection history
- Pending bank alerts

**Props**:
```typescript
interface ClientMandateStatusProps {
  mandate: MandateRecord | null;
  applicationId: string;
  onMandateUpdate?: (mandate: MandateRecord) => void;
}
```

**Usage**:
```tsx
<ClientMandateStatus
  mandate={mandate}
  applicationId={app.id}
  onMandateUpdate={(updated) => setMandate(updated)}
/>
```

## Workflow

### 1. Mandate Initiation

1. Admin clicks "Initiate NuPay DebiCheck" in application detail view
2. DebiCheckModal opens with pre-filled client and bank details
3. Admin selects:
   - DebiCheck Type (TT1 or TT2)
   - Instalment amount
   - Number of instalments
   - Frequency (once-off, weekly, monthly)
   - First strike date
   - Tracking days (10 or 32)
4. Admin submits form
5. Mandate record created as "draft"
6. `nupay-initiate` function called
7. Mandate submitted to NuPay API
8. Status updated to "mandate_submitted"
9. Client receives notification

### 2. Client Authentication (TT1)

1. Client receives push notification on banking app
2. Client authenticates mandate
3. NuPay sends webhook callback with status update
4. `nupay-callback` function updates mandate to "accepted"
5. Client sees "Approved" status in portal

### 3. Collection Process

1. On first strike date, NuPay attempts collection
2. If successful, collection recorded in `debicheck_collections`
3. If failed, retry attempts made over tracking period (10 or 32 days)
4. Settlement batch created when collections settle
5. Admin can view collection history and settlement reports

### 4. Mandate Cancellation

1. Admin or client clicks "Cancel Mandate"
2. Confirmation dialog shown
3. `nupay-mandate-cancel` function called
4. Mandate marked as "cancelled" in database
5. No further collections attempted

## Testing

### Test Credentials

```
Merchant Number: 25500019658
Username: NSK25500019658
Password: M%@Dm4618E
API Key (base64): TlNLMjU1MDAwMTk2NTg6TSVARG00NjE4RQ==
```

### Important Notes

- Testing must be done in LIVE environment (no UAT/Sandbox available)
- Use active test accounts with correct details
- R10.00 load limit on test merchant (to prevent accidental collections)
- NuPay will NOT settle collections on test merchant
- Cancel test collections before debit date to avoid processing

### Test Workflow

1. Create a test loan application with real bank details
2. Approve application and create contract
3. Click "Initiate NuPay DebiCheck"
4. Submit mandate with TT1 type
5. Check NuPay dashboard for mandate status
6. Verify webhook callback updates mandate status
7. Test cancellation if needed

## Monitoring & Maintenance

### Regular Tasks

1. **Daily**: Check for failed collections and retry
2. **Weekly**: Review settlement reports
3. **Monthly**: Reconcile collections with bank statements
4. **Quarterly**: Review mandate performance and client feedback

### Troubleshooting

#### Mandate stuck in "pending_bank"
- Check if client received push notification
- Verify client's banking app is up to date
- Check NuPay dashboard for timeout settings
- Consider manual cancellation and retry

#### Collections failing
- Verify client has sufficient funds
- Check for account issues (frozen, closed, etc.)
- Review NuPay response codes for specific errors
- Contact client to resolve account issues

#### Webhook not updating status
- Verify webhook URL registered in NuPay portal
- Check webhook secret matches environment variable
- Review Edge Function logs for errors
- Test webhook manually from NuPay dashboard

## API Response Codes

Common NuPay response codes:

| Code | Meaning |
|------|---------|
| 00 | Success |
| 01 | Invalid request |
| 02 | Authentication failed |
| 03 | Mandate not found |
| 04 | Invalid mandate status |
| 05 | Collection failed |
| 06 | Insufficient funds |
| 07 | Account closed/frozen |
| 08 | Timeout |
| 99 | Unknown error |

## Security Considerations

1. **API Keys**: Store in Supabase Secrets, never commit to repo
2. **Webhook Verification**: Always verify webhook secret
3. **RLS Policies**: Clients can only see their own mandates
4. **Audit Logging**: All mandate actions logged for compliance
5. **Data Encryption**: Sensitive data encrypted at rest
6. **Rate Limiting**: Implement rate limits on API endpoints

## Compliance

- **POPIA**: Client consent captured before mandate initiation
- **NCA**: Compliance with National Credit Act requirements
- **DebiCheck**: Adherence to DebiCheck rules and regulations
- **Audit Trail**: Complete audit log of all mandate actions

## Support

For issues or questions:
1. Check NuPay API documentation
2. Review Edge Function logs in Supabase Dashboard
3. Check database audit logs for transaction history
4. Contact NuPay support for API-level issues
5. Contact Devin for code-level issues

## References

- NuPay API Documentation: See PDF specifications in `/Documents/NuPayment Integration/`
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- DebiCheck Rules: https://www.debicheck.co.za/
- South African Banking Standards: https://www.bankingsupport.co.za/
