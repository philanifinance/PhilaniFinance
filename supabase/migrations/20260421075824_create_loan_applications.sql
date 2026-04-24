/*
  # Create Loan Applications Table

  ## Overview
  Creates the core table for storing Philani Finance loan applications submitted
  through the multi-step application flow.

  ## New Tables
  - `loan_applications`
    - `id` (uuid, primary key) - Unique application identifier
    - `created_at` (timestamptz) - Submission timestamp
    - `status` (text) - Application status: pending, reviewing, approved, rejected
    - `loan_amount` (numeric) - Requested loan amount in ZAR
    - `loan_term_days` (integer) - Requested repayment term in days
    - `interest_amount` (numeric) - Calculated interest
    - `service_fee` (numeric) - Calculated service fee
    - `vat_amount` (numeric) - VAT on fees
    - `total_repayable` (numeric) - Total amount to repay
    - `first_name` (text) - Applicant first name
    - `last_name` (text) - Applicant last name
    - `id_number` (text) - South African 13-digit ID number
    - `mobile_number` (text) - Mobile phone number
    - `email` (text) - Email address
    - `employer_name` (text) - Employer name
    - `monthly_income` (numeric) - Monthly income in ZAR
    - `pay_date` (text) - Pay date (e.g. 25th of the month)
    - `bank_name` (text) - Selected SA bank
    - `account_number` (text) - Bank account number
    - `account_type` (text) - Account type: cheque, savings, transmission

  ## Security
  - RLS enabled
  - Public insert policy (anyone can submit an application)
  - Authenticated users can read their own applications via email match
*/

CREATE TABLE IF NOT EXISTS loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  loan_amount numeric NOT NULL,
  loan_term_days integer NOT NULL,
  interest_amount numeric NOT NULL,
  service_fee numeric NOT NULL,
  vat_amount numeric NOT NULL,
  total_repayable numeric NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  id_number text NOT NULL,
  mobile_number text NOT NULL,
  email text NOT NULL,
  employer_name text NOT NULL,
  monthly_income numeric NOT NULL,
  pay_date text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL
);

ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a loan application"
  ON loan_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view their own applications"
  ON loan_applications FOR SELECT
  TO authenticated
  USING (email = (SELECT auth.jwt() ->> 'email'));
