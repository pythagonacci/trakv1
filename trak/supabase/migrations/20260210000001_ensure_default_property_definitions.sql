-- Migration: Ensure default property definitions and link existing fields
-- Creates Status and Priority property definitions for all workspaces
-- Links all existing priority/status table fields to their workspace property definitions

DO $$
DECLARE
  ws_id uuid;
  status_def_id uuid;
  priority_def_id uuid;
  fields_linked integer;
BEGIN
  -- Iterate through all workspaces
  FOR ws_id IN SELECT id FROM workspaces LOOP

    RAISE NOTICE 'Processing workspace: %', ws_id;

    -- ========================================================================
    -- CREATE STATUS PROPERTY DEFINITION
    -- ========================================================================

    -- Try to insert Status property definition (with canonical IDs)
    INSERT INTO property_definitions (workspace_id, name, type, options)
    VALUES (
      ws_id,
      'Status',
      'select',
      '[
        {"id": "todo", "label": "To Do", "color": "#6b7280"},
        {"id": "in_progress", "label": "In Progress", "color": "#3b82f6"},
        {"id": "done", "label": "Done", "color": "#10b981"},
        {"id": "blocked", "label": "Blocked", "color": "#ef4444"}
      ]'::jsonb
    )
    ON CONFLICT (workspace_id, name) DO UPDATE
    SET
      options = '[
        {"id": "todo", "label": "To Do", "color": "#6b7280"},
        {"id": "in_progress", "label": "In Progress", "color": "#3b82f6"},
        {"id": "done", "label": "Done", "color": "#10b981"},
        {"id": "blocked", "label": "Blocked", "color": "#ef4444"}
      ]'::jsonb,
      updated_at = now()
    WHERE property_definitions.type = 'select'  -- Safety: only update if it's the right type
    RETURNING id INTO status_def_id;

    -- Get ID if already existed and wasn't updated
    IF status_def_id IS NULL THEN
      SELECT id INTO status_def_id
      FROM property_definitions
      WHERE workspace_id = ws_id
        AND name = 'Status'
        AND type = 'select'
      LIMIT 1;
    END IF;

    IF status_def_id IS NULL THEN
      RAISE WARNING 'Failed to create or find Status property definition for workspace %', ws_id;
      CONTINUE;
    END IF;

    RAISE NOTICE 'Status property definition ID: %', status_def_id;

    -- ========================================================================
    -- CREATE PRIORITY PROPERTY DEFINITION
    -- ========================================================================

    -- Try to insert Priority property definition (with canonical IDs)
    INSERT INTO property_definitions (workspace_id, name, type, options)
    VALUES (
      ws_id,
      'Priority',
      'select',
      '[
        {"id": "low", "label": "Low", "color": "#6b7280"},
        {"id": "medium", "label": "Medium", "color": "#f59e0b"},
        {"id": "high", "label": "High", "color": "#f97316"},
        {"id": "urgent", "label": "Urgent", "color": "#ef4444"}
      ]'::jsonb
    )
    ON CONFLICT (workspace_id, name) DO UPDATE
    SET
      options = '[
        {"id": "low", "label": "Low", "color": "#6b7280"},
        {"id": "medium", "label": "Medium", "color": "#f59e0b"},
        {"id": "high", "label": "High", "color": "#f97316"},
        {"id": "urgent", "label": "Urgent", "color": "#ef4444"}
      ]'::jsonb,
      updated_at = now()
    WHERE property_definitions.type = 'select'  -- Safety: only update if it's the right type
    RETURNING id INTO priority_def_id;

    -- Get ID if already existed and wasn't updated
    IF priority_def_id IS NULL THEN
      SELECT id INTO priority_def_id
      FROM property_definitions
      WHERE workspace_id = ws_id
        AND name = 'Priority'
        AND type = 'select'
      LIMIT 1;
    END IF;

    IF priority_def_id IS NULL THEN
      RAISE WARNING 'Failed to create or find Priority property definition for workspace %', ws_id;
      CONTINUE;
    END IF;

    RAISE NOTICE 'Priority property definition ID: %', priority_def_id;

    -- ========================================================================
    -- LINK EXISTING STATUS FIELDS
    -- ========================================================================

    UPDATE table_fields tf
    SET property_definition_id = status_def_id
    FROM tables t
    WHERE tf.table_id = t.id
      AND t.workspace_id = ws_id
      AND tf.type = 'status'
      AND tf.property_definition_id IS NULL;

    GET DIAGNOSTICS fields_linked = ROW_COUNT;
    RAISE NOTICE 'Linked % status fields to property definition', fields_linked;

    -- ========================================================================
    -- LINK EXISTING PRIORITY FIELDS
    -- ========================================================================

    UPDATE table_fields tf
    SET property_definition_id = priority_def_id
    FROM tables t
    WHERE tf.table_id = t.id
      AND t.workspace_id = ws_id
      AND tf.type = 'priority'
      AND tf.property_definition_id IS NULL;

    GET DIAGNOSTICS fields_linked = ROW_COUNT;
    RAISE NOTICE 'Linked % priority fields to property definition', fields_linked;

  END LOOP;

  RAISE NOTICE 'Migration complete: All workspaces processed';
END $$;

-- Verify: Check that all priority/status fields are now linked
DO $$
DECLARE
  unlinked_count integer;
BEGIN
  SELECT COUNT(*) INTO unlinked_count
  FROM table_fields
  WHERE type IN ('priority', 'status')
    AND property_definition_id IS NULL;

  IF unlinked_count > 0 THEN
    RAISE WARNING 'Warning: % priority/status fields are still unlinked', unlinked_count;
  ELSE
    RAISE NOTICE 'Success: All priority/status fields are linked to property definitions';
  END IF;
END $$;
