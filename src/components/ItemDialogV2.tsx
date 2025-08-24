import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Heading2, Minus, Clock, Users, Calendar, Hash, Type, FileText, User } from 'lucide-react';

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
  field_type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'user_select' | 'user_multiselect';
  options?: string[];
  position?: number;
  default_value?: any;
}

interface ItemDialogV2Props {
  item?: Item;
  columnId: string;
  projectId: string;
  profiles: Profile[];
  onSave: () => void;
  onCancel: () => void;
}

// Rich text editor toolbar component
function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 p-2 border-b">
      <Button
        type="button"
        variant={editor.isActive('bold') ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive('italic') ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button
        type="button"
        variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button
        type="button"
        variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ItemDialogV2({ item, columnId, projectId, profiles, onSave, onCancel }: ItemDialogV2Props) {
  const [name, setName] = useState(item?.name || '');
  const [estimatedTime, setEstimatedTime] = useState<string>(item?.estimated_time?.toString() || '');
  const [actualTime, setActualTime] = useState<string>(item?.actual_time?.toString() || '0');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    item?.assignments.map(a => a.user_id) || []
  );
  const [loading, setLoading] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Initialize rich text editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Enter item description...',
      }),
    ],
    content: item?.description || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  useEffect(() => {
    fetchCustomFields();
    if (item) {
      fetchCustomFieldValues();
    } else {
      fetchDefaultValues();
    }
  }, [projectId, item]);

  const fetchCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const fields = data.map(field => ({
        ...field,
        options: field.options ? field.options as string[] : undefined,
        default_value: field.default_value
      }));
      
      setCustomFields(fields);
      
      if (!item) {
        const defaults: Record<string, any> = {};
        fields.forEach(field => {
          if (field.default_value !== null && field.default_value !== undefined) {
            defaults[field.id] = field.default_value;
          }
        });
        setCustomFieldValues(prev => ({ ...defaults, ...prev }));
      }
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

  const fetchDefaultValues = async () => {
    try {
      const { data: defaultsData, error: defaultsError } = await supabase
        .from('project_defaults')
        .select('*')
        .eq('project_id', projectId);

      if (defaultsError) throw defaultsError;

      defaultsData?.forEach(defaultItem => {
        switch (defaultItem.field_name) {
          case 'description':
            if (editor && defaultItem.default_value) {
              editor.commands.setContent(defaultItem.default_value);
            }
            break;
          case 'estimated_time':
            setEstimatedTime(defaultItem.default_value?.toString() || '');
            break;
          case 'assigned_to':
            if (Array.isArray(defaultItem.default_value)) {
              setSelectedUserIds(defaultItem.default_value);
            }
            break;
        }
      });
    } catch (error: any) {
      console.error('Error fetching default values:', error);
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
      const description = editor?.getHTML() || '';

      if (item) {
        // Update existing item
        const { error: updateError } = await supabase
          .from('items')
          .update({
            name: name.trim(),
            description,
            estimated_time: estimatedTime ? parseFloat(estimatedTime) : null,
            actual_time: actualTime ? parseFloat(actualTime) : 0,
          })
          .eq('id', item.id);

        if (updateError) throw updateError;

        // Update assignments
        await supabase
          .from('item_assignments')
          .delete()
          .eq('item_id', item.id);

        if (selectedUserIds.length > 0) {
          const assignments = selectedUserIds.map(userId => ({
            item_id: item.id,
            user_id: userId,
          }));
          await supabase.from('item_assignments').insert(assignments);
        }

        // Update custom field values
        for (const [fieldId, value] of Object.entries(customFieldValues)) {
          if (value === null || value === undefined || value === '' || 
              (Array.isArray(value) && value.length === 0)) {
            await supabase
              .from('item_field_values')
              .delete()
              .eq('item_id', item.id)
              .eq('field_id', fieldId);
          } else {
            const { data: existing } = await supabase
              .from('item_field_values')
              .select('id')
              .eq('item_id', item.id)
              .eq('field_id', fieldId)
              .single();

            if (existing) {
              await supabase
                .from('item_field_values')
                .update({ value })
                .eq('id', existing.id);
            } else {
              await supabase
                .from('item_field_values')
                .insert({
                  item_id: item.id,
                  field_id: fieldId,
                  value
                });
            }
          }
        }

        toast({
          title: "Item updated",
          description: "Item has been updated successfully.",
        });
      } else {
        // Create new item
        const { data: itemsInColumn } = await supabase
          .from('items')
          .select('position')
          .eq('column_id', columnId)
          .order('position', { ascending: false })
          .limit(1);

        const nextPosition = itemsInColumn && itemsInColumn.length > 0 
          ? itemsInColumn[0].position + 1 
          : 0;

        const { data: newItem, error: createError } = await supabase
          .from('items')
          .insert({
            name: name.trim(),
            description,
            estimated_time: estimatedTime ? parseFloat(estimatedTime) : null,
            actual_time: actualTime ? parseFloat(actualTime) : 0,
            column_id: columnId,
            position: nextPosition,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Create assignments
        if (selectedUserIds.length > 0) {
          const assignments = selectedUserIds.map(userId => ({
            item_id: newItem.id,
            user_id: userId,
          }));
          await supabase.from('item_assignments').insert(assignments);
        }

        // Create custom field values
        const fieldValueInserts = [];
        for (const [fieldId, value] of Object.entries(customFieldValues)) {
          if (value !== null && value !== undefined && value !== '' && 
              (!Array.isArray(value) || value.length > 0)) {
            fieldValueInserts.push({
              item_id: newItem.id,
              field_id: fieldId,
              value
            });
          }
        }
        
        if (fieldValueInserts.length > 0) {
          await supabase.from('item_field_values').insert(fieldValueInserts);
        }

        toast({
          title: "Item created",
          description: "New item has been created successfully.",
        });
      }

      onSave();
    } catch (error: any) {
      toast({
        title: "Error saving item",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderFieldValue = (field: CustomField) => {
    const value = customFieldValues[field.id];
    
    switch (field.field_type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: e.target.value
            })}
            placeholder="Enter text"
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: e.target.value ? parseFloat(e.target.value) : null
            })}
            placeholder="0"
          />
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: e.target.value
            })}
          />
        );
      
      case 'select':
        return (
          <Select
            value={value || 'no-value'}
            onValueChange={(newValue) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: newValue === 'no-value' ? null : newValue
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-value">None</SelectItem>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option || 'empty'}>
                  {option || '(empty)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'multiselect':
        return (
          <div className="space-y-2 border rounded-md p-2 max-h-32 overflow-y-auto">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center space-x-2">
                <Checkbox
                  checked={Array.isArray(value) && value.includes(option)}
                  onCheckedChange={(checked) => {
                    const currentValue = Array.isArray(value) ? value : [];
                    const newValue = checked
                      ? [...currentValue, option]
                      : currentValue.filter(v => v !== option);
                    setCustomFieldValues({
                      ...customFieldValues,
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
            value={value || 'no-value'}
            onValueChange={(newValue) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: newValue === 'no-value' ? null : newValue
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-value">None</SelectItem>
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
          <div className="space-y-2 border rounded-md p-2 max-h-32 overflow-y-auto">
            {profiles.map((profile) => (
              <label key={profile.id} className="flex items-center space-x-2">
                <Checkbox
                  checked={Array.isArray(value) && value.includes(profile.id)}
                  onCheckedChange={(checked) => {
                    const currentValue = Array.isArray(value) ? value : [];
                    const newValue = checked
                      ? [...currentValue, profile.id]
                      : currentValue.filter(v => v !== profile.id);
                    setCustomFieldValues({
                      ...customFieldValues,
                      [field.id]: newValue
                    });
                  }}
                />
                <span className="text-sm">
                  {profile.full_name || profile.email || 'Unknown'}
                </span>
              </label>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text': return <Type className="h-4 w-4 text-muted-foreground" />;
      case 'number': return <Hash className="h-4 w-4 text-muted-foreground" />;
      case 'date': return <Calendar className="h-4 w-4 text-muted-foreground" />;
      case 'select':
      case 'multiselect': return <List className="h-4 w-4 text-muted-foreground" />;
      case 'user_select':
      case 'user_multiselect': return <User className="h-4 w-4 text-muted-foreground" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <form onSubmit={handleSave} className="h-full flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Name & Description */}
        <div className="flex-1 flex flex-col p-6 border-r overflow-hidden">
          <div className="flex flex-col h-full space-y-4">
            <div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item name"
                className="text-2xl font-semibold border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                required
              />
            </div>
            
            <div className="flex-1 overflow-hidden">
              <div className="border rounded-lg h-full flex flex-col">
                <EditorToolbar editor={editor} />
                <div className="flex-1 overflow-y-auto">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-[400px] bg-muted/30 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* Built-in Fields */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Properties
                </h3>
                <div className="space-y-4">
                  {/* Estimated Time */}
                  <div className="grid grid-cols-[120px,1fr] gap-4 items-center">
                    <Label className="text-right flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">Estimated</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={estimatedTime}
                        onChange={(e) => setEstimatedTime(e.target.value)}
                        placeholder="0"
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">hours</span>
                    </div>
                  </div>

                  {/* Actual Time */}
                  <div className="grid grid-cols-[120px,1fr] gap-4 items-center">
                    <Label className="text-right flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">Actual</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={actualTime}
                        onChange={(e) => setActualTime(e.target.value)}
                        placeholder="0"
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">hours</span>
                    </div>
                  </div>

                  {/* Assigned Users */}
                  <div className="grid grid-cols-[120px,1fr] gap-4 items-start">
                    <Label className="text-right pt-2 flex items-center justify-end gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">Assigned to</span>
                    </Label>
                    <div className="space-y-2 border rounded-md p-2 max-h-32 overflow-y-auto">
                      {profiles.map((profile) => (
                        <label key={profile.id} className="flex items-center space-x-2">
                          <Checkbox
                            checked={selectedUserIds.includes(profile.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUserIds([...selectedUserIds, profile.id]);
                              } else {
                                setSelectedUserIds(selectedUserIds.filter(id => id !== profile.id));
                              }
                            }}
                          />
                          <span className="text-sm">
                            {profile.full_name || profile.email || 'Unknown'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-4">Custom Fields</h3>
                    <div className="space-y-4">
                      {customFields.map((field) => (
                        <div key={field.id} className="grid grid-cols-[120px,1fr] gap-4 items-start">
                          <Label className="text-right pt-2 flex items-center justify-end gap-1">
                            {getFieldIcon(field.field_type)}
                            <span className="text-sm">{field.name}</span>
                          </Label>
                          <div>{renderFieldValue(field)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t p-4 flex justify-end gap-2">
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