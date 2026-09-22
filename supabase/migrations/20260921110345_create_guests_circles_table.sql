CREATE TABLE contacts (
    id uuid primary key default gen_random_uuid(),
    first_name text,
    last_name text,
    title text,
    email text,
    phone text,
    user_id uuid,
    added_by uuid not null,
    created_at timestamptz default now(),
    saved boolean default false,

    constraint link_to_author
    foreign key (added_by)
    references auth.users (id),

    constraint contact_to_user
    foreign key (user_id)
    references auth.users (id) 
    on delete set null
);

ALTER table public.contacts enable row level security;

create policy "Users can view their own contacts"
on contacts for select
to authenticated 
using ( (select auth.uid()) = added_by);

create policy "Users can create their own contacts"
on contacts for insert
to authenticated 
with check ((select auth.uid()) = added_by);

create policy "Users can update their own contacts"
on contacts for update
to authenticated
using ((select auth.uid()) = added_by)
with check ((select auth.uid()) = added_by);

create policy "Users can delete their own contacts"
on contacts for delete
to authenticated 
using ( (select auth.uid()) = added_by);


