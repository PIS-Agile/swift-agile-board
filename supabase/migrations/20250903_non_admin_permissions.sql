-- Define specific permissions for non-admin users
-- This migration sets up what non-admins CAN and CANNOT do

-- Drop existing policies to recreate them with proper permissions
DROP POLICY IF EXISTS "all_users_can_create_items" ON public.items;
DROP POLICY IF EXISTS "all_users_can_update_items" ON public.items;
DROP POLICY IF EXISTS "admins_can_delete_items" ON public.items;
DROP POLICY IF EXISTS "all_users_can_read_items" ON public.items;

-- Items permissions
-- Everyone can read items
CREATE POLICY "users_read_items" ON public.items
FOR SELECT TO authenticated
USING (true);

-- Everyone can create items
CREATE POLICY "users_create_items" ON public.items
FOR INSERT TO authenticated
WITH CHECK (true);

-- Everyone can update items
CREATE POLICY "users_update_items" ON public.items
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Only admins can delete items
CREATE POLICY "only_admins_delete_items" ON public.items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Item assignments - everyone can manage assignments
DROP POLICY IF EXISTS "Users can manage item assignments" ON public.item_assignments;
CREATE POLICY "users_manage_assignments" ON public.item_assignments
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Item field values - everyone can manage field values
DROP POLICY IF EXISTS "Users can manage item field values" ON public.item_field_values;
CREATE POLICY "users_manage_field_values" ON public.item_field_values
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Comments - everyone can manage their own comments, admins can delete any
DROP POLICY IF EXISTS "Users can insert comments" ON public.item_comments;
DROP POLICY IF EXISTS "Users can view comments" ON public.item_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.item_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.item_comments;

CREATE POLICY "users_view_comments" ON public.item_comments
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "users_create_comments" ON public.item_comments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_comments" ON public.item_comments
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_comments" ON public.item_comments
FOR DELETE TO authenticated
USING (
  -- Users can delete their own comments
  auth.uid() = user_id
  OR
  -- Admins can delete any comment
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Projects - only admins can create/update/delete projects
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;

CREATE POLICY "users_read_projects" ON public.projects
FOR SELECT TO authenticated
USING (
  -- Users can see projects they're members of
  id IN (
    SELECT project_id FROM public.project_members 
    WHERE user_id = auth.uid()
  )
  OR
  -- Admins can see all projects
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "only_admins_create_projects" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "only_admins_update_projects" ON public.projects
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

CREATE POLICY "only_admins_delete_projects" ON public.projects
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Project members - only admins can add/remove members
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Project creators can add members" ON public.project_members;

CREATE POLICY "users_view_project_members" ON public.project_members
FOR SELECT TO authenticated
USING (
  -- Users can see members of projects they're in
  project_id IN (
    SELECT project_id FROM public.project_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "only_admins_manage_project_members" ON public.project_members
FOR ALL TO authenticated
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

-- Default values - non-admins can read but not modify
DROP POLICY IF EXISTS "Users can read default values" ON public.default_values;
DROP POLICY IF EXISTS "Users can manage default values" ON public.default_values;

CREATE POLICY "users_read_default_values" ON public.default_values
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "only_admins_manage_default_values" ON public.default_values
FOR ALL TO authenticated
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

-- Create a function to check user permissions for the UI
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS TABLE(
  can_delete_items BOOLEAN,
  can_manage_columns BOOLEAN,
  can_manage_custom_fields BOOLEAN,
  can_manage_projects BOOLEAN,
  can_manage_users BOOLEAN,
  is_admin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.is_admin as can_delete_items,
    p.is_admin as can_manage_columns,
    p.is_admin as can_manage_custom_fields,
    p.is_admin as can_manage_projects,
    p.is_admin as can_manage_users,
    p.is_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Summary of permissions after this migration:
-- 
-- ADMINS CAN:
-- - Everything
-- 
-- NON-ADMINS CAN:
-- - Create, read, update items (but not delete)
-- - Read columns (but not create/update/delete)
-- - Read custom fields (but not create/update/delete)  
-- - Create and manage their own comments
-- - Read all comments
-- - See projects they're members of
-- - Read default values
-- 
-- NON-ADMINS CANNOT:
-- - Delete items
-- - Create/update/delete columns
-- - Create/update/delete custom fields
-- - Create/update/delete projects
-- - Add/remove project members
-- - Promote/demote users
-- - Delete other users' comments
-- - Modify default values