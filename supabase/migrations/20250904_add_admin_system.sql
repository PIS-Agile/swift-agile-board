-- ============================================
-- ADD ADMIN SYSTEM TO PROFILES
-- ============================================

-- 1. Add is_admin column to profiles table (default false for new users)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Create an index for faster admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- 3. You can manually set existing users as admins later with:
-- UPDATE public.profiles SET is_admin = true WHERE email IN ('admin1@example.com', 'admin2@example.com');
-- Or set ALL current users as admins:
-- UPDATE public.profiles SET is_admin = true WHERE created_at < NOW();

-- ============================================
-- PREVENT USERS FROM MODIFYING is_admin FIELD
-- ============================================

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

-- Create new update policy that prevents changing is_admin
CREATE POLICY "Users can update own profile except admin status" ON public.profiles
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

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get current user permissions
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS TABLE(
  user_id UUID,
  is_admin BOOLEAN,
  can_delete_items BOOLEAN,
  can_manage_columns BOOLEAN,
  can_manage_custom_fields BOOLEAN,
  can_manage_projects BOOLEAN,
  can_manage_users BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.is_admin,
    p.is_admin as can_delete_items,
    p.is_admin as can_manage_columns,
    p.is_admin as can_manage_custom_fields,
    p.is_admin as can_manage_projects,
    p.is_admin as can_manage_users
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- ADMIN-ONLY POLICIES
-- ============================================

-- Items: Everyone can create, read, update. Only admins can delete
DROP POLICY IF EXISTS "only_admins_delete_items" ON public.items;
DROP POLICY IF EXISTS "admins_can_delete_items" ON public.items;
DROP POLICY IF EXISTS "Users can delete items" ON public.items;

CREATE POLICY "only_admins_can_delete_items" ON public.items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Columns: Only admins can create, update, delete
DROP POLICY IF EXISTS "only_admins_manage_columns" ON public.columns;
DROP POLICY IF EXISTS "admins_can_manage_columns" ON public.columns;
DROP POLICY IF EXISTS "Users can insert columns" ON public.columns;
DROP POLICY IF EXISTS "Users can update columns" ON public.columns;
DROP POLICY IF EXISTS "Users can delete columns" ON public.columns;

CREATE POLICY "only_admins_create_columns" ON public.columns
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "only_admins_update_columns" ON public.columns
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "only_admins_delete_columns" ON public.columns
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Custom Fields: Only admins can create, update, delete
DROP POLICY IF EXISTS "only_admins_manage_custom_fields" ON public.custom_fields;
DROP POLICY IF EXISTS "admins_can_manage_custom_fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Users can manage custom fields" ON public.custom_fields;

CREATE POLICY "only_admins_create_custom_fields" ON public.custom_fields
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "only_admins_update_custom_fields" ON public.custom_fields
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "only_admins_delete_custom_fields" ON public.custom_fields
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Projects: Only admins can create, update, delete
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
DROP POLICY IF EXISTS "only_admins_create_projects" ON public.projects;

CREATE POLICY "only_admins_can_create_projects" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "only_admins_can_update_projects" ON public.projects
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "only_admins_can_delete_projects" ON public.projects
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Default Values: Only admins can modify
DROP POLICY IF EXISTS "only_admins_manage_default_values" ON public.default_values;
DROP POLICY IF EXISTS "Users can manage default values" ON public.default_values;

CREATE POLICY "only_admins_can_manage_default_values" ON public.default_values
FOR ALL TO authenticated
USING (
  -- For SELECT, everyone can read
  (TG_OP = 'SELECT' OR TG_OP IS NULL)
  OR
  -- For other operations, must be admin
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- ============================================
-- SUMMARY OF PERMISSIONS
-- ============================================
-- ADMINS CAN:
-- ✅ Everything

-- NON-ADMINS CAN:
-- ✅ Create, read, update items (but NOT delete)
-- ✅ Read columns (but NOT create/update/delete)
-- ✅ Read custom fields (but NOT create/update/delete)
-- ✅ Read projects
-- ✅ Create and manage comments
-- ✅ Update their own profile (except is_admin field)

-- NON-ADMINS CANNOT:
-- ❌ Delete items
-- ❌ Create/update/delete columns
-- ❌ Create/update/delete custom fields
-- ❌ Create/update/delete projects
-- ❌ Change their own or others' admin status
-- ❌ Modify default values

-- ============================================
-- AFTER RUNNING THIS MIGRATION:
-- ============================================
-- 1. Manually set existing users as admins:
--    UPDATE public.profiles SET is_admin = true WHERE email = 'your-email@example.com';
-- 
-- 2. Or set ALL existing users as admins:
--    UPDATE public.profiles SET is_admin = true WHERE created_at < '2024-12-27';
--    (Use today's date so only current users become admins)