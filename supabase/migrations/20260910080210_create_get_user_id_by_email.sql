create or replace function get_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid;
begin
  select id into user_id
  from auth.users
  where lower(email) = lower(p_email)
    and deleted_at is null
  limit 1;

  return user_id;
end;
$$;

revoke execute on function get_user_id_by_email(text) from anon, authenticated;