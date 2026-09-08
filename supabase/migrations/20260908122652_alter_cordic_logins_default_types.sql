Alter table cordic_logins
alter column type set default 'personal',
add constraint type_check check (type in ('personal', 'account'));
