-- ── Loan Contracts Table ─────────────────────────────────────────────
create table if not exists public.loan_contracts (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid not null references public.loan_applications(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  contract_number     text not null unique,
  generated_by        uuid references auth.users(id),
  generated_at        timestamptz not null default now(),
  signed_by_client    boolean not null default false,
  client_signature    text,          -- base64 data-URL of signature
  signed_at           timestamptz,
  client_ip           text,
  status              text not null default 'pending_signature'
                        check (status in ('pending_signature','signed','cancelled')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- indexes
create index if not exists loan_contracts_application_id_idx on public.loan_contracts(application_id);
create index if not exists loan_contracts_user_id_idx       on public.loan_contracts(user_id);

-- updated_at trigger
create or replace function public.set_loan_contracts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists loan_contracts_updated_at on public.loan_contracts;
create trigger loan_contracts_updated_at
  before update on public.loan_contracts
  for each row execute function public.set_loan_contracts_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.loan_contracts enable row level security;

-- Clients: read their own contracts
create policy "clients_read_own_contracts"
  on public.loan_contracts for select
  using (auth.uid() = user_id);

-- Clients: update (sign) their own pending contracts
create policy "clients_sign_own_contracts"
  on public.loan_contracts for update
  using (auth.uid() = user_id and status = 'pending_signature')
  with check (auth.uid() = user_id);

-- Admins: full access via role check
create policy "admins_all_contracts"
  on public.loan_contracts for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','owner')
    )
  );

-- Admins: insert (generate) contracts
create policy "admins_insert_contracts"
  on public.loan_contracts for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','owner')
    )
  );
