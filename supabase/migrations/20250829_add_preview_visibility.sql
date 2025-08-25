-- Add show_in_preview column to custom_fields table
ALTER TABLE custom_fields 
ADD COLUMN IF NOT EXISTS show_in_preview BOOLEAN DEFAULT true;

-- Create table for built-in field preview settings
CREATE TABLE IF NOT EXISTS project_field_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  show_in_preview BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, field_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_field_settings_project_id ON project_field_settings(project_id);

-- Insert default settings for built-in fields for existing projects
INSERT INTO project_field_settings (project_id, field_name, show_in_preview)
SELECT DISTINCT p.id, field.name, true
FROM projects p
CROSS JOIN (
  VALUES 
    ('estimated_time'),
    ('actual_time'),
    ('assigned_to'),
    ('item_id')
) AS field(name)
ON CONFLICT (project_id, field_name) DO NOTHING;

-- Enable RLS for the new table
ALTER TABLE project_field_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for project_field_settings
CREATE POLICY "Users can view project field settings" ON project_field_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update project field settings" ON project_field_settings
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert project field settings" ON project_field_settings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete project field settings" ON project_field_settings
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_project_field_settings_updated_at 
  BEFORE UPDATE ON project_field_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE project_field_settings;