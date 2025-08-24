import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AppSidebar } from '@/components/AppSidebar';
import { KanbanColumn } from '@/components/KanbanColumn';
import { CustomFieldsDialog } from '@/components/CustomFieldsDialog';
import { TestDropdown } from '@/components/TestDropdown';
import { RealtimeStatus } from '@/components/RealtimeStatus';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from '@/hooks/use-toast';
import { Plus, Menu, Settings2 } from 'lucide-react';
import type { User, Session } from '@supabase/supabase-js';

interface Column {
  id: string;
  name: string;
  position: number;
  color: string;
  project_id: string;
}

interface Item {
  id: string;
  name: string;
  description: string | null;
  estimated_time: number | null;
  actual_time: number;
  position: number;
  column_id: string;
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
    };
  }>;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('00000000-0000-0000-0000-000000000001');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newColumnDialogOpen, setNewColumnDialogOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#6366f1');
  const [customFieldsDialogOpen, setCustomFieldsDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/auth');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProject = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', selectedProjectId)
      .single();

    if (error) throw error;
    setSelectedProject(data);
    return data;
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) throw error;
    setProfiles(data || []);
    return data || [];
  };

  const fetchColumns = useCallback(async () => {
    if (!selectedProjectId) return;
    
    try {
      const { data, error } = await supabase
        .from('columns')
        .select('*')
        .eq('project_id', selectedProjectId)
        .order('position', { ascending: true });

      if (error) throw error;
      console.log('📊 Fetched columns:', data?.length || 0);
      setColumns(data || []);
    } catch (error) {
      console.error('Error fetching columns:', error);
    }
  }, [selectedProjectId]);

  const fetchItems = useCallback(async () => {
    if (!selectedProjectId) return;
    
    try {
      // First get columns for this project to ensure we have the latest data
      const { data: columnsData, error: columnsError } = await supabase
        .from('columns')
        .select('id')
        .eq('project_id', selectedProjectId);

      if (columnsError) throw columnsError;

      // If no columns, set items to empty
      if (!columnsData || columnsData.length === 0) {
        setItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          assignments:item_assignments(
            user_id,
            profiles!item_assignments_user_id_fkey(
              id,
              full_name,
              email
            )
          ),
          custom_field_values:item_field_values(
            field_id,
            value,
            custom_fields!item_field_values_field_id_fkey(
              name,
              field_type
            )
          )
        `)
        .in('column_id', columnsData.map(col => col.id))
        .order('position', { ascending: true });

      if (error) throw error;
      console.log('📦 Fetched items:', data?.length || 0);
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  }, [selectedProjectId]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch project and profiles first
      const [projectData, profilesData] = await Promise.all([
        fetchProject(),
        fetchProfiles(),
      ]);
      // Then fetch columns and items
      await fetchColumns();
      await fetchItems();
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [fetchColumns, fetchItems]);

  // Memoize the callbacks to prevent unnecessary re-renders
  const handleRealtimeItemsChange = useCallback(() => {
    console.log('📦 Handling realtime items change');
    fetchItems();
  }, [fetchItems]);

  const handleRealtimeColumnsChange = useCallback(() => {
    console.log('📊 Handling realtime columns change');
    fetchColumns();
    fetchItems(); // Also refresh items when columns change
  }, [fetchColumns, fetchItems]);

  // Use the new realtime subscription hook
  const { isConnected } = useRealtimeSubscription({
    projectId: selectedProjectId,
    onItemsChange: handleRealtimeItemsChange,
    onColumnsChange: handleRealtimeColumnsChange,
    enabled: !!user && !!selectedProjectId
  });

  // Show connection status in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔌 Realtime connection status:', isConnected ? 'Connected' : 'Disconnected');
    }
  }, [isConnected]);

  useEffect(() => {
    if (user && selectedProjectId) {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    }
  }, [user, selectedProjectId, fetchData]);

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('columns')
        .insert([
          {
            name: newColumnName.trim(),
            project_id: selectedProjectId,
            position: columns.length,
            color: newColumnColor,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setColumns([...columns, data]);
      setNewColumnName('');
      setNewColumnColor('#6366f1');
      setNewColumnDialogOpen(false);
      
      toast({
        title: "Column created",
        description: `${data.name} has been created successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Error creating column",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleItemUpdate = async () => {
    try {
      await fetchItems();
    } catch (error: any) {
      toast({
        title: "Error updating items",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleColumnUpdate = async () => {
    try {
      await fetchColumns();
      await fetchItems(); // Refresh items too in case column was deleted
    } catch (error: any) {
      toast({
        title: "Error updating columns",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleColumnReorder = async (draggedColumnId: string, targetColumnId: string) => {
    const draggedColumn = columns.find(col => col.id === draggedColumnId);
    const targetColumn = columns.find(col => col.id === targetColumnId);
    
    if (!draggedColumn || !targetColumn || draggedColumn.id === targetColumn.id) return;

    const draggedIndex = columns.indexOf(draggedColumn);
    const targetIndex = columns.indexOf(targetColumn);

    // Create new columns array with swapped positions
    const newColumns = [...columns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    // Update positions in the new array
    const updates = newColumns.map((col, index) => ({
      id: col.id,
      position: index
    }));

    // Update local state optimistically
    setColumns(newColumns.map((col, index) => ({ ...col, position: index })));

    try {
      // Update all column positions in database
      for (const update of updates) {
        const { error } = await supabase
          .from('columns')
          .update({ position: update.position })
          .eq('id', update.id);
        
        if (error) throw error;
      }

      toast({
        title: "Columns reordered",
        description: "Column order has been updated successfully.",
      });
    } catch (error: any) {
      // Revert on error
      await fetchColumns();
      toast({
        title: "Error reordering columns",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Auth redirect will handle this
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar 
            selectedProjectId={selectedProjectId}
            onProjectSelect={setSelectedProjectId}
          />
          
          <main className="flex-1 flex flex-col h-screen overflow-hidden">
            <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 flex-shrink-0">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <SidebarTrigger />
                  <div>
                    <h1 className="text-xl font-semibold">
                      {selectedProject?.name || 'Loading...'}
                    </h1>
                    {selectedProject?.description && (
                      <p className="text-sm text-muted-foreground">
                        {selectedProject.description}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <RealtimeStatus />
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCustomFieldsDialogOpen(true)}
                    >
                      <Settings2 className="h-4 w-4 mr-2" />
                      Custom Fields
                    </Button>
                    
                    <Dialog open={newColumnDialogOpen} onOpenChange={setNewColumnDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Column
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Create New Column</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateColumn} className="space-y-4 px-1">
                          <div className="space-y-2">
                            <Label htmlFor="column-name">Column Name</Label>
                            <Input
                              id="column-name"
                              value={newColumnName}
                              onChange={(e) => setNewColumnName(e.target.value)}
                              placeholder="Enter column name"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="column-color">Column Color</Label>
                            <div className="flex gap-2 items-center">
                              <Input
                                id="column-color"
                                type="color"
                                value={newColumnColor}
                                onChange={(e) => setNewColumnColor(e.target.value)}
                                className="w-20 h-10 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={newColumnColor}
                                onChange={(e) => setNewColumnColor(e.target.value)}
                                placeholder="#6366f1"
                                className="flex-1"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setNewColumnDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button type="submit">Create Column</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-auto">
              <div className="p-6 h-full">
                <div className="flex gap-6 h-full">
                  {columns.map((column) => (
                    <KanbanColumn
                      key={column.id}
                      column={column}
                      items={items.filter(item => item.column_id === column.id)}
                      profiles={profiles}
                      projectId={selectedProjectId}
                      onItemUpdate={handleItemUpdate}
                      onColumnUpdate={handleColumnUpdate}
                      onColumnReorder={handleColumnReorder}
                    />
                  ))}
                  
                  {columns.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center space-y-4">
                        <div className="text-4xl opacity-20">📋</div>
                        <div>
                          <h3 className="text-lg font-medium text-muted-foreground">
                            No columns yet
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Create your first column to get started
                          </p>
                        </div>
                        <Button onClick={() => setNewColumnDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Column
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>

        <CustomFieldsDialog
          projectId={selectedProjectId}
          open={customFieldsDialogOpen}
          onOpenChange={setCustomFieldsDialogOpen}
        />
      </SidebarProvider>
    </DndProvider>
  );
};

export default Index;
