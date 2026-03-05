-- Add section_header block type for structural section labels on project pages
ALTER TYPE public.block_type ADD VALUE IF NOT EXISTS 'section_header';

COMMENT ON TYPE public.block_type IS 'Types of blocks that can be added to tabs: text, task, link, divider, table, timeline, file, video, image, gallery, embed, pdf, section, section_header, doc_reference, chart, shopify_product';
