-- Migration: Add doc_reference to block_type enum
-- This allows blocks to reference documents

-- Add the new enum value to the block_type enum
ALTER TYPE block_type ADD VALUE IF NOT EXISTS 'doc_reference';

-- Note: Postgres doesn't allow adding enum values in a transaction,
-- so if you're running this as part of a larger migration, you may need to run it separately

COMMENT ON TYPE block_type IS 'Types of blocks that can be added to tabs: text, task, link, divider, table, timeline, file, video, image, embed, pdf, section, doc_reference';

