-- Add 'file' to task_references, task_subtask_references, and block_references reference_type check constraints
-- Allows linking files from the reference picker to tasks and blocks

alter table public.block_references
  drop constraint if exists block_references_reference_type_check;

alter table public.block_references
  add constraint block_references_reference_type_check
  check (reference_type = any (array['doc'::text, 'table_row'::text, 'task'::text, 'block'::text, 'tab'::text, 'person'::text, 'file'::text]));

alter table public.task_references
  drop constraint if exists task_references_reference_type_check;

alter table public.task_references
  add constraint task_references_reference_type_check
  check (reference_type = any (array['doc'::text, 'table_row'::text, 'task'::text, 'block'::text, 'tab'::text, 'file'::text]));

alter table public.task_subtask_references
  drop constraint if exists task_subtask_references_reference_type_check;

alter table public.task_subtask_references
  add constraint task_subtask_references_reference_type_check
  check (reference_type = any (array['doc'::text, 'table_row'::text, 'task'::text, 'block'::text, 'tab'::text, 'file'::text]));
