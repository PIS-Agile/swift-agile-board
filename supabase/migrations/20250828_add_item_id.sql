-- Add item_id column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS item_id INTEGER;

-- Create a sequence for auto-incrementing item_id per project
CREATE SEQUENCE IF NOT EXISTS item_id_seq START 1;

-- Function to get next item_id for a project
CREATE OR REPLACE FUNCTION get_next_item_id(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_max_id INTEGER;
BEGIN
  -- Get the maximum item_id for the project
  SELECT COALESCE(MAX(item_id), 0) INTO v_max_id
  FROM items
  WHERE project_id = p_project_id;
  
  -- Return the next id
  RETURN v_max_id + 1;
END;
$$ LANGUAGE plpgsql;

-- Update existing items with item_ids
DO $$
DECLARE
  r RECORD;
  v_counter INTEGER;
  v_current_project UUID;
BEGIN
  v_current_project := NULL;
  v_counter := 0;
  
  FOR r IN (
    SELECT id, project_id
    FROM items
    WHERE item_id IS NULL
    ORDER BY project_id, created_at
  ) LOOP
    IF v_current_project IS NULL OR v_current_project != r.project_id THEN
      v_current_project := r.project_id;
      v_counter := 1;
    ELSE
      v_counter := v_counter + 1;
    END IF;
    
    UPDATE items SET item_id = v_counter WHERE id = r.id;
  END LOOP;
END $$;

-- Make item_id NOT NULL after populating existing records
ALTER TABLE items ALTER COLUMN item_id SET NOT NULL;

-- Create unique constraint for item_id per project
ALTER TABLE items ADD CONSTRAINT unique_item_id_per_project UNIQUE (project_id, item_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_items_item_id ON items(item_id);
CREATE INDEX IF NOT EXISTS idx_items_project_item_id ON items(project_id, item_id);