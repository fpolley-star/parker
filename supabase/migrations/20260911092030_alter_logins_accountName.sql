alter table cordic_logins
add column account_name citext;

alter table cordic_memberships
add column cordic_user_id citext
