-- Fix RPC to work with float8[] embeddings by casting to vector
DROP FUNCTION IF EXISTS public.match_unstructured_parents(vector, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION public.match_unstructured_parents(
  match_embedding float8[],
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
  SELECT *
  FROM (
    SELECT
      p.id,
      p.source_type,
      p.source_id,
      p.summary,
      CASE
        WHEN p.summary_embedding IS NOT NULL
          AND array_length(p.summary_embedding, 1) = 1536
          AND array_length(match_embedding, 1) = 1536
        THEN 1 - ((p.summary_embedding::vector(1536)) <=> (match_embedding::vector(1536)))
        ELSE NULL
      END as similarity
    FROM public.unstructured_parents p
    WHERE p.workspace_id = filter_workspace_id
  ) scored
  WHERE scored.similarity IS NOT NULL
    AND scored.similarity > match_threshold
  ORDER BY scored.similarity DESC
  LIMIT match_count;
END;
$$;
