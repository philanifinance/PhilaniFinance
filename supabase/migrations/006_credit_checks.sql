-- ============================================================
-- Credit Bureau Check Storage
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Summary table ────────────────────────────────────────────
-- Stores only the bureau response summary, NOT the full report.
-- Full report is never persisted locally (POPIA compliance).

CREATE TABLE IF NOT EXISTS public.credit_checks (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id      UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performed_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Bureau reference
  bureau_name         TEXT NOT NULL DEFAULT 'experian',
  bureau_reference    TEXT,

  -- Identity verification
  identity_status     TEXT NOT NULL DEFAULT 'unknown'
                      CHECK (identity_status IN ('verified', 'warning', 'mismatch', 'unknown', 'error')),
  identity_details    TEXT,

  -- Credit scoring
  credit_score        INTEGER,
  credit_score_band   TEXT CHECK (credit_score_band IN ('excellent', 'good', 'fair', 'poor', 'very_poor', NULL)),
  risk_category       TEXT,

  -- Adverse indicators
  has_judgments        BOOLEAN DEFAULT FALSE,
  has_defaults         BOOLEAN DEFAULT FALSE,
  has_debt_review      BOOLEAN DEFAULT FALSE,
  adverse_count       INTEGER DEFAULT 0,
  adverse_summary     TEXT,

  -- Affordability cross-reference
  bureau_monthly_income    INTEGER,
  bureau_debt_obligations  INTEGER,
  user_monthly_income      INTEGER,
  income_match             TEXT CHECK (income_match IN ('match', 'mismatch', 'unavailable', NULL)),

  -- Consent
  consent_reference   TEXT NOT NULL,
  consent_timestamp   TIMESTAMPTZ NOT NULL,

  -- Status
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'completed', 'error')),
  error_details       TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_checks_application ON public.credit_checks(application_id);
CREATE INDEX idx_credit_checks_user        ON public.credit_checks(user_id);

-- ── Add summary columns to loan_applications ────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS last_credit_score        INTEGER,
  ADD COLUMN IF NOT EXISTS last_credit_check_id     UUID REFERENCES public.credit_checks(id),
  ADD COLUMN IF NOT EXISTS credit_check_timestamp   TIMESTAMPTZ;

-- ── RLS Policies ────────────────────────────────────────────
ALTER TABLE public.credit_checks ENABLE ROW LEVEL SECURITY;

-- Only owner-role users can insert (via Edge Function service role)
CREATE POLICY credit_checks_owner_read ON public.credit_checks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'owner'
    )
  );

-- Service-role inserts handled by Edge Function (bypasses RLS)
-- Admins with owner role can read; no one else can see credit data
