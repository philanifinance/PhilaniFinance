-- ============================================================
-- DebiCheck Collections & Settlement Tracking
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Table for storing settlement reports from NuPay
CREATE TABLE public.debicheck_reports (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Report metadata
  report_type   TEXT NOT NULL DEFAULT 'settlement'
                CHECK (report_type IN ('settlement', 'collection', 'instalment')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  
  -- Report data (JSON array of collections/settlements)
  report_data   JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata about the report
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Index for fast lookups
CREATE INDEX idx_reports_type_dates ON public.debicheck_reports(report_type, start_date, end_date);
CREATE INDEX idx_reports_created ON public.debicheck_reports(created_at DESC);

-- RLS
ALTER TABLE public.debicheck_reports ENABLE ROW LEVEL SECURITY;

-- Admins/Owners can read all reports
CREATE POLICY "Admins can read reports"
  ON public.debicheck_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Table for tracking individual collections
CREATE TABLE public.debicheck_collections (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mandate_id        UUID NOT NULL REFERENCES public.debicheck_mandates(id) ON DELETE CASCADE,
  
  -- Collection details from NuPay
  collection_date   DATE NOT NULL,
  collection_amount INTEGER NOT NULL,  -- In cents or whole rands (match your schema)
  collection_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (collection_status IN (
                      'pending',      -- Awaiting collection
                      'collected',    -- Successfully collected
                      'failed',       -- Collection failed
                      'reversed',     -- Collection reversed
                      'cancelled'     -- Collection cancelled
                    )),
  
  -- NuPay response details
  nupay_collection_id TEXT,
  nupay_response_code TEXT,
  nupay_response_message TEXT,
  
  -- Retry tracking
  retry_count       INTEGER DEFAULT 0,
  last_retry_at     TIMESTAMPTZ,
  
  -- Audit
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_collections_mandate ON public.debicheck_collections(mandate_id);
CREATE INDEX idx_collections_date ON public.debicheck_collections(collection_date);
CREATE INDEX idx_collections_status ON public.debicheck_collections(collection_status);

-- RLS
ALTER TABLE public.debicheck_collections ENABLE ROW LEVEL SECURITY;

-- Admins can read all collections
CREATE POLICY "Admins can read collections"
  ON public.debicheck_collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Clients can read their own collections
CREATE POLICY "Clients can read own collections"
  ON public.debicheck_collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.debicheck_mandates dm
      WHERE dm.id = mandate_id AND dm.user_id = auth.uid()
    )
  );

-- Table for tracking settlement batches
CREATE TABLE public.debicheck_settlements (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Settlement batch details
  settlement_date   DATE NOT NULL,
  settlement_period TEXT NOT NULL,  -- e.g., "2026-08-01 to 2026-08-31"
  
  -- Financial summary
  total_collected   INTEGER NOT NULL DEFAULT 0,  -- In cents or whole rands
  total_settled     INTEGER NOT NULL DEFAULT 0,
  total_failed      INTEGER NOT NULL DEFAULT 0,
  total_reversed    INTEGER NOT NULL DEFAULT 0,
  
  -- NuPay details
  nupay_settlement_id TEXT,
  nupay_response_code TEXT,
  nupay_response_message TEXT,
  
  -- Settlement status
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'settled', 'failed', 'partial')),
  
  -- Settlement data (JSON array of collection details)
  settlement_data   JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Audit
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  settled_at        TIMESTAMPTZ,
  
  CONSTRAINT valid_settlement_dates CHECK (settled_at IS NULL OR settled_at >= created_at)
);

-- Indexes
CREATE INDEX idx_settlements_date ON public.debicheck_settlements(settlement_date);
CREATE INDEX idx_settlements_status ON public.debicheck_settlements(status);

-- RLS
ALTER TABLE public.debicheck_settlements ENABLE ROW LEVEL SECURITY;

-- Admins can read all settlements
CREATE POLICY "Admins can read settlements"
  ON public.debicheck_settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Table for mandate instalment tracking
CREATE TABLE public.debicheck_instalments (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mandate_id        UUID NOT NULL REFERENCES public.debicheck_mandates(id) ON DELETE CASCADE,
  
  -- Instalment details
  instalment_number INTEGER NOT NULL,
  instalment_amount INTEGER NOT NULL,  -- In cents or whole rands
  due_date          DATE NOT NULL,
  
  -- Status tracking
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending',      -- Awaiting collection
                      'collected',    -- Successfully collected
                      'failed',       -- Collection failed
                      'waived',       -- Instalment waived
                      'cancelled'     -- Cancelled
                    )),
  
  -- Collection details
  collected_date    DATE,
  collected_amount  INTEGER,
  
  -- NuPay tracking
  nupay_collection_id TEXT,
  nupay_response_code TEXT,
  nupay_response_message TEXT,
  
  -- Audit
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_instalment_per_mandate UNIQUE(mandate_id, instalment_number)
);

-- Indexes
CREATE INDEX idx_instalments_mandate ON public.debicheck_instalments(mandate_id);
CREATE INDEX idx_instalments_due_date ON public.debicheck_instalments(due_date);
CREATE INDEX idx_instalments_status ON public.debicheck_instalments(status);

-- RLS
ALTER TABLE public.debicheck_instalments ENABLE ROW LEVEL SECURITY;

-- Admins can read all instalments
CREATE POLICY "Admins can read instalments"
  ON public.debicheck_instalments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Clients can read their own instalments
CREATE POLICY "Clients can read own instalments"
  ON public.debicheck_instalments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.debicheck_mandates dm
      WHERE dm.id = mandate_id AND dm.user_id = auth.uid()
    )
  );

-- Add columns to debicheck_mandates for tracking
ALTER TABLE public.debicheck_mandates
ADD COLUMN IF NOT EXISTS total_collected INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_failed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_collection_date DATE,
ADD COLUMN IF NOT EXISTS next_collection_date DATE,
ADD COLUMN IF NOT EXISTS collections_count INTEGER DEFAULT 0;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_mandates_last_collection ON public.debicheck_mandates(last_collection_date);
CREATE INDEX IF NOT EXISTS idx_mandates_next_collection ON public.debicheck_mandates(next_collection_date);
