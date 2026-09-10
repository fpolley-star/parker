create table profiles(
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    phone text,
    created_at timestamptz default now()
);


alter table profiles enable row level security;

create policy "Users can view their own data"
on profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users can update their own data"
on profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


