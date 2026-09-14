create table cordic_accounts (
 id uuid primary key default gen_random_uuid(),
 account_number citext unique not null,
 "references" jsonb,
 created_at timestamptz default now()
);
alter table cordic_accounts enable row level security;

alter table cordic_logins add column account_id uuid references cordic_accounts(id);
-- one account per distinct number
insert into cordic_accounts (account_number)
select distinct account_number from cordic_logins
where type = 'account' and account_number is not null
on conflict (account_number) do nothing;

-- link the logins
update cordic_logins l
set account_id = a.id
from cordic_accounts a
where l.account_number = a.account_number and l.type = 'account';

create policy "read_accounts_you_belong_to"
ON cordic_accounts
for select
to authenticated
using (
  exists (
    select 1 from cordic_logins l
    join cordic_memberships m on m.cordic_login_id = l.id
    where l.account_id = cordic_accounts.id
      and m.user_id = auth.uid()
  )
)