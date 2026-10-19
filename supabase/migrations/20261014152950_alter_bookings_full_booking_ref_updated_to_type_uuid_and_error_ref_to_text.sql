ALTER TABLE bookings 
ALTER COLUMN full_booking_ref TYPE UUID USING full_booking_ref::uuid;
ALTER TABLE bookings 
ALTER COLUMN error_ref TYPE TEXT;
