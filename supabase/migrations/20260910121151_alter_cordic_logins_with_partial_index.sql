create unique index cordic_logins_one_personal_per_username
  on cordic_logins (username)
  where type = 'personal';