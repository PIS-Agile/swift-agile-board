import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options?: string[];
  default_value?: any;
}

interface ProjectDefault {
  id?: string;
  field_name: string;
  default_value: any;
}

interface DefaultValuesDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DefaultValuesDialog({ projectId, open, onOpenChange }: DefaultValuesDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [projectDefaults, setProjectDefaults] = useState<Record<string, any>>({
    description: '',
    estimated_time: null,
    assigned_to: []
  });
  const [customFieldDefaults, setCustomFieldDefaults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, projectId]);

  const fetchData = async () => {
    try {
      // Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      setProfiles(profilesData || []);

      // Fetch custom fields
      const { data: fieldsData } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
      
      setCustomFields(fieldsData || []);

      // Build custom field defaults object
      const cfDefaults: Record<string, any> = {};
      fieldsData?.forEach(field => {
        cfDefaults[field.id] = field.default_value || getEmptyValue(field.field_type);
      });
      setCustomFieldDefaults(cfDefaults);

      // Fetch project defaults
      const { data: defaultsData } = await supabase
        .from('project_defaults')
        .select('*')
        .eq('project_id', projectId);

      // Build project defaults object
      const defaults: Record<string, any> = {
        description: '',
        estimated_time: null,
        assigned_to: []
      };
      
      defaultsData?.forEach(item => {
        defaults[item.field_name] = item.default_value;
      });
      
      setProjectDefaults(defaults);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading defaults",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getEmptyValue = (fieldType: string) => {
    switch (fieldType) {
      case 'multiselect':
      case 'user_multiselect':
        return [];
      case 'number':
        return null;
      case 'date':
        return '';
      default:
        return '';
    }
  };

  const handleSaveBuiltInDefaults = async () => {
    setLoading(true);
    try {
      // Save each built-in field default
      for (const [fieldName, defaultValue] of Object.entries(projectDefaults)) {
        // Check if default exists
        const { data: existing } = await supabase
          .from('project_defaults')
          .select('id')
          .eq('project_id', projectId)
          .eq('field_name', fieldName)
          .single();

        if (existing) {
          // Update existing
          await supabase
            .from('project_defaults')
            .update({ 
              default_value: defaultValue,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          // Insert new
          await supabase
            .from('project_defaults')
            .insert({
              project_id: projectId,
              field_name: fieldName,
              default_value: defaultValue
            });
        }
      }

      toast({
        title: "Default values saved",
        description: "Built-in field defaults have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving defaults",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomFieldDefaults = async () => {
    setLoading(true);
    try {
      // Update each custom field's default value
      for (const [fieldId, defaultValue] of Object.entries(customFieldDefaults)) {
        await supabase
          .from('custom_fields')
          .update({ default_value: defaultValue })
          .eq('id', fieldId);
      }

      toast({
        title: "Custom field defaults saved",
        description: "Custom field default values have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving custom field defaults",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCustomFieldInput = (field: CustomField) => {
    const value = customFieldDefaults[field.id] || getEmptyValue(field.field_type);
    
    switch (field.field_type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => setCustomFieldDefaults({
              ...customFieldDefaults,
              [field.id]: e.target.value
            })}
            placeholder="Enter default text"
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => setCustomFieldDefaults({
              ...customFieldDefaults,
              [field.id]: e.target.value ? parseFloat(e.target.value) : null
            })}
            placeholder="Enter default number"
          />
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setCustomFieldDefaults({
              ...customFieldDefaults,
              [field.id]: e.target.value
            })}
          />
        );
      
      case 'select':
        return (
          <Select
            value={value || 'no-default'}
            onValueChange={(newValue) => setCustomFieldDefaults({
              ...customFieldDefaults,
              [field.id]: newValue === 'no-default' ? '' : newValue
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select default option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-default">No default</SelectItem>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option || 'empty-option'}>
                  {option || '(empty)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'multiselect':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const currentValue = Array.isArray(value) ? value : [];
                    const newValue = e.target.checked
                      ? [...currentValue, option]
                      : currentValue.filter(v => v !== option);
                    setCustomFieldDefaults({
                      ...customFieldDefaults,
                      [field.id]: newValue
                    });
                  }}
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        );
      
      case 'user_select':
        return (
          <Select
            value={value || 'no-default'}
            onValueChange={(newValue) => setCustomFieldDefaults({
              ...customFieldDefaults,
              [field.id]: newValue === 'no-default' ? '' : newValue
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select default user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-default">No default</SelectItem>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name || profile.email || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'user_multiselect':
        return (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {profiles.map((profile) => (
              <label key={profile.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(profile.id)}
                  onChange={(e) => {
                    const currentValue = Array.isArray(value) ? value : [];
                    const newValue = e.target.checked
                      ? [...currentValue, profile.id]
                      : currentValue.filter(v => v !== profile.id);
                    setCustomFieldDefaults({
                      ...customFieldDefaults,
                      [field.id]: newValue
                    });
                  }}
                />
                <span className="text-sm">{profile.full_name || profile.email || 'Unknown'}</span>
              </label>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Default Values</DialogTitle>
          <DialogDescription>
            Set default values for fields that will be automatically filled when creating new items.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="builtin" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="builtin">Built-in Fields</TabsTrigger>
            <TabsTrigger value="custom">Custom Fields</TabsTrigger>
          </TabsList>
          
          <TabsContent value="builtin" className="flex-1 overflow-y-auto px-1 space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="default-description">Description</Label>
                <Textarea
                  id="default-description"
                  value={projectDefaults.description || ''}
                  onChange={(e) => setProjectDefaults({
                    ...projectDefaults,
                    description: e.target.value
                  })}
                  placeholder="Enter default description"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="default-estimated-time">Estimated Time (hours)</Label>
                <Input
                  id="default-estimated-time"
                  type="number"
                  min="0"
                  step="0.5"
                  value={projectDefaults.estimated_time || ''}
                  onChange={(e) => setProjectDefaults({
                    ...projectDefaults,
                    estimated_time: e.target.value ? parseFloat(e.target.value) : null
                  })}
                  placeholder="Enter default estimated time"
                />
              </div>
              
              <div>
                <Label>Default Assigned Users</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {profiles.map((profile) => (
                    <label key={profile.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={Array.isArray(projectDefaults.assigned_to) && 
                                projectDefaults.assigned_to.includes(profile.id)}
                        onChange={(e) => {
                          const currentValue = Array.isArray(projectDefaults.assigned_to) 
                            ? projectDefaults.assigned_to 
                            : [];
                          const newValue = e.target.checked
                            ? [...currentValue, profile.id]
                            : currentValue.filter(id => id !== profile.id);
                          setProjectDefaults({
                            ...projectDefaults,
                            assigned_to: newValue
                          });
                        }}
                      />
                      <span className="text-sm">
                        {profile.full_name || profile.email || 'Unknown'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              <Button 
                onClick={handleSaveBuiltInDefaults} 
                disabled={loading}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Built-in Field Defaults
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="custom" className="flex-1 overflow-y-auto px-1 space-y-4">
            {customFields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No custom fields have been created yet.
              </div>
            ) : (
              <div className="space-y-4">
                {customFields.map((field) => (
                  <div key={field.id}>
                    <Label>{field.name}</Label>
                    {renderCustomFieldInput(field)}
                  </div>
                ))}
                
                <Button 
                  onClick={handleSaveCustomFieldDefaults} 
                  disabled={loading}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Custom Field Defaults
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}