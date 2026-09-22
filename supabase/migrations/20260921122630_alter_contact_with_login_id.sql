alter table contacts
  add column cordic_login_id uuid not null references cordic_logins(id);