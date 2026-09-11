CREATE POLICY "Users can view logins they're a member of"
ON cordic_logins
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cordic_memberships m
    WHERE m.cordic_login_id = cordic_logins.id
      AND m.user_id = auth.uid()
  )
);