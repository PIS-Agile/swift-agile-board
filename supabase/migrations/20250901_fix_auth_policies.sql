-- First, drop ALL existing policies on auth.users to start fresh
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'auth' AND tablename = 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON auth.users', pol.policyname);
    END LOOP;
END $$;

-- Disable RLS on auth.users (Supabase handles auth internally)
-- This is the recommended approach - let Supabase handle auth.users
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- If you really need RLS on auth.users, use these minimal policies instead:
-- ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
-- 
-- -- Allow service role full access
-- CREATE POLICY "Service role access" ON auth.users
-- FOR ALL TO service_role
-- USING (true)
-- WITH CHECK (true);
-- 
-- -- Allow users to read their own record
-- CREATE POLICY "Users can view own record" ON auth.users
-- FOR SELECT TO authenticated
-- USING (auth.uid() = id);

-- The real control should be in the public.profiles table
-- Ensure profiles table has proper policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- Profiles should be viewable by authenticated users only
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- The trigger should handle profile creation, not a policy
-- Make sure the handle_new_user function exists and works properly
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
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT ALL ON auth.users TO postgres, service_role;
GRANT SELECT ON auth.users TO anon, authenticated;

-- Ensure the profiles table can be inserted into by the trigger
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Add a check to make sure email confirmation is not required (for easier testing)
-- You can remove this in production if you want email confirmation
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;