-- Enable realtime for loan_contracts so admins receive live updates when clients sign
alter publication supabase_realtime add table public.loan_contracts;
