import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { toast } from '@/hooks/use-toast';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { 
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, 
  Heading1, Heading2, Heading3, Minus, Clock, Users, Calendar, 
  Hash, Type, FileText, User, Undo, Redo, Link2, Share2, Check, MessageSquare 
} from 'lucide-react';
import { ItemComments } from '@/components/ItemComments';

interface Item {
  id: string;
  item_id: number;
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

interface Column {
  id: string;
  name: string;
  position: number;
  project_id: string;
}

interface ItemDialogV3Props {
  item?: Item;
  columnId: string;
  projectId: string;
  profiles: Profile[];
  columns?: Column[];
  onSave: () => void;
  onCancel: () => void;
  readOnly?: boolean;
}

// Enhanced Rich text editor toolbar component
function EditorToolbar({ editor }: { editor: Editor | null }) {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    if (!editor) return;
    
    // Force re-render when selection or content changes
    const updateHandler = () => forceUpdate({});
    
    editor.on('selectionUpdate', updateHandler);
    editor.on('update', updateHandler);
    
    return () => {
      editor.off('selectionUpdate', updateHandler);
      editor.off('update', updateHandler);
    };
  }, [editor]);
  
  if (!editor) return null;
  
  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);
    
    if (url === null) {
      return;
    }
    
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center gap-1 p-2 border-b flex-wrap">
      {/* Text Style */}
      <ToggleGroup type="single" value="normal" className="gap-1">
        <ToggleGroupItem
          value="h1"
          aria-label="Heading 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          data-active={editor.isActive('heading', { level: 1 })}
          className="h-8 w-8 p-0 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
        >
          <Heading1 className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="h2"
          aria-label="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          data-active={editor.isActive('heading', { level: 2 })}
          className="h-8 w-8 p-0 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
        >
          <Heading2 className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="h3"
          aria-label="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          data-active={editor.isActive('heading', { level: 3 })}
          className="h-8 w-8 p-0 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
        >
          <Heading3 className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Text Formatting */}
      <div className="flex gap-1">
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
        <Button
          type="button"
          variant={editor.isActive('underline') ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('link') ? 'default' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={setLink}
          title="Add link"
        >
          <Link2 className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <div className="flex gap-1">
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
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Other */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Undo/Redo */}
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ItemDialogV3({ item, columnId, projectId, profiles, columns, onSave, onCancel, readOnly = false }: ItemDialogV3Props) {
  const [name, setName] = useState(item?.name || '');
  const [estimatedTime, setEstimatedTime] = useState<string>(item?.estimated_time?.toString() || '');
  const [actualTime, setActualTime] = useState<string>(item?.actual_time?.toString() || '0');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    item?.assignments.map(a => a.user_id) || []
  );
  const [selectedColumnId, setSelectedColumnId] = useState<string>(columnId);
  const [loading, setLoading] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [showCopied, setShowCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Initialize rich text editor with all extensions
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          class: 'text-green-600 hover:text-green-700 underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: 'Enter item description...',
      }),
    ],
    content: item?.description || '',
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
    },
  });

  useEffect(() => {
    fetchCustomFields();
    fetchCurrentUser();
    if (item) {
      fetchCustomFieldValues();
    } else {
      fetchDefaultValues();
    }
  }, [projectId, item]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

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
          // For user fields, always set a value (null if invalid/empty)
          if (field.field_type === 'user_select') {
            if (field.default_value !== null && field.default_value !== undefined) {
              const userExists = profiles.some(p => p.id === field.default_value);
              defaults[field.id] = userExists ? field.default_value : null;
            } else {
              defaults[field.id] = null;
            }
          } else if (field.field_type === 'user_multiselect') {
            if (field.default_value !== null && field.default_value !== undefined && Array.isArray(field.default_value)) {
              const validUsers = field.default_value.filter(userId => 
                profiles.some(p => p.id === userId)
              );
              defaults[field.id] = validUsers.length > 0 ? validUsers : [];
            } else {
              defaults[field.id] = [];
            }
          } else if (field.default_value !== null && field.default_value !== undefined) {
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
          case 'actual_time':
            setActualTime(defaultItem.default_value?.toString() || '');
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

  const handleShare = () => {
    if (item?.id) {
      const shareUrl = `${window.location.origin}/item/${item.id}`;
      navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard.",
      });
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
            column_id: selectedColumnId,
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
          const field = customFields.find(f => f.id === fieldId);
          let validatedValue = value;
          
          // Validate user fields
          if (field?.field_type === 'user_select') {
            if (value && typeof value === 'string') {
              const userExists = profiles.some(p => p.id === value);
              validatedValue = userExists ? value : null;
            } else {
              validatedValue = null;
            }
          } else if (field?.field_type === 'user_multiselect') {
            if (value && Array.isArray(value)) {
              validatedValue = value.filter(userId => profiles.some(p => p.id === userId));
            } else {
              validatedValue = [];
            }
          }
          
          if (validatedValue === null || validatedValue === undefined || validatedValue === '' || 
              (Array.isArray(validatedValue) && validatedValue.length === 0)) {
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
                .update({ value: validatedValue })
                .eq('id', existing.id);
            } else {
              await supabase
                .from('item_field_values')
                .insert({
                  item_id: item.id,
                  field_id: fieldId,
                  value: validatedValue
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

        // Get next item_id for this project using the database function
        const { data: itemIdData, error: itemIdError } = await supabase
          .rpc('get_next_item_id', { p_project_id: projectId });

        if (itemIdError) throw itemIdError;
        const nextItemId = itemIdData || 1;

        const { data: newItem, error: createError } = await supabase
          .from('items')
          .insert({
            name: name.trim(),
            description,
            estimated_time: estimatedTime ? parseFloat(estimatedTime) : null,
            actual_time: actualTime ? parseFloat(actualTime) : 0,
            column_id: selectedColumnId,
            project_id: projectId,
            position: nextPosition,
            item_id: nextItemId,
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
          const field = customFields.find(f => f.id === fieldId);
          
          // For user fields, always save (even null/empty values)
          if (field?.field_type === 'user_select') {
            let validatedValue = null;
            if (value && typeof value === 'string') {
              const userExists = profiles.some(p => p.id === value);
              validatedValue = userExists ? value : null;
            }
            fieldValueInserts.push({
              item_id: newItem.id,
              field_id: fieldId,
              value: validatedValue
            });
          } else if (field?.field_type === 'user_multiselect') {
            let validatedValue = [];
            if (value && Array.isArray(value)) {
              validatedValue = value.filter(userId => profiles.some(p => p.id === userId));
            }
            fieldValueInserts.push({
              item_id: newItem.id,
              field_id: fieldId,
              value: validatedValue
            });
          } else if (value !== null && value !== undefined && value !== '' && 
                     (!Array.isArray(value) || value.length > 0)) {
            // For non-user fields, only save if they have a value
            fieldValueInserts.push({
              item_id: newItem.id,
              field_id: fieldId,
              value: value
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
        const multiselectValue = Array.isArray(value) ? value : [];
        return (
          <MultiSelect
            options={(field.options || []).map(option => ({
              value: option,
              label: option,
            }))}
            selected={multiselectValue}
            onChange={(newValues) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: newValues
            })}
            placeholder="Select options..."
            searchPlaceholder="Search options..."
            emptyText="No options available"
          />
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
        const userMultiselectValue = Array.isArray(value) ? value : [];
        return (
          <MultiSelect
            options={profiles.map(profile => ({
              value: profile.id,
              label: profile.full_name || profile.email || 'Unknown',
            }))}
            selected={userMultiselectValue}
            onChange={(newValues) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: newValues
            })}
            placeholder="Select users..."
            searchPlaceholder="Search users..."
            emptyText="No users found"
          />
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
    <form onSubmit={handleSave} className="h-full flex flex-col overflow-hidden">
      {/* Main content area with three panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Comments */}
        <div className="w-[320px] bg-muted/30 border-r overflow-hidden flex flex-col">
          <div className="p-4 flex-1 overflow-hidden">
            {item && currentUserId && (
              <ItemComments
                itemId={item.id}
                currentUserId={currentUserId}
                profiles={profiles}
                readOnly={readOnly}
              />
            )}
            {!item && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4" />
                <p className="text-sm text-center">Comments will be available<br />after creating the item</p>
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel - Name & Description - Takes most space */}
        <div className="flex-1 min-w-[600px] flex flex-col border-r overflow-hidden">
          <div className="p-6 pb-3 flex-shrink-0">
            <div className="flex items-start gap-2">
              <Input
                value={name}
                onChange={(e) => !readOnly && setName(e.target.value)}
                placeholder="Item name"
                className="text-2xl font-semibold border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                required
                disabled={readOnly}
              />
              {item && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="flex-shrink-0"
                  title="Share item"
                >
                  {showCopied ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <Share2 className="h-5 w-5" />
                  )}
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex-1 px-6 pb-6 overflow-hidden flex flex-col">
            <div className="border rounded-lg flex-1 flex flex-col overflow-hidden">
              {!readOnly && <EditorToolbar editor={editor} />}
              <div className="flex-1 overflow-y-auto no-scrollbar">
                <EditorContent editor={editor} className="h-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-[360px] bg-muted/30 overflow-y-auto no-scrollbar">
          <div className="p-6 space-y-6">
              {/* Built-in Fields */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Properties
                </h3>
                <div className="space-y-4">
                  {/* Item ID - Read only */}
                  {item && item.item_id && (
                    <div className="grid grid-cols-[120px,1fr] gap-4 items-center">
                      <Label className="text-right flex items-center justify-end gap-1">
                        <Hash className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">Item ID</span>
                      </Label>
                      <Input 
                        value={`#${item.item_id}`}
                        disabled
                        className="bg-muted/50"
                      />
                    </div>
                  )}
                  
                  {/* Column */}
                  {columns && columns.length > 0 && (
                    <div className="grid grid-cols-[120px,1fr] gap-4 items-center">
                      <Label className="text-right flex items-center justify-end gap-1">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">Column</span>
                      </Label>
                      <Select value={selectedColumnId} onValueChange={setSelectedColumnId}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.sort((a, b) => a.position - b.position).map(col => (
                            <SelectItem key={col.id} value={col.id}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

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
                    <MultiSelect
                      options={profiles.map(profile => ({
                        value: profile.id,
                        label: profile.full_name || profile.email || 'Unknown',
                      }))}
                      selected={selectedUserIds}
                      onChange={setSelectedUserIds}
                      placeholder="Select users..."
                      searchPlaceholder="Search users..."
                      emptyText="No users found"
                    />
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
        </div>
      </div>

      {/* Footer Actions - Always visible */}
      {!readOnly && (
        <div className="border-t p-4 flex justify-end gap-2 bg-background flex-shrink-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : (item ? 'Update Item' : 'Create Item')}
          </Button>
        </div>
      )}
      {readOnly && (
        <div className="border-t p-4 flex justify-end gap-2 bg-background flex-shrink-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            Close
          </Button>
        </div>
      )}
    </form>
  );
}