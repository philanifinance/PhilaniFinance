-- ============================================================
-- Ozow Bank Link / Transaction History Storage
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE public.ozow_bank_links (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id  UUID REFERENCES public.loan_applications(id) ON DELETE SET NULL,

  -- Ozow identifiers
  ozow_transaction_id TEXT NOT NULL,
  ozow_reference      TEXT,

  -- Bank info returned by Ozow
  bank_name           TEXT NOT NULL DEFAULT '',
  account_holder      TEXT NOT NULL DEFAULT '',
  account_number_masked TEXT NOT NULL DEFAULT '',

  -- Status
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'authenticated', 'fetching', 'complete', 'error')),
  error_details   TEXT,

  -- Fetched data summary
  transactions_count  INTEGER DEFAULT 0,
  date_range_start    DATE,
  date_range_end      DATE,
  raw_data_path       TEXT,              -- Storage path to JSON dump if stored

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_ozow_links_user ON public.ozow_bank_links(user_id);
CREATE INDEX idx_ozow_links_app ON public.ozow_bank_links(application_id);

-- RLS
ALTER TABLE public.ozow_bank_links ENABLE ROW LEVEL SECURITY;

-- Users can see their own links
CREATE POLICY "Users can read own ozow links"
  ON public.ozow_bank_links FOR SELECT
  USING (user_id = auth.uid());

-- Users can create own links
CREATE POLICY "Users can insert own ozow links"
  ON public.ozow_bank_links FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update own links
CREATE POLICY "Users can update own ozow links"
  ON public.ozow_bank_links FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can read all
CREATE POLICY "Admins can read all ozow links"
  ON public.ozow_bank_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
