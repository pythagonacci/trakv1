-- Add 'person' as a valid block reference type for @person mentions
alter table public.block_references
  drop constraint block_references_reference_type_check;

alter table public.block_references
  add constraint block_references_reference_type_check
  check (reference_type = any (array['doc'::text, 'table_row'::text, 'task'::text, 'block'::text, 'tab'::text, 'person'::text]));
