-- ============================================
-- RESTORE USER SIGNUP ABILITY
-- ============================================

-- 1. Drop the trigger that blocks new user signups
DROP TRIGGER IF EXISTS block_new_user_signups ON auth.users;

-- 2. Drop the function that prevents signups
DROP FUNCTION IF EXISTS prevent_new_user_signups();

-- 3. Drop the helper function for checking existing users
DROP FUNCTION IF EXISTS is_existing_user(text);

-- 4. IMPORTANT: Restore INSERT permissions on auth.users
-- These permissions are needed for Supabase Auth to create new users
GRANT INSERT ON auth.users TO anon;
GRANT INSERT ON auth.users TO authenticated;
GRANT INSERT ON auth.users TO service_role;

-- 5. Also ensure other necessary permissions are in place
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON auth.users TO postgres, service_role;
GRANT SELECT ON auth.users TO authenticated;

-- 6. Make sure the profile creation trigger still works
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent errors if profile already exists
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Ensure the profile creation trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Ensure RLS is disabled on auth.users (standard Supabase setup)
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- 9. Clean up any policies that might interfere
DROP POLICY IF EXISTS "disable_signup" ON auth.users CASCADE;
DROP POLICY IF EXISTS "enable_signup" ON auth.users CASCADE;
DROP POLICY IF EXISTS "prevent_user_update" ON auth.users CASCADE;

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this migration, you should be able to:
-- 1. Sign up new users
-- 2. Log in with existing users
-- 3. Users will automatically get a profile created

-- To test if permissions are correct, you can run:
-- SELECT has_table_privilege('anon', 'auth.users', 'INSERT');
-- This should return TRUE