create or replace function update_vault_secret(p_secret_id uuid, p_new_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform vault.update_secret(p_secret_id, p_new_secret);
end;
$$;

revoke execute on function update_vault_secret(uuid, text) from anon, authenticated;