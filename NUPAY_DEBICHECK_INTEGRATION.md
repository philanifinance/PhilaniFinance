# NuPay DebiCheck Integration — Reference

This is the authoritative doc for this integration. It replaces the older
`DEBICHECK_*.md`, `WEBHOOK_SETUP_GUIDE.md`, `YOUR_WEBHOOK_URL.md`,
`NUPAY_PORTAL_NAVIGATION.md` and `ENVIRONMENT_VARIABLES_SETUP.md` files,
which were written against an **assumed** API shape (JWT bearer tokens, a
Terminal ID, a webhook callback) that does not match NuPay's actual
DebiCheck webservices. Those files are now marked deprecated — see the end
of this doc for what to do with them.

The real API contracts come from the spec PDFs in `NuPayment Integration/`:

| Spec PDF | Webservice(s) | Used by |
|---|---|---|
| Mandate Initiation Specification v3.7 | `mandate_initiation` | `nupay-initiate` |
| Mandate Status Specification v1.5 | `mandate_status`, `maintenance_status_check` | `nupay-mandate-status`, `nupay-status-poll` |
| Mandate Maintenance Specification v3 | `mandate_maintenance`, `mandate_cancellation`, `update_employer_code` | `nupay-mandate-cancel` |
| Settlement Report v1.4 | `report/settlement_report` | `nupay-settlement-report` |
| Mandate and Instalment Reporting v2.6 | `report/mandate_report`, `report/instalment_report` | not yet built |
| Instalment Maintenance v1.5 | `add_instalment`, `instalment_maintenance`, `instalment_reschedule`, `instalment_cancellation`, `reactivate_instalment`, `instalment_recall` | not yet built |
| Strike Date Analysis v1.1 | `strike_date_analysis` | not yet built |

## What was wrong before

1. **Auth.** The old code called a fictional `POST {apiUrl}/auth/token` with
   `MerchantID`/`TerminalID`/`APIKey` to get a JWT, then sent
   `Authorization: Bearer <token>`. The real API has no token endpoint and no
   Terminal ID at all. Every request body carries an `"auth"` field:
   `Base64("username:password")`, computed fresh per call.
2. **Base URL.** The old code used `https://api.nupay.co.za/v1` with made-up
   paths like `/debicheck/mandate/initiate`. The real base is
   `https://btm.nupay.co.za/wsDebiCheck/`, with one fixed path per method
   (e.g. `/mandate_initiation`, `/mandate_status`, `/mandate_cancellation`).
3. **Field names/shapes.** Every request/response field name, the currency
   format (`"500.00"`, not cents), the mandatory `contractReference` 14-char
   limit, the account type and bank ID codes, and the tracking indicator
   range (`00`–`10`, not up to 32) were invented and didn't match the spec.
4. **Webhooks.** None of the seven spec PDFs document a push/webhook
   notification. Every method is a synchronous request the merchant calls;
   status changes are discovered by polling `mandate_status`. The old
   `nupay-callback` function, the webhook secret, and the "register a
   webhook in the NuPay portal" instructions describe a mechanism that does
   not exist in this API. `nupay-callback` has been removed; a scheduled
   `nupay-status-poll` function now does the polling instead (see below).

## Current architecture

```
DebiCheckModal (admin UI)
  → insert debicheck_mandates row (status: draft)
  → invoke nupay-initiate
        → POST /mandate_initiation  (auth is a body field, not a header)
        → store nupay_mandate_id / nupay_contract_reference /
          nupay_mandate_request_tran_id, map Status → internal status

ClientMandateStatus / MandateManagementPanel ("Refresh" button)
  → invoke nupay-mandate-status
        → POST /mandate_status (search_type: mandate_id)
        → map mandateStatusGrouping (Pending/Rejected/Active) → internal status

nupay-status-poll (cron, e.g. every 15 min — no webhook exists to replace this)
  → same as above, for every mandate still in mandate_submitted/pending_bank

Cancel button → nupay-mandate-cancel
  → POST /mandate_cancellation (cancelReason: MD17, cancelTracking: F)

Admin settlement view → nupay-settlement-report
  → POST /report/settlement_report (dateFrom/dateTo as YYYYMMDD)
```

Internal mandate status values are unchanged from before (`draft`,
`mandate_submitted`, `pending_bank`, `accepted`, `rejected`, `cancelled`,
`error`) — only how they're derived from NuPay's responses changed, so the
frontend components didn't need to change their status handling.

## Required environment variables (Supabase Edge Functions → Secrets)

```
NUPAY_USERNAME     — NuPay merchant portal username (e.g. NSK25500019658)
NUPAY_PASSWORD     — NuPay merchant portal password
NUPAY_MERCHANT_ID  — Your NuPay merchant number (e.g. 25500019658) — the
                     code zero-pads this to 15 digits itself, don't pre-pad it.
```

There is no `NUPAY_API_URL`, `NUPAY_TERMINAL_ID`, `NUPAY_API_KEY`, or
`NUPAY_WEBHOOK_SECRET` — none of those exist in the real API.

## Known gaps / follow-ups

- **Investec is not DebiCheck-capable.** It's not in NuPay's Financial
  Institution ID list (Appendix 5.5). The loan application form still offers
  it as a bank option; `DebiCheckModal` now blocks mandate initiation for it
  with an explicit warning, but the application flow itself doesn't prevent
  someone from signing up with Investec in the first place.
- **Debtor ID type** is hardcoded to `"2"` (SA ID Document) in the new
  `debtor_id_type` column — fine today since the form only collects SA ID
  numbers, but will need wiring up if passport/temporary-residence debtors
  are ever supported.
- **Reporting and Instalment Maintenance webservices** (mandate/instalment
  reports, add/reschedule/cancel individual instalments, Strike Date
  Analysis) are documented in the PDFs but have no edge functions yet. The
  `debicheck_instalments` table exists in the schema but nothing populates
  or maintains it — the settlement report is the only reporting surface
  wired up so far.
- **Tracking indicator** is capped to NuPay's documented `00`–`10` range in
  the UI (previously offered 10/32 days, where 32 isn't a valid value).

## Deprecated docs

`WEBHOOK_SETUP_GUIDE.md`, `YOUR_WEBHOOK_URL.md`, `NUPAY_PORTAL_NAVIGATION.md`,
`ENVIRONMENT_VARIABLES_SETUP.md`, `DEBICHECK_README.md`,
`DEBICHECK_COMPLETION_REPORT.md`, `DEBICHECK_SUMMARY.md`,
`DEBICHECK_DEPLOYMENT.md` and `DEBICHECK_INTEGRATION.md` all describe the
fictional JWT/Terminal-ID/webhook setup and are now out of date. Each has
been given a one-line banner pointing here. It's safe to delete all of them
— `git rm WEBHOOK_SETUP_GUIDE.md YOUR_WEBHOOK_URL.md NUPAY_PORTAL_NAVIGATION.md ENVIRONMENT_VARIABLES_SETUP.md DEBICHECK_README.md DEBICHECK_COMPLETION_REPORT.md DEBICHECK_SUMMARY.md DEBICHECK_DEPLOYMENT.md DEBICHECK_INTEGRATION.md`.
