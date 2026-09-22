create table vehicle_types (
  id uuid primary key default gen_random_uuid(),
  identifier citext unique not null,
  name text, icon text, description text,
  luggage integer, passengers integer,
  hero_img text, 
  list_img text, 
  main_img text, 
  details text,
  sort_order integer,
  active boolean default true,
  created_at timestamptz default now()
);

Alter table public.vehicle_types enable row level security;

create policy "Anyone can view"
on vehicle_types for select
to authenticated, anon
using ( active );

insert into vehicle_types (identifier, name, icon, description, luggage, passengers) values
  ('5 Seater',                        '5 Seater',                        '5 Seater.jpeg',                        null,                          2,  5),
  ('6 Seater',                        '6 Seater',                        '6 Seater.jpeg',                        null,                          2,  6),
  ('7 Seater',                        '7 Seater',                        '7 Seater.jpeg',                        null,                          8,  7),
  ('8 Seater',                        '8 Seater',                        '8 Seater.jpeg',                        null,                          8,  8),
  ('Any Vehicle',                     'Any Vehicle',                     'Any Vehicle.jpeg',                     'Any available car',           2,  4),
  ('Business Class 16 Seat Minibus',  'Business Class 16 Seat Minibus',  'Business Class 16 Seat Minibus.jpeg',  null,                         16, 16),
  ('Business Class MPV',              'Business Class MPV',              'Business Class MPV.jpeg',              'Mercedes V-Class or similar', 8,  6),
  ('Business Class Vehicle',          'Business Class Vehicle',          'Business Class Vehicle.jpeg',          'Mercedes E-Class or similar', 2,  3),
  ('Electric Vehicle',                'Electric Vehicle',                'Electric Vehicle.jpeg',                null,                          2,  4),
  ('Estate Car',                      'Estate Car',                      'Estate Car.jpeg',                      null,                          4,  4),
  ('Executive',                       'Executive',                       'Executive.jpeg',                       'Executive',                   2,  3),
  ('First Class Vehicle',             'First Class Vehicle',             'First Class Vehicle.jpeg',             'Mercedes S-Class or similar', 2,  3),
  ('Hybrid Vehicle',                  'Hybrid Vehicle',                  'Hybrid Vehicle.jpeg',                  null,                          2,  4),
  ('Lady Driver',                     'Lady Driver',                     null,                                   null,                          2,  4),
  ('Low Car',                         'Low Car',                         'Low Car.jpeg',                         null,                          2,  4),
  ('Wheelchair Accessible',           'Wheelchair Accessible Vehicle',   'Wheelchair Accessible.jpeg',           null,                          2,  4)
on conflict (identifier) do nothing;