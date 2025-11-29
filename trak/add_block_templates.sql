-- Migration: Add block template/sharing functionality
-- This allows blocks to be reused across multiple projects/tabs

-- Add is_template column to blocks table
ALTER TABLE blocks
ADD COLUMN is_template BOOLEAN DEFAULT FALSE;

-- Add template_name column for naming reusable blocks
ALTER TABLE blocks
ADD COLUMN template_name TEXT DEFAULT NULL;

-- Add original_block_id to track block references
ALTER TABLE blocks
ADD COLUMN original_block_id UUID REFERENCES blocks(id) ON DELETE CASCADE DEFAULT NULL;

-- Add index for finding template blocks
CREATE INDEX idx_blocks_is_template ON blocks(is_template) WHERE is_template = TRUE;

-- Add index for finding block references
CREATE INDEX idx_blocks_original_block_id ON blocks(original_block_id) WHERE original_block_id IS NOT NULL;

COMMENT ON COLUMN blocks.is_template IS 'Whether this block is a reusable template/shared block';
COMMENT ON COLUMN blocks.template_name IS 'Optional name for template blocks to make them easier to find';
COMMENT ON COLUMN blocks.original_block_id IS 'If this is a reference, points to the original block';

