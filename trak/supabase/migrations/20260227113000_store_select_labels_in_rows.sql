-- Store select-like table row values as canonical labels instead of option IDs.
-- Accept both IDs and labels as input, but persist labels for select/status/priority/multi_select paths
-- that go through _resolve_option_id/_resolve_option_id_or_null.

CREATE OR REPLACE FUNCTION public._resolve_option_id(p_options jsonb, p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_text text;
  v_opt jsonb;
BEGIN
  IF p_options IS NULL THEN
    RETURN p_value;
  END IF;

  IF jsonb_typeof(p_value) = 'string' THEN
    v_text := trim(both '"' from p_value::text);
  ELSE
    v_text := p_value::text;
  END IF;

  -- Match by id
  SELECT opt INTO v_opt
  FROM jsonb_array_elements(p_options) AS opt
  WHERE lower(opt->>'id') = lower(v_text)
  LIMIT 1;

  IF v_opt IS NOT NULL THEN
    RETURN to_jsonb(v_opt->>'label');
  END IF;

  -- Match by label
  SELECT opt INTO v_opt
  FROM jsonb_array_elements(p_options) AS opt
  WHERE lower(opt->>'label') = lower(v_text)
  LIMIT 1;

  IF v_opt IS NOT NULL THEN
    RETURN to_jsonb(v_opt->>'label');
  END IF;

  RETURN p_value;
END;
$$;

CREATE OR REPLACE FUNCTION public._resolve_option_id_or_null(p_options jsonb, p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_text text;
  v_opt jsonb;
BEGIN
  IF p_options IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(p_value) = 'string' THEN
    v_text := trim(both '"' from p_value::text);
  ELSE
    v_text := p_value::text;
  END IF;

  -- Match by id
  SELECT opt INTO v_opt
  FROM jsonb_array_elements(p_options) AS opt
  WHERE lower(opt->>'id') = lower(v_text)
  LIMIT 1;

  IF v_opt IS NOT NULL THEN
    RETURN to_jsonb(v_opt->>'label');
  END IF;

  -- Match by label
  SELECT opt INTO v_opt
  FROM jsonb_array_elements(p_options) AS opt
  WHERE lower(opt->>'label') = lower(v_text)
  LIMIT 1;

  IF v_opt IS NOT NULL THEN
    RETURN to_jsonb(v_opt->>'label');
  END IF;

  RETURN NULL;
END;
$$;
