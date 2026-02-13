-- Add shopify_product block type for embedding Shopify products in project tabs
ALTER TYPE public.block_type ADD VALUE IF NOT EXISTS 'shopify_product';

COMMENT ON TYPE public.block_type IS 'Types of blocks that can be added to tabs: text, task, link, divider, table, timeline, file, video, image, gallery, embed, pdf, section, doc_reference, chart, shopify_product';
