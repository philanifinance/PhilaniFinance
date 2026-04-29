-- ============================================================
-- Add explicit credit check consent fields to loan_applications
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS credit_consent_given  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS credit_consent_at     TIMESTAMPTZ;
