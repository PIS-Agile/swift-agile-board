-- ============================================
-- ADD OPEN/CLOSED SYSTEM FOR ITEMS
-- ============================================

-- 1. Add is_open field to items table (default true so items are open by default)
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true;

-- 2. Set all existing items as open (optional - you can change this)
UPDATE public.items SET is_open = true WHERE is_open IS NULL;

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_items_is_open ON public.items(is_open);

-- ============================================
-- UPDATE ITEM POLICIES FOR OPEN/CLOSED SYSTEM
-- ============================================

-- Drop existing item policies
DROP POLICY IF EXISTS "Users can view items" ON public.items;
DROP POLICY IF EXISTS "Users can insert items" ON public.items;
DROP POLICY IF EXISTS "Users can update items" ON public.items;
DROP POLICY IF EXISTS "Users can delete items" ON public.items;
DROP POLICY IF EXISTS "users_read_items" ON public.items;
DROP POLICY IF EXISTS "users_create_items" ON public.items;
DROP POLICY IF EXISTS "users_update_items" ON public.items;
DROP POLICY IF EXISTS "only_admins_can_delete_items" ON public.items;
DROP POLICY IF EXISTS "only_admins_delete_items" ON public.items;

-- Everyone can read all items
CREATE POLICY "everyone_can_read_items" ON public.items
FOR SELECT TO authenticated
USING (true);

-- Everyone can create items (they'll be open by default)
CREATE POLICY "everyone_can_create_items" ON public.items
FOR INSERT TO authenticated
WITH CHECK (true);

-- Update policy: Everyone can update open items, only admins can update closed items
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
  -- Can update if item is open
  is_open = true
  OR
  -- Or if user is admin
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Delete policy: Everyone can delete open items, only admins can delete closed items
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
-- UPDATE COMMENT POLICIES
-- ============================================

-- Drop existing comment policies
DROP POLICY IF EXISTS "Users can insert comments" ON public.item_comments;
DROP POLICY IF EXISTS "Users can view comments" ON public.item_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.item_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.item_comments;
DROP POLICY IF EXISTS "users_view_comments" ON public.item_comments;
DROP POLICY IF EXISTS "users_create_comments" ON public.item_comments;
DROP POLICY IF EXISTS "users_update_own_comments" ON public.item_comments;
DROP POLICY IF EXISTS "users_delete_comments" ON public.item_comments;

-- Everyone can view all comments
CREATE POLICY "everyone_can_view_comments" ON public.item_comments
FOR SELECT TO authenticated
USING (true);

-- Everyone can create comments on ANY item (open or closed)
CREATE POLICY "everyone_can_create_comments" ON public.item_comments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update comments (for resolving/unresolving): Only admins can do this
CREATE POLICY "only_admins_can_update_comments" ON public.item_comments
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

-- Delete comments: Only admins can delete any comment
CREATE POLICY "only_admins_can_delete_comments" ON public.item_comments
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- ============================================
-- UPDATE HELPER FUNCTIONS
-- ============================================

-- Drop the existing function first to avoid conflicts
DROP FUNCTION IF EXISTS public.get_current_user_permissions();

-- Recreate with updated return type
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS TABLE(
  user_id UUID,
  is_admin BOOLEAN,
  can_delete_open_items BOOLEAN,
  can_delete_closed_items BOOLEAN,
  can_update_open_items BOOLEAN,
  can_update_closed_items BOOLEAN,
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
    true as can_delete_open_items,  -- Everyone can delete open items
    p.is_admin as can_delete_closed_items,  -- Only admins can delete closed items
    true as can_update_open_items,  -- Everyone can update open items
    p.is_admin as can_update_closed_items,  -- Only admins can update closed items
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
-- SUMMARY OF NEW PERMISSIONS
-- ============================================
-- FOR OPEN ITEMS (is_open = true):
-- ✅ Everyone can update
-- ✅ Everyone can delete
-- ✅ Will display in greenish color

-- FOR CLOSED ITEMS (is_open = false):
-- ✅ Everyone can read
-- ✅ Only admins can update
-- ✅ Only admins can delete
-- ✅ Will display in normal gray/black color

-- FOR COMMENTS:
-- ✅ Everyone can read comments on any item
-- ✅ Everyone can create comments on any item
-- ❌ Only admins can delete comments
-- ❌ Only admins can mark comments as resolved/unresolved

-- OTHER PERMISSIONS (unchanged):
-- ❌ Only admins can create/update/delete columns
-- ❌ Only admins can create/update/delete custom fields
-- ❌ Only admins can create/update/delete projects
-- ❌ Only admins can change is_open status on closed items