-- Add 'column' column to blocks table for multi-column layout support
-- Run this in Supabase SQL Editor
-- This allows blocks to be arranged in up to 3 columns (0, 1, or 2)

-- Add the column with a default value of 0 for existing blocks
-- Note: "column" is a reserved keyword, so we need to quote it
ALTER TABLE blocks
ADD COLUMN IF NOT EXISTS "column" INTEGER NOT NULL DEFAULT 0;

-- Add a check constraint to ensure column values are between 0 and 2 (3 columns max)
ALTER TABLE blocks
ADD CONSTRAINT blocks_column_check CHECK ("column" >= 0 AND "column" <= 2);

-- Create an index on column and position for efficient querying
CREATE INDEX IF NOT EXISTS idx_blocks_column_position ON blocks(tab_id, "column", position) WHERE parent_block_id IS NULL;
