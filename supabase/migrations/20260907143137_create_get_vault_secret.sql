CREATE OR REPLACE FUNCTION get_vault_secret(secret_id uuid)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
set search_path = ''
AS $$
DECLARE
  decrypted_value TEXT;
BEGIN

  IF current_user = 'postgres' OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    
    SELECT decrypted_secret
    INTO decrypted_value
    FROM vault.decrypted_secrets
    WHERE id = secret_id;

    RETURN decrypted_value;
  ELSE
    RAISE EXCEPTION 'Access denied: Unauthorized role.';
  END IF;
END;
$$;

revoke execute on function get_vault_secret(uuid) from anon, authenticated;
