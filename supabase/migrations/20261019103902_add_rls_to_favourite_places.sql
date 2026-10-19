alter table favourite_places enable row level security;

create policy "Allow logged in users to manage their own favourite places" 
on favourite_places
for all
to authenticated