-- ============================================
-- ADD ADMIN-ONLY FLAG TO PROJECTS
-- ============================================

-- 1. Add is_admin_only column to projects table (default false for backward compatibility)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS is_admin_only BOOLEAN DEFAULT false;

-- 2. Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_projects_is_admin_only ON public.projects(is_admin_only);

-- ============================================
-- UPDATE RLS POLICIES FOR ADMIN-ONLY PROJECTS
-- ============================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON public.projects;

-- Create new SELECT policy that respects admin-only flag
CREATE POLICY "Users can view appropriate projects" ON public.projects
FOR SELECT TO authenticated
USING (
  -- Non-admin-only projects are visible to everyone
  (is_admin_only = false)
  OR 
  -- Admin-only projects are only visible to admins
  (is_admin_only = true AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  ))
);

-- Update INSERT policy to allow setting is_admin_only (only admins can set it to true)
DROP POLICY IF EXISTS "only_admins_can_create_projects" ON public.projects;

CREATE POLICY "Admins can create projects with admin-only flag" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  -- Must be an admin to create any project
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
  AND
  -- If setting is_admin_only to true, must be an admin
  (
    is_admin_only = false 
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  )
);

-- Update UPDATE policy to prevent non-admins from changing admin-only flag
DROP POLICY IF EXISTS "only_admins_can_update_projects" ON public.projects;

CREATE POLICY "Admins can update projects" ON public.projects
FOR UPDATE TO authenticated
USING (
  -- Must be an admin to update any project
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
)
WITH CHECK (
  -- Must be an admin to update any project
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
  AND
  -- If changing is_admin_only to true, must be an admin
  (
    is_admin_only = (SELECT is_admin_only FROM public.projects WHERE id = projects.id)
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  )
);

-- ============================================
-- UPDATE RELATED TABLE POLICIES
-- ============================================

-- Update columns policy to respect admin-only projects
DROP POLICY IF EXISTS "Authenticated users can view all columns" ON public.columns;

CREATE POLICY "Users can view columns in appropriate projects" ON public.columns
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = columns.project_id
    AND (
      projects.is_admin_only = false
      OR
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_admin = true
      )
    )
  )
);

-- Update items policy to respect admin-only projects
DROP POLICY IF EXISTS "Authenticated users can view all items" ON public.items;

CREATE POLICY "Users can view items in appropriate projects" ON public.items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.columns
    INNER JOIN public.projects ON projects.id = columns.project_id
    WHERE columns.id = items.column_id
    AND (
      projects.is_admin_only = false
      OR
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_admin = true
      )
    )
  )
);

-- Update custom_fields policy to respect admin-only projects  
DROP POLICY IF EXISTS "Authenticated users can view all custom fields" ON public.custom_fields;

CREATE POLICY "Users can view custom fields in appropriate projects" ON public.custom_fields
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = custom_fields.project_id
    AND (
      projects.is_admin_only = false
      OR
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_admin = true
      )
    )
  )
);

-- ============================================
-- HELPER FUNCTION FOR GETTING VISIBLE PROJECTS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_visible_projects()
RETURNS SETOF public.projects AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.projects
  WHERE 
    is_admin_only = false
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  ORDER BY created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- SUMMARY
-- ============================================
-- This migration adds an is_admin_only flag to projects
-- 
-- ADMIN-ONLY PROJECTS:
-- ✅ Only visible to admins in the UI
-- ✅ Items, columns, and custom fields are also hidden from non-admins
-- ✅ Cannot be accessed or modified by non-admins
-- 
-- REGULAR PROJECTS (is_admin_only = false):
-- ✅ Visible to all authenticated users
-- ✅ Follow existing permission rules
-- 
-- DEFAULT PROJECT (Kanban):
-- ✅ Remains visible to all users (is_admin_only = false by default)