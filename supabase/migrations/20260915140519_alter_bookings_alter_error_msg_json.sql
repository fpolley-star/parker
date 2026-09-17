ALTER TABLE bookings 
ALTER COLUMN error_msg TYPE jsonb USING error_msg::jsonb;