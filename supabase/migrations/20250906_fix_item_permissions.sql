-- ============================================
-- FIX ITEM PERMISSIONS - NON-ADMINS CANNOT UPDATE/DELETE
-- ============================================

-- Drop all existing item policies to start fresh
DROP POLICY IF EXISTS "everyone_can_read_items" ON public.items;
DROP POLICY IF EXISTS "everyone_can_create_items" ON public.items;
DROP POLICY IF EXISTS "update_items_based_on_status" ON public.items;
DROP POLICY IF EXISTS "delete_items_based_on_status" ON public.items;

-- 1. Everyone can READ items
CREATE POLICY "all_users_can_read_items" ON public.items
FOR SELECT TO authenticated
USING (true);

-- 2. Everyone can CREATE items
CREATE POLICY "all_users_can_create_items" ON public.items
FOR INSERT TO authenticated
WITH CHECK (true);

-- 3. Only ADMINS can UPDATE items (regardless of open/closed status)
CREATE POLICY "only_admins_can_update_items" ON public.items
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

-- 4. Only ADMINS can DELETE items (regardless of open/closed status)
CREATE POLICY "only_admins_can_delete_items" ON public.items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- ============================================
-- UPDATE PERMISSIONS FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS public.get_current_user_permissions();

CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS TABLE(
  user_id UUID,
  is_admin BOOLEAN,
  can_create_items BOOLEAN,
  can_update_items BOOLEAN,
  can_delete_items BOOLEAN,
  can_manage_columns BOOLEAN,
  can_manage_custom_fields BOOLEAN,
  can_manage_projects BOOLEAN,
  can_delete_comments BOOLEAN,
  can_resolve_comments BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.is_admin,
    true as can_create_items,  -- Everyone can create items
    p.is_admin as can_update_items,  -- Only admins can update items
    p.is_admin as can_delete_items,  -- Only admins can delete items
    p.is_admin as can_manage_columns,
    p.is_admin as can_manage_custom_fields,
    p.is_admin as can_manage_projects,
    p.is_admin as can_delete_comments,
    p.is_admin as can_resolve_comments
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- SUMMARY OF PERMISSIONS
-- ============================================
-- ADMINS CAN:
-- ✅ Create items
-- ✅ Read items
-- ✅ Update items
-- ✅ Delete items
-- ✅ Manage columns, custom fields, projects
-- ✅ Delete and resolve comments

-- NON-ADMINS CAN:
-- ✅ Create items
-- ✅ Read items
-- ✅ Create comments
-- ❌ CANNOT update items
-- ❌ CANNOT delete items
-- ❌ CANNOT manage columns, custom fields, projects
-- ❌ CANNOT delete or resolve comments

-- The is_open field now serves only as a visual indicator:
-- - Open items (is_open = true): Display in greenish-gray
-- - Closed items (is_open = false): Display in normal gray