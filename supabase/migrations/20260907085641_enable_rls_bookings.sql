alter table bookings enable row level security;

Create policy "Users can read their own booking"
on bookings
for select
to authenticated
using (user_id = auth.uid());

Create policy "Users can insert their own booking"
on bookings
for insert
to authenticated
with check (user_id = auth.uid());
