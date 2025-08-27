-- ============================================
-- UPDATE COMMENT PERMISSIONS - NON-ADMINS CAN MANAGE COMMENTS ON OPEN ITEMS
-- ============================================

-- Drop existing comment policies
DROP POLICY IF EXISTS "everyone_can_view_comments" ON public.item_comments;
DROP POLICY IF EXISTS "everyone_can_create_comments" ON public.item_comments;
DROP POLICY IF EXISTS "only_admins_can_update_comments" ON public.item_comments;
DROP POLICY IF EXISTS "only_admins_can_delete_comments" ON public.item_comments;

-- 1. Everyone can VIEW all comments
CREATE POLICY "everyone_can_view_comments" ON public.item_comments
FOR SELECT TO authenticated
USING (true);

-- 2. Everyone can CREATE comments on any item (open or closed)
CREATE POLICY "everyone_can_create_comments" ON public.item_comments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE comments (for resolving/unresolving): 
-- Everyone can update comments on open items, only admins on closed items
CREATE POLICY "update_comments_based_on_item_status" ON public.item_comments
FOR UPDATE TO authenticated
USING (
  -- Can update if the item is open
  EXISTS (
    SELECT 1 FROM public.items 
    WHERE items.id = item_comments.item_id 
    AND items.is_open = true
  )
  OR
  -- Or if user is admin
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
)
WITH CHECK (
  -- Can update if the item is open
  EXISTS (
    SELECT 1 FROM public.items 
    WHERE items.id = item_comments.item_id 
    AND items.is_open = true
  )
  OR
  -- Or if user is admin
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- 4. DELETE comments: 
-- Users can delete their own comments on open items, admins can delete any comment
CREATE POLICY "delete_comments_based_on_item_status" ON public.item_comments
FOR DELETE TO authenticated
USING (
  -- User can delete their own comment if item is open
  (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM public.items 
      WHERE items.id = item_comments.item_id 
      AND items.is_open = true
    )
  )
  OR
  -- Or if user is admin (can delete any comment)
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- ============================================
-- VERIFY COLUMN POLICIES (ONLY ADMINS CAN MANAGE)
-- ============================================

-- These should already exist from previous migrations, but let's ensure they're correct
DROP POLICY IF EXISTS "only_admins_create_columns" ON public.columns;
DROP POLICY IF EXISTS "only_admins_update_columns" ON public.columns;
DROP POLICY IF EXISTS "only_admins_delete_columns" ON public.columns;
DROP POLICY IF EXISTS "Users can view columns" ON public.columns;

-- Everyone can VIEW columns
CREATE POLICY "everyone_can_view_columns" ON public.columns
FOR SELECT TO authenticated
USING (true);

-- Only admins can CREATE columns
CREATE POLICY "only_admins_can_create_columns" ON public.columns
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Only admins can UPDATE columns
CREATE POLICY "only_admins_can_update_columns" ON public.columns
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

-- Only admins can DELETE columns
CREATE POLICY "only_admins_can_delete_columns" ON public.columns
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
  can_update_open_items BOOLEAN,
  can_update_closed_items BOOLEAN,
  can_delete_open_items BOOLEAN,
  can_delete_closed_items BOOLEAN,
  can_manage_columns BOOLEAN,
  can_manage_custom_fields BOOLEAN,
  can_manage_projects BOOLEAN,
  can_delete_comments_on_open_items BOOLEAN,
  can_delete_any_comments BOOLEAN,
  can_resolve_comments_on_open_items BOOLEAN,
  can_resolve_any_comments BOOLEAN
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
    p.is_admin as can_manage_columns,  -- Only admins can manage columns
    p.is_admin as can_manage_custom_fields,  -- Only admins can manage custom fields
    p.is_admin as can_manage_projects,  -- Only admins can manage projects
    true as can_delete_comments_on_open_items,  -- Everyone can delete their own comments on open items
    p.is_admin as can_delete_any_comments,  -- Only admins can delete any comment
    true as can_resolve_comments_on_open_items,  -- Everyone can resolve comments on open items
    p.is_admin as can_resolve_any_comments  -- Only admins can resolve comments on closed items
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- SUMMARY OF PERMISSIONS
-- ============================================
-- FOR OPEN ITEMS (is_open = true):
-- ✅ Everyone can read, update, delete items
-- ✅ Everyone can drag & drop items
-- ✅ Everyone can create comments
-- ✅ Everyone can delete their own comments
-- ✅ Everyone can mark comments as resolved/unresolved
-- ✅ Display in greenish-gray color

-- FOR CLOSED ITEMS (is_open = false):
-- ✅ Everyone can read items
-- ✅ Everyone can create comments
-- ❌ Only admins can update items
-- ❌ Only admins can delete items
-- ❌ Only admins can drag & drop items
-- ❌ Only admins can delete comments
-- ❌ Only admins can mark comments as resolved/unresolved
-- ✅ Display in normal gray color

-- FOR COLUMNS:
-- ✅ Everyone can read columns
-- ❌ Only admins can create columns
-- ❌ Only admins can update columns
-- ❌ Only admins can delete columns

-- FOR CUSTOM FIELDS, PROJECTS, DEFAULT VALUES:
-- ✅ Everyone can read
-- ❌ Only admins can create/update/delete