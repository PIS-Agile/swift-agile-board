import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from '@/hooks/use-toast';
import { Filter, X, RotateCcw } from 'lucide-react';

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
}

interface Column {
  id: string;
  name: string;
  color: string;
}

export interface FilterCriteria {
  name?: string;
  description?: string;
  estimatedTimeMin?: number | null;
  estimatedTimeMax?: number | null;
  actualTimeMin?: number | null;
  actualTimeMax?: number | null;
  assignedUsers?: string[];
  columns?: string[];
  customFields?: Record<string, any>;
}

interface FilterDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: FilterCriteria) => void;
  currentFilters: FilterCriteria;
  columns: Column[];
}

export function FilterDialog({ 
  projectId, 
  open, 
  onOpenChange, 
  onApplyFilters, 
  currentFilters,
  columns 
}: FilterDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [filters, setFilters] = useState<FilterCriteria>(currentFilters);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    if (open) {
      fetchData();
      setFilters(currentFilters);
    }
  }, [open, projectId, currentFilters]);

  useEffect(() => {
    // Count active filters
    let count = 0;
    if (filters.name) count++;
    if (filters.description) count++;
    if (filters.estimatedTimeMin !== null && filters.estimatedTimeMin !== undefined) count++;
    if (filters.estimatedTimeMax !== null && filters.estimatedTimeMax !== undefined) count++;
    if (filters.actualTimeMin !== null && filters.actualTimeMin !== undefined) count++;
    if (filters.actualTimeMax !== null && filters.actualTimeMax !== undefined) count++;
    if (filters.assignedUsers && filters.assignedUsers.length > 0) count++;
    if (filters.columns && filters.columns.length > 0) count++;
    if (filters.customFields) {
      Object.values(filters.customFields).forEach(value => {
        if (value !== null && value !== undefined && value !== '' && 
            (!Array.isArray(value) || value.length > 0)) {
          count++;
        }
      });
    }
    setActiveFiltersCount(count);
  }, [filters]);

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
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading filter data",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApplyFilters = () => {
    onApplyFilters(filters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    const emptyFilters: FilterCriteria = {
      name: '',
      description: '',
      estimatedTimeMin: null,
      estimatedTimeMax: null,
      actualTimeMin: null,
      actualTimeMax: null,
      assignedUsers: [],
      columns: [],
      customFields: {}
    };
    setFilters(emptyFilters);
  };

  const renderCustomFieldFilter = (field: CustomField) => {
    const value = filters.customFields?.[field.id] || '';
    
    switch (field.field_type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label>{field.name}</Label>
            <Input
              value={value}
              onChange={(e) => setFilters({
                ...filters,
                customFields: {
                  ...filters.customFields,
                  [field.id]: e.target.value
                }
              })}
              placeholder={`Search ${field.name}...`}
            />
          </div>
        );
      
      case 'number':
        const minValue = filters.customFields?.[`${field.id}_min`] || '';
        const maxValue = filters.customFields?.[`${field.id}_max`] || '';
        return (
          <div key={field.id} className="space-y-2">
            <Label>{field.name}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={minValue}
                onChange={(e) => setFilters({
                  ...filters,
                  customFields: {
                    ...filters.customFields,
                    [`${field.id}_min`]: e.target.value ? parseFloat(e.target.value) : null
                  }
                })}
                placeholder="Min"
              />
              <Input
                type="number"
                value={maxValue}
                onChange={(e) => setFilters({
                  ...filters,
                  customFields: {
                    ...filters.customFields,
                    [`${field.id}_max`]: e.target.value ? parseFloat(e.target.value) : null
                  }
                })}
                placeholder="Max"
              />
            </div>
          </div>
        );
      
      case 'date':
        const startDate = filters.customFields?.[`${field.id}_start`] || '';
        const endDate = filters.customFields?.[`${field.id}_end`] || '';
        return (
          <div key={field.id} className="space-y-2">
            <Label>{field.name}</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setFilters({
                  ...filters,
                  customFields: {
                    ...filters.customFields,
                    [`${field.id}_start`]: e.target.value
                  }
                })}
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setFilters({
                  ...filters,
                  customFields: {
                    ...filters.customFields,
                    [`${field.id}_end`]: e.target.value
                  }
                })}
              />
            </div>
          </div>
        );
      
      case 'select':
      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
        return (
          <div key={field.id} className="space-y-2">
            <Label>{field.name}</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
              {field.options?.map((option) => (
                <label key={option} className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedValues.includes(option)}
                    onCheckedChange={(checked) => {
                      const newValue = checked
                        ? [...selectedValues, option]
                        : selectedValues.filter(v => v !== option);
                      setFilters({
                        ...filters,
                        customFields: {
                          ...filters.customFields,
                          [field.id]: newValue
                        }
                      });
                    }}
                  />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </div>
          </div>
        );
      
      case 'user_select':
      case 'user_multiselect':
        const selectedUserIds = Array.isArray(value) ? value : (value ? [value] : []);
        return (
          <div key={field.id} className="space-y-2">
            <Label>{field.name}</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
              {profiles.map((profile) => (
                <label key={profile.id} className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedUserIds.includes(profile.id)}
                    onCheckedChange={(checked) => {
                      const newValue = checked
                        ? [...selectedUserIds, profile.id]
                        : selectedUserIds.filter(id => id !== profile.id);
                      setFilters({
                        ...filters,
                        customFields: {
                          ...filters.customFields,
                          [field.id]: newValue
                        }
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
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Items
            </span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">
                {activeFiltersCount} active filter{activeFiltersCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Filter items by various criteria. Leave fields empty to ignore them.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-1">
          <Accordion type="multiple" defaultValue={["basic", "columns"]} className="w-full">
            <AccordionItem value="basic">
              <AccordionTrigger>Basic Fields</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label htmlFor="filter-name">Name</Label>
                  <Input
                    id="filter-name"
                    value={filters.name || ''}
                    onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                    placeholder="Search in item names..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="filter-description">Description</Label>
                  <Input
                    id="filter-description"
                    value={filters.description || ''}
                    onChange={(e) => setFilters({ ...filters, description: e.target.value })}
                    placeholder="Search in descriptions..."
                  />
                </div>
                
                <div>
                  <Label>Estimated Time (hours)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={filters.estimatedTimeMin || ''}
                      onChange={(e) => setFilters({ 
                        ...filters, 
                        estimatedTimeMin: e.target.value ? parseFloat(e.target.value) : null 
                      })}
                      placeholder="Min"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={filters.estimatedTimeMax || ''}
                      onChange={(e) => setFilters({ 
                        ...filters, 
                        estimatedTimeMax: e.target.value ? parseFloat(e.target.value) : null 
                      })}
                      placeholder="Max"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Actual Time (hours)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={filters.actualTimeMin || ''}
                      onChange={(e) => setFilters({ 
                        ...filters, 
                        actualTimeMin: e.target.value ? parseFloat(e.target.value) : null 
                      })}
                      placeholder="Min"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={filters.actualTimeMax || ''}
                      onChange={(e) => setFilters({ 
                        ...filters, 
                        actualTimeMax: e.target.value ? parseFloat(e.target.value) : null 
                      })}
                      placeholder="Max"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Assigned Users</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {profiles.map((profile) => (
                      <label key={profile.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={filters.assignedUsers?.includes(profile.id) || false}
                          onCheckedChange={(checked) => {
                            const currentUsers = filters.assignedUsers || [];
                            const newUsers = checked
                              ? [...currentUsers, profile.id]
                              : currentUsers.filter(id => id !== profile.id);
                            setFilters({ ...filters, assignedUsers: newUsers });
                          }}
                        />
                        <span className="text-sm">
                          {profile.full_name || profile.email || 'Unknown'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="columns">
              <AccordionTrigger>Columns</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <Label>Show items only in these columns</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {columns.map((column) => (
                    <label key={column.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={filters.columns?.includes(column.id) || false}
                        onCheckedChange={(checked) => {
                          const currentColumns = filters.columns || [];
                          const newColumns = checked
                            ? [...currentColumns, column.id]
                            : currentColumns.filter(id => id !== column.id);
                          setFilters({ ...filters, columns: newColumns });
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: column.color }}
                        />
                        <span className="text-sm">{column.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {customFields.length > 0 && (
              <AccordionItem value="custom">
                <AccordionTrigger>Custom Fields</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {customFields.map(field => renderCustomFieldFilter(field))}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
        
        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleResetFilters}
            disabled={activeFiltersCount === 0}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyFilters}>
              Apply Filters
              {activeFiltersCount > 0 && ` (${activeFiltersCount})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}