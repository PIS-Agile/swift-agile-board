-- Enable Realtime for all required tables
-- Run this in Supabase SQL Editor to enable real-time updates

-- Drop existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;

-- Create publication for specific tables
CREATE PUBLICATION supabase_realtime FOR TABLE 
  public.items,
  public.columns,
  public.projects,
  public.item_assignments,
  public.profiles,
  public.custom_fields,
  public.item_field_values,
  public.user_default_values;

-- Set replica identity to FULL for all tables to ensure all data is sent
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.columns REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.item_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.custom_fields REPLICA IDENTITY FULL;
ALTER TABLE public.item_field_values REPLICA IDENTITY FULL;
ALTER TABLE public.user_default_values REPLICA IDENTITY FULL;

-- Verify the publication was created
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- Verify which tables are included in the publication
SELECT 
  schemaname,
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;