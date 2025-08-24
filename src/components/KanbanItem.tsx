import { useState } from 'react';
import { useDrag } from 'react-dnd';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ItemDialog } from './ItemDialog';
import { toast } from '@/hooks/use-toast';
import { Clock, User, MoreHorizontal, Edit3, Trash2 } from 'lucide-react';

interface Item {
  id: string;
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
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface KanbanItemProps {
  item: Item;
  columnId: string;
  profiles: Profile[];
  onUpdate: () => void;
}

export function KanbanItem({ item, columnId, profiles, onUpdate }: KanbanItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [{ isDragging }, drag] = useDrag({
    type: 'item',
    item: { id: item.id, columnId },
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

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card
      ref={drag}
      className={`kanban-item cursor-grab ${
        isDragging ? 'opacity-50 kanban-item-dragging' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-sm flex-1 pr-2">{item.name}</h4>
          {isHovered && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Item
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => document.getElementById(`delete-item-trigger-${item.id}`)?.click()}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {item.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="space-y-2">
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
                {item.assignments.slice(0, 3).map((assignment) => (
                  <Badge
                    key={assignment.user_id}
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5 h-auto"
                    title={assignment.profiles.full_name || assignment.profiles.email || 'Unknown'}
                  >
                    {getInitials(assignment.profiles.full_name)}
                  </Badge>
                ))}
                {item.assignments.length > 3 && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-auto">
                    +{item.assignments.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <ItemDialog
            item={item}
            columnId={columnId}
            profiles={profiles}
            onSave={() => {
              onUpdate();
              setEditDialogOpen(false);
            }}
            onCancel={() => setEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button id={`delete-item-trigger-${item.id}`} className="hidden" />
        </AlertDialogTrigger>
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
    </Card>
  );
}