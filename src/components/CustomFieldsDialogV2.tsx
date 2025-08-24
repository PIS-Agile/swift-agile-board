import { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, GripVertical, Edit2, Save, X, Trash2, AlertCircle } from 'lucide-react';

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options?: string[];
  position: number;
  project_id: string;
  isEditing?: boolean;
  tempName?: string;
  tempType?: string;
  tempOptions?: string;
}

interface CustomFieldsDialogV2Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Draggable field component
function DraggableField({ 
  field, 
  index, 
  moveField, 
  onEdit, 
  onSave, 
  onCancel, 
  onDelete,
  onTypeChange,
  onNameChange,
  onOptionsChange
}: {
  field: CustomField;
  index: number;
  moveField: (dragIndex: number, hoverIndex: number) => void;
  onEdit: (id: string) => void;
  onSave: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, newType: string) => void;
  onNameChange: (id: string, newName: string) => void;
  onOptionsChange: (id: string, newOptions: string) => void;
}) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: 'field',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'field',
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        moveField(item.index, index);
        item.index = index;
      }
    },
  });

  const getFieldTypeLabel = (type: string) => {
    switch (type) {
      case 'text': return 'Text';
      case 'number': return 'Number';
      case 'date': return 'Date';
      case 'select': return 'Single Select';
      case 'multiselect': return 'Multi Select';
      case 'user_select': return 'User (Single)';
      case 'user_multiselect': return 'User (Multiple)';
      default: return type;
    }
  };

  return (
    <div ref={(node) => preview(drop(node))} className={`${isDragging ? 'opacity-50' : ''}`}>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div ref={drag} className="cursor-move mt-1">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <div className="flex-1 space-y-3">
            {field.isEditing ? (
              <>
                <div className="flex gap-2">
                  <Input
                    value={field.tempName}
                    onChange={(e) => onNameChange(field.id, e.target.value)}
                    placeholder="Field name"
                    className="flex-1"
                  />
                  <Select
                    value={field.tempType}
                    onValueChange={(value) => onTypeChange(field.id, value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="select">Single Select</SelectItem>
                      <SelectItem value="multiselect">Multi Select</SelectItem>
                      <SelectItem value="user_select">User (Single)</SelectItem>
                      <SelectItem value="user_multiselect">User (Multiple)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {(field.tempType === 'select' || field.tempType === 'multiselect') && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Options (one per line)</Label>
                    <textarea
                      value={field.tempOptions}
                      onChange={(e) => onOptionsChange(field.id, e.target.value)}
                      className="w-full min-h-[80px] p-2 text-sm border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                    />
                  </div>
                )}
                
                {field.field_type !== field.tempType && (
                  <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950 rounded-md">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      {getDataMigrationWarning(field.field_type, field.tempType!)}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium">{field.name}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{getFieldTypeLabel(field.field_type)}</Badge>
                    {field.options && field.options.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {field.options.length} option{field.options.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-1">
            {field.isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSave(field.id)}
                  className="h-8 w-8 p-0"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onCancel(field.id)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(field.id)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(field.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function getDataMigrationWarning(fromType: string, toType: string): string {
  // Safe migrations (no data loss)
  if (fromType === 'select' && toType === 'multiselect') {
    return "Data will be preserved. Single selections will become multi-selections.";
  }
  if (fromType === 'user_select' && toType === 'user_multiselect') {
    return "Data will be preserved. Single user selections will become multi-user selections.";
  }
  
  // Potentially lossy migrations
  if (fromType === 'multiselect' && toType === 'select') {
    return "Warning: Only the first selected option will be kept.";
  }
  if (fromType === 'user_multiselect' && toType === 'user_select') {
    return "Warning: Only the first selected user will be kept.";
  }
  
  // Type changes that will lose data
  return "Warning: Changing field type will clear all existing data for this field.";
}

export function CustomFieldsDialogV2({ projectId, open, onOpenChange }: CustomFieldsDialogV2Props) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<string>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [showNewFieldForm, setShowNewFieldForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchCustomFields();
    }
  }, [open, projectId]);

  const fetchCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setFields(data.map(field => ({
        ...field,
        options: field.options as string[] || [],
        isEditing: false,
        tempName: field.name,
        tempType: field.field_type,
        tempOptions: (field.options as string[] || []).join('\n')
      })));
    } catch (error: any) {
      toast({
        title: "Error loading custom fields",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const moveField = async (dragIndex: number, hoverIndex: number) => {
    const dragField = fields[dragIndex];
    const newFields = [...fields];
    newFields.splice(dragIndex, 1);
    newFields.splice(hoverIndex, 0, dragField);
    
    // Update positions
    const updatedFields = newFields.map((field, index) => ({
      ...field,
      position: index
    }));
    
    setFields(updatedFields);
    
    // Update positions in database
    try {
      for (let i = 0; i < updatedFields.length; i++) {
        await supabase
          .from('custom_fields')
          .update({ position: i })
          .eq('id', updatedFields[i].id);
      }
    } catch (error: any) {
      toast({
        title: "Error reordering fields",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (id: string) => {
    setFields(fields.map(field => ({
      ...field,
      isEditing: field.id === id,
      tempName: field.id === id ? field.name : field.tempName,
      tempType: field.id === id ? field.field_type : field.tempType,
      tempOptions: field.id === id ? (field.options || []).join('\n') : field.tempOptions
    })));
  };

  const handleCancel = (id: string) => {
    setFields(fields.map(field => {
      if (field.id === id) {
        return {
          ...field,
          isEditing: false,
          tempName: field.name,
          tempType: field.field_type,
          tempOptions: (field.options || []).join('\n')
        };
      }
      return field;
    }));
  };

  const handleSave = async (id: string) => {
    const field = fields.find(f => f.id === id);
    if (!field || !field.tempName) return;

    try {
      setLoading(true);
      const options = (field.tempType === 'select' || field.tempType === 'multiselect')
        ? field.tempOptions?.split('\n').filter(o => o.trim())
        : null;

      // Handle data migration if type changed
      if (field.field_type !== field.tempType) {
        await handleDataMigration(field.id, field.field_type, field.tempType!);
      }

      // Update field
      const { error } = await supabase
        .from('custom_fields')
        .update({
          name: field.tempName,
          field_type: field.tempType,
          options
        })
        .eq('id', id);

      if (error) throw error;

      setFields(fields.map(f => {
        if (f.id === id) {
          return {
            ...f,
            name: field.tempName!,
            field_type: field.tempType!,
            options: options || [],
            isEditing: false
          };
        }
        return f;
      }));

      toast({
        title: "Field updated",
        description: "Custom field has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error updating field",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDataMigration = async (fieldId: string, fromType: string, toType: string) => {
    // Handle safe migrations
    if ((fromType === 'select' && toType === 'multiselect') ||
        (fromType === 'user_select' && toType === 'user_multiselect')) {
      // Convert single values to arrays
      const { data: values } = await supabase
        .from('item_field_values')
        .select('*')
        .eq('field_id', fieldId);

      if (values) {
        for (const value of values) {
          if (value.value && !Array.isArray(value.value)) {
            await supabase
              .from('item_field_values')
              .update({ value: [value.value] })
              .eq('id', value.id);
          }
        }
      }
    } else if ((fromType === 'multiselect' && toType === 'select') ||
               (fromType === 'user_multiselect' && toType === 'user_select')) {
      // Convert arrays to single values (keep first)
      const { data: values } = await supabase
        .from('item_field_values')
        .select('*')
        .eq('field_id', fieldId);

      if (values) {
        for (const value of values) {
          if (Array.isArray(value.value) && value.value.length > 0) {
            await supabase
              .from('item_field_values')
              .update({ value: value.value[0] })
              .eq('id', value.id);
          }
        }
      }
    } else {
      // Clear data for incompatible type changes
      await supabase
        .from('item_field_values')
        .delete()
        .eq('field_id', fieldId);
    }
  };

  const handleDelete = async () => {
    if (!deleteFieldId) return;

    try {
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', deleteFieldId);

      if (error) throw error;

      setFields(fields.filter(f => f.id !== deleteFieldId));
      setDeleteFieldId(null);

      toast({
        title: "Field deleted",
        description: "Custom field and all its values have been deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting field",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateField = async () => {
    if (!newFieldName.trim()) return;

    try {
      setLoading(true);
      const options = (newFieldType === 'select' || newFieldType === 'multiselect')
        ? newFieldOptions.split('\n').filter(o => o.trim())
        : null;

      const position = fields.length;

      const { data, error } = await supabase
        .from('custom_fields')
        .insert({
          name: newFieldName.trim(),
          field_type: newFieldType,
          project_id: projectId,
          options,
          position
        })
        .select()
        .single();

      if (error) throw error;

      setFields([...fields, {
        ...data,
        options: options || [],
        isEditing: false,
        tempName: data.name,
        tempType: data.field_type,
        tempOptions: (options || []).join('\n')
      }]);

      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldOptions('');
      setShowNewFieldForm(false);

      toast({
        title: "Field created",
        description: "New custom field has been created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error creating field",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Custom Fields</DialogTitle>
          <DialogDescription>
            Add, edit, and reorder custom fields for items in this project. Drag fields to reorder them.
          </DialogDescription>
        </DialogHeader>

        <DndProvider backend={HTML5Backend}>
          <div className="flex-1 overflow-y-auto px-1">
            <div className="space-y-3">
              {fields.map((field, index) => (
                <DraggableField
                  key={field.id}
                  field={field}
                  index={index}
                  moveField={moveField}
                  onEdit={handleEdit}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onDelete={(id) => setDeleteFieldId(id)}
                  onTypeChange={(id, newType) => {
                    setFields(fields.map(f => 
                      f.id === id ? { ...f, tempType: newType } : f
                    ));
                  }}
                  onNameChange={(id, newName) => {
                    setFields(fields.map(f => 
                      f.id === id ? { ...f, tempName: newName } : f
                    ));
                  }}
                  onOptionsChange={(id, newOptions) => {
                    setFields(fields.map(f => 
                      f.id === id ? { ...f, tempOptions: newOptions } : f
                    ));
                  }}
                />
              ))}

              {showNewFieldForm ? (
                <Card className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      placeholder="Field name"
                      className="flex-1"
                    />
                    <Select value={newFieldType} onValueChange={setNewFieldType}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="select">Single Select</SelectItem>
                        <SelectItem value="multiselect">Multi Select</SelectItem>
                        <SelectItem value="user_select">User (Single)</SelectItem>
                        <SelectItem value="user_multiselect">User (Multiple)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {(newFieldType === 'select' || newFieldType === 'multiselect') && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Options (one per line)</Label>
                      <textarea
                        value={newFieldOptions}
                        onChange={(e) => setNewFieldOptions(e.target.value)}
                        className="w-full min-h-[80px] p-2 text-sm border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                      />
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNewFieldForm(false);
                        setNewFieldName('');
                        setNewFieldType('text');
                        setNewFieldOptions('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateField}
                      disabled={!newFieldName.trim() || loading}
                    >
                      Create Field
                    </Button>
                  </div>
                </Card>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowNewFieldForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Field
                </Button>
              )}
            </div>
          </div>
        </DndProvider>

        <AlertDialog open={!!deleteFieldId} onOpenChange={() => setDeleteFieldId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Custom Field</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this custom field? All data associated with this field will be permanently deleted. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Field
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}