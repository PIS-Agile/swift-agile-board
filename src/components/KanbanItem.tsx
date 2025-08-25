import { useState, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ItemDialogV3 } from './ItemDialogV3';
import { toast } from '@/hooks/use-toast';
import { Clock, User, Edit3, Trash2, MoreHorizontal, MessageSquare } from 'lucide-react';

interface Item {
  id: string;
  item_id: number;
  name: string;
  description: string | null;
  estimated_time: number | null;
  actual_time: number;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignments: Array<{
    user_id: string;
    profiles: {
      full_name: string | null;
      email: string | null;
    };
  }>;
  custom_field_values?: Array<{
    field_id: string;
    value: any;
    custom_fields: {
      name: string;
      field_type: string;
      show_in_preview?: boolean;
    };
  }>;
  comment_count?: number;
  has_user_mentions?: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface KanbanItemProps {
  item: Item;
  columnId: string;
  projectId: string;
  profiles: Profile[];
  columns?: any[];
  onUpdate: () => void;
}

export function KanbanItem({ item, columnId, projectId, profiles, columns, onUpdate }: KanbanItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [{ isDragging }, drag] = useDrag({
    type: 'item',
    item: { id: item.id, columnId, position: item.position },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      
      onUpdate();
      toast({
        title: "Item deleted",
        description: "Item has been deleted successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting item",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open edit dialog if clicking on dropdown menu or buttons
    const target = e.target as HTMLElement;
    const isDropdownClick = target.closest('[role="menu"]') || 
                           target.closest('[role="menuitem"]') || 
                           target.closest('button');
    
    if (!isDragging && !isDropdownClick) {
      e.stopPropagation();
      setEditDialogOpen(true);
    }
  };

  return (
    <>
      <Card
          ref={drag}
          className={`kanban-item cursor-pointer ${
            isDragging ? 'opacity-50 kanban-item-dragging cursor-grabbing' : 'cursor-pointer hover:shadow-md transition-shadow'
          } ${(editDialogOpen || deleteDialogOpen) ? 'pointer-events-none' : ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleCardClick}
        >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 pr-2">
            {item.item_id && (
              <Badge variant="outline" className="text-xs px-1.5 py-0.5 font-mono flex-shrink-0">
                #{item.item_id}
              </Badge>
            )}
            <h4 className="font-medium text-sm break-words">{item.name}</h4>
          </div>
          {(isHovered || dropdownOpen) && (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 flex-shrink-0"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onSelect={() => {
                    setEditDialogOpen(true);
                    setDropdownOpen(false);
                  }}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Item
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => {
                    setDeleteDialogOpen(true);
                    setDropdownOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="space-y-2">
          {/* Comments indicator */}
          {item.comment_count !== undefined && item.comment_count > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>{item.comment_count} {item.comment_count === 1 ? 'comment' : 'comments'}</span>
            </div>
          )}

          {(item.estimated_time || item.actual_time > 0) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {item.estimated_time && `${item.estimated_time}h est`}
                {item.estimated_time && item.actual_time > 0 && ' / '}
                {item.actual_time > 0 && `${item.actual_time}h spent`}
              </span>
            </div>
          )}

          {item.assignments.length > 0 && (
            <div className="flex items-center gap-2">
              <User className="h-3 w-3 text-muted-foreground" />
              <div className="flex gap-1">
                {item.assignments.slice(0, 2).map((assignment) => (
                  <Badge
                    key={assignment.user_id}
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5 h-auto truncate max-w-[120px]"
                    title={assignment.profiles.full_name || assignment.profiles.email || 'Unknown'}
                  >
                    {assignment.profiles.full_name || assignment.profiles.email || 'Unknown'}
                  </Badge>
                ))}
                {item.assignments.length > 2 && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-auto">
                    +{item.assignments.length - 2}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Custom Fields Preview */}
          {item.custom_field_values && item.custom_field_values.length > 0 && (
            <div className="space-y-1 pt-1 border-t">
              {item.custom_field_values
                .filter(fv => fv.custom_fields.show_in_preview !== false)
                .map((fieldValue) => {
                const value = fieldValue.value;
                const fieldType = fieldValue.custom_fields.field_type;
                
                // Skip empty values
                if (!value || value === '' || (Array.isArray(value) && value.length === 0)) return null;
                
                // Skip invalid user selections (UUID-like strings that don't match any user)
                if (fieldType === 'user_select' || fieldType === 'user_multiselect') {
                  if (typeof value === 'string') {
                    const user = profiles.find(p => p.id === value);
                    if (!user) return null; // Skip if user not found
                  } else if (Array.isArray(value)) {
                    const validUsers = value.filter(userId => 
                      profiles.find(p => p.id === userId)
                    );
                    if (validUsers.length === 0) return null; // Skip if no valid users
                  }
                }
                
                let displayValue: any = value;
                
                // Format value based on field type
                if (fieldType === 'date') {
                  // Parse date string without timezone conversion
                  // value is in format "YYYY-MM-DD"
                  const [year, month, day] = value.split('-').map(Number);
                  displayValue = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`; // DD/MM/YYYY format
                } else if (fieldType === 'user_select') {
                  const user = profiles.find(p => p.id === value);
                  displayValue = user ? (user.full_name || user.email || 'Unknown') : null;
                } else if (fieldType === 'user_multiselect' && Array.isArray(value)) {
                  const validUsers = value
                    .map(userId => {
                      const user = profiles.find(p => p.id === userId);
                      return user ? (user.full_name || user.email || 'Unknown') : null;
                    })
                    .filter(Boolean);
                  if (validUsers.length === 0) return null;
                  displayValue = validUsers.join(', ');
                } else if (Array.isArray(value)) {
                  displayValue = value.join(', ');
                }
                
                if (!displayValue) return null;
                
                return (
                  <div key={fieldValue.field_id} className="text-xs text-muted-foreground">
                    <span className="font-medium">{fieldValue.custom_fields.name}:</span>{' '}
                    <span>{displayValue}</span>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          )}
        </div>
      </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="h-[85vh] max-h-[900px] max-w-7xl overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            <DialogTitle>Edit Item {item.item_id ? `#${item.item_id}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden min-h-0">
            <ItemDialogV3
              item={item}
              columnId={columnId}
              projectId={projectId}
              profiles={profiles}
              columns={columns}
              onSave={() => {
                onUpdate();
                setEditDialogOpen(false);
              }}
              onCancel={() => setEditDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{item.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}