-- Add width and height columns to cards for configurable layout
-- width: 'half' = 50% of block, 'full' = 100%
-- height: 'compact' = shorter card, 'tall' = larger vertically
alter table public.cards
  add column if not exists width text not null default 'half'
    check (width in ('half', 'full')),
  add column if not exists height text not null default 'tall'
    check (height in ('compact', 'tall'));

comment on column public.cards.width is 'Horizontal size: half (50%) or full (100%) of block width';
comment on column public.cards.height is 'Vertical size: compact or tall';
