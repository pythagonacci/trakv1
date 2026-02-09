-- Migration: Add property_definition_id to table_fields
-- This links priority and status fields to workspace-level property definitions

-- Step 1: Add property_definition_id column to table_fields
ALTER TABLE public.table_fields
  ADD COLUMN property_definition_id uuid;

-- Step 2: Add foreign key constraint with RESTRICT (blocks deletion)
ALTER TABLE public.table_fields
  ADD CONSTRAINT table_fields_property_definition_id_fkey
  FOREIGN KEY (property_definition_id)
  REFERENCES public.property_definitions(id)
  ON DELETE RESTRICT;

-- Step 3: Create index for performance
CREATE INDEX idx_table_fields_property_definition_id
  ON public.table_fields(property_definition_id)
  WHERE property_definition_id IS NOT NULL;

-- Step 4: Add check constraint (priority/status fields must have property_definition_id)
-- Use NOT VALID to allow existing data, will validate after migration
ALTER TABLE public.table_fields
  ADD CONSTRAINT check_priority_status_has_property_def
  CHECK (
    (type NOT IN ('priority', 'status')) OR
    (type IN ('priority', 'status') AND property_definition_id IS NOT NULL)
  )
  NOT VALID;

-- Note: Constraint will be validated in a later migration after data migration completes
-- Run: ALTER TABLE table_fields VALIDATE CONSTRAINT check_priority_status_has_property_def;
