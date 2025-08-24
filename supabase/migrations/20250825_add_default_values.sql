-- Add default_value column to custom_fields table
ALTER TABLE public.custom_fields 
ADD COLUMN default_value JSONB DEFAULT null;

-- Create table for project default field settings
CREATE TABLE public.project_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  default_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, field_name)
);

-- Enable RLS on project_defaults
ALTER TABLE public.project_defaults ENABLE ROW LEVEL SECURITY;

-- Create policies for project_defaults
CREATE POLICY "Users can view project defaults" ON public.project_defaults
  FOR SELECT USING (true);

CREATE POLICY "Users can manage project defaults" ON public.project_defaults
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Add indexes
CREATE INDEX idx_project_defaults_project_id ON public.project_defaults(project_id);

-- Add comment
COMMENT ON TABLE public.project_defaults IS 'Stores default values for built-in fields per project';
COMMENT ON COLUMN public.custom_fields.default_value IS 'Default value for custom field';
COMMENT ON COLUMN public.project_defaults.field_name IS 'Name of the built-in field (description, estimated_time, etc.)';