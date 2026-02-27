-- Enable trigram similarity support for typo-tolerant search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for table row fuzzy search
CREATE INDEX IF NOT EXISTS idx_table_rows_data_text_trgm
  ON table_rows USING gin (lower((data::text)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tables_title_trgm
  ON tables USING gin (lower(title) gin_trgm_ops);

-- Trigram index for tag fuzzy search via entity_properties
CREATE INDEX IF NOT EXISTS idx_entity_properties_tags_value_trgm
  ON entity_properties USING gin (lower((value::text)) gin_trgm_ops)
  WHERE field_type = 'tags';

-- Primary fuzzy matcher for table rows scoped to a workspace.
-- Uses trigram matching/ranking on table title and row JSON text.
CREATE OR REPLACE FUNCTION public.search_table_rows_fuzzy(
  filter_workspace_id uuid,
  search_text text,
  filter_table_ids uuid[] DEFAULT NULL,
  filter_project_ids uuid[] DEFAULT NULL,
  filter_row_ids uuid[] DEFAULT NULL,
  result_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  data jsonb,
  "order" integer,
  table_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  table_title text,
  project_id uuid,
  project_name text,
  score real
)
LANGUAGE sql
STABLE
AS $$
  WITH ranked AS (
    SELECT
      r.id,
      r.data,
      r."order",
      r.table_id,
      r.created_at,
      r.updated_at,
      t.title AS table_title,
      t.project_id,
      p.name AS project_name,
      GREATEST(
        similarity(lower(COALESCE(t.title, '')), lower(search_text)),
        similarity(lower(COALESCE(r.data::text, '')), lower(search_text)),
        word_similarity(lower(search_text), lower(COALESCE(t.title, ''))),
        word_similarity(lower(search_text), lower(COALESCE(r.data::text, '')))
      )::real AS score
    FROM table_rows r
    INNER JOIN tables t ON t.id = r.table_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.workspace_id = filter_workspace_id
      AND (filter_table_ids IS NULL OR r.table_id = ANY(filter_table_ids))
      AND (filter_project_ids IS NULL OR t.project_id = ANY(filter_project_ids))
      AND (filter_row_ids IS NULL OR r.id = ANY(filter_row_ids))
      AND (
        lower(COALESCE(t.title, '')) % lower(search_text)
        OR lower(COALESCE(r.data::text, '')) % lower(search_text)
        OR lower(COALESCE(t.title, '')) LIKE ('%' || lower(search_text) || '%')
        OR lower(COALESCE(r.data::text, '')) LIKE ('%' || lower(search_text) || '%')
      )
  )
  SELECT *
  FROM ranked
  ORDER BY score DESC, "order" ASC
  LIMIT GREATEST(1, COALESCE(result_limit, 200));
$$;

-- Primary fuzzy matcher for tag discovery across entity_properties tags,
-- including table-row tags.
CREATE OR REPLACE FUNCTION public.search_tags_fuzzy(
  filter_workspace_id uuid,
  search_text text,
  result_limit integer DEFAULT 200
)
RETURNS TABLE (
  id text,
  name text,
  color text,
  score real
)
LANGUAGE sql
STABLE
AS $$
  WITH raw_tags AS (
    SELECT
      tag_item AS tag
    FROM entity_properties ep
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(ep.value) = 'array' THEN ep.value
        ELSE jsonb_build_array(ep.value)
      END
    ) AS tag_item
    WHERE ep.workspace_id = filter_workspace_id
      AND ep.field_type = 'tags'
      AND ep.entity_type IN ('task', 'block', 'timeline_event', 'table_row')
  ),
  normalized AS (
    SELECT
      COALESCE(
        NULLIF(tag->>'id', ''),
        NULLIF(tag->>'value', ''),
        NULLIF(tag->>'name', ''),
        NULLIF(tag->>'label', ''),
        NULLIF(TRIM(BOTH '"' FROM tag::text), '')
      ) AS id,
      COALESCE(
        NULLIF(tag->>'name', ''),
        NULLIF(tag->>'label', ''),
        NULLIF(tag->>'value', ''),
        NULLIF(TRIM(BOTH '"' FROM tag::text), '')
      ) AS name,
      NULLIF(tag->>'color', '') AS color
    FROM raw_tags
    WHERE tag IS NOT NULL
  ),
  deduped AS (
    SELECT DISTINCT ON (lower(name))
      COALESCE(id, name) AS id,
      name,
      color,
      GREATEST(
        similarity(lower(name), lower(search_text)),
        word_similarity(lower(search_text), lower(name))
      )::real AS score
    FROM normalized
    WHERE name IS NOT NULL
      AND name <> ''
      AND (
        lower(name) % lower(search_text)
        OR word_similarity(lower(search_text), lower(name)) >= 0.35
        OR lower(name) LIKE ('%' || lower(search_text) || '%')
      )
    ORDER BY lower(name), score DESC
  )
  SELECT id, name, color, score
  FROM deduped
  ORDER BY score DESC, name ASC
  LIMIT GREATEST(1, COALESCE(result_limit, 200));
$$;
