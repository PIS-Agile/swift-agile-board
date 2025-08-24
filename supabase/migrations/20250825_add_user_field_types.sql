-- Add user_select and user_multiselect to the field_type constraint
ALTER TABLE public.custom_fields 
DROP CONSTRAINT custom_fields_field_type_check;

ALTER TABLE public.custom_fields 
ADD CONSTRAINT custom_fields_field_type_check 
CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect', 'user_select', 'user_multiselect'));