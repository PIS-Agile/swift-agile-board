-- Add GitHub-compatible fields to items table
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS milestone TEXT,
ADD COLUMN IF NOT EXISTS github_issue_number INTEGER,
ADD COLUMN IF NOT EXISTS github_issue_id BIGINT,
ADD COLUMN IF NOT EXISTS github_node_id TEXT,
ADD COLUMN IF NOT EXISTS github_html_url TEXT,
ADD COLUMN IF NOT EXISTS github_state TEXT DEFAULT 'open',
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS priority TEXT;

-- Add indexes for GitHub fields
CREATE INDEX IF NOT EXISTS idx_items_github_issue_number ON public.items(github_issue_number);
CREATE INDEX IF NOT EXISTS idx_items_github_issue_id ON public.items(github_issue_id);
CREATE INDEX IF NOT EXISTS idx_items_labels ON public.items USING gin(labels);

-- Create table for GitHub integration settings per project
CREATE TABLE IF NOT EXISTS public.github_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  github_token TEXT, -- Encrypted in app layer
  sync_enabled BOOLEAN DEFAULT false,
  column_mapping JSONB DEFAULT '{}'::jsonb,
  label_mapping JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE public.github_integrations ENABLE ROW LEVEL SECURITY;

-- Policies for GitHub integrations
CREATE POLICY "Users can view GitHub integrations" ON public.github_integrations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage GitHub integrations" ON public.github_integrations
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create table for sync logs
CREATE TABLE IF NOT EXISTS public.github_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'sync'
  direction TEXT NOT NULL, -- 'to_github', 'from_github'
  status TEXT NOT NULL, -- 'success', 'error'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.github_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies for sync logs
CREATE POLICY "Users can view sync logs" ON public.github_sync_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create sync logs" ON public.github_sync_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add column state mapping (for tracking which column maps to which GitHub state/label)
ALTER TABLE public.columns
ADD COLUMN IF NOT EXISTS github_label TEXT,
ADD COLUMN IF NOT EXISTS github_state TEXT CHECK (github_state IN ('open', 'closed'));

-- Default column mappings
COMMENT ON COLUMN public.items.labels IS 'GitHub labels as JSON array [{name, color, description}]';
COMMENT ON COLUMN public.items.milestone IS 'GitHub milestone title';
COMMENT ON COLUMN public.items.github_issue_number IS 'GitHub issue number (#123)';
COMMENT ON COLUMN public.items.github_issue_id IS 'GitHub issue ID';
COMMENT ON COLUMN public.items.github_state IS 'GitHub issue state (open/closed)';
COMMENT ON COLUMN public.items.priority IS 'Priority level (low, medium, high, critical)';
COMMENT ON COLUMN public.columns.github_label IS 'GitHub label to apply when item is in this column';
COMMENT ON COLUMN public.columns.github_state IS 'GitHub state when item is in this column';