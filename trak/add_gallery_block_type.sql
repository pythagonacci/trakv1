-- Add 'gallery' to block_type enum

ALTER TYPE block_type ADD VALUE IF NOT EXISTS 'gallery';

COMMENT ON TYPE block_type IS 'Types of blocks that can be added to tabs: text, task, link, divider, table, timeline, file, video, image, gallery, embed, pdf, section, doc_reference';
