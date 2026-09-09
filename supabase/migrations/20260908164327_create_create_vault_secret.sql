CREATE OR REPLACE FUNCTION create_vault_secret(secret TEXT, name TEXT, description TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret_id UUID;
BEGIN
  IF current_user = 'postgres' OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    SELECT vault.create_secret(secret, name, description) INTO secret_id;
    RETURN secret_id;
  ELSE
    RAISE EXCEPTION 'Access denied: Unauthorized role.';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_vault_secret(text, text, text) FROM anon, authenticated;