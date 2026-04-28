-- ============================================================
-- DebiCheck Mandate Tracking
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE public.debicheck_mandates (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- NuPay identifiers
  contract_ref  TEXT NOT NULL UNIQUE,           -- Unique loan reference sent to NuPay
  nupay_mandate_id TEXT,                         -- ID returned by NuPay after submission

  -- Mandate parameters
  debicheck_type TEXT NOT NULL DEFAULT 'TT1',    -- TT1 = Real-Time, TT2 = Non-Real-Time
  instalment_amount INTEGER NOT NULL,            -- In ZAR cents or whole rands (match your schema)
  num_instalments INTEGER NOT NULL DEFAULT 1,
  frequency     TEXT NOT NULL DEFAULT 'once-off', -- once-off, weekly, monthly
  first_strike_date DATE NOT NULL,
  tracking_days INTEGER NOT NULL DEFAULT 10,     -- Days NuPay tracks for funds (10 or 32)

  -- Client details snapshot (captured at initiation time)
  client_name   TEXT NOT NULL,
  client_id_number TEXT NOT NULL,
  client_mobile TEXT NOT NULL,
  client_bank   TEXT NOT NULL,
  client_account_number TEXT NOT NULL,
  client_account_type TEXT NOT NULL,
  client_branch_code TEXT NOT NULL DEFAULT '',

  -- Status tracking
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN (
                  'draft',              -- Modal opened, not yet sent
                  'mandate_submitted',  -- Sent to NuPay API
                  'pending_bank',       -- NuPay confirmed receipt, at bank
                  'accepted',           -- Client authenticated via banking app
                  'rejected',           -- Client declined or timeout
                  'cancelled',          -- Admin cancelled
                  'error'               -- API or network error
                )),
  nupay_response_code TEXT,
  nupay_response_message TEXT,
  error_details TEXT,

  -- Audit
  initiated_by  UUID NOT NULL REFERENCES auth.users(id),
  initiated_at  TIMESTAMPTZ DEFAULT NOW(),
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_mandates_application ON public.debicheck_mandates(application_id);
CREATE INDEX idx_mandates_status ON public.debicheck_mandates(status);
CREATE INDEX idx_mandates_contract_ref ON public.debicheck_mandates(contract_ref);

-- RLS
ALTER TABLE public.debicheck_mandates ENABLE ROW LEVEL SECURITY;

-- Admins/Owners can read all mandates
CREATE POLICY "Admins can read mandates"
  ON public.debicheck_mandates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Admins/Owners can create mandates
CREATE POLICY "Admins can create mandates"
  ON public.debicheck_mandates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Admins/Owners can update mandates
CREATE POLICY "Admins can update mandates"
  ON public.debicheck_mandates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Service role (Edge Functions) bypasses RLS automatically.
-- Webhook handler uses service_role key so no extra policy needed.

-- Clients can see their own mandate status (read-only)
CREATE POLICY "Clients can read own mandates"
  ON public.debicheck_mandates FOR SELECT
  USING (user_id = auth.uid());
