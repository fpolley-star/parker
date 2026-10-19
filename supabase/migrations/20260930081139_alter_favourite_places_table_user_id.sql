alter table favourite_places
add column user_id uuid,
add column tag text,
add column postcode text,
ADD CONSTRAINT link_to_user_id
FOREIGN KEY (user_id)
REFERENCES auth.users (id);