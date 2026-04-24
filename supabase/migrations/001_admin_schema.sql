-- Philani Finance Admin Dashboard Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users with role)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loan applications table (production-ready)
CREATE TABLE public.loan_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,

  -- Personal details
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  id_number TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  email TEXT NOT NULL,

  -- Employment details
  employer_name TEXT NOT NULL,
  monthly_income INTEGER NOT NULL,
  pay_date TEXT NOT NULL,

  -- Banking details
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL,

  -- Loan details
  loan_amount INTEGER NOT NULL,
  loan_term_days INTEGER NOT NULL,
  interest_amount INTEGER NOT NULL,
  service_fee INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL,
  total_repayable INTEGER NOT NULL,

  -- Status & admin workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application documents table
CREATE TABLE public.application_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID REFERENCES public.loan_applications ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('payslip', 'bank_statement', 'id_copy')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  actor_id UUID REFERENCES auth.users NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_loan_applications_status ON public.loan_applications(status);
CREATE INDEX idx_loan_applications_user_id ON public.loan_applications(user_id);
CREATE INDEX idx_loan_applications_created_at ON public.loan_applications(created_at DESC);
CREATE INDEX idx_application_documents_app_id ON public.application_documents(application_id);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target ON public.audit_logs(target_type, target_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Loan applications RLS
CREATE POLICY "Users can view own applications"
  ON public.loan_applications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own applications"
  ON public.loan_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all applications"
  ON public.loan_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update all applications"
  ON public.loan_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Documents RLS
CREATE POLICY "Users can view own documents"
  ON public.application_documents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own documents"
  ON public.application_documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all documents"
  ON public.application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Audit logs RLS
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

-- Storage bucket RLS for loan_documents
-- (Run in Supabase Dashboard -> Storage -> Policies)
-- Policy: Admins can select all objects in loan_documents bucket
-- CREATE POLICY "Admins can read all loan documents"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'loan_documents' AND
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND role IN ('admin', 'owner')
--     )
--   );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to make first user an owner (run manually after first signup)
-- UPDATE public.profiles SET role = 'owner' WHERE id = 'YOUR_USER_UUID';
