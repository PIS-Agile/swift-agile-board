import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, X, Settings2 } from 'lucide-react';

interface CustomField {
  id: string;
  name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'user_select' | 'user_multiselect';
  options?: string[];
  project_id: string;
}

interface CustomFieldsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomFieldsDialog({ projectId, open, onOpenChange }: CustomFieldsDialogProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomField['field_type']>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [loading, setLoading] = useState(false);

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
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setFields(data.map(field => ({
        ...field,
        options: field.options ? field.options as string[] : undefined
      })));
    } catch (error: any) {
      toast({
        title: "Error loading custom fields",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;

    setLoading(true);
    try {
      const fieldData: any = {
        project_id: projectId,
        name: newFieldName.trim(),
        field_type: newFieldType,
      };

      if ((newFieldType === 'select' || newFieldType === 'multiselect') && newFieldOptions) {
        fieldData.options = newFieldOptions.split(',').map(opt => opt.trim()).filter(Boolean);
      }

      const { data, error } = await supabase
        .from('custom_fields')
        .insert([fieldData])
        .select()
        .single();

      if (error) throw error;

      setFields([...fields, {
        ...data,
        options: data.options ? data.options as string[] : undefined
      }]);
      
      setNewFieldName('');
      setNewFieldOptions('');
      
      toast({
        title: "Custom field added",
        description: `${data.name} has been added successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding custom field",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;

      setFields(fields.filter(f => f.id !== fieldId));
      
      toast({
        title: "Custom field deleted",
        description: "Custom field has been deleted successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting custom field",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px]">
        <DialogHeader>
          <DialogTitle>Manage Custom Fields</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-1">
          <form onSubmit={handleAddField} className="space-y-4 border-b pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-name">Field Name</Label>
                <Input
                  id="field-name"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="e.g., Priority, Sprint"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="field-type">Field Type</Label>
                <Select value={newFieldType} onValueChange={(value: CustomField['field_type']) => setNewFieldType(value)}>
                  <SelectTrigger id="field-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Select (Single)</SelectItem>
                    <SelectItem value="multiselect">Select (Multiple)</SelectItem>
                    <SelectItem value="user_select">User (Single)</SelectItem>
                    <SelectItem value="user_multiselect">User (Multiple)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(newFieldType === 'select' || newFieldType === 'multiselect') && (
              <div className="space-y-2">
                <Label htmlFor="field-options">Options (comma-separated)</Label>
                <Input
                  id="field-options"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder="e.g., Low, Medium, High"
                />
              </div>
            )}

            <Button type="submit" disabled={loading} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </form>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Existing Fields</h4>
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom fields yet.</p>
            ) : (
              <div className="space-y-2">
                {fields.map((field) => (
                  <div key={field.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <span className="font-medium text-sm">{field.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({field.field_type})</span>
                      {field.options && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Options: {field.options.join(', ')}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteField(field.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}