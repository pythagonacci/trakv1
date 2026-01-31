-- RPC Function for Parent Gating (Vector Similarity Search)
CREATE OR REPLACE FUNCTION match_unstructured_parents(
  match_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_workspace_id uuid
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id uuid,
  summary text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.source_type,
    p.source_id,
    p.summary,
    1 - (p.summary_embedding <=> match_embedding) as similarity
  FROM public.unstructured_parents p
  WHERE p.workspace_id = filter_workspace_id
  AND 1 - (p.summary_embedding <=> match_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
