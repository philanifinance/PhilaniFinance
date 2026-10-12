-- ============================================================
-- Align DebiCheck mandate schema with the real NuPay DebiCheck
-- webservice specifications (see "NuPayment Integration" PDFs).
--
-- Key findings from the official specs that this migration fixes:
--   - NuPay auto-generates its own 14-char "contractReference" when
--     the initiation request leaves it blank. We now store that
--     value separately instead of assuming our own ref is sent as-is.
--   - The initiation response also returns a "mandateRequestTranId",
--     which the Mandate Status webservice can search on.
--   - Status is reported with a documented "mandateStatusGrouping"
--     (Pending / Rejected / Active) plus a status_reason_code — we
--     store the reason code for support/debugging visibility.
--   - DebtorIdType is a required field (NuPay Appendix 5.3); we
--     default to "2" (SA ID Document) since this product only
--     collects SA ID numbers today.
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.debicheck_mandates
  ADD COLUMN IF NOT EXISTS nupay_contract_reference TEXT,
  ADD COLUMN IF NOT EXISTS nupay_mandate_request_tran_id TEXT,
  ADD COLUMN IF NOT EXISTS nupay_status_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS debtor_id_type TEXT NOT NULL DEFAULT '2';

CREATE INDEX IF NOT EXISTS idx_mandates_nupay_contract_ref
  ON public.debicheck_mandates(nupay_contract_reference);

COMMENT ON COLUMN public.debicheck_mandates.contract_ref IS
  'Our internal reference, sent to NuPay as "clientReference" (max 35 chars).';
COMMENT ON COLUMN public.debicheck_mandates.nupay_contract_reference IS
  'The "contractReference" NuPay generated/echoed back (max 14 chars) — required for status/maintenance/cancellation lookups.';
COMMENT ON COLUMN public.debicheck_mandates.nupay_mandate_request_tran_id IS
  'The "mandateRequestTranId" returned by NuPay on initiation.';
COMMENT ON COLUMN public.debicheck_mandates.nupay_status_reason_code IS
  'Latest "status_reason_code" from the Mandate Status webservice (DebiCheck/NuPay response code).';
