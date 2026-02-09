-- Migration: Validate constraints and verify data integrity
-- Ensures all priority/status fields are properly linked and all row data uses canonical IDs

-- ============================================================================
-- VERIFICATION 1: Check all priority/status fields are linked
-- ============================================================================

DO $$
DECLARE
  unlinked_count integer;
  unlinked_fields text;
BEGIN
  SELECT COUNT(*) INTO unlinked_count
  FROM table_fields tf
  WHERE tf.type IN ('priority', 'status')
    AND tf.property_definition_id IS NULL;

  IF unlinked_count > 0 THEN
    -- Get details of unlinked fields
    SELECT string_agg(
      'Field ID: ' || tf.id || ', Name: ' || tf.name || ', Type: ' || tf.type || ', Table: ' || tf.table_id,
      E'\n'
    ) INTO unlinked_fields
    FROM table_fields tf
    WHERE tf.type IN ('priority', 'status')
      AND tf.property_definition_id IS NULL
    LIMIT 20;

    RAISE EXCEPTION E'Migration failed: % priority/status fields are not linked to property definitions:\n%',
      unlinked_count, unlinked_fields;
  ELSE
    RAISE NOTICE '✓ All priority/status fields are linked to property definitions';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION 2: Check for invalid canonical IDs in row data
-- ============================================================================

DO $$
DECLARE
  invalid_count integer;
  invalid_sample text;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM table_rows tr
  JOIN table_fields tf ON tr.table_id = tf.table_id
  JOIN property_definitions pd ON tf.property_definition_id = pd.id
  WHERE tf.type IN ('priority', 'status')
    AND tr.data ? tf.id::text
    AND (tr.data->>tf.id::text) IS NOT NULL
    AND (tr.data->>tf.id::text) != ''
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(pd.options) opt
      WHERE opt->>'id' = tr.data->>tf.id::text
    );

  IF invalid_count > 0 THEN
    -- Get sample of invalid values
    SELECT string_agg(
      'Row: ' || tr.id || ', Field: ' || tf.name || ' (' || tf.type || '), Value: "' || (tr.data->>tf.id::text) || '"',
      E'\n'
    ) INTO invalid_sample
    FROM (
      SELECT tr.id, tf.id as field_id, tf.name, tf.type, tr.data
      FROM table_rows tr
      JOIN table_fields tf ON tr.table_id = tf.table_id
      JOIN property_definitions pd ON tf.property_definition_id = pd.id
      WHERE tf.type IN ('priority', 'status')
        AND tr.data ? tf.id::text
        AND (tr.data->>tf.id::text) IS NOT NULL
        AND (tr.data->>tf.id::text) != ''
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(pd.options) opt
          WHERE opt->>'id' = tr.data->>tf.id::text
        )
      LIMIT 10
    ) sample;

    RAISE EXCEPTION E'Migration failed: % rows have non-canonical IDs. Sample:\n%',
      invalid_count, invalid_sample;
  ELSE
    RAISE NOTICE '✓ All row data uses valid canonical IDs';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION 3: Check all workspaces have default property definitions
-- ============================================================================

DO $$
DECLARE
  missing_status integer;
  missing_priority integer;
  ws_sample text;
BEGIN
  -- Check for workspaces missing Status definition
  SELECT COUNT(*) INTO missing_status
  FROM workspaces w
  WHERE NOT EXISTS (
    SELECT 1
    FROM property_definitions pd
    WHERE pd.workspace_id = w.id
      AND pd.name = 'Status'
      AND pd.type = 'select'
  );

  -- Check for workspaces missing Priority definition
  SELECT COUNT(*) INTO missing_priority
  FROM workspaces w
  WHERE NOT EXISTS (
    SELECT 1
    FROM property_definitions pd
    WHERE pd.workspace_id = w.id
      AND pd.name = 'Priority'
      AND pd.type = 'select'
  );

  IF missing_status > 0 OR missing_priority > 0 THEN
    SELECT string_agg('Workspace: ' || w.id, E'\n') INTO ws_sample
    FROM (
      SELECT w.id
      FROM workspaces w
      WHERE NOT EXISTS (
        SELECT 1 FROM property_definitions pd
        WHERE pd.workspace_id = w.id AND pd.name IN ('Status', 'Priority') AND pd.type = 'select'
      )
      LIMIT 10
    ) sample;

    RAISE EXCEPTION E'Migration failed: % workspaces missing Status, % missing Priority:\n%',
      missing_status, missing_priority, ws_sample;
  ELSE
    RAISE NOTICE '✓ All workspaces have Status and Priority property definitions';
  END IF;
END $$;

-- ============================================================================
-- ENABLE CONSTRAINT: priority/status fields must have property_definition_id
-- ============================================================================

DO $$
BEGIN
  -- Validate the constraint (this will fail if any violations exist)
  ALTER TABLE table_fields VALIDATE CONSTRAINT check_priority_status_has_property_def;

  RAISE NOTICE '✓ Constraint validated successfully';
END $$;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

DO $$
DECLARE
  total_fields integer;
  total_rows integer;
  workspace_count integer;
BEGIN
  -- Count migrated fields
  SELECT COUNT(*) INTO total_fields
  FROM table_fields
  WHERE type IN ('priority', 'status')
    AND property_definition_id IS NOT NULL;

  -- Count rows with priority/status values
  SELECT COUNT(DISTINCT tr.id) INTO total_rows
  FROM table_rows tr
  JOIN table_fields tf ON tr.table_id = tf.table_id
  WHERE tf.type IN ('priority', 'status')
    AND tr.data ? tf.id::text;

  -- Count workspaces
  SELECT COUNT(*) INTO workspace_count
  FROM workspaces;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Workspaces: %', workspace_count;
  RAISE NOTICE 'Priority/Status fields migrated: %', total_fields;
  RAISE NOTICE 'Rows with priority/status data: %', total_rows;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All priority/status fields now use canonical IDs:';
  RAISE NOTICE '  Priority: low, medium, high, urgent';
  RAISE NOTICE '  Status: todo, in_progress, done, blocked';
  RAISE NOTICE '========================================';
END $$;
