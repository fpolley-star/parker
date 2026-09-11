ALTER TABLE bookings
    ADD COLUMN payment TEXT,
    ADD COLUMN full_name TEXT,
    ADD COLUMN phone TEXT,
    ADD COLUMN email TEXT,
    ADD COLUMN via jsonb,
    ADD COLUMN vehicleType TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN note TEXT,
    ADD COLUMN waitReturn BOOLEAN;
