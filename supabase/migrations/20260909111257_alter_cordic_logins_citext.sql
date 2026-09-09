create extension if not exists citext;

alter table cordic_logins
  alter column account_number type citext,
  alter column username type citext;