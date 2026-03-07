-- Fix PGRST203: PostgREST cannot choose between overloaded create_table_full
-- when the client sends named parameters. Drop legacy overloads so only the
-- canonical (workspace_id, project_id, tab_id, title, description, fields, rows, created_by)
-- version remains.

DROP FUNCTION IF EXISTS public.create_table_full(uuid, uuid, text, text, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.create_table_full(uuid, text, uuid, uuid, uuid, text, jsonb, jsonb);
