alter table cordic_memberships drop column cordic_user_id;
alter table cordic_logins drop column account_name;
alter table cordic_accounts add column display_name text;
