-- Enable realtime for all tables
-- First, drop existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication with all tables
CREATE PUBLICATION supabase_realtime FOR TABLE 
  public.items,
  public.columns,
  public.projects,
  public.item_assignments,
  public.profiles,
  public.custom_fields,
  public.item_field_values;

-- Enable real-time replica identity for better performance
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.columns REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.item_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.custom_fields REPLICA IDENTITY FULL;
ALTER TABLE public.item_field_values REPLICA IDENTITY FULL;