ALTER TYPE public.block_type ADD VALUE IF NOT EXISTS 'chart';

COMMENT ON TYPE public.block_type IS 'Types of blocks that can be added to tabs: text, task, link, divider, table, timeline, file, video, image, gallery, embed, pdf, section, doc_reference, chart';
