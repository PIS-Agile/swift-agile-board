import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Trello, Plus, FolderKanban, LogOut, User, Edit3, Trash2, MoreHorizontal, RefreshCw, Shield } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAdminStatus } from '@/hooks/useAdminStatus';

interface Project {
  id: string;
  name: string;
  description: string | null;
  is_admin_only?: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface AppSidebarProps {
  selectedProjectId: string;
  onProjectSelect: (projectId: string) => void;
  onSyncClick?: () => void;
}

export function AppSidebar({ selectedProjectId, onProjectSelect, onSyncClick }: AppSidebarProps) {
  const { isAdmin } = useAdminStatus();
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectAdminOnly, setNewProjectAdminOnly] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [editProjectAdminOnly, setEditProjectAdminOnly] = useState(false);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const { state } = useSidebar();
  const navigate = useNavigate();

  const isCollapsed = state === 'collapsed';

  useEffect(() => {
    fetchProjects();
    fetchProfile();

    // Set up real-time subscription for projects
    const projectsChannel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        (payload) => {
          console.log('Project change detected:', payload);
          fetchProjects();
        }
      )
      .subscribe((status) => {
        console.log('Projects subscription status:', status);
      });

    return () => {
      supabase.removeChannel(projectsChannel);
    };
  }, []);

  const fetchProjects = async () => {
    try {
      // Use the helper function to get only visible projects
      const { data, error } = await supabase
        .rpc('get_visible_projects');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading projects",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjectName.trim() || !editingProject) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: editProjectName.trim(),
          description: editProjectDescription.trim() || null,
          is_admin_only: editProjectAdminOnly,
        })
        .eq('id', editingProject.id)
        .select()
        .single();

      if (error) throw error;

      setProjects(projects.map(p => p.id === editingProject.id ? data : p));
      setEditDialogOpen(false);
      setEditingProject(null);
      
      toast({
        title: "Project updated",
        description: `${data.name} has been updated successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating project",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects(projects.filter(p => p.id !== projectId));
      if (selectedProjectId === projectId) {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        if (remainingProjects.length > 0) {
          onProjectSelect(remainingProjects[0].id);
        }
      }
      
      toast({
        title: "Project deleted",
        description: "Project and all its data have been deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting project",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startEditProject = (project: Project) => {
    setEditingProject(project);
    setEditProjectName(project.name);
    setEditProjectDescription(project.description || '');
    setEditProjectAdminOnly(project.is_admin_only || false);
    setEditDialogOpen(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            name: newProjectName.trim(),
            description: newProjectDescription.trim() || null,
            created_by: user.id,
            is_admin_only: newProjectAdminOnly,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setProjects([...projects, data]);
      setNewProjectName('');
      setNewProjectDescription('');
      setNewProjectAdminOnly(false);
      setCreateDialogOpen(false);
      
      toast({
        title: "Project created",
        description: `${data.name} has been created successfully${newProjectAdminOnly ? ' (Admin-only)' : ''}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error creating project",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/auth');
    } catch (error: any) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Sidebar className="border-r">
        <SidebarContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Trello className="h-5 w-5 text-primary" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="font-semibold text-sm">Minimal Kanban</h2>
              <p className="text-xs text-muted-foreground">Project Management</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects.map((project) => (
                <SidebarMenuItem 
                  key={project.id}
                  onMouseEnter={() => setHoveredProjectId(project.id)}
                  onMouseLeave={() => setHoveredProjectId(null)}
                >
                  <div className="flex items-center w-full">
                    <SidebarMenuButton
                      onClick={() => onProjectSelect(project.id)}
                      isActive={selectedProjectId === project.id}
                      className="justify-start flex-1"
                    >
                      <FolderKanban className="h-4 w-4" />
                      {!isCollapsed && (
                        <div className="flex items-center gap-2 flex-1">
                          <span>{project.name}</span>
                          {project.is_admin_only && (
                            <Shield className="h-3 w-3 text-muted-foreground" title="Admin only" />
                          )}
                        </div>
                      )}
                    </SidebarMenuButton>
                    {!isCollapsed && (hoveredProjectId === project.id || dropdownOpen === project.id) && project.id !== '00000000-0000-0000-0000-000000000001' && (
                      <DropdownMenu 
                        open={dropdownOpen === project.id} 
                        onOpenChange={(open) => setDropdownOpen(open ? project.id : null)}
                      >
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
                              startEditProject(project);
                              setDropdownOpen(null);
                            }}
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Project
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => {
                              if (confirm(`Are you sure you want to delete "${project.name}"? This will permanently delete all columns and items in this project.`)) {
                                handleDeleteProject(project.id);
                              }
                              setDropdownOpen(null);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </SidebarMenuItem>
              ))}
              
              <SidebarMenuItem>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <SidebarMenuButton className="justify-start text-muted-foreground hover:text-foreground">
                      <Plus className="h-4 w-4" />
                      {!isCollapsed && <span>New Project</span>}
                    </SidebarMenuButton>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Create New Project</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateProject} className="space-y-4 px-1">
                      <div className="space-y-2">
                        <Label htmlFor="project-name">Project Name</Label>
                        <Input
                          id="project-name"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="Enter project name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="project-description">Description (optional)</Label>
                        <Textarea
                          id="project-description"
                          value={newProjectDescription}
                          onChange={(e) => setNewProjectDescription(e.target.value)}
                          placeholder="Describe your project"
                          rows={3}
                        />
                      </div>
                      {isAdmin && (
                        <div className="flex items-center space-x-2 rounded-lg border p-3">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <Label htmlFor="admin-only" className="text-sm font-medium">
                              Admin Only
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Only administrators can see this project
                            </p>
                          </div>
                          <Switch
                            id="admin-only"
                            checked={newProjectAdminOnly}
                            onCheckedChange={setNewProjectAdminOnly}
                          />
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Create Project</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="space-y-2">
          {!isCollapsed && profile && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile.full_name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile.email}
                </p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSyncClick}
              className="flex-1 justify-start text-muted-foreground hover:text-foreground"
              title="Reset realtime connection"
            >
              <RefreshCw className="h-4 w-4" />
              {!isCollapsed && <span>Sync</span>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="flex-1 justify-start text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span>Sign Out</span>}
            </Button>
          </div>
        </div>
      </SidebarFooter>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditProject} className="space-y-4 px-1">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Project Name</Label>
              <Input
                id="edit-project-name"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                placeholder="Enter project name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-description">Description (optional)</Label>
              <Textarea
                id="edit-project-description"
                value={editProjectDescription}
                onChange={(e) => setEditProjectDescription(e.target.value)}
                placeholder="Describe your project"
                rows={3}
              />
            </div>
            {isAdmin && editingProject?.id !== '00000000-0000-0000-0000-000000000001' && (
              <div className="flex items-center space-x-2 rounded-lg border p-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <Label htmlFor="edit-admin-only" className="text-sm font-medium">
                    Admin Only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only administrators can see this project
                  </p>
                </div>
                <Switch
                  id="edit-admin-only"
                  checked={editProjectAdminOnly}
                  onCheckedChange={setEditProjectAdminOnly}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Update Project</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}