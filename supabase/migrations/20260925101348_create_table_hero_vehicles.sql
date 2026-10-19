create table hero_vehicles (
    id uuid primary key default gen_random_uuid(),
    name text,
    description text,
    icon text,
    hero_img text,
    details text,
    sort_order integer,
    active boolean default false,
    created_at timestamptz default now()
);

Alter table public.hero_vehicles enable row level security;

create policy "Anyone can view"
on hero_vehicles
for select
to authenticated, anon
using (active);

insert into hero_vehicles ( name, description, icon, sort_order, active) values
('Any Vehicle', 'Any available car', '', 1, true),
('Business Class', 'Mercedes E-Class or similar', '', 2, true ),
('First Class', 'BMW I7 or similar', '', 3, true ),
('Estate Car', 'Toyota Corolla Touring or similar', '', 4, true),
('Small MPV', 'VW Minibus or similar', '', 5, true),
('Business MPV', 'Ford Tourneo or similar', '', 6, true),
('Large MPV', 'Ford Tourneo or similar', '', 7, true),
('Business Class Minibus', '', '', 8, true),
('Wheelchair Accessible Vehicle', '', '', 9, true),
('Electric', '', '', 10, true),
('Low Car', '', '', 11, true)
