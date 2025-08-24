import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { toast } from '@/hooks/use-toast';
import { Filter, X, RotateCcw, Search } from 'lucide-react';

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

interface FilterDropdownProps {
  projectId: string;
  onApplyFilters: (filters: FilterCriteria) => void;
  currentFilters: FilterCriteria;
  columns: Column[];
}

export function FilterDropdown({ 
  projectId, 
  onApplyFilters, 
  currentFilters,
  columns 
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [filters, setFilters] = useState<FilterCriteria>(currentFilters);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, projectId]);

  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

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
        .order('position')
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
    setOpen(false);
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
    onApplyFilters(emptyFilters);
  };

  const handleClearFilter = (filterKey: string) => {
    const newFilters = { ...filters };
    if (filterKey === 'assignedUsers' || filterKey === 'columns') {
      newFilters[filterKey] = [];
    } else if (filterKey.startsWith('customField-')) {
      const fieldId = filterKey.replace('customField-', '');
      if (newFilters.customFields) {
        delete newFilters.customFields[fieldId];
      }
    } else {
      delete newFilters[filterKey as keyof FilterCriteria];
    }
    setFilters(newFilters);
    onApplyFilters(newFilters);
  };

  // Convert profiles to MultiSelectOptions
  const profileOptions: MultiSelectOption[] = profiles.map(profile => ({
    value: profile.id,
    label: profile.full_name || profile.email || 'Unknown',
  }));

  // Convert columns to MultiSelectOptions
  const columnOptions: MultiSelectOption[] = columns.map(column => ({
    value: column.id,
    label: column.name,
    color: column.color,
  }));

  const renderCustomFieldFilter = (field: CustomField) => {
    const value = filters.customFields?.[field.id] || '';
    
    switch (field.field_type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm">{field.name}</Label>
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
              className="h-9"
            />
          </div>
        );
      
      case 'number':
        const minValue = filters.customFields?.[`${field.id}_min`] || '';
        const maxValue = filters.customFields?.[`${field.id}_max`] || '';
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm">{field.name}</Label>
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
                className="h-9"
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
                className="h-9"
              />
            </div>
          </div>
        );
      
      case 'date':
        const startDate = filters.customFields?.[`${field.id}_start`] || '';
        const endDate = filters.customFields?.[`${field.id}_end`] || '';
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm">{field.name}</Label>
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
                className="h-9"
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
                className="h-9"
              />
            </div>
          </div>
        );
      
      case 'select':
      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
        const fieldOptions: MultiSelectOption[] = (field.options || []).map(opt => ({
          value: opt,
          label: opt,
        }));
        
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm">{field.name}</Label>
            <MultiSelect
              options={fieldOptions}
              selected={selectedValues}
              onChange={(newValues) => setFilters({
                ...filters,
                customFields: {
                  ...filters.customFields,
                  [field.id]: newValues
                }
              })}
              placeholder={`Select ${field.name}...`}
            />
          </div>
        );
      
      case 'user_select':
      case 'user_multiselect':
        const selectedUserIds = Array.isArray(value) ? value : (value ? [value] : []);
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm">{field.name}</Label>
            <MultiSelect
              options={profileOptions}
              selected={selectedUserIds}
              onChange={(newValues) => setFilters({
                ...filters,
                customFields: {
                  ...filters.customFields,
                  [field.id]: newValues
                }
              })}
              placeholder={`Select ${field.name}...`}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  // Get active filter badges
  const getActiveFilterBadges = () => {
    const badges = [];
    
    if (filters.name) {
      badges.push(
        <Badge key="name" variant="secondary" className="gap-1">
          Name: {filters.name}
          <X 
            className="h-3 w-3 cursor-pointer hover:text-destructive" 
            onClick={() => handleClearFilter('name')}
          />
        </Badge>
      );
    }
    
    if (filters.assignedUsers && filters.assignedUsers.length > 0) {
      badges.push(
        <Badge key="users" variant="secondary" className="gap-1">
          {filters.assignedUsers.length} user{filters.assignedUsers.length !== 1 ? 's' : ''}
          <X 
            className="h-3 w-3 cursor-pointer hover:text-destructive" 
            onClick={() => handleClearFilter('assignedUsers')}
          />
        </Badge>
      );
    }
    
    if (filters.columns && filters.columns.length > 0) {
      badges.push(
        <Badge key="columns" variant="secondary" className="gap-1">
          {filters.columns.length} column{filters.columns.length !== 1 ? 's' : ''}
          <X 
            className="h-3 w-3 cursor-pointer hover:text-destructive" 
            onClick={() => handleClearFilter('columns')}
          />
        </Badge>
      );
    }
    
    return badges;
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={activeFiltersCount > 0 ? 'default' : 'outline'}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-background text-foreground">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="flex items-center justify-between p-4 pb-2">
            <h4 className="font-medium text-sm">Filters</h4>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 px-2 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
          
          <ScrollArea className="h-[400px]">
            <div className="p-4 pt-2 space-y-4">
              {/* Name & Description */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Name</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={filters.name || ''}
                      onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                      placeholder="Search item names..."
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Description</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={filters.description || ''}
                      onChange={(e) => setFilters({ ...filters, description: e.target.value })}
                      placeholder="Search descriptions..."
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Time Fields */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Estimated Time (hours)</Label>
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
                      className="h-9"
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
                      className="h-9"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Actual Time (hours)</Label>
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
                      className="h-9"
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
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Assigned Users */}
              <div className="space-y-2">
                <Label className="text-sm">Assigned Users</Label>
                <MultiSelect
                  options={profileOptions}
                  selected={filters.assignedUsers || []}
                  onChange={(newValues) => setFilters({ ...filters, assignedUsers: newValues })}
                  placeholder="Select users..."
                  searchPlaceholder="Search users..."
                />
              </div>

              {/* Columns */}
              <div className="space-y-2">
                <Label className="text-sm">Columns</Label>
                <MultiSelect
                  options={columnOptions}
                  selected={filters.columns || []}
                  onChange={(newValues) => setFilters({ ...filters, columns: newValues })}
                  placeholder="Select columns..."
                  searchPlaceholder="Search columns..."
                />
              </div>

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Custom Fields</Label>
                    {customFields.map(field => renderCustomFieldFilter(field))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          
          <div className="border-t p-3">
            <Button 
              onClick={handleApplyFilters} 
              className="w-full"
              size="sm"
            >
              Apply Filters
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Active filter badges */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {getActiveFilterBadges()}
        </div>
      )}
    </div>
  );
}