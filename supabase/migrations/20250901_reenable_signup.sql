-- Re-enable user sign-ups by dropping the restrictive policy
DROP POLICY IF EXISTS "disable_signup" ON auth.users;

-- Optional: Drop the update prevention policy if it was created
DROP POLICY IF EXISTS "prevent_user_update" ON auth.users;

-- Create a new policy that allows sign-ups (default behavior)
-- This allows new users to sign up normally
CREATE POLICY "enable_signup" ON auth.users
FOR INSERT TO anon
WITH CHECK (true);

-- Allow authenticated users to read their own user data
CREATE POLICY "users_can_read_own_data" ON auth.users
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users to update their own data
CREATE POLICY "users_can_update_own_data" ON auth.users
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);