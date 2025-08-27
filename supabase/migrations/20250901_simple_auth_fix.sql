-- Simplest fix: Just disable RLS on auth.users
-- Supabase handles authentication internally and doesn't need RLS policies

-- Drop all policies on auth.users
DROP POLICY IF EXISTS "disable_signup" ON auth.users CASCADE;
DROP POLICY IF EXISTS "enable_signup" ON auth.users CASCADE;
DROP POLICY IF EXISTS "prevent_user_update" ON auth.users CASCADE;
DROP POLICY IF EXISTS "users_can_read_own_data" ON auth.users CASCADE;
DROP POLICY IF EXISTS "users_can_update_own_data" ON auth.users CASCADE;

-- Disable RLS on auth.users (this is the standard Supabase setup)
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- Make sure the profile creation trigger is working
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();