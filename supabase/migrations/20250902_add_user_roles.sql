-- Add is_admin column to profiles table to track admin status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Mark all existing users as admins (they were here before the restriction)
UPDATE public.profiles 
SET is_admin = true 
WHERE created_at <= NOW();

-- Create an index for faster admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- Create a function to automatically set admin status for new users
-- All users created after this migration will be non-admins by default
CREATE OR REPLACE FUNCTION public.handle_new_user_admin_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there are already users in the system
  -- If this is one of the first users (less than a threshold), make them admin
  -- Otherwise, they're a regular user
  IF (SELECT COUNT(*) FROM public.profiles WHERE is_admin = true) < 1 THEN
    -- If no admins exist, make this user an admin (safety mechanism)
    NEW.is_admin := true;
  ELSE
    -- Otherwise, new users are not admins by default
    NEW.is_admin := COALESCE(NEW.is_admin, false);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profiles
DROP TRIGGER IF EXISTS set_user_admin_status ON public.profiles;
CREATE TRIGGER set_user_admin_status
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_admin_status();

-- Update RLS policies for admin-only operations
-- Example: Only admins can delete items
CREATE POLICY "admins_can_delete_items" ON public.items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Example: Only admins can create/edit/delete columns
CREATE POLICY "admins_can_manage_columns" ON public.columns
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

-- Example: Only admins can manage custom fields
CREATE POLICY "admins_can_manage_custom_fields" ON public.custom_fields
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

-- Non-admins can still read everything
CREATE POLICY "all_users_can_read_items" ON public.items
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "all_users_can_read_columns" ON public.columns
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "all_users_can_read_custom_fields" ON public.custom_fields
FOR SELECT TO authenticated
USING (true);

-- Non-admins can create and update items (but not delete)
CREATE POLICY "all_users_can_create_items" ON public.items
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "all_users_can_update_items" ON public.items
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Create a view to easily check user permissions
CREATE OR REPLACE VIEW public.user_permissions AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  p.is_admin,
  CASE 
    WHEN p.is_admin THEN 'Admin - Full Access'
    ELSE 'User - Limited Access'
  END as permission_level,
  CASE 
    WHEN p.is_admin THEN ARRAY[
      'create_items', 'read_items', 'update_items', 'delete_items',
      'create_columns', 'read_columns', 'update_columns', 'delete_columns',
      'create_custom_fields', 'read_custom_fields', 'update_custom_fields', 'delete_custom_fields',
      'manage_users', 'manage_projects'
    ]
    ELSE ARRAY[
      'create_items', 'read_items', 'update_items',
      'read_columns',
      'read_custom_fields'
    ]
  END as allowed_actions
FROM public.profiles p;

-- Grant access to the view
GRANT SELECT ON public.user_permissions TO authenticated;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to promote a user to admin (only admins can call this)
CREATE OR REPLACE FUNCTION public.promote_to_admin(user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if current user is admin
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins can promote other users';
  END IF;
  
  -- Promote the user
  UPDATE public.profiles 
  SET is_admin = true 
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to demote a user from admin (only admins can call this)
CREATE OR REPLACE FUNCTION public.demote_from_admin(user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if current user is admin
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins can demote other users';
  END IF;
  
  -- Prevent removing the last admin
  IF (SELECT COUNT(*) FROM public.profiles WHERE is_admin = true) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;
  
  -- Demote the user
  UPDATE public.profiles 
  SET is_admin = false 
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;