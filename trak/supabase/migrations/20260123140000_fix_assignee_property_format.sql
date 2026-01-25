-- Migration to convert assignee property values from UUID strings to {id, name} objects
-- This enables searching by assignee name in the AI search layer

-- Update entity_properties where value is a plain UUID string (assignee property)
-- The stored value should be a profile ID, but legacy rows may store workspace_members.id
WITH assignee_updates AS (
  SELECT
    ep.id,
    jsonb_build_object(
      'id', COALESCE(p.id::text, pm.id::text, src.assignee_raw_id),
      'name', COALESCE(p.name, p.email, pm.name, pm.email, 'Unknown')
    ) AS new_value
  FROM entity_properties ep
  JOIN property_definitions pd ON ep.property_definition_id = pd.id
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN jsonb_typeof(ep.value) = 'object' THEN ep.value->>'id'
        ELSE ep.value::text
      END AS assignee_raw_id
  ) src
  -- Try direct profile lookup first (profile id stored)
  LEFT JOIN profiles p ON p.id = (src.assignee_raw_id)::uuid
  -- If the value is a workspace_members.id, map to profiles via user_id
  LEFT JOIN workspace_members wm ON wm.id = (src.assignee_raw_id)::uuid AND p.id IS NULL
  LEFT JOIN profiles pm ON pm.id = wm.user_id
  WHERE pd.name = 'Assignee'
    AND pd.type = 'person'
    AND (
      (jsonb_typeof(ep.value) = 'string' AND ep.value::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      OR
      (jsonb_typeof(ep.value) = 'object' AND (ep.value->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    )
)
UPDATE entity_properties
SET value = assignee_updates.new_value
FROM assignee_updates
WHERE entity_properties.id = assignee_updates.id;
