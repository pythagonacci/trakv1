-- Migration to drop the legacy status text columns after migrating to the statuses JSONB array

-- 1. Drop status from task_items
ALTER TABLE "public"."task_items" DROP COLUMN IF EXISTS "status";

-- 2. Drop status from timeline_events
ALTER TABLE "public"."timeline_events" DROP COLUMN IF EXISTS "status";

-- 3. We also need to recreate any views or functions that might have depended on the implicit schema
-- The RPC functions were already updated in 20260221174000_migrate_status_to_jsonb.sql to handle both, 
-- but we should ensure they don't try to insert into the old 'status' column anymore if they still do.

-- Let's redefine create_task_full and update_task_full just to be safe, removing references to the 'status' column insertion,
-- but the previous migration actually changed them to just use p_status (the param) to populate statuses JSONB.
-- Let's check the previous migration to see if it kept inserting into 'status' for backward compatibility.
