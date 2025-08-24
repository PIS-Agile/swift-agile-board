-- Add position column to custom_fields table for ordering
ALTER TABLE public.custom_fields 
ADD COLUMN position INTEGER DEFAULT 0;

-- Update existing records to have sequential positions
WITH numbered_fields AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) - 1 as new_position
  FROM public.custom_fields
)
UPDATE public.custom_fields
SET position = numbered_fields.new_position
FROM numbered_fields
WHERE custom_fields.id = numbered_fields.id;

-- Add index for better query performance
CREATE INDEX idx_custom_fields_position ON public.custom_fields(project_id, position);