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
import { useAdminStatus } from '@/hooks/useAdminStatus';

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
  isItemOpen?: boolean;
}

export function ItemComments({ itemId, currentUserId, profiles, readOnly = false, isItemOpen = true }: ItemCommentsProps) {
  const { isAdmin } = useAdminStatus();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('ItemComments mounted for item:', itemId, 'with profiles:', profiles.length);
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
    setLoadingComments(true);
    try {
      const { data: commentsData, error } = await supabase
        .from('item_comments')
        .select(`
          *,
          comment_mentions (
            user_id
          )
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        throw error;
      }
      
      console.log('Fetched comments for item:', itemId, commentsData);
      
      // Enrich comments with user profile data
      const enrichedComments = commentsData?.map(comment => {
        const author = profiles.find(p => p.id === comment.user_id);
        const mentions = comment.comment_mentions?.map((m: any) => ({
          user_id: m.user_id,
          profiles: profiles.find(p => p.id === m.user_id)
        }));
        
        return {
          ...comment,
          profiles: author,
          mentions
        };
      }) || [];
      
      setComments(enrichedComments);
      setLoadingComments(false);
      
      // Scroll to bottom after loading comments
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      setLoadingComments(false);
    }
  };

  const extractMentions = (text: string): string[] => {
    const mentions: string[] = [];
    
    console.log('Extracting mentions from:', text);
    console.log('Available profiles:', profiles.map(p => ({ id: p.id, name: p.full_name, email: p.email })));
    
    // Split by @ to find all potential mentions
    const parts = text.split('@');
    
    // Skip first part as it's before any @
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      // Extract the mention text - take everything up to common delimiters
      // but try to match against full names first
      let mentionText = '';
      
      // Try to match against known names first (greedy approach)
      for (const profile of profiles) {
        const fullName = profile.full_name;
        if (fullName && part.toLowerCase().startsWith(fullName.toLowerCase())) {
          mentionText = fullName;
          break;
        }
      }
      
      // If no exact match found, extract until delimiter
      if (!mentionText) {
        // Take text until we hit a delimiter or another @
        const match = part.match(/^([^,.\n@!?;:]+)/);
        if (match) {
          mentionText = match[1].trim();
        }
      }
      
      if (mentionText) {
        console.log('Found mention text:', mentionText);
        
        const mentionLower = mentionText.toLowerCase();
        
        // Try to find matching user
        const matchedUser = profiles.find(p => {
          const fullName = p.full_name?.toLowerCase().trim();
          const email = p.email?.toLowerCase().trim();
          
          // Exact match on full name (case insensitive)
          if (fullName === mentionLower) {
            console.log(`Exact match found: "${mentionText}" === "${p.full_name}"`);
            return true;
          }
          
          // Match first name only
          const firstName = p.full_name?.split(' ')[0]?.toLowerCase();
          if (firstName === mentionLower) {
            console.log(`First name match found: "${mentionText}" === "${firstName}"`);
            return true;
          }
          
          // Match email username part
          const emailUsername = email?.split('@')[0];
          if (emailUsername === mentionLower) {
            console.log(`Email username match found: "${mentionText}" === "${emailUsername}"`);
            return true;
          }
          
          return false;
        });
        
        if (matchedUser) {
          console.log('Matched user:', matchedUser);
          mentions.push(matchedUser.id);
        } else {
          console.log('No match found for:', mentionText);
          console.log('Available users:', profiles.map(p => p.full_name || p.email));
        }
      }
    }
    
    console.log('Final extracted mentions:', mentions);
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
      console.log('Attempting to save mentions for users:', mentionedUserIds);
      
      if (mentionedUserIds.length > 0) {
        const mentionsToInsert = mentionedUserIds.map(userId => ({
          comment_id: comment.id,
          user_id: userId,
        }));

        console.log('Inserting mentions:', mentionsToInsert);

        const { data: mentionData, error: mentionError } = await supabase
          .from('comment_mentions')
          .insert(mentionsToInsert)
          .select();

        if (mentionError) {
          console.error('Error saving mentions:', mentionError);
          toast({
            title: "Warning",
            description: "Comment saved but mentions might not work properly",
            variant: "destructive",
          });
        } else {
          console.log('Mentions saved successfully:', mentionData);
        }
      } else {
        console.log('No mentions found in comment');
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
    let result = content;
    
    // Find all @mentions and replace with styled spans
    const parts = content.split('@');
    if (parts.length === 1) return content; // No mentions
    
    result = parts[0]; // Start with text before first @
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      let mentionText = '';
      let remainingText = part;
      
      // Try to match against known names first (greedy approach)
      for (const profile of profiles) {
        const fullName = profile.full_name;
        if (fullName && part.toLowerCase().startsWith(fullName.toLowerCase())) {
          mentionText = fullName;
          remainingText = part.substring(fullName.length);
          break;
        }
      }
      
      // If no exact match found, extract until delimiter
      if (!mentionText) {
        const match = part.match(/^([^,.\n@!?;:]+)(.*)/);
        if (match) {
          mentionText = match[1].trim();
          remainingText = match[2] || '';
        }
      }
      
      if (mentionText) {
        const mentionLower = mentionText.toLowerCase();
        
        // Check if this mention matches a user
        const matchedUser = profiles.find(p => {
          const fullName = p.full_name?.toLowerCase().trim();
          const firstName = p.full_name?.split(' ')[0]?.toLowerCase();
          const emailUsername = p.email?.split('@')[0]?.toLowerCase();
          
          return fullName === mentionLower || 
                 firstName === mentionLower ||
                 emailUsername === mentionLower;
        });
        
        if (matchedUser) {
          result += `<span class="text-green-600 font-medium">@${mentionText}</span>${remainingText}`;
        } else {
          result += `@${part}`;
        }
      } else {
        result += `@${part}`;
      }
    }
    
    return result;
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
          {loadingComments ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
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
                        {!readOnly && (isAdmin || isItemOpen) && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
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
                            {/* Delete button: admins can delete any comment, non-admins can only delete their own on open items */}
                            {(isAdmin || (isItemOpen && comment.user_id === currentUserId)) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-destructive"
                                onClick={() => handleDelete(comment.id)}
                                title={isAdmin ? "Delete comment" : "Delete your comment"}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
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
                  type="button"
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
                      type="button"
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