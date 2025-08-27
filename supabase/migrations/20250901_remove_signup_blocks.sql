-- ============================================
-- REMOVE SIGNUP BLOCKS
-- ============================================

-- 1. Drop the trigger that blocks new user signups
-- You created this, so you can drop it
DROP TRIGGER IF EXISTS block_new_user_signups ON auth.users;

-- 2. Drop the function that prevents signups
-- You created this, so you can drop it
DROP FUNCTION IF EXISTS prevent_new_user_signups();

-- 3. Drop the helper function for checking existing users
-- You created this, so you can drop it
DROP FUNCTION IF EXISTS is_existing_user(text);

-- ============================================
-- The REVOKE issue:
-- ============================================
-- You ran: REVOKE INSERT ON auth.users FROM anon, authenticated;
-- 
-- Unfortunately, you need to be the table owner or have GRANT OPTION 
-- to GRANT permissions back. 
--
-- SOLUTION: Contact Supabase support or use the Supabase Dashboard
-- to restore the INSERT permissions on auth.users for anon and authenticated roles.
--
-- Or try this workaround in the Supabase Dashboard SQL Editor:
-- Sometimes the Dashboard SQL Editor runs with higher privileges.
-- 
-- If that doesn't work, you'll need to:
-- 1. Go to Supabase Dashboard
-- 2. Go to Database > Roles
-- 3. Find 'anon' and 'authenticated' roles
-- 4. Restore their INSERT permissions on auth.users
--
-- Or contact Supabase support with this message:
-- "I accidentally revoked INSERT permissions on auth.users from anon and authenticated roles
-- and now new user signups are failing with 500 errors. Please restore default permissions."
-- ============================================