-- Fix source_sync_mode to only apply when source entity exists in task_items
-- Previously, ALL rows had source_sync_mode='snapshot' even when they had no source entity
-- This migration makes source_sync_mode nullable and only sets it when there's a source entity

-- 1. Drop the NOT NULL constraint
ALTER TABLE public.task_items
  ALTER COLUMN source_sync_mode DROP NOT NULL;

-- 2. Remove the default value
ALTER TABLE public.task_items
  ALTER COLUMN source_sync_mode DROP DEFAULT;

-- 3. Set source_sync_mode to NULL for rows without a source entity
UPDATE public.task_items
SET source_sync_mode = NULL
WHERE source_entity_type IS NULL AND source_entity_id IS NULL AND source_task_id IS NULL;
