-- ============================================
-- FIX PERMISSIONS - NON-ADMINS CAN UPDATE/DELETE OPEN ITEMS
-- ============================================

-- Drop all existing item policies to start fresh
DROP POLICY IF EXISTS "all_users_can_read_items" ON public.items;
DROP POLICY IF EXISTS "all_users_can_create_items" ON public.items;
DROP POLICY IF EXISTS "only_admins_can_update_items" ON public.items;
DROP POLICY IF EXISTS "only_admins_can_delete_items" ON public.items;

-- 1. Everyone can READ all items (open and closed)
CREATE POLICY "everyone_can_read_items" ON public.items
FOR SELECT TO authenticated
USING (true);

-- 2. Everyone can CREATE items (they'll be open by default)
CREATE POLICY "everyone_can_create_items" ON public.items
FOR INSERT TO authenticated
WITH CHECK (true);

-- 3. UPDATE policy: Everyone can update open items, only admins can update closed items
CREATE POLICY "update_items_based_on_status" ON public.items
FOR UPDATE TO authenticated
USING (
  -- Can update if item is open
  is_open = true
  OR
  -- Or if user is admin
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
)
WITH CHECK (
  -- Can update if item will remain open or become open
  is_open = true
  OR
  -- Or if user is admin (admins can close items)
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- 4. DELETE policy: Everyone can delete open items, only admins can delete closed items
CREATE POLICY "delete_items_based_on_status" ON public.items
FOR DELETE TO authenticated
USING (
  -- Can delete if item is open
  is_open = true
  OR
  -- Or if user is admin
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
  can_update_open_items BOOLEAN,
  can_update_closed_items BOOLEAN,
  can_delete_open_items BOOLEAN,
  can_delete_closed_items BOOLEAN,
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
    true as can_update_open_items,  -- Everyone can update open items
    p.is_admin as can_update_closed_items,  -- Only admins can update closed items
    true as can_delete_open_items,  -- Everyone can delete open items
    p.is_admin as can_delete_closed_items,  -- Only admins can delete closed items
    p.is_admin as can_manage_columns,
    p.is_admin as can_manage_custom_fields,
    p.is_admin as can_manage_projects,
    p.is_admin as can_delete_comments,  -- Only admins can delete comments
    p.is_admin as can_resolve_comments  -- Only admins can resolve comments
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- SUMMARY OF PERMISSIONS
-- ============================================
-- FOR OPEN ITEMS (is_open = true):
-- ✅ Everyone can read
-- ✅ Everyone can update 
-- ✅ Everyone can delete
-- ✅ Everyone can drag & drop
-- ✅ Display in greenish-gray color

-- FOR CLOSED ITEMS (is_open = false):
-- ✅ Everyone can read
-- ❌ Only admins can update
-- ❌ Only admins can delete
-- ❌ Only admins can drag & drop
-- ✅ Display in normal gray color

-- FOR COMMENTS:
-- ✅ Everyone can read comments on any item
-- ✅ Everyone can create comments on any item (open or closed)
-- ❌ Only admins can delete comments
-- ❌ Only admins can mark comments as resolved/unresolved

-- OTHER PERMISSIONS:
-- ❌ Only admins can create/update/delete columns
-- ❌ Only admins can create/update/delete custom fields
-- ❌ Only admins can create/update/delete projects
-- ❌ Only admins can change is_open status (close/open items)