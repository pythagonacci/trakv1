-- Add asset_file_ids array for slideshow support on cards.
-- When populated, cards display a slideshow of multiple images.
-- Backfill: copy asset_file_id into asset_file_ids for existing cards.
alter table public.cards
  add column if not exists asset_file_ids uuid[] not null default '{}';

comment on column public.cards.asset_file_ids is 'Ordered list of file IDs for slideshow. When empty, asset_file_id is used as single asset.';

-- Backfill: migrate existing single assets into the array
update public.cards
set asset_file_ids = array[asset_file_id]
where asset_file_id is not null
  and (asset_file_ids is null or asset_file_ids = '{}');
