alter table bookings
 add column acc_user_id text,
 add column "references" jsonb,
 add column booking_capabilties text,
 add column is_account boolean default false,
 add column jwtQuote text
