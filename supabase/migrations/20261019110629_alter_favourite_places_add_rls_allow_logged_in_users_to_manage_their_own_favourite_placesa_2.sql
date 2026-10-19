drop policy "Allow logged in users to manage their own favourite places" on public.favourite_places;

create policy "Allow logged in users to manage their own favourite places" 
on public.favourite_places
for all
to authenticated 
using (user_id = auth.uid())
with check (user_id = auth.uid());