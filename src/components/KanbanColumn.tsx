import { useState, useRef, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { KanbanItem } from './KanbanItem';
import { ItemDialogV3 } from './ItemDialogV3';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit3, MoreHorizontal, Palette } from 'lucide-react';

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
  columns?: Column[];
  onItemUpdate: () => void;
  onColumnUpdate: () => void;
  onColumnReorder?: (draggedColumnId: string, targetColumnId: string) => void;
}

export function KanbanColumn({ column, items, profiles, projectId, columns, onItemUpdate, onColumnUpdate, onColumnReorder }: KanbanColumnProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [columnColor, setColumnColor] = useState(column.color);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [dropIndicatorPosition, setDropIndicatorPosition] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  // Drag source for column
  const [{ isDragging }, dragRef] = useDrag({
    type: 'column',
    item: { id: column.id, position: column.position },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop target for columns (for reordering)
  const [{ isOverColumn }, dropColumn] = useDrop({
    accept: 'column',
    drop: (draggedColumn: { id: string; position: number }) => {
      if (onColumnReorder && draggedColumn.id !== column.id) {
        onColumnReorder(draggedColumn.id, column.id);
      }
    },
    collect: (monitor) => ({
      isOverColumn: monitor.isOver(),
    }),
  });

  // Drop target for items (supports both moving between columns and reordering within)
  const [{ isOver }, dropItems] = useDrop({
    accept: 'item',
    hover: (draggedItem: { id: string; columnId: string; position: number }, monitor) => {
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset || !itemsRef.current) {
        setDropIndicatorPosition(null);
        return;
      }

      const hoverBoundingRect = itemsRef.current.getBoundingClientRect();
      const hoverClientY = clientOffset.y - hoverBoundingRect.top + itemsRef.current.scrollTop;
      
      // Get all item elements and their positions
      const itemElements = itemsRef.current.querySelectorAll('.kanban-item-wrapper');
      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      
      let targetPosition = sortedItems.length; // Default to end
      let foundPosition = false;
      
      // Find drop position based on actual item positions
      itemElements.forEach((element, index) => {
        if (foundPosition) return;
        
        const rect = element.getBoundingClientRect();
        const itemTop = rect.top - hoverBoundingRect.top + itemsRef.current!.scrollTop;
        const itemHeight = rect.height;
        const itemMiddle = itemTop + itemHeight / 2;
        
        if (hoverClientY < itemMiddle) {
          targetPosition = index;
          foundPosition = true;
        }
      });
      
      // Don't show indicator if dropping on the same position
      if (draggedItem.columnId === column.id) {
        const currentIndex = sortedItems.findIndex(item => item.id === draggedItem.id);
        if (currentIndex === targetPosition || currentIndex === targetPosition - 1) {
          setDropIndicatorPosition(null);
          return;
        }
      }
      
      setDropIndicatorPosition(targetPosition);
      setIsDraggingOver(true);
    },
    drop: async (draggedItem: { id: string; columnId: string; position: number }, monitor) => {
      try {
        // Use the position from the last hover event
        let targetPosition = dropIndicatorPosition !== null ? dropIndicatorPosition : items.length;
        
        if (draggedItem.columnId === column.id) {
          // Reordering within the same column
          const sortedItems = [...items].sort((a, b) => a.position - b.position);
          const currentIndex = sortedItems.findIndex(item => item.id === draggedItem.id);
          
          if (currentIndex === -1 || currentIndex === targetPosition) return;
          
          // Remove item from current position and insert at new position
          const [movedItem] = sortedItems.splice(currentIndex, 1);
          sortedItems.splice(targetPosition > currentIndex ? targetPosition - 1 : targetPosition, 0, movedItem);
          
          // Update positions for all items
          const updates = sortedItems.map((item, index) => ({
            id: item.id,
            position: index
          }));
          
          // Batch update changed positions
          for (const update of updates) {
            const originalItem = items.find(i => i.id === update.id);
            if (originalItem && originalItem.position !== update.position) {
              await supabase
                .from('items')
                .update({ position: update.position })
                .eq('id', update.id);
            }
          }
          
          toast({
            title: "Item reordered",
            description: "Item position updated",
          });
        } else {
          // Moving to a different column
          const sortedItems = [...items].sort((a, b) => a.position - b.position);
          
          // Insert at target position
          sortedItems.splice(targetPosition, 0, { ...draggedItem, position: targetPosition } as any);
          
          // Update the moved item
          await supabase
            .from('items')
            .update({ 
              column_id: column.id,
              position: targetPosition,
              project_id: projectId // Ensure project_id is set
            })
            .eq('id', draggedItem.id);
          
          // Update positions of items after the insertion point
          for (let i = targetPosition + 1; i < sortedItems.length; i++) {
            if (sortedItems[i].id !== draggedItem.id) {
              await supabase
                .from('items')
                .update({ position: i })
                .eq('id', sortedItems[i].id);
            }
          }
          
          toast({
            title: "Item moved",
            description: `Item moved to ${column.name}`,
          });
        }
        
        onItemUpdate();
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

  // Reset drop indicator when not dragging
  useEffect(() => {
    if (!isOver) {
      setDropIndicatorPosition(null);
      setIsDraggingOver(false);
    }
  }, [isOver]);

  const handleUpdateColumn = async () => {
    if (!columnName.trim()) return;

    try {
      const { error } = await supabase
        .from('columns')
        .update({ 
          name: columnName.trim(),
          color: columnColor
        })
        .eq('id', column.id);

      if (error) throw error;
      
      setEditingColumn(false);
      setColorDialogOpen(false);
      onColumnUpdate();
      
      toast({
        title: "Column updated",
        description: "Column has been updated successfully.",
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

  // Combine refs for both drag and drop
  const combinedRef = (el: HTMLDivElement | null) => {
    dragRef(el);
    dropColumn(el);
    dropItems(el);
    dropRef.current = el;
  };

  return (
    <div
      ref={combinedRef}
      className={`kanban-column p-4 w-80 flex-shrink-0 transition-all relative flex flex-col h-fit ${
        isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-grab'
      } ${
        isDraggingOver ? 'ring-2 ring-primary bg-primary/5 shadow-xl' : ''
      } ${
        isOverColumn ? 'scale-105 shadow-lg' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Column drop indicator */}
      {isOverColumn && !isDragging && (
        <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none animate-pulse" />
      )}
      <div className={`flex items-center justify-between mb-4 ${isDragging ? 'cursor-grabbing' : ''}`}>
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-3 h-3 rounded-full transition-transform"
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
        
        {(isHovered || dropdownOpen) && !editingColumn && (
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onSelect={() => {
                  setEditingColumn(true);
                  setDropdownOpen(false);
                }}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Rename Column
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setColorDialogOpen(true);
                  setDropdownOpen(false);
                }}
              >
                <Palette className="h-4 w-4 mr-2" />
                Change Color
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
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

      <div 
        ref={itemsRef}
        className="space-y-3 mb-4 relative overflow-y-auto max-h-[calc(100vh-280px)] min-h-[200px] pr-2 no-scrollbar"
        onWheel={(e) => {
          // Enable scrolling even during drag
          if (itemsRef.current) {
            itemsRef.current.scrollTop += e.deltaY;
          }
        }}
      >
        {items
          .sort((a, b) => a.position - b.position)
          .map((item, index) => (
            <div key={item.id} className="kanban-item-wrapper relative">
              {isDraggingOver && dropIndicatorPosition === index && (
                <div className="relative mb-3">
                  <div className="h-1 bg-primary rounded-full transition-all duration-200 shadow-[0_0_10px_rgba(var(--primary)/0.5)]" />
                  <div className="absolute inset-0 h-1 bg-primary rounded-full animate-pulse" />
                </div>
              )}
              <KanbanItem
                item={item}
                columnId={column.id}
                projectId={projectId}
                profiles={profiles}
                columns={columns}
                onUpdate={onItemUpdate}
              />
            </div>
          ))}
        {isDraggingOver && dropIndicatorPosition === items.length && (
          <div className="relative">
            <div className="h-1 bg-primary rounded-full transition-all duration-200 shadow-[0_0_10px_rgba(var(--primary)/0.5)]" />
            <div className="absolute inset-0 h-1 bg-primary rounded-full animate-pulse" />
          </div>
        )}
      </div>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
        </DialogTrigger>
        <DialogContent className="h-[85vh] max-h-[900px] max-w-6xl overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            <DialogTitle>Create New Item</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden min-h-0">
            <ItemDialogV3
              columnId={column.id}
              projectId={projectId}
              profiles={profiles}
              columns={columns}
              onSave={() => {
                onItemUpdate();
                setItemDialogOpen(false);
              }}
              onCancel={() => setItemDialogOpen(false)}
            />
          </div>
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

      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Column Color</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-1">
            <div className="space-y-2">
              <label htmlFor="column-color-picker">Select Color</label>
              <div className="flex gap-2 items-center">
                <Input
                  id="column-color-picker"
                  type="color"
                  value={columnColor}
                  onChange={(e) => setColumnColor(e.target.value)}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  type="text"
                  value={columnColor}
                  onChange={(e) => setColumnColor(e.target.value)}
                  placeholder="#6366f1"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setColorDialogOpen(false);
                  setColumnColor(column.color);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateColumn}>
                Save Color
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}