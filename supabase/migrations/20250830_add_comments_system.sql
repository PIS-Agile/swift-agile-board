-- Create comments table
CREATE TABLE IF NOT EXISTS public.item_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create mentions table
CREATE TABLE IF NOT EXISTS public.comment_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.item_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(comment_id, user_id)
);

-- Add indexes for performance
CREATE INDEX idx_item_comments_item_id ON public.item_comments(item_id);
CREATE INDEX idx_item_comments_user_id ON public.item_comments(user_id);
CREATE INDEX idx_comment_mentions_user_id ON public.comment_mentions(user_id);
CREATE INDEX idx_comment_mentions_comment_id ON public.comment_mentions(comment_id);

-- Enable RLS
ALTER TABLE public.item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

-- RLS policies for comments
CREATE POLICY "Users can view comments on items they can see" ON public.item_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_comments.item_id
    )
  );

CREATE POLICY "Users can create comments" ON public.item_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.item_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete any comment" ON public.item_comments
  FOR DELETE USING (true);

-- RLS policies for mentions
CREATE POLICY "Users can view mentions" ON public.comment_mentions
  FOR SELECT USING (true);

CREATE POLICY "Users can create mentions" ON public.comment_mentions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.item_comments
      WHERE item_comments.id = comment_mentions.comment_id
      AND item_comments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete mentions from their comments" ON public.comment_mentions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.item_comments
      WHERE item_comments.id = comment_mentions.comment_id
      AND item_comments.user_id = auth.uid()
    )
  );

-- Function to get comment count for items
CREATE OR REPLACE FUNCTION get_item_comment_count(item_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.item_comments
    WHERE item_id = item_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has mentions in item
CREATE OR REPLACE FUNCTION user_has_mentions_in_item(item_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.item_comments ic
    JOIN public.comment_mentions cm ON ic.id = cm.comment_id
    WHERE ic.item_id = item_uuid
    AND cm.user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- Update the updated_at timestamp automatically
CREATE TRIGGER update_item_comments_updated_at
  BEFORE UPDATE ON public.item_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();