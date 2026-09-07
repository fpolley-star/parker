create table cordic_logins (
  id uuid primary key default gen_random_uuid(),
  account_number text not null,
  username text not null,
  secret_id uuid not null,
  created_at timestamptz not null default now(),
  unique (account_number, username)
);

alter table cordic_logins enable row level security;