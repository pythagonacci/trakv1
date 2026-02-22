-- ============================================================================
-- PROPERTIES REFACTOR — DB AUDIT QUERIES
-- Supabase SQL Editor: Select ONE block below and run it to see that result.
-- Run each block separately and copy/save the output.
-- ============================================================================

-- ========== RUN SEPARATELY: 1 — entity_properties schema ==========
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'entity_properties'
ORDER BY ordinal_position;

-- ========== RUN SEPARATELY: 2 — entity_properties constraints & indexes ==========
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.entity_properties'::regclass;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'entity_properties';

-- ========== RUN SEPARATELY: 3 — entity_properties sample data (20 rows) ==========
SELECT id, entity_type, entity_id, workspace_id,
       property_definition_id, field_name, field_type, value,
       created_at, updated_at
FROM entity_properties
ORDER BY created_at DESC
LIMIT 20;

-- ========== RUN SEPARATELY: 4 — entity_properties counts by entity_type ==========
SELECT entity_type, COUNT(*) AS count
FROM entity_properties
GROUP BY entity_type
ORDER BY count DESC;

-- ========== RUN SEPARATELY: 5 — entity_properties: with vs without property_definition_id ==========
SELECT
  CASE WHEN property_definition_id IS NOT NULL THEN 'has_property_definition_id' ELSE 'no_property_definition_id' END AS kind,
  COUNT(*) AS count
FROM entity_properties
GROUP BY 1;

-- ========== RUN SEPARATELY: 6 — entity_properties: entities with multiple properties ==========
SELECT entity_type, entity_id, COUNT(*) AS prop_count,
       array_agg(DISTINCT field_type) AS field_types,
       array_agg(DISTINCT field_name) FILTER (WHERE field_name IS NOT NULL) AS field_names
FROM entity_properties
GROUP BY entity_type, entity_id
HAVING COUNT(*) > 1
LIMIT 10;

-- ========== RUN SEPARATELY: 7 — property_definitions full contents ==========
SELECT id, workspace_id, name, type, options, created_at, updated_at
FROM property_definitions
ORDER BY workspace_id, name;

-- ========== RUN SEPARATELY: 8 — property_definitions counts per workspace ==========
SELECT workspace_id, COUNT(*) AS def_count,
       array_agg(name ORDER BY name) AS names
FROM property_definitions
GROUP BY workspace_id
ORDER BY def_count DESC;

-- ========== RUN SEPARATELY: 9 — table_fields with property_definition_id ==========
SELECT tf.id, tf.table_id, tf.name, tf.type, tf.property_definition_id,
       pd.name AS pd_name, pd.type AS pd_type
FROM table_fields tf
LEFT JOIN property_definitions pd ON pd.id = tf.property_definition_id
WHERE tf.property_definition_id IS NOT NULL
ORDER BY tf.table_id
LIMIT 50;

-- ========== RUN SEPARATELY: 10 — table_fields: with/without property_definition_id by type ==========
SELECT tf.type,
       COUNT(*) FILTER (WHERE tf.property_definition_id IS NOT NULL) AS with_pd,
       COUNT(*) FILTER (WHERE tf.property_definition_id IS NULL) AS without_pd
FROM table_fields tf
GROUP BY tf.type
ORDER BY tf.type;

-- ========== RUN SEPARATELY: 11 — task_items priorities (JSONB) sample ==========
SELECT id, title, status, priorities, created_at
FROM task_items
WHERE priorities IS NOT NULL AND priorities != '[]'::jsonb
ORDER BY updated_at DESC
LIMIT 15;

-- ========== RUN SEPARATELY: 12 — task_items status distribution ==========
SELECT status, COUNT(*) AS count
FROM task_items
GROUP BY status
ORDER BY count DESC;

-- ========== RUN SEPARATELY: 13 — timeline_events status/priority/priorities columns ==========
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'timeline_events'
  AND column_name IN ('status', 'priority', 'priorities', 'statuses');

-- ========== RUN SEPARATELY: 14 — timeline_events sample (status, priority/priorities) ==========
SELECT id, title, status, priority, priorities
FROM timeline_events
WHERE status IS NOT NULL OR priority IS NOT NULL OR (priorities IS NOT NULL AND priorities != '[]'::jsonb)
ORDER BY updated_at DESC
LIMIT 15;

-- ========== RUN SEPARATELY: 15 — timeline_events status/priority distribution ==========
SELECT status, COUNT(*) AS count FROM timeline_events WHERE status IS NOT NULL GROUP BY status ORDER BY count DESC;
SELECT priority, COUNT(*) AS count FROM timeline_events WHERE priority IS NOT NULL GROUP BY priority ORDER BY count DESC;

-- ========== RUN SEPARATELY: 16 — triggers on property-related tables ==========
SELECT tgname AS trigger_name,
       relname AS table_name,
       proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE relname IN ('entity_properties', 'property_definitions', 'task_items', 'timeline_events', 'table_rows', 'table_fields')
  AND NOT tgisinternal
ORDER BY relname, tgname;

-- ========== RUN SEPARATELY: 17 — foreign keys referencing property_definitions ==========
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'property_definitions';

-- ========== RUN SEPARATELY: 18 — entity_properties unique/primary constraints ==========
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.entity_properties'::regclass
  AND contype IN ('u', 'p');

-- ========== RUN SEPARATELY: 19 — tables with status/priority fields ==========
-- First find a table that has status or priority fields
SELECT t.id AS table_id, t.name AS table_name,
       array_agg(tf.id || ':' || tf.name || '(' || tf.type || ')') AS fields
FROM tables t
JOIN table_fields tf ON tf.table_id = t.id
WHERE tf.type IN ('status', 'priority')
GROUP BY t.id, t.name
LIMIT 5;

-- Then for one such table_id, sample row data (replace TABLE_ID):
-- SELECT tr.id, tr.data FROM table_rows tr WHERE tr.table_id = 'TABLE_ID' LIMIT 5;

-- ========== RUN SEPARATELY: 20 — functions referencing property_definitions or entity_properties ==========
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND (
    routine_definition ILIKE '%property_definitions%'
    OR routine_definition ILIKE '%entity_properties%'
  )
ORDER BY routine_name;

-- ========== RUN SEPARATELY: 21 — entity_properties count by field_type ==========
SELECT field_type, COUNT(*) AS count
FROM entity_properties
WHERE value IS NOT NULL
GROUP BY field_type
ORDER BY count DESC;

-- ========== RUN SEPARATELY: 22 — entity_properties sample value per field_type ==========
SELECT DISTINCT ON (field_type) field_type, value
FROM entity_properties
WHERE value IS NOT NULL
ORDER BY field_type;
