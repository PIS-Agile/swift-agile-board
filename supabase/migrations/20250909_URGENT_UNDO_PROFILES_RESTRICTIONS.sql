-- ============================================
-- URGENT: UNDO ACCIDENTAL PROFILE RESTRICTIONS
-- ============================================

BEGIN;

-- ============================================================================
-- 1. DROP THE RESTRICTIVE POLICY THAT WAS JUST ADDED
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_own_only" ON profiles;

-- ============================================================================
-- 2. RESTORE THE ORIGINAL PERMISSIVE SELECT POLICY
-- ============================================================================

-- Recreate the policy that allows all authenticated users to see all profiles
-- (This is needed for the app to show user names in assignments, comments, etc.)
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- 3. DROP THE SECURITY DEFINER FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS get_all_profiles_secure() CASCADE;

-- ============================================================================
-- 4. DROP THE PROFILES_SECURE VIEW
-- ============================================================================

DROP VIEW IF EXISTS public.profiles_secure CASCADE;

-- ============================================================================
-- 5. VERIFY OTHER PROFILE POLICIES STILL EXIST
-- ============================================================================

-- Make sure the update policy still exists (users can only update their own)
-- If it doesn't exist, recreate it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can update own profile except admin status'
  ) THEN
    CREATE POLICY "Users can update own profile except admin status" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
      auth.uid() = id 
      AND (
        -- Either is_admin didn't change
        is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
        -- Or the user is an admin (admins can modify other admins)
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND is_admin = true
        )
      )
    );
  END IF;
END $$;

-- If the insert policy doesn't exist, recreate it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname LIKE '%insert%'
  ) THEN
    CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

/*
After running this:

✅ The app should work normally again:
- Users can see all other users' names in dropdowns
- Assignments work properly
- Comments show correct user names
- @mentions work

✅ Test by:
1. Check if the app loads without errors
2. Try creating/editing an item and assigning users
3. Check if user names appear in existing items
4. Try commenting and @mentioning someone

If there are still issues, check the browser console for errors.
*/