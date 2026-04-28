-- Fix infinite recursion in RLS policies
-- The admin check on profiles was querying profiles itself, causing a loop.
-- Solution: Use a SECURITY DEFINER function to bypass RLS for admin checks.

-- Create admin check function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Admins can update all applications" ON public.loan_applications;

DROP POLICY IF EXISTS "Users can view own documents" ON public.application_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.application_documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON public.application_documents;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;

-- Recreate profiles policies (no recursion)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Recreate loan_applications policies
CREATE POLICY "Users can view own applications"
  ON public.loan_applications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own applications"
  ON public.loan_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all applications"
  ON public.loan_applications FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update all applications"
  ON public.loan_applications FOR UPDATE
  USING (public.is_admin());

-- Recreate documents policies
CREATE POLICY "Users can view own documents"
  ON public.application_documents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own documents"
  ON public.application_documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all documents"
  ON public.application_documents FOR SELECT
  USING (public.is_admin());

-- Recreate audit logs policies
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = actor_id);
