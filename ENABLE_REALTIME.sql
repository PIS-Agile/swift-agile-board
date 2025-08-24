-- =====================================================
-- ENABLE REALTIME IN SUPABASE
-- Run this SQL in your Supabase SQL Editor
-- =====================================================

-- Step 1: Drop existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;

-- Step 2: Create publication for all required tables
CREATE PUBLICATION supabase_realtime FOR TABLE 
  public.items,
  public.columns,
  public.projects,
  public.item_assignments,
  public.profiles,
  public.custom_fields,
  public.item_field_values,
  public.user_default_values;

-- Step 3: Set replica identity to FULL for all tables
-- This ensures all column values are sent in the realtime events
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.columns REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.item_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.custom_fields REPLICA IDENTITY FULL;
ALTER TABLE public.item_field_values REPLICA IDENTITY FULL;
ALTER TABLE public.user_default_values REPLICA IDENTITY FULL;

-- Step 4: Verify the publication was created
SELECT 
  pubname,
  puballtables,
  pubinsert,
  pubupdate,
  pubdelete
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- Step 5: Verify which tables are included
SELECT 
  schemaname,
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;

-- Step 6: Grant necessary permissions (if needed)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- =====================================================
-- IMPORTANT: After running this SQL
-- =====================================================
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to Database → Replication
-- 3. Make sure these tables show "Realtime enabled":
--    - items
--    - columns
--    - projects
--    - item_assignments
--    - profiles
--    - custom_fields
--    - item_field_values
-- 4. If not, click on each table and toggle "Enable Realtime"
-- =====================================================