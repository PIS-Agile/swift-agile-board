import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { Check, X, Users, Calendar } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  description: string | null;
  estimated_time: number | null;
  actual_time: number;
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

interface CustomField {
  id: string;
  name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'multiselect';
  options?: string[];
}

interface CustomFieldValue {
  field_id: string;
  value: any;
}

interface ItemDialogProps {
  item?: Item;
  columnId: string;
  projectId: string;
  profiles: Profile[];
  onSave: () => void;
  onCancel: () => void;
}

export function ItemDialog({ item, columnId, projectId, profiles, onSave, onCancel }: ItemDialogProps) {
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [estimatedTime, setEstimatedTime] = useState<string>(item?.estimated_time?.toString() || '');
  const [actualTime, setActualTime] = useState<string>(item?.actual_time?.toString() || '0');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    item?.assignments.map(a => a.user_id) || []
  );
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchCustomFields();
    if (item) {
      fetchCustomFieldValues();
    }
  }, [projectId, item]);

  const fetchCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setCustomFields(data.map(field => ({
        ...field,
        options: field.options ? field.options as string[] : undefined
      })));
    } catch (error: any) {
      console.error('Error fetching custom fields:', error);
    }
  };

  const fetchCustomFieldValues = async () => {
    if (!item) return;
    
    try {
      const { data, error } = await supabase
        .from('item_field_values')
        .select('*')
        .eq('item_id', item.id);

      if (error) throw error;
      
      const values: Record<string, any> = {};
      data.forEach(fieldValue => {
        values[fieldValue.field_id] = fieldValue.value;
      });
      setCustomFieldValues(values);
    } catch (error: any) {
      console.error('Error fetching custom field values:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the item.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const itemData: any = {
        name: name.trim(),
        description: description.trim() || null,
        estimated_time: estimatedTime ? parseInt(estimatedTime) : null,
        actual_time: actualTime ? parseInt(actualTime) : 0,
        column_id: columnId,
        project_id: projectId,
        created_by: item ? undefined : user.id,
      };

      let itemId: string;

      if (item) {
        // Update existing item
        const { error } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', item.id);

        if (error) throw error;
        itemId = item.id;
      } else {
        // Create new item
        const { data, error } = await supabase
          .from('items')
          .insert([itemData])
          .select()
          .single();

        if (error) throw error;
        itemId = data.id;
      }

      // Update assignments
      // First, remove all existing assignments
      await supabase
        .from('item_assignments')
        .delete()
        .eq('item_id', itemId);

      // Then, add new assignments
      if (selectedUserIds.length > 0) {
        const assignments = selectedUserIds.map(userId => ({
          item_id: itemId,
          user_id: userId,
        }));

        const { error: assignmentError } = await supabase
          .from('item_assignments')
          .insert(assignments);

        if (assignmentError) throw assignmentError;
      }

      // Update custom field values
      // First, remove all existing custom field values
      await supabase
        .from('item_field_values')
        .delete()
        .eq('item_id', itemId);

      // Then, add new custom field values
      const customFieldEntries = Object.entries(customFieldValues).filter(([_, value]) => value !== null && value !== '' && value !== undefined);
      if (customFieldEntries.length > 0) {
        const fieldValues = customFieldEntries.map(([fieldId, value]) => ({
          item_id: itemId,
          field_id: fieldId,
          value: value,
        }));

        const { error: customFieldError } = await supabase
          .from('item_field_values')
          .insert(fieldValues);

        if (customFieldError) throw customFieldError;
      }

      toast({
        title: item ? "Item updated" : "Item created",
        description: `${name} has been ${item ? 'updated' : 'created'} successfully.`,
      });

      onSave();
    } catch (error: any) {
      toast({
        title: `Error ${item ? 'updating' : 'creating'} item`,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const removeUserSelection = (userId: string) => {
    setSelectedUserIds(prev => prev.filter(id => id !== userId));
  };

  const getSelectedUsers = () => {
    return profiles.filter(profile => selectedUserIds.includes(profile.id));
  };

  const getDisplayName = (profile: Profile) => {
    return profile.full_name || profile.email || 'Unknown User';
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="item-name">Name *</Label>
        <Input
          id="item-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter item name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-description">Description</Label>
        <Textarea
          id="item-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the item (optional)"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estimated-time">Estimated Time (hours)</Label>
          <Input
            id="estimated-time"
            type="number"
            min="0"
            step="0.5"
            value={estimatedTime}
            onChange={(e) => setEstimatedTime(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="actual-time">Actual Time (hours)</Label>
          <Input
            id="actual-time"
            type="number"
            min="0"
            step="0.5"
            value={actualTime}
            onChange={(e) => setActualTime(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Assigned To</Label>
        <div className="space-y-2">
          {getSelectedUsers().length > 0 && (
            <div className="flex flex-wrap gap-2">
              {getSelectedUsers().map((user) => (
                <Badge key={user.id} variant="secondary" className="pr-1">
                  {getDisplayName(user)}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-2 hover:bg-transparent"
                    onClick={() => removeUserSelection(user.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          
          <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
              >
                <Users className="h-4 w-4 mr-2" />
                {selectedUserIds.length === 0 
                  ? "Select assignees" 
                  : `${selectedUserIds.length} user${selectedUserIds.length !== 1 ? 's' : ''} selected`
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search users..." />
                <CommandList>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {profiles.map((profile) => (
                      <CommandItem
                        key={profile.id}
                        onSelect={() => toggleUserSelection(profile.id)}
                        className="flex items-center gap-2"
                      >
                        <div className="flex h-4 w-4 items-center justify-center">
                          {selectedUserIds.includes(profile.id) && (
                            <Check className="h-4 w-4" />
                          )}
                        </div>
                        <span>{getDisplayName(profile)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-medium">Custom Fields</h4>
          {customFields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={`custom-${field.id}`}>{field.name}</Label>
              
              {field.field_type === 'text' && (
                <Input
                  id={`custom-${field.id}`}
                  type="text"
                  value={customFieldValues[field.id] || ''}
                  onChange={(e) => setCustomFieldValues(prev => ({
                    ...prev,
                    [field.id]: e.target.value
                  }))}
                  placeholder={`Enter ${field.name.toLowerCase()}`}
                />
              )}
              
              {field.field_type === 'number' && (
                <Input
                  id={`custom-${field.id}`}
                  type="number"
                  value={customFieldValues[field.id] || ''}
                  onChange={(e) => setCustomFieldValues(prev => ({
                    ...prev,
                    [field.id]: e.target.value ? parseFloat(e.target.value) : null
                  }))}
                  placeholder="0"
                />
              )}
              
              {field.field_type === 'date' && (
                <Input
                  id={`custom-${field.id}`}
                  type="date"
                  value={customFieldValues[field.id] || ''}
                  onChange={(e) => setCustomFieldValues(prev => ({
                    ...prev,
                    [field.id]: e.target.value
                  }))}
                />
              )}
              
              {field.field_type === 'select' && field.options && (
                <Select
                  value={customFieldValues[field.id] || ''}
                  onValueChange={(value) => setCustomFieldValues(prev => ({
                    ...prev,
                    [field.id]: value
                  }))}
                >
                  <SelectTrigger id={`custom-${field.id}`}>
                    <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {field.field_type === 'multiselect' && field.options && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(customFieldValues[field.id] || []).map((value: string) => (
                      <Badge key={value} variant="secondary" className="pr-1">
                        {value}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-2 hover:bg-transparent"
                          onClick={() => {
                            const currentValues = customFieldValues[field.id] || [];
                            setCustomFieldValues(prev => ({
                              ...prev,
                              [field.id]: currentValues.filter((v: string) => v !== value)
                            }));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      const currentValues = customFieldValues[field.id] || [];
                      if (!currentValues.includes(value)) {
                        setCustomFieldValues(prev => ({
                          ...prev,
                          [field.id]: [...currentValues, value]
                        }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Add ${field.name.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options
                        .filter(option => !(customFieldValues[field.id] || []).includes(option))
                        .map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : (item ? 'Update Item' : 'Create Item')}
        </Button>
      </div>
    </form>
  );
}