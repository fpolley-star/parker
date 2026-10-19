  ALTER TABLE bookings 
  DROP COLUMN local_time,
  ADD COLUMN session_token VARCHAR(255) DEFAULT NULL,
  ADD COLUMN is_return BOOLEAN DEFAULT false;