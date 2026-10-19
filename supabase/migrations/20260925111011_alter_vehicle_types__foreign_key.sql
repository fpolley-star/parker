Alter table vehicle_types
add column parent uuid,
alter column active set default false,
ADD CONSTRAINT link_to_parent
    FOREIGN KEY (parent)
    REFERENCES hero_vehicles(id);