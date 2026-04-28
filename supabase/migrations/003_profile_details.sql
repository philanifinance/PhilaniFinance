-- ============================================================
-- Extend profiles table with personal/employment/banking details
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS id_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS mobile_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS employer_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS monthly_income INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pay_date TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
