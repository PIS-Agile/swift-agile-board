import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DragProvider } from '@/contexts/DragContext';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AppSidebar } from '@/components/AppSidebar';
import { KanbanColumn } from '@/components/KanbanColumn';
import { ItemDialogV3 } from '@/components/ItemDialogV3';
import { CustomFieldsDialogV2 } from '@/components/CustomFieldsDialogV2';
import { DefaultValuesDialog } from '@/components/DefaultValuesDialog';
import { FilterDropdown, FilterCriteria } from '@/components/FilterDropdown';
import { TestDropdown } from '@/components/TestDropdown';
import { RealtimeStatus } from '@/components/RealtimeStatus';
import { useRealtimeWithReset } from '@/hooks/useRealtimeWithReset';
import { toast } from '@/hooks/use-toast';
import { Plus, Menu, Settings2, FileText, AtSign } from 'lucide-react';
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
  item_id: number;
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
  comment_count?: number;
  has_user_mentions?: boolean;
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
  const [defaultValuesDialogOpen, setDefaultValuesDialogOpen] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({});
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [isEditingItem, setIsEditingItem] = useState(false); // Track if any item dialog is open
  const [sharedItemId, setSharedItemId] = useState<string | null>(null);
  const [sharedItem, setSharedItem] = useState<Item | null>(null);
  const [userHasMentions, setUserHasMentions] = useState(false);
  const navigate = useNavigate();
  const { itemId } = useParams();
  
  // Track if this is the initial load
  const isInitialLoadRef = useRef(true);
  const previousProjectIdRef = useRef(selectedProjectId);
  
  // Use ref to track dialog states for loading prevention
  const dialogStatesRef = useRef({
    customFields: false,
    defaultValues: false,
    editingItem: false,
    newColumn: false
  });

  // Update ref when dialog states change
  useEffect(() => {
    dialogStatesRef.current.customFields = customFieldsDialogOpen;
    dialogStatesRef.current.defaultValues = defaultValuesDialogOpen;
    dialogStatesRef.current.editingItem = isEditingItem;
    dialogStatesRef.current.newColumn = newColumnDialogOpen;
  }, [customFieldsDialogOpen, defaultValuesDialogOpen, isEditingItem, newColumnDialogOpen]);

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

  // Separate function to check for mentions across entire project
  const checkUserMentions = useCallback(async () => {
    const currentUser = (await supabase.auth.getUser()).data.user;
    if (!currentUser || !selectedProjectId) {
      console.log('Skipping mention check - no user or project:', { currentUser: !!currentUser, selectedProjectId });
      return;
    }

    console.log('Checking mentions for user:', currentUser.id, 'in project:', selectedProjectId);

    try {
      // Step 1: Get all items in this project
      const { data: projectItems, error: itemsError } = await supabase
        .from('items')
        .select('id')
        .eq('project_id', selectedProjectId);

      if (itemsError) {
        console.error('Error fetching project items:', itemsError);
        return;
      }

      if (!projectItems || projectItems.length === 0) {
        console.log('No items in project, no mentions possible');
        setUserHasMentions(false);
        return;
      }

      const itemIds = projectItems.map(item => item.id);
      console.log('Found', itemIds.length, 'items in project');

      // Step 2: Get all comments on these items that mention the current user and are unresolved
      const { data: unsolvedMentions, error: mentionsError } = await supabase
        .from('item_comments')
        .select(`
          id,
          item_id,
          is_resolved,
          comment_mentions!inner(
            user_id
          )
        `)
        .in('item_id', itemIds)
        .eq('is_resolved', false)
        .eq('comment_mentions.user_id', currentUser.id);

      if (mentionsError) {
        console.error('Error fetching mentions:', mentionsError);
        return;
      }

      const hasUnsolvedMentions = unsolvedMentions && unsolvedMentions.length > 0;
      console.log('Unsolved mentions found:', hasUnsolvedMentions, 'Count:', unsolvedMentions?.length || 0);
      
      if (unsolvedMentions && unsolvedMentions.length > 0) {
        console.log('Unsolved mentions details:', unsolvedMentions);
      }
      
      setUserHasMentions(hasUnsolvedMentions);
    } catch (error) {
      console.error('Error checking mentions:', error);
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

      const { data: itemsData, error } = await supabase
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
              field_type,
              show_in_preview
            )
          )
        `)
        .in('column_id', columnsData.map(col => col.id))
        .order('position', { ascending: true });

      if (error) throw error;

      // Fetch comment counts and mention status for all items
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (itemsData && itemsData.length > 0 && currentUser) {
        const itemIds = itemsData.map(item => item.id);
        
        // Get comment counts
        const { data: commentCounts } = await supabase
          .from('item_comments')
          .select('item_id')
          .in('item_id', itemIds);

        // Get items where current user is mentioned in UNSOLVED comments
        const { data: mentionedItems, error: mentionError } = await supabase
          .from('comment_mentions')
          .select('comment_id, item_comments!inner(item_id, is_resolved)')
          .eq('user_id', currentUser.id)
          .eq('item_comments.is_resolved', false);

        if (mentionError) {
          console.error('Error fetching mentions:', mentionError);
        }

        console.log('Mentions query result for user', currentUser.id, ':', mentionedItems);

        // Create maps for quick lookup
        const commentCountMap = commentCounts?.reduce((acc, comment) => {
          acc[comment.item_id] = (acc[comment.item_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        // Get item IDs with unsolved mentions
        const unsolvedMentionItemIds = new Set(
          mentionedItems?.map(m => (m as any).item_comments.item_id) || []
        );

        console.log('Items with unsolved mentions:', Array.from(unsolvedMentionItemIds));

        // Add comment counts and unsolved mention status to items
        const data = itemsData.map(item => ({
          ...item,
          comment_count: commentCountMap[item.id] || 0,
          has_user_mentions: unsolvedMentionItemIds.has(item.id)
        }));

        // Don't update mention status here - let checkUserMentions handle it project-wide
        // This ensures we don't miss mentions in items outside current view

        console.log('📦 Fetched items with comments:', data?.length || 0);
        // Debug: Check if item_id is included
        if (data && data.length > 0) {
          console.log('First item data:', data[0]);
        }
        setItems(data || []);
        return;
      }

      setItems(itemsData || []);
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
      // Always check for mentions project-wide
      await checkUserMentions();
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [fetchColumns, fetchItems, checkUserMentions]);

  // Simple callback for any data change
  const handleDataChange = useCallback(() => {
    console.log('🔄 Realtime data change detected, refreshing...');
    fetchColumns();
    fetchItems();
    checkUserMentions();
  }, [fetchColumns, fetchItems, checkUserMentions]);

  // Use the realtime subscription hook with reset capability
  const { isConnected, resetConnection } = useRealtimeWithReset({
    projectId: selectedProjectId,
    onDataChange: handleDataChange,
    enabled: !!user && !!selectedProjectId
  });

  // Show connection status
  useEffect(() => {
    if (user && selectedProjectId) {
      console.log('✅ Real-time listening for project:', selectedProjectId);
      console.log('📡 Connection status:', isConnected ? 'Connected' : 'Connecting...');
    }
  }, [user, selectedProjectId, isConnected]);
  
  // Debug: Force refresh button (only in development)
  const forceRefresh = () => {
    console.log('🔄 Force refreshing data...');
    fetchColumns();
    fetchItems();
    checkUserMentions();
  };

  // Handle shared item from URL
  useEffect(() => {
    if (itemId && user) {
      const fetchSharedItem = async () => {
        try {
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
                  field_type,
                  show_in_preview
                )
              )
            `)
            .eq('id', itemId)
            .single();

          if (error) throw error;
          
          if (data) {
            setSharedItem(data);
            setSharedItemId(itemId);
            // Set the project ID from the item's column
            const { data: columnData } = await supabase
              .from('columns')
              .select('project_id')
              .eq('id', data.column_id)
              .single();
            
            if (columnData) {
              setSelectedProjectId(columnData.project_id);
            }
          }
        } catch (error) {
          console.error('Error fetching shared item:', error);
          toast({
            title: "Item not found",
            description: "The shared item could not be loaded.",
            variant: "destructive",
          });
        }
      };
      
      fetchSharedItem();
    }
  }, [itemId, user]);

  useEffect(() => {
    if (user && selectedProjectId) {
      // Check if any dialog is open using the ref
      const hasOpenDialogs = 
        dialogStatesRef.current.customFields || 
        dialogStatesRef.current.defaultValues || 
        dialogStatesRef.current.editingItem ||
        dialogStatesRef.current.newColumn;
      
      // Check if we're switching projects
      const isProjectSwitch = previousProjectIdRef.current !== selectedProjectId;
      previousProjectIdRef.current = selectedProjectId;
      
      // Only show loading on initial load or project switch, and only when no dialogs are open
      if ((isInitialLoadRef.current || isProjectSwitch) && !hasOpenDialogs) {
        setLoading(true);
        fetchData().finally(() => {
          setLoading(false);
          isInitialLoadRef.current = false;
        });
      } else {
        // Don't show loading screen if dialogs are open or it's just a refresh
        fetchData().finally(() => {
          isInitialLoadRef.current = false;
        });
      }
    }
  }, [user, selectedProjectId, fetchData]);
  
  // Ensure mentions are checked when user logs in
  useEffect(() => {
    if (user && selectedProjectId) {
      console.log('User authenticated, checking mentions for:', user.id);
      checkUserMentions();
    }
  }, [user, selectedProjectId, checkUserMentions]);

  // Apply filters whenever items or filters change
  useEffect(() => {
    applyFilters();
  }, [items, filters]);

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

  const applyFilters = () => {
    let filtered = [...items];

    // Filter by name
    if (filters.name) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(filters.name!.toLowerCase())
      );
    }

    // Filter by description
    if (filters.description) {
      filtered = filtered.filter(item => 
        item.description?.toLowerCase().includes(filters.description!.toLowerCase())
      );
    }

    // Filter by estimated time
    if (filters.estimatedTimeMin !== null && filters.estimatedTimeMin !== undefined) {
      filtered = filtered.filter(item => 
        item.estimated_time !== null && item.estimated_time >= filters.estimatedTimeMin!
      );
    }
    if (filters.estimatedTimeMax !== null && filters.estimatedTimeMax !== undefined) {
      filtered = filtered.filter(item => 
        item.estimated_time !== null && item.estimated_time <= filters.estimatedTimeMax!
      );
    }

    // Filter by actual time
    if (filters.actualTimeMin !== null && filters.actualTimeMin !== undefined) {
      filtered = filtered.filter(item => 
        item.actual_time >= filters.actualTimeMin!
      );
    }
    if (filters.actualTimeMax !== null && filters.actualTimeMax !== undefined) {
      filtered = filtered.filter(item => 
        item.actual_time <= filters.actualTimeMax!
      );
    }

    // Filter by unified user field
    if (filters.user) {
      filtered = filtered.filter(item => {
        // Check if user is in assigned users
        const assignedUserIds = item.assignments.map(a => a.user_id);
        if (assignedUserIds.includes(filters.user!)) return true;
        
        // Check if user is in any custom user field
        if (item.custom_field_values) {
          for (const fieldValue of item.custom_field_values) {
            // Check if this is a user field and contains the user
            const field = customFields.find(f => f.id === fieldValue.field_id);
            if (field && (field.field_type === 'user_select' || field.field_type === 'user_multiselect')) {
              const value = fieldValue.value;
              if (value) {
                // Handle both single and multi-select user fields
                if (Array.isArray(value)) {
                  if (value.includes(filters.user!)) return true;
                } else if (value === filters.user!) {
                  return true;
                }
              }
            }
          }
        }
        
        return false;
      });
    }
    
    // Keep support for old assignedUsers filter for backwards compatibility
    if (filters.assignedUsers && filters.assignedUsers.length > 0) {
      filtered = filtered.filter(item => {
        const assignedUserIds = item.assignments.map(a => a.user_id);
        return filters.assignedUsers!.some(userId => assignedUserIds.includes(userId));
      });
    }

    // Filter by item number (exact match)
    if (filters.itemNumber !== null && filters.itemNumber !== undefined) {
      filtered = filtered.filter(item => 
        item.item_id === filters.itemNumber
      );
    }

    // Filter by unsolved mentions
    if (filters.mentionsMe) {
      filtered = filtered.filter(item => item.has_user_mentions === true);
    }

    // Filter by columns
    if (filters.columns && filters.columns.length > 0) {
      filtered = filtered.filter(item => 
        filters.columns!.includes(item.column_id)
      );
    }

    // Filter by custom fields
    if (filters.customFields) {
      Object.entries(filters.customFields).forEach(([fieldKey, filterValue]) => {
        if (filterValue === null || filterValue === undefined || filterValue === '' || 
            (Array.isArray(filterValue) && filterValue.length === 0)) {
          return;
        }

        // Skip user fields as they're handled by the unified user filter
        const field = customFields.find(f => f.id === fieldKey);
        if (field && (field.field_type === 'user_select' || field.field_type === 'user_multiselect')) {
          return;
        }

        // Handle different filter types
        if (fieldKey.endsWith('_min') || fieldKey.endsWith('_max')) {
          // Number range filters
          const fieldId = fieldKey.replace(/_min$|_max$/, '');
          const isMin = fieldKey.endsWith('_min');
          
          filtered = filtered.filter(item => {
            const fieldValue = item.custom_field_values?.find(v => v.field_id === fieldId)?.value;
            if (fieldValue === null || fieldValue === undefined) return false;
            
            if (isMin) {
              return parseFloat(fieldValue) >= filterValue;
            } else {
              return parseFloat(fieldValue) <= filterValue;
            }
          });
        } else if (fieldKey.endsWith('_start') || fieldKey.endsWith('_end')) {
          // Date range filters
          const fieldId = fieldKey.replace(/_start$|_end$/, '');
          const isStart = fieldKey.endsWith('_start');
          
          filtered = filtered.filter(item => {
            const fieldValue = item.custom_field_values?.find(v => v.field_id === fieldId)?.value;
            if (!fieldValue) return false;
            
            const fieldDate = new Date(fieldValue);
            const filterDate = new Date(filterValue as string);
            
            if (isStart) {
              return fieldDate >= filterDate;
            } else {
              return fieldDate <= filterDate;
            }
          });
        } else if (typeof filterValue === 'string') {
          // Text search
          filtered = filtered.filter(item => {
            const fieldValue = item.custom_field_values?.find(v => v.field_id === fieldKey)?.value;
            if (!fieldValue) return false;
            return String(fieldValue).toLowerCase().includes(filterValue.toLowerCase());
          });
        } else if (Array.isArray(filterValue)) {
          // Multi-select filters
          filtered = filtered.filter(item => {
            const fieldValue = item.custom_field_values?.find(v => v.field_id === fieldKey)?.value;
            if (!fieldValue) return false;
            
            if (Array.isArray(fieldValue)) {
              // Check if any selected filter values are in the field value
              return filterValue.some(fv => fieldValue.includes(fv));
            } else {
              // Single value, check if it's in the filter values
              return filterValue.includes(fieldValue);
            }
          });
        }
      });
    }

    setFilteredItems(filtered);
  };

  const handleApplyFilters = (newFilters: FilterCriteria) => {
    setFilters(newFilters);
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
    <DragProvider>
      <DndProvider backend={HTML5Backend}>
        <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar 
            selectedProjectId={selectedProjectId}
            onProjectSelect={(projectId) => {
              // Close all dialogs when switching projects
              setCustomFieldsDialogOpen(false);
              setDefaultValuesDialogOpen(false);
              setNewColumnDialogOpen(false);
              setIsEditingItem(false);
              setSelectedProjectId(projectId);
            }}
            onSyncClick={resetConnection}
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
                    <RealtimeStatus isConnected={isConnected} />
                    
                    {process.env.NODE_ENV === 'development' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={forceRefresh}
                        title="Force refresh data"
                      >
                        🔄 Refresh
                      </Button>
                    )}
                    
                    <div className="flex gap-2">
                      {/* DEBUG: Show button state */}
                      {process.env.NODE_ENV === 'development' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            console.log('=== MANUAL MENTION CHECK ===');
                            console.log('Current userHasMentions state:', userHasMentions);
                            await checkUserMentions();
                            console.log('Check complete. New state should be set.');
                          }}
                        >
                          Debug Mentions ({userHasMentions ? 'YES' : 'NO'})
                        </Button>
                      )}
                      
                      {userHasMentions && (
                        <Button
                          size="sm"
                          variant={filters.mentionsMe ? "default" : "outline"}
                          onClick={() => {
                            const newFilters = { ...filters, mentionsMe: !filters.mentionsMe };
                            setFilters(newFilters);
                            handleApplyFilters(newFilters);
                          }}
                          className="relative"
                          title="Show items with unsolved mentions"
                        >
                          <AtSign className="h-4 w-4 mr-2" />
                          Mentions
                          {!filters.mentionsMe && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-600 rounded-full animate-pulse" />
                          )}
                        </Button>
                      )}
                      
                      <FilterDropdown
                        projectId={selectedProjectId}
                        onApplyFilters={handleApplyFilters}
                        currentFilters={filters}
                        columns={columns}
                      />
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDefaultValuesDialogOpen(true)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Default Values
                      </Button>
                      
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

            <div className="flex-1 overflow-auto no-scrollbar">
              <div className="p-6 h-full">
                <div 
                  className="flex gap-6 items-start h-full overflow-x-auto no-scrollbar"
                  onWheel={(e) => {
                    // Enable horizontal scrolling with shift key or when dragging
                    const target = e.currentTarget;
                    if (e.shiftKey || e.deltaX !== 0) {
                      target.scrollLeft += e.deltaX || e.deltaY;
                      e.preventDefault();
                    }
                  }}
                >
                  {columns.map((column) => (
                    <KanbanColumn
                      key={column.id}
                      column={column}
                      items={filteredItems.filter(item => item.column_id === column.id)}
                      profiles={profiles}
                      projectId={selectedProjectId}
                      columns={columns}
                      onItemUpdate={handleItemUpdate}
                      onColumnUpdate={handleColumnUpdate}
                      onColumnReorder={handleColumnReorder}
                      onItemDialogChange={setIsEditingItem}
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

        <CustomFieldsDialogV2
          projectId={selectedProjectId}
          open={customFieldsDialogOpen}
          onOpenChange={setCustomFieldsDialogOpen}
        />
        
        <DefaultValuesDialog
          projectId={selectedProjectId}
          open={defaultValuesDialogOpen}
          onOpenChange={setDefaultValuesDialogOpen}
        />
        
        {/* Shared Item Dialog */}
        {sharedItem && (
          <Dialog open={!!sharedItemId} onOpenChange={(open) => {
            if (!open) {
              setSharedItemId(null);
              setSharedItem(null);
              navigate('/');
            }
          }}>
            <DialogContent className="h-[85vh] max-h-[900px] max-w-7xl overflow-hidden flex flex-col p-0">
              <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
                <DialogTitle>View Item #{sharedItem.item_id}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-hidden min-h-0">
                <ItemDialogV3
                  item={sharedItem}
                  columnId={sharedItem.column_id}
                  projectId={selectedProjectId}
                  profiles={profiles}
                  columns={columns}
                  onSave={() => {}}
                  onCancel={() => {
                    setSharedItemId(null);
                    setSharedItem(null);
                    navigate('/');
                  }}
                  readOnly={true}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
        </SidebarProvider>
      </DndProvider>
    </DragProvider>
  );
};

export default Index;
