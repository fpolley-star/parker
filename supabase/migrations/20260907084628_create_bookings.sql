create table bookings (
  id uuid primary key default gen_random_uuid(),
  cordic_job_id text,
  user_id uuid not null references auth.users (id),
  status text not null default 'pending' check (status in ('pending', 'booked', 'failed')),
  created_at timestamptz not null default now(),
  booked_for timestamptz,
  pickup text,
  dropoff text
);