-- Add project_id to items table for better filtering and real-time updates
ALTER TABLE public.items ADD COLUMN project_id UUID;

-- Update existing items with project_id from their columns
UPDATE public.items 
SET project_id = columns.project_id
FROM public.columns
WHERE items.column_id = columns.id;

-- Make project_id NOT NULL after populating it
ALTER TABLE public.items ALTER COLUMN project_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.items ADD CONSTRAINT items_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_items_project_id ON public.items(project_id);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.item_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_fields;
ALTER PUBLICATION supabase_realtime ADD TABLE public.item_field_values;