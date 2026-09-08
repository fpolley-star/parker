Alter table cordic_logins
alter column account_number drop not null,
add column type text not null default 'account' check (type in ('personal','account'));
