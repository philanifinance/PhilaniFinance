-- ── Loan Disbursement & Repayment Tracking ───────────────────────────
-- Adds disbursement and repayment status columns to loan_applications.
-- loan_disbursed_at : timestamp when admin clicked "Mark as Paid / Disbursed"
-- loan_paid_at      : timestamp when admin clicked "Payment Received"
-- loan_status       : overall lifecycle status beyond approval
--   'approved'      : approved but not yet disbursed
--   'disbursed'     : money sent to client
--   'repaid'        : client has repaid in full
--   'defaulted'     : client failed to repay

alter table public.loan_applications
  add column if not exists loan_disbursed_at  timestamptz,
  add column if not exists loan_paid_at       timestamptz,
  add column if not exists loan_lifecycle     text
    check (loan_lifecycle in ('approved','disbursed','repaid','defaulted'));
