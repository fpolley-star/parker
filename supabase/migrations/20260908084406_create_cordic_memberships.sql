create table cordic_memberships (
  cordic_login_id uuid not null,
  user_id uuid not null,

constraint link_to_login
  foreign key (cordic_login_id)
  references cordic_logins (id)
  on delete cascade,

constraint link_to_user
  foreign key (user_id)
  references auth.users (id)
  on delete cascade,

constraint one_user_to_a_login
 primary key (cordic_login_id, user_id)
);

alter table cordic_memberships enable row level security;
create policy "users can view own data"
  on cordic_memberships
  for select
  to authenticated
  using (auth.uid() = user_id);