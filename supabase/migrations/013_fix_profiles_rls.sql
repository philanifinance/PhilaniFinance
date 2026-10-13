-- ============================================================
-- Fix profiles table RLS policies for user profile management
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Add INSERT policy for users to create/update their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Ensure the existing UPDATE policy works correctly
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add UPSERT capability (for ProfileContext seeding from loan applications)
-- This allows users to update their profile even if it was seeded from application data
