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
import { Trello, Plus, FolderKanban, LogOut, User } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface AppSidebarProps {
  selectedProjectId: string;
  onProjectSelect: (projectId: string) => void;
}

export function AppSidebar({ selectedProjectId, onProjectSelect }: AppSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const { state } = useSidebar();
  const navigate = useNavigate();

  const isCollapsed = state === 'collapsed';

  useEffect(() => {
    fetchProjects();
    fetchProfile();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: true });

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
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setProjects([...projects, data]);
      setNewProjectName('');
      setNewProjectDescription('');
      setCreateDialogOpen(false);
      
      toast({
        title: "Project created",
        description: `${data.name} has been created successfully.`,
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
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton
                    onClick={() => onProjectSelect(project.id)}
                    isActive={selectedProjectId === project.id}
                    className="justify-start"
                  >
                    <FolderKanban className="h-4 w-4" />
                    {!isCollapsed && <span>{project.name}</span>}
                  </SidebarMenuButton>
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
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Project</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateProject} className="space-y-4">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}