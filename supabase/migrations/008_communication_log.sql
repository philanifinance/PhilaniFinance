-- ============================================================
-- Communication Log table for SMS & Email notifications
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.communication_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('loan_approved', 'debicheck_initiated', 'debicheck_reminder')),
  recipient     TEXT NOT NULL,
  subject       TEXT,
  body_preview  TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  provider      TEXT,
  provider_ref  TEXT,
  error_details TEXT,
  sent_by       UUID,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups per application
CREATE INDEX IF NOT EXISTS idx_comm_log_app ON public.communication_log(application_id);
CREATE INDEX IF NOT EXISTS idx_comm_log_event ON public.communication_log(trigger_event, status);

-- RLS: only owner/admin can view communication logs
ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage communication_log"
  ON public.communication_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  );
