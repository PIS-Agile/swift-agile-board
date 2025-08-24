import { useState } from 'react';
import { useDrop } from 'react-dnd';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { KanbanItem } from './KanbanItem';
import { ItemDialog } from './ItemDialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit3, MoreHorizontal } from 'lucide-react';

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

interface Column {
  id: string;
  name: string;
  position: number;
  color: string;
  project_id: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface KanbanColumnProps {
  column: Column;
  items: Item[];
  profiles: Profile[];
  projectId: string;
  onItemUpdate: () => void;
  onColumnUpdate: () => void;
}

export function KanbanColumn({ column, items, profiles, projectId, onItemUpdate, onColumnUpdate }: KanbanColumnProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [{ isOver }, drop] = useDrop({
    accept: 'item',
    drop: async (draggedItem: { id: string; columnId: string }) => {
      if (draggedItem.columnId === column.id) return;

      try {
        const { error } = await supabase
          .from('items')
          .update({ 
            column_id: column.id,
            position: items.length
          })
          .eq('id', draggedItem.id);

        if (error) throw error;
        onItemUpdate();
        
        toast({
          title: "Item moved",
          description: `Item moved to ${column.name}`,
        });
      } catch (error: any) {
        toast({
          title: "Error moving item",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const handleUpdateColumn = async () => {
    if (!columnName.trim()) return;

    try {
      const { error } = await supabase
        .from('columns')
        .update({ name: columnName.trim() })
        .eq('id', column.id);

      if (error) throw error;
      
      setEditingColumn(false);
      onColumnUpdate();
      
      toast({
        title: "Column updated",
        description: "Column name has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error updating column",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteColumn = async () => {
    try {
      const { error } = await supabase
        .from('columns')
        .delete()
        .eq('id', column.id);

      if (error) throw error;
      
      onColumnUpdate();
      
      toast({
        title: "Column deleted",
        description: `${column.name} and all its items have been deleted.`,
      });
    } catch (error: any) {
      toast({
        title: "Error deleting column",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div
      ref={drop}
      className={`kanban-column p-4 w-80 flex-shrink-0 ${
        isOver ? 'ring-2 ring-primary ring-opacity-50' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          {editingColumn ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                onBlur={handleUpdateColumn}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateColumn();
                  if (e.key === 'Escape') {
                    setColumnName(column.name);
                    setEditingColumn(false);
                  }
                }}
                className="h-7 text-sm font-medium"
                autoFocus
              />
            </div>
          ) : (
            <h3 className="font-medium text-sm flex-1">{column.name}</h3>
          )}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {items.length}
          </span>
        </div>
        
        {isHovered && !editingColumn && (
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => {
                  setEditingColumn(true);
                  setDropdownOpen(false);
                }}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Column
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setDeleteDialogOpen(true);
                  setDropdownOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {items
          .sort((a, b) => a.position - b.position)
          .map((item) => (
            <KanbanItem
              key={item.id}
              item={item}
              columnId={column.id}
              projectId={projectId}
              profiles={profiles}
              onUpdate={onItemUpdate}
            />
          ))}
      </div>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Item</DialogTitle>
          </DialogHeader>
          <ItemDialog
            columnId={column.id}
            projectId={projectId}
            profiles={profiles}
            onSave={() => {
              onItemUpdate();
              setItemDialogOpen(false);
            }}
            onCancel={() => setItemDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Column</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{column.name}"? This will also delete all items in this column. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteColumn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}