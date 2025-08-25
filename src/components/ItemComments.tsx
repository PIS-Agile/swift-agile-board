import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { Send, Trash2, CheckCircle, Circle, AtSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Comment {
  id: string;
  item_id: string;
  user_id: string;
  content: string;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  mentions?: Array<{
    user_id: string;
    profiles?: Profile;
  }>;
}

interface ItemCommentsProps {
  itemId: string;
  currentUserId: string;
  profiles: Profile[];
  readOnly?: boolean;
}

export function ItemComments({ itemId, currentUserId, profiles, readOnly = false }: ItemCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments();
    
    // Set up realtime subscription
    const channel = supabase
      .channel(`item-comments-${itemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_comments',
          filter: `item_id=eq.${itemId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemId]);

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('item_comments')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            email
          ),
          mentions:comment_mentions (
            user_id,
            profiles:user_id (
              id,
              full_name,
              email
            )
          )
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(commentsData || []);
      
      // Scroll to bottom after loading comments
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
    }
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionText = match[1].toLowerCase();
      const matchedUser = profiles.find(p => 
        p.full_name?.toLowerCase().includes(mentionText) || 
        p.email?.toLowerCase().includes(mentionText)
      );
      if (matchedUser) {
        mentions.push(matchedUser.id);
      }
    }
    
    return [...new Set(mentions)];
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || loading) return;

    setLoading(true);
    try {
      // Create comment
      const { data: comment, error: commentError } = await supabase
        .from('item_comments')
        .insert({
          item_id: itemId,
          user_id: currentUserId,
          content: newComment.trim(),
        })
        .select()
        .single();

      if (commentError) throw commentError;

      // Extract and save mentions
      const mentionedUserIds = extractMentions(newComment);
      if (mentionedUserIds.length > 0) {
        const mentionsToInsert = mentionedUserIds.map(userId => ({
          comment_id: comment.id,
          user_id: userId,
        }));

        const { error: mentionError } = await supabase
          .from('comment_mentions')
          .insert(mentionsToInsert);

        if (mentionError) console.error('Error saving mentions:', mentionError);
      }

      setNewComment('');
      fetchComments();
      
      // Scroll to bottom after adding comment
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      toast({
        title: "Error adding comment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('item_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error deleting comment",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleResolved = async (commentId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('item_comments')
        .update({ is_resolved: !currentStatus })
        .eq('id', commentId);

      if (error) throw error;
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Error updating comment",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    
    // Check for @ symbol to show mention popup
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentionPopover(true);
      setMentionPosition(lastAtIndex);
      setMentionSearch('');
    } else if (lastAtIndex !== -1 && value.length > lastAtIndex + 1) {
      const searchText = value.substring(lastAtIndex + 1);
      if (!searchText.includes(' ') || searchText.split(' ').length <= 2) {
        setMentionSearch(searchText);
        setShowMentionPopover(true);
        setMentionPosition(lastAtIndex);
      } else {
        setShowMentionPopover(false);
      }
    } else {
      setShowMentionPopover(false);
    }
  };

  const insertMention = (user: Profile) => {
    const beforeMention = newComment.substring(0, mentionPosition);
    const afterMention = newComment.substring(mentionPosition + mentionSearch.length + 1);
    const userName = user.full_name || user.email || 'Unknown';
    setNewComment(`${beforeMention}@${userName} ${afterMention}`);
    setShowMentionPopover(false);
    inputRef.current?.focus();
  };

  const filteredProfiles = profiles.filter(p => {
    if (!mentionSearch) return true;
    const search = mentionSearch.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(search) ||
      p.email?.toLowerCase().includes(search)
    );
  });

  const formatCommentContent = (content: string) => {
    // Replace @mentions with styled spans
    return content.replace(/@(\w+(?:\s+\w+)*)/g, (match, name) => {
      const matchedUser = profiles.find(p => 
        p.full_name?.toLowerCase().includes(name.toLowerCase()) || 
        p.email?.toLowerCase().includes(name.toLowerCase())
      );
      if (matchedUser) {
        return `<span class="text-green-600 font-medium">@${name}</span>`;
      }
      return match;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Comments</h3>
        {comments.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {comments.length}
          </Badge>
        )}
      </div>
      
      <ScrollArea className="flex-1 pr-4 mb-3" ref={scrollRef}>
        <div className="space-y-3">
          {comments.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No comments yet
            </div>
          ) : (
            comments.map((comment) => {
              const author = comment.profiles || profiles.find(p => p.id === comment.user_id);
              const authorName = author?.full_name || author?.email || 'Unknown';
              const initials = authorName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div 
                  key={comment.id} 
                  className={`group ${comment.is_resolved ? 'opacity-60' : ''}`}
                >
                  <div className="flex gap-2">
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {authorName}
                          </span>
                          {' · '}
                          <span title={new Date(comment.created_at).toLocaleString()}>
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {!readOnly && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleResolved(comment.id, comment.is_resolved)}
                              title={comment.is_resolved ? "Mark as unresolved" : "Mark as resolved"}
                            >
                              {comment.is_resolved ? (
                                <CheckCircle className="h-3 w-3 text-green-600" />
                              ) : (
                                <Circle className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive"
                              onClick={() => handleDelete(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div 
                        className="text-sm mt-1 break-words"
                        dangerouslySetInnerHTML={{ __html: formatCommentContent(comment.content) }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {!readOnly && (
        <div className="relative">
          <Popover open={showMentionPopover} onOpenChange={setShowMentionPopover}>
            <PopoverTrigger asChild>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newComment}
                  onChange={handleInputChange}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                  placeholder="Add a comment... (use @ to mention)"
                  disabled={loading}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || loading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </PopoverTrigger>
            <PopoverContent 
              className="w-56 p-0" 
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <ScrollArea className="h-48">
                <div className="p-1">
                  {filteredProfiles.map((profile) => (
                    <Button
                      key={profile.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm"
                      onClick={() => insertMention(profile)}
                    >
                      <AtSign className="h-3 w-3 mr-2" />
                      {profile.full_name || profile.email || 'Unknown'}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}