ALTER TABLE bookings
  ADD COLUMN cordic_login_id uuid,
  ALTER COLUMN pickup TYPE jsonb,
  ALTER COLUMN dropoff TYPE jsonb,
  ADD CONSTRAINT link_to_login 
    FOREIGN KEY (cordic_login_id) 
    REFERENCES cordic_logins (id);
