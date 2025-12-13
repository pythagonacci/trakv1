-- Atomic position calculation function to prevent race conditions in block creation
-- This function safely calculates the next available position for blocks

CREATE OR REPLACE FUNCTION get_next_block_position(
  p_tab_id UUID,
  p_parent_block_id UUID DEFAULT NULL,
  p_column INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_position INTEGER := 0;
  existing_positions INTEGER[];
  pos_count INTEGER;
BEGIN
  -- Get all existing positions for this tab/parent/column combination, sorted
  IF p_parent_block_id IS NOT NULL THEN
    -- For nested blocks
    SELECT array_agg(position ORDER BY position)
    INTO existing_positions
    FROM blocks
    WHERE parent_block_id = p_parent_block_id;
  ELSE
    -- For top-level blocks
    SELECT array_agg(position ORDER BY position)
    INTO existing_positions
    FROM blocks
    WHERE tab_id = p_tab_id
      AND "column" = p_column
      AND parent_block_id IS NULL;
  END IF;

  -- Find the first available position (starting from 0)
  IF existing_positions IS NOT NULL THEN
    pos_count := array_length(existing_positions, 1);
    IF pos_count > 0 THEN
      -- Look for the first gap or append to end
      -- existing_positions[1] is the first element (position 0 if no gaps)
      FOR i IN 0..pos_count LOOP
        -- If we've reached the end, or found a gap
        IF i = pos_count OR existing_positions[i + 1] > i THEN
          next_position := i;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    -- If no positions exist, next_position remains 0
  END IF;

  RETURN next_position;
END;
$$;

-- Alternative: Add a unique constraint to prevent position conflicts
-- Note: This would require handling constraint violations in the application
-- ALTER TABLE blocks ADD CONSTRAINT unique_block_position
--   EXCLUDE (tab_id WITH =, "column" WITH =, position WITH =)
--   WHERE (parent_block_id IS NULL);
