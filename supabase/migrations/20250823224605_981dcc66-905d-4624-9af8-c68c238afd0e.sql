-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create columns table
CREATE TABLE public.columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID REFERENCES public.columns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  estimated_time INTEGER, -- in hours
  actual_time INTEGER DEFAULT 0, -- in hours
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create item assignments (many-to-many between items and users)
CREATE TABLE public.item_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- Create custom fields table
CREATE TABLE public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect')),
  options JSONB, -- for select/multiselect options
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create item field values table
CREATE TABLE public.item_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  field_id UUID REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value JSONB,
  UNIQUE(item_id, field_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_field_values ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects policies (all authenticated users can access all projects for collaboration)
CREATE POLICY "Authenticated users can view all projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update projects" ON public.projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete projects" ON public.projects FOR DELETE TO authenticated USING (true);

-- Columns policies
CREATE POLICY "Authenticated users can view all columns" ON public.columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage columns" ON public.columns FOR ALL TO authenticated USING (true);

-- Items policies
CREATE POLICY "Authenticated users can view all items" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage items" ON public.items FOR ALL TO authenticated USING (true);

-- Item assignments policies
CREATE POLICY "Authenticated users can view all assignments" ON public.item_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage assignments" ON public.item_assignments FOR ALL TO authenticated USING (true);

-- Custom fields policies
CREATE POLICY "Authenticated users can view all custom fields" ON public.custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage custom fields" ON public.custom_fields FOR ALL TO authenticated USING (true);

-- Item field values policies
CREATE POLICY "Authenticated users can view all field values" ON public.item_field_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage field values" ON public.item_field_values FOR ALL TO authenticated USING (true);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_columns_updated_at BEFORE UPDATE ON public.columns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default project and columns
INSERT INTO public.projects (id, name, description) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Kanban', 'Default kanban project for task management');

INSERT INTO public.columns (project_id, name, position, color) VALUES
('00000000-0000-0000-0000-000000000001', 'Backlog', 0, '#64748b'),
('00000000-0000-0000-0000-000000000001', 'To Do', 1, '#3b82f6'),
('00000000-0000-0000-0000-000000000001', 'In Development', 2, '#f59e0b'),
('00000000-0000-0000-0000-000000000001', 'In Review', 3, '#8b5cf6'),
('00000000-0000-0000-0000-000000000001', 'Done', 4, '#10b981');