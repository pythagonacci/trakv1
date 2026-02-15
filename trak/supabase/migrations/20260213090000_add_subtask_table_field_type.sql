-- Migration: Allow "subtask" as a table field type
-- Purpose: Enable a dedicated Subtask field type (checkbox UI + indent behavior)

ALTER TABLE public.table_fields
  DROP CONSTRAINT IF EXISTS table_fields_type_check;

ALTER TABLE public.table_fields
  ADD CONSTRAINT table_fields_type_check
  CHECK (
    type = ANY (
      ARRAY[
        'text'::text,
        'long_text'::text,
        'number'::text,
        'select'::text,
        'multi_select'::text,
        'date'::text,
        'checkbox'::text,
        'subtask'::text,
        'url'::text,
        'email'::text,
        'phone'::text,
        'person'::text,
        'files'::text,
        'created_time'::text,
        'last_edited_time'::text,
        'created_by'::text,
        'last_edited_by'::text,
        'formula'::text,
        'relation'::text,
        'rollup'::text,
        'status'::text,
        'priority'::text
      ]
    )
  );
