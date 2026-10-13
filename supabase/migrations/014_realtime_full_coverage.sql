-- ============================================================
-- Fix: the admin dashboard has had realtime subscription code for
-- loan_contracts since migration 011, but `pg_publication_tables`
-- shows the supabase_realtime publication has had ZERO tables in it
-- all along — migration 011 was apparently never actually run against
-- this database, so that subscription has silently done nothing.
--
-- This adds loan_contracts (so the existing subscription starts
-- working) plus loan_applications and debicheck_mandates, so admin
-- dashboard status changes (decision, DebiCheck mandate status) also
-- update live instead of requiring a manual refresh.
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_contracts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.debicheck_mandates;
