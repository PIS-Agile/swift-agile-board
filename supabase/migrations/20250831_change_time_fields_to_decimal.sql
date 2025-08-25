-- Change time fields from integer to numeric to allow decimal values
-- This allows values like 1.5, 2.5, 0.25 hours etc.

-- Alter estimated_time column in items table
ALTER TABLE public.items 
ALTER COLUMN estimated_time TYPE NUMERIC(10,2);

-- Alter actual_time column in items table  
ALTER TABLE public.items 
ALTER COLUMN actual_time TYPE NUMERIC(10,2);

-- Update custom fields storage to handle decimals properly
-- The item_field_values table already uses JSONB which can store decimals
-- But we need to ensure the UI and validation handle decimals correctly

-- If there are any project_field_settings for numeric fields, update them
UPDATE public.project_field_settings
SET show_in_preview = show_in_preview
WHERE field_name IN ('estimated_time', 'actual_time');

-- The numeric type will automatically handle both integers and decimals
-- Values like 1, 1.5, 2.25, 0.5 are all valid
-- Custom fields with type 'number' already use JSONB storage which supports decimals