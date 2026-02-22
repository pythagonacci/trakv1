# Properties Refactor — DB Audit Results

Paste your query results below each section. Run queries from `PROPERTIES_REFACTOR_DB_AUDIT.sql` one block at a time and paste the output here.

---

## 1. entity_properties schema

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "column_name": "entity_type",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "entity_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "property_definition_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "value",
    "data_type": "jsonb",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "workspace_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "column_name": "entity_subtype",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "field_name",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "field_type",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  }
]

## 2. entity_properties constraints & indexes

<!-- Paste results from RUN SEPARATELY: 2 -->

```
(paste here)
```
[
  {
    "indexname": "entity_properties_pkey1",
    "indexdef": "CREATE UNIQUE INDEX entity_properties_pkey1 ON public.entity_properties USING btree (id)"
  },
  {
    "indexname": "entity_properties_entity_property_unique",
    "indexdef": "CREATE UNIQUE INDEX entity_properties_entity_property_unique ON public.entity_properties USING btree (entity_type, entity_id, property_definition_id)"
  },
  {
    "indexname": "idx_entity_properties_property_definition",
    "indexdef": "CREATE INDEX idx_entity_properties_property_definition ON public.entity_properties USING btree (property_definition_id)"
  },
  {
    "indexname": "idx_entity_properties_value_gin",
    "indexdef": "CREATE INDEX idx_entity_properties_value_gin ON public.entity_properties USING gin (value)"
  },
  {
    "indexname": "idx_entity_props_workspace_propdef_entity",
    "indexdef": "CREATE INDEX idx_entity_props_workspace_propdef_entity ON public.entity_properties USING btree (workspace_id, property_definition_id, entity_type, entity_id)"
  },
  {
    "indexname": "idx_entity_props_value_gin",
    "indexdef": "CREATE INDEX idx_entity_props_value_gin ON public.entity_properties USING gin (value)"
  },
  {
    "indexname": "idx_entity_props_entity",
    "indexdef": "CREATE INDEX idx_entity_props_entity ON public.entity_properties USING btree (entity_type, entity_id, workspace_id)"
  },
  {
    "indexname": "idx_entity_props_entity_id",
    "indexdef": "CREATE INDEX idx_entity_props_entity_id ON public.entity_properties USING btree (entity_id)"
  },
  {
    "indexname": "idx_entity_properties_entity_type_subtype",
    "indexdef": "CREATE INDEX idx_entity_properties_entity_type_subtype ON public.entity_properties USING btree (entity_type, entity_subtype)"
  },
  {
    "indexname": "idx_entity_properties_unique_named_field",
    "indexdef": "CREATE UNIQUE INDEX idx_entity_properties_unique_named_field ON public.entity_properties USING btree (entity_type, entity_id, field_name)"
  },
  {
    "indexname": "idx_entity_properties_entity_id_entity_type",
    "indexdef": "CREATE INDEX idx_entity_properties_entity_id_entity_type ON public.entity_properties USING btree (entity_id, entity_type)"
  },
  {
    "indexname": "idx_entity_properties_workspace_field_type",
    "indexdef": "CREATE INDEX idx_entity_properties_workspace_field_type ON public.entity_properties USING btree (workspace_id, field_type)"
  },
  {
    "indexname": "idx_entity_properties_entity_field_type",
    "indexdef": "CREATE INDEX idx_entity_properties_entity_field_type ON public.entity_properties USING btree (entity_id, field_type)"
  }
]
---

## 3. entity_properties sample data (20 rows)

<!-- Paste results from RUN SEPARATELY: 3 -->

```
(paste here)
```[
  {
    "id": "804788df-3fe6-4f1d-b201-53b84b0ae624",
    "entity_type": "block",
    "entity_id": "6a7dde33-5011-42e7-b364-78ded65373d3",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "Priority",
    "field_type": "priority",
    "value": "medium",
    "created_at": "2026-02-21 19:09:21.462907+00",
    "updated_at": "2026-02-21 19:09:21.462907+00"
  },
  {
    "id": "1e4d3ad0-3d4c-471c-92fe-44f47609b141",
    "entity_type": "task",
    "entity_id": "8c425fc4-322c-439b-8556-12ab72e2848c",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "ty edh",
    "field_type": "priority",
    "value": "medium",
    "created_at": "2026-02-21 19:08:46.539407+00",
    "updated_at": "2026-02-21 19:08:46.539407+00"
  },
  {
    "id": "679888ee-080f-40e3-aa46-c3ed26dddecc",
    "entity_type": "task",
    "entity_id": "8c425fc4-322c-439b-8556-12ab72e2848c",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "Priority",
    "field_type": "priority",
    "value": "medium",
    "created_at": "2026-02-21 19:08:46.500205+00",
    "updated_at": "2026-02-21 19:08:46.500205+00"
  },
  {
    "id": "194986a8-36e0-4adc-8fdf-3151d5f74561",
    "entity_type": "table_row",
    "entity_id": "f501831e-07a8-4ac4-9bf3-d2db5c41a339",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": "90820491-52a4-4486-8c05-0367b6299273",
    "field_name": "Status",
    "field_type": "status",
    "value": "todo",
    "created_at": "2026-02-21 18:42:18.107242+00",
    "updated_at": "2026-02-21 18:42:18.661729+00"
  },
  {
    "id": "d6ffbce0-4163-4fd6-b147-479e29458e09",
    "entity_type": "table_row",
    "entity_id": "f501831e-07a8-4ac4-9bf3-d2db5c41a339",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": "95010ab5-4a9c-4667-bb80-92fea629553b",
    "field_name": "Priority",
    "field_type": "priority",
    "value": "high",
    "created_at": "2026-02-21 18:42:17.975134+00",
    "updated_at": "2026-02-21 18:42:18.594872+00"
  },
  {
    "id": "a358ebd7-2484-473f-90b5-fc1038d831fc",
    "entity_type": "table_row",
    "entity_id": "e396b0bb-be70-4ee6-84b2-982365942729",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": "90820491-52a4-4486-8c05-0367b6299273",
    "field_name": "Status",
    "field_type": "status",
    "value": "in_progress",
    "created_at": "2026-02-21 18:03:25.022486+00",
    "updated_at": "2026-02-21 18:03:25.696409+00"
  },
  {
    "id": "adfbca59-ee2c-4658-abad-1a0c2652798b",
    "entity_type": "table_row",
    "entity_id": "e30a1191-d4fb-4422-a757-e4ed71e274fa",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "MARKETING STATUS",
    "field_type": "status",
    "value": "todo",
    "created_at": "2026-02-20 20:33:05.622741+00",
    "updated_at": "2026-02-20 20:33:05.622741+00"
  },
  {
    "id": "37ec7760-097a-4392-a556-76c285243341",
    "entity_type": "table_row",
    "entity_id": "e30a1191-d4fb-4422-a757-e4ed71e274fa",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "Code Status",
    "field_type": "status",
    "value": "in_progress",
    "created_at": "2026-02-20 20:33:00.73366+00",
    "updated_at": "2026-02-20 20:33:00.73366+00"
  },
  {
    "id": "e4105caa-06c8-4b77-9715-24b46dae4a8c",
    "entity_type": "table_row",
    "entity_id": "6adce469-f85d-48d1-8fb5-a43863ac4e33",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "priority",
    "field_type": "priority",
    "value": "low",
    "created_at": "2026-02-20 00:25:23.50188+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "9aa7fe4d-3cf2-4952-b022-8e9fa5a6ce2a",
    "entity_type": "table_row",
    "entity_id": "ee391fb6-3a9d-47f5-8cd0-15f9b9b8ff5f",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "priority",
    "field_type": "priority",
    "value": "high",
    "created_at": "2026-02-20 00:25:23.50188+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "b18fbd10-f83e-4d55-b839-760a151cb013",
    "entity_type": "table_row",
    "entity_id": "15bdad41-5894-4e16-aea6-94a918d3e4ed",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "IMPACT PRIORTY",
    "field_type": "priority",
    "value": "high",
    "created_at": "2026-02-20 00:25:23.50188+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "ef4b0e73-79c5-4f4e-9e0f-0fed49bf1d09",
    "entity_type": "table_row",
    "entity_id": "9285cf61-1764-4113-b55e-2ab8f5bd4f39",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "priority",
    "field_type": "priority",
    "value": "medium",
    "created_at": "2026-02-20 00:25:23.50188+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "30fc795b-8b41-4f89-8ea7-f776814f051c",
    "entity_type": "table_row",
    "entity_id": "15bdad41-5894-4e16-aea6-94a918d3e4ed",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "execution priority",
    "field_type": "priority",
    "value": "pri_2",
    "created_at": "2026-02-20 00:25:23.50188+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "eb3d3170-9441-4ec4-b53a-b3bc9262594f",
    "entity_type": "table_row",
    "entity_id": "a203e27a-7113-43cc-82d9-1007308511f0",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "travel date",
    "field_type": "due_date",
    "value": {
      "end": "2026-02-20",
      "start": "2026-02-20"
    },
    "created_at": "2026-02-19 20:51:17.837012+00",
    "updated_at": "2026-02-19 20:51:17.837012+00"
  },
  {
    "id": "55229aa5-c48f-468c-a7f0-b0fe3bd3a277",
    "entity_type": "table_row",
    "entity_id": "a203e27a-7113-43cc-82d9-1007308511f0",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "visit priority",
    "field_type": "priority",
    "value": "high",
    "created_at": "2026-02-19 20:50:51.806101+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "1bef8891-045b-4f3d-b4e4-0f4467d9bc01",
    "entity_type": "table_row",
    "entity_id": "a203e27a-7113-43cc-82d9-1007308511f0",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "flight priority",
    "field_type": "priority",
    "value": "urgent",
    "created_at": "2026-02-19 20:50:42.735229+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "91f1e84e-672f-406d-b796-d9141830e18a",
    "entity_type": "table_row",
    "entity_id": "3eaa5b2f-c360-4733-9593-d9f27b148eb4",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "budget priority",
    "field_type": "priority",
    "value": "high",
    "created_at": "2026-02-19 18:58:37.516944+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "d7c1df05-e853-4121-8f7b-fd6b2089c7c1",
    "entity_type": "table_row",
    "entity_id": "3eaa5b2f-c360-4733-9593-d9f27b148eb4",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "execution priority",
    "field_type": "priority",
    "value": "urgent",
    "created_at": "2026-02-19 18:58:25.813832+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "0c3d0309-ce7d-4fd9-a2e5-e1ccd4bd2955",
    "entity_type": "table_row",
    "entity_id": "b204ed0a-9a50-4c76-a6fb-103f94e9c2e8",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "budget priority",
    "field_type": "priority",
    "value": "urgent",
    "created_at": "2026-02-19 18:40:45.431515+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  },
  {
    "id": "26aa7908-a40a-433c-b3ca-4e5969b67c89",
    "entity_type": "table_row",
    "entity_id": "b204ed0a-9a50-4c76-a6fb-103f94e9c2e8",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "property_definition_id": null,
    "field_name": "execution priority",
    "field_type": "priority",
    "value": "low",
    "created_at": "2026-02-19 18:40:37.825009+00",
    "updated_at": "2026-02-20 00:25:23.50188+00"
  }
]

---

## 4. entity_properties counts by entity_type

<!-- Paste results from RUN SEPARATELY: 4 -->

```
[
  {
    "entity_type": "table_row",
    "count": 30
  },
  {
    "entity_type": "subtask",
    "count": 23
  },
  {
    "entity_type": "task",
    "count": 23
  },
  {
    "entity_type": "block",
    "count": 6
  }
]
```

---

## 5. entity_properties: with vs without property_definition_id

<!-- Paste results from RUN SEPARATELY: 5 -->

```[
  {
    "kind": "no_property_definition_id",
    "count": 21
  },
  {
    "kind": "has_property_definition_id",
    "count": 61
  }
]
(paste here)
```

---

## 6. entity_properties: entities with multiple properties

<!-- Paste results from RUN SEPARATELY: 6 -->

```
(paste here)[
  {
    "entity_type": "subtask",
    "entity_id": "4c0b83ce-ecf1-475f-b6d8-181e3769136a",
    "prop_count": 4,
    "field_types": [
      "assignee",
      "due_date",
      "priority",
      "status"
    ],
    "field_names": [
      "Assignee",
      "Due Date",
      "Priority",
      "Status"
    ]
  },
  {
    "entity_type": "subtask",
    "entity_id": "7765e580-b5de-408d-ab1d-b2e15079eee8",
    "prop_count": 4,
    "field_types": [
      "assignee",
      "due_date",
      "priority",
      "status"
    ],
    "field_names": [
      "Assignee",
      "Due Date",
      "Priority",
      "Status"
    ]
  },
  {
    "entity_type": "subtask",
    "entity_id": "906bdee3-c431-4de5-8878-a74db24b4cc7",
    "prop_count": 4,
    "field_types": [
      "assignee",
      "due_date",
      "priority",
      "status"
    ],
    "field_names": [
      "Assignee",
      "Due Date",
      "Priority",
      "Status"
    ]
  },
  {
    "entity_type": "subtask",
    "entity_id": "a0d0cece-a25f-429a-b266-d633934c32b7",
    "prop_count": 3,
    "field_types": [
      "assignee",
      "due_date",
      "status"
    ],
    "field_names": [
      "Assignee",
      "Due Date",
      "Status"
    ]
  },
  {
    "entity_type": "subtask",
    "entity_id": "a43ab2dd-c592-4bf8-a72e-d5e6cebc80c4",
    "prop_count": 3,
    "field_types": [
      "assignee",
      "due_date",
      "status"
    ],
    "field_names": [
      "Assignee",
      "Due Date",
      "Status"
    ]
  },
  {
    "entity_type": "subtask",
    "entity_id": "bc9a9d5c-18d6-45d2-a1c4-bd3f43f736b9",
    "prop_count": 4,
    "field_types": [
      "assignee",
      "due_date",
      "priority",
      "status"
    ],
    "field_names": [
      "Assignee",
      "Due Date",
      "Priority",
      "Status"
    ]
  },
  {
    "entity_type": "table_row",
    "entity_id": "098acaec-b6c4-473c-8735-4611bfc4dad7",
    "prop_count": 2,
    "field_types": [
      "priority",
      "status"
    ],
    "field_names": [
      "Priority",
      "Status"
    ]
  },
  {
    "entity_type": "table_row",
    "entity_id": "1163b1f3-6b53-4444-ab5f-227eb5ffc7c6",
    "prop_count": 2,
    "field_types": [
      "priority"
    ],
    "field_names": [
      "budget priority",
      "Execution priority"
    ]
  },
  {
    "entity_type": "table_row",
    "entity_id": "15bdad41-5894-4e16-aea6-94a918d3e4ed",
    "prop_count": 2,
    "field_types": [
      "priority"
    ],
    "field_names": [
      "execution priority",
      "IMPACT PRIORTY"
    ]
  },
  {
    "entity_type": "table_row",
    "entity_id": "3eaa5b2f-c360-4733-9593-d9f27b148eb4",
    "prop_count": 2,
    "field_types": [
      "priority"
    ],
    "field_names": [
      "budget priority",
      "execution priority"
    ]
  }
]
```

---

## 7. property_definitions full contents

<!-- Paste results from RUN SEPARATELY: 7 -->

```
(paste here)[
  {
    "id": "55f4113f-53b3-49e7-94ad-0f52a828d412",
    "workspace_id": "073d7793-8459-4f2c-92f2-063f9e0747e4",
    "name": "Priority",
    "type": "select",
    "options": [
      {
        "id": "low",
        "color": "#6b7280",
        "label": "Low"
      },
      {
        "id": "medium",
        "color": "#f59e0b",
        "label": "Medium"
      },
      {
        "id": "high",
        "color": "#f97316",
        "label": "High"
      },
      {
        "id": "urgent",
        "color": "#ef4444",
        "label": "Urgent"
      }
    ],
    "created_at": "2026-02-09 17:39:52.086595+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  },
  {
    "id": "d453ab48-92a1-4d6a-8e0c-ed7397b5be60",
    "workspace_id": "073d7793-8459-4f2c-92f2-063f9e0747e4",
    "name": "Status",
    "type": "select",
    "options": [
      {
        "id": "todo",
        "color": "#6b7280",
        "label": "To Do"
      },
      {
        "id": "in_progress",
        "color": "#3b82f6",
        "label": "In Progress"
      },
      {
        "id": "done",
        "color": "#10b981",
        "label": "Done"
      },
      {
        "id": "blocked",
        "color": "#ef4444",
        "label": "Blocked"
      }
    ],
    "created_at": "2026-02-09 17:39:52.086595+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  },
  {
    "id": "a17eb0c5-c18f-48ff-b9bd-23f2636105a4",
    "workspace_id": "231df22c-2094-4726-9999-4860734551d7",
    "name": "Priority",
    "type": "select",
    "options": [
      {
        "id": "low",
        "color": "#6b7280",
        "label": "Low"
      },
      {
        "id": "medium",
        "color": "#f59e0b",
        "label": "Medium"
      },
      {
        "id": "high",
        "color": "#f97316",
        "label": "High"
      },
      {
        "id": "urgent",
        "color": "#ef4444",
        "label": "Urgent"
      }
    ],
    "created_at": "2026-02-09 17:39:52.086595+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  },
  {
    "id": "552fdb48-2cf3-4c41-b56b-e6967bc74e68",
    "workspace_id": "231df22c-2094-4726-9999-4860734551d7",
    "name": "Status",
    "type": "select",
    "options": [
      {
        "id": "todo",
        "color": "#6b7280",
        "label": "To Do"
      },
      {
        "id": "in_progress",
        "color": "#3b82f6",
        "label": "In Progress"
      },
      {
        "id": "done",
        "color": "#10b981",
        "label": "Done"
      },
      {
        "id": "blocked",
        "color": "#ef4444",
        "label": "Blocked"
      }
    ],
    "created_at": "2026-02-09 17:39:52.086595+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  },
  {
    "id": "2c931223-f1fe-44fe-93e2-c2e0649dfd67",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "name": "Assignee",
    "type": "person",
    "options": [],
    "created_at": "2026-01-22 02:56:46.899476+00",
    "updated_at": "2026-01-22 02:56:46.899476+00"
  },
  {
    "id": "abaf4914-06cb-4e4c-8393-55f173522e4f",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "name": "Due Date",
    "type": "date",
    "options": [],
    "created_at": "2026-01-22 02:56:46.899476+00",
    "updated_at": "2026-01-22 02:56:46.899476+00"
  },
  {
    "id": "95010ab5-4a9c-4667-bb80-92fea629553b",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "name": "Priority",
    "type": "select",
    "options": [
      {
        "id": "low",
        "color": "#6b7280",
        "label": "Low"
      },
      {
        "id": "medium",
        "color": "#f59e0b",
        "label": "Medium"
      },
      {
        "id": "high",
        "color": "#f97316",
        "label": "High"
      },
      {
        "id": "urgent",
        "color": "#ef4444",
        "label": "Urgent"
      }
    ],
    "created_at": "2026-01-22 02:56:46.899476+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  },
  {
    "id": "90820491-52a4-4486-8c05-0367b6299273",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "name": "Status",
    "type": "select",
    "options": [
      {
        "id": "todo",
        "color": "#6b7280",
        "label": "To Do"
      },
      {
        "id": "in_progress",
        "color": "#3b82f6",
        "label": "In Progress"
      },
      {
        "id": "done",
        "color": "#10b981",
        "label": "Done"
      },
      {
        "id": "blocked",
        "color": "#ef4444",
        "label": "Blocked"
      }
    ],
    "created_at": "2026-01-22 02:56:46.899476+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  },
  {
    "id": "24de8b0a-1d7f-4be0-9b29-693da3a4bc2c",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "name": "Tags",
    "type": "multi_select",
    "options": [],
    "created_at": "2026-01-22 02:56:46.899476+00",
    "updated_at": "2026-01-22 02:56:46.899476+00"
  },
  {
    "id": "57441265-f7da-4b0b-bcf6-91681b8940ef",
    "workspace_id": "78f1b60d-d378-4cfd-b86a-5526948540ef",
    "name": "Priority",
    "type": "select",
    "options": [
      {
        "id": "low",
        "color": "#6b7280",
        "label": "Low"
      },
      {
        "id": "medium",
        "color": "#f59e0b",
        "label": "Medium"
      },
      {
        "id": "high",
        "color": "#f97316",
        "label": "High"
      },
      {
        "id": "urgent",
        "color": "#ef4444",
        "label": "Urgent"
      }
    ],
    "created_at": "2026-02-09 17:39:52.086595+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  },
  {
    "id": "6b938511-b899-4d0e-895b-a047bd842669",
    "workspace_id": "78f1b60d-d378-4cfd-b86a-5526948540ef",
    "name": "Status",
    "type": "select",
    "options": [
      {
        "id": "todo",
        "color": "#6b7280",
        "label": "To Do"
      },
      {
        "id": "in_progress",
        "color": "#3b82f6",
        "label": "In Progress"
      },
      {
        "id": "done",
        "color": "#10b981",
        "label": "Done"
      },
      {
        "id": "blocked",
        "color": "#ef4444",
        "label": "Blocked"
      }
    ],
    "created_at": "2026-02-09 17:39:52.086595+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  },
  {
    "id": "be826be6-610d-4f63-a42f-3cfc36266839",
    "workspace_id": "eecf01f0-80fd-49a8-9c43-a246f7224ece",
    "name": "Priority",
    "type": "select",
    "options": [
      {
        "id": "low",
        "color": "#6b7280",
        "label": "Low"
      },
      {
        "id": "medium",
        "color": "#f59e0b",
        "label": "Medium"
      },
      {
        "id": "high",
        "color": "#f97316",
        "label": "High"
      },
      {
        "id": "urgent",
        "color": "#ef4444",
        "label": "Urgent"
      }
    ],
    "created_at": "2026-02-09 17:39:52.086595+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  },
  {
    "id": "1a52cdb6-642c-469f-bb0c-c733087bf404",
    "workspace_id": "eecf01f0-80fd-49a8-9c43-a246f7224ece",
    "name": "Status",
    "type": "select",
    "options": [
      {
        "id": "todo",
        "color": "#6b7280",
        "label": "To Do"
      },
      {
        "id": "in_progress",
        "color": "#3b82f6",
        "label": "In Progress"
      },
      {
        "id": "done",
        "color": "#10b981",
        "label": "Done"
      },
      {
        "id": "blocked",
        "color": "#ef4444",
        "label": "Blocked"
      }
    ],
    "created_at": "2026-02-09 17:39:52.086595+00",
    "updated_at": "2026-02-09 17:39:52.086595+00"
  }
]
```

---

## 8. property_definitions counts per workspace

<!-- Paste results from RUN SEPARATELY: 8 -->

```
(paste here)
```[
  {
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "def_count": 5,
    "names": [
      "Assignee",
      "Due Date",
      "Priority",
      "Status",
      "Tags"
    ]
  },
  {
    "workspace_id": "073d7793-8459-4f2c-92f2-063f9e0747e4",
    "def_count": 2,
    "names": [
      "Priority",
      "Status"
    ]
  },
  {
    "workspace_id": "231df22c-2094-4726-9999-4860734551d7",
    "def_count": 2,
    "names": [
      "Priority",
      "Status"
    ]
  },
  {
    "workspace_id": "78f1b60d-d378-4cfd-b86a-5526948540ef",
    "def_count": 2,
    "names": [
      "Priority",
      "Status"
    ]
  },
  {
    "workspace_id": "eecf01f0-80fd-49a8-9c43-a246f7224ece",
    "def_count": 2,
    "names": [
      "Priority",
      "Status"
    ]
  }
]

---

## 9. table_fields with property_definition_id

<!-- Paste results from RUN SEPARATELY: 9 -->

```
([
  {
    "id": "8b4ac685-1b3a-4003-b78a-35570052573a",
    "table_id": "0f6873c9-f064-46c8-9885-f1a54b4e8627",
    "name": "Code Status",
    "type": "status",
    "property_definition_id": "90820491-52a4-4486-8c05-0367b6299273",
    "pd_name": "Status",
    "pd_type": "select"
  },
  {
    "id": "d7588183-8b77-43d0-8914-92e92b155f59",
    "table_id": "0f6873c9-f064-46c8-9885-f1a54b4e8627",
    "name": "Marketing Status",
    "type": "status",
    "property_definition_id": "90820491-52a4-4486-8c05-0367b6299273",
    "pd_name": "Status",
    "pd_type": "select"
  },
  {
    "id": "da5683af-f717-48d1-931a-006d1d133e8a",
    "table_id": "44bace06-d9ef-4fbe-9687-2e11693a8394",
    "name": "Visit Priority",
    "type": "priority",
    "property_definition_id": "95010ab5-4a9c-4667-bb80-92fea629553b",
    "pd_name": "Priority",
    "pd_type": "select"
  },
  {
    "id": "a18ad4f7-c6fb-43d4-8f2c-ec6ce4eb58b1",
    "table_id": "44bace06-d9ef-4fbe-9687-2e11693a8394",
    "name": "Status",
    "type": "status",
    "property_definition_id": "90820491-52a4-4486-8c05-0367b6299273",
    "pd_name": "Status",
    "pd_type": "select"
  },
  {
    "id": "c0d4963d-bf4b-4ecd-a547-4da3cb04cb5f",
    "table_id": "44bace06-d9ef-4fbe-9687-2e11693a8394",
    "name": "Flight Priority",
    "type": "priority",
    "property_definition_id": "95010ab5-4a9c-4667-bb80-92fea629553b",
    "pd_name": "Priority",
    "pd_type": "select"
  },
  {
    "id": "4cc31ca0-cb94-4990-906b-7a7a5984ec05",
    "table_id": "5c1edd9a-aba4-4746-8650-6c42cc2b83cf",
    "name": "priority",
    "type": "priority",
    "property_definition_id": "95010ab5-4a9c-4667-bb80-92fea629553b",
    "pd_name": "Priority",
    "pd_type": "select"
  },
  {
    "id": "6ae3b3b3-b66d-4796-ab42-11d8c6e9de0b",
    "table_id": "cd349e8e-444c-483d-bf04-19f4fa7c3c47",
    "name": "MARKETING STATUS",
    "type": "status",
    "property_definition_id": "90820491-52a4-4486-8c05-0367b6299273",
    "pd_name": "Status",
    "pd_type": "select"
  },
  {
    "id": "07b89fe2-3b7f-4609-a0e7-751dfe367bff",
    "table_id": "cd349e8e-444c-483d-bf04-19f4fa7c3c47",
    "name": "Code Status",
    "type": "status",
    "property_definition_id": "90820491-52a4-4486-8c05-0367b6299273",
    "pd_name": "Status",
    "pd_type": "select"
  }
]
```

---

## 10. table_fields: with/without property_definition_id by type

<!-- Paste results from RUN SEPARATELY: 10 -->

```
[
  {
    "type": "date",
    "with_pd": 0,
    "without_pd": 2
  },
  {
    "type": "priority",
    "with_pd": 3,
    "without_pd": 10
  },
  {
    "type": "status",
    "with_pd": 5,
    "without_pd": 0
  },
  {
    "type": "subtask",
    "with_pd": 0,
    "without_pd": 1
  },
  {
    "type": "text",
    "with_pd": 0,
    "without_pd": 10
  }
]
```

---

## 11. task_items priorities (JSONB) sample

<!-- Paste results from RUN SEPARATELY: 11 -->

```
[
  {
    "id": "3305ab7b-5531-42b7-b7ad-3c2663ae5387",
    "title": "buy cocoa powder",
    "status": "todo",
    "priorities": [
      {
        "value": "low",
        "field_name": "Priority"
      }
    ],
    "created_at": "2026-02-21 19:12:33.303614+00"
  },
  {
    "id": "8c425fc4-322c-439b-8556-12ab72e2848c",
    "title": "New task",
    "status": "todo",
    "priorities": [
      {
        "value": "medium",
        "field_name": "ty edh"
      },
      {
        "value": "medium",
        "field_name": "Priority"
      }
    ],
    "created_at": "2026-02-21 19:07:45.880173+00"
  },
  {
    "id": "bcb8edfb-df2b-4a0d-abee-5d2989996302",
    "title": "Timeline Re-Design",
    "status": "todo",
    "priorities": [
      {
        "value": "low",
        "field_name": "Priority"
      }
    ],
    "created_at": "2026-02-14 03:47:54.128402+00"
  },
  {
    "id": "9a63ed62-6ca8-41c3-8823-bf9efecd5413",
    "title": "tpe dihs",
    "status": "todo",
    "priorities": [
      {
        "value": "medium",
        "field_name": "Priority"
      }
    ],
    "created_at": "2026-02-19 03:02:06.441195+00"
  },
  {
    "id": "a40eaf25-2d65-4e93-94bc-0e61daa5de86",
    "title": "Test 1",
    "status": "todo",
    "priorities": [
      {
        "value": "high",
        "field_name": "Priority"
      }
    ],
    "created_at": "2026-02-19 18:17:47.014981+00"
  },
  {
    "id": "977dedc3-d6b5-4576-92d4-49ccfd04d3be",
    "title": "Timeline Re-Design",
    "status": "todo",
    "priorities": [
      {
        "value": "high",
        "field_name": "Priority"
      }
    ],
    "created_at": "2026-02-13 19:49:41.727724+00"
  },
  {
    "id": "bcc797bf-b295-47f2-94b5-5ffd1e1f3343",
    "title": "AI Mentioning Entities ",
    "status": "todo",
    "priorities": [
      {
        "value": "urgent",
        "field_name": "Priority"
      }
    ],
    "created_at": "2026-02-13 19:53:17.855417+00"
  },
  {
    "id": "a2f06ab8-7cda-4e1a-855b-b3c22026d468",
    "title": "Source Linking for Other Blocks ",
    "status": "todo",
    "priorities": [
      {
        "value": "high",
        "field_name": "Priority"
      }
    ],
    "created_at": "2026-02-13 19:45:46.455265+00"
  },
  {
    "id": "89b0613d-139a-4f0c-99fb-237395a71d49",
    "title": "Progress + Status Bars/Graphs",
    "status": "todo",
    "priorities": [
      {
        "value": "high",
        "field_name": "Priority"
      }
    ],
    "created_at": "2026-02-13 19:49:12.504314+00"
  }
]
```

---

## 12. task_items status distribution

<!-- Paste results from RUN SEPARATELY: 12 -->

```
[
  {
    "status": "todo",
    "count": 11
  }
]
```

---

## 13. timeline_events status/priority/priorities columns

<!-- Paste results from RUN SEPARATELY: 13 -->

```
[
  {
    "column_name": "priorities",
    "data_type": "jsonb",
    "is_nullable": "NO"
  },
  {
    "column_name": "status",
    "data_type": "text",
    "is_nullable": "NO"
  }
]
```

---

## 14. timeline_events sample (status, priority/priorities)

<!-- Paste results from RUN SEPARATELY: 14 -->

```
Error: Failed to run sql query: ERROR: 42703: column "priority" does not exist LINE 1: SELECT id, title, status, priority, priorities ^ HINT: Perhaps you meant to reference the column "timeline_events.priorities".
```

---

## 15. timeline_events status/priority distribution

<!-- Paste results from RUN SEPARATELY: 15 -->

```
(paste here)
```Error: Failed to run sql query: ERROR: 42703: column "priority" does not exist LINE 2: SELECT priority, COUNT(*) AS count FROM timeline_events WHERE priority IS NOT NULL GROUP BY priority ORDER BY count DESC; ^ HINT: Perhaps you meant to reference the column "timeline_events.priorities".

---

## 16. Triggers on property-related tables

<!-- Paste results from RUN SEPARATELY: 16 -->

```
[
  {
    "trigger_name": "entity_properties_populate_named_fields_trigger",
    "table_name": "entity_properties",
    "function_name": "entity_properties_populate_named_fields"
  },
  {
    "trigger_name": "entity_properties_set_subtype",
    "table_name": "entity_properties",
    "function_name": "entity_properties_set_subtype"
  },
  {
    "trigger_name": "entity_properties_set_updated_at",
    "table_name": "entity_properties",
    "function_name": "entity_properties_set_updated_at"
  },
  {
    "trigger_name": "sync_live_task_properties_to_source_trigger",
    "table_name": "entity_properties",
    "function_name": "sync_live_task_properties_to_source"
  },
  {
    "trigger_name": "property_definitions_set_updated_at",
    "table_name": "property_definitions",
    "function_name": "set_updated_at"
  },
  {
    "trigger_name": "table_fields_set_order",
    "table_name": "table_fields",
    "function_name": "assign_table_field_order"
  },
  {
    "trigger_name": "table_fields_set_updated_at",
    "table_name": "table_fields",
    "function_name": "set_updated_at"
  },
  {
    "trigger_name": "cleanup_entity_properties_on_table_row_delete_trigger",
    "table_name": "table_rows",
    "function_name": "cleanup_entity_properties_on_table_row_delete"
  },
  {
    "trigger_name": "table_rows_set_order",
    "table_name": "table_rows",
    "function_name": "assign_table_row_order"
  },
  {
    "trigger_name": "table_rows_set_updated_at",
    "table_name": "table_rows",
    "function_name": "set_updated_at"
  },
  {
    "trigger_name": "table_rows_validate_data",
    "table_name": "table_rows",
    "function_name": "validate_table_row_data"
  },
  {
    "trigger_name": "cleanup_entity_properties_on_task_delete_trigger",
    "table_name": "task_items",
    "function_name": "cleanup_entity_properties_on_task_delete"
  },
  {
    "trigger_name": "sync_live_task_item_to_source_trigger",
    "table_name": "task_items",
    "function_name": "sync_live_task_item_to_source"
  },
  {
    "trigger_name": "task_items_seed_priorities_from_source_row",
    "table_name": "task_items",
    "function_name": "seed_task_priorities_from_source_row"
  },
  {
    "trigger_name": "task_items_set_display_order",
    "table_name": "task_items",
    "function_name": "set_task_item_display_order"
  },
  {
    "trigger_name": "task_items_set_updated_at",
    "table_name": "task_items",
    "function_name": "set_updated_at"
  },
  {
    "trigger_name": "trigger_set_edited_flag_on_task_item_update",
    "table_name": "task_items",
    "function_name": "set_edited_flag_on_task_item_update"
  },
  {
    "trigger_name": "cleanup_entity_properties_on_timeline_event_delete_trigger",
    "table_name": "timeline_events",
    "function_name": "cleanup_entity_properties_on_timeline_event_delete"
  },
  {
    "trigger_name": "timeline_events_set_updated_at",
    "table_name": "timeline_events",
    "function_name": "set_updated_at"
  },
  {
    "trigger_name": "trigger_set_edited_flag_on_timeline_event_update",
    "table_name": "timeline_events",
    "function_name": "set_edited_flag_on_timeline_event_update"
  }
]
```

---

## 17. Foreign keys referencing property_definitions

<!-- Paste results from RUN SEPARATELY: 17 -->

```[
  {
    "table_schema": "public",
    "table_name": "entity_properties",
    "column_name": "property_definition_id",
    "foreign_table": "property_definitions",
    "foreign_column": "id"
  },
  {
    "table_schema": "public",
    "table_name": "table_fields",
    "column_name": "property_definition_id",
    "foreign_table": "property_definitions",
    "foreign_column": "id"
  }
]

```

---

## 18. entity_properties unique/primary constraints

<!-- Paste results from RUN SEPARATELY: 18 -->

```
[
  {
    "conname": "entity_properties_entity_property_unique",
    "pg_get_constraintdef": "UNIQUE (entity_type, entity_id, property_definition_id)"
  },
  {
    "conname": "entity_properties_pkey1",
    "pg_get_constraintdef": "PRIMARY KEY (id)"
  }
]
```

---

## 19. Tables with status/priority fields

<!-- Paste results from RUN SEPARATELY: 19 -->

```
Error: Failed to run sql query: ERROR: 42703: column t.name does not exist LINE 1: SELECT t.id AS table_id, t.name AS table_name, ^ HINT: Perhaps you meant to reference the column "tf.name".
```

---

## 20. Functions referencing property_definitions or entity_properties

<!-- Paste results from RUN SEPARATELY: 20 -->

```
[
  {
    "routine_name": "_resolve_field_value_with_property_def",
    "routine_definition": "\nDECLARE\n  v_options jsonb;\n  v_item jsonb;\n  v_item_res jsonb;\n  v_result jsonb := '[]'::jsonb;\nBEGIN\n  IF p_field_type IN ('status', 'priority') AND p_property_definition_id IS NOT NULL THEN\n    SELECT options INTO v_options\n    FROM public.property_definitions\n    WHERE id = p_property_definition_id\n    LIMIT 1;\n\n    IF jsonb_typeof(p_value) = 'array' THEN\n      FOR v_item IN SELECT * FROM jsonb_array_elements(p_value) LOOP\n        v_item_res := public._resolve_option_id_or_null(v_options, v_item);\n        IF v_item_res IS NOT NULL THEN\n          v_result := v_result || jsonb_build_array(v_item_res);\n        END IF;\n      END LOOP;\n      RETURN v_result;\n    END IF;\n\n    RETURN public._resolve_option_id_or_null(v_options, p_value);\n  END IF;\n\n  RETURN public._resolve_field_value(p_field_type, p_config, p_value);\nEND;\n"
  },
  {
    "routine_name": "bulk_insert_rows",
    "routine_definition": "\ndeclare\n  v_row jsonb;\n  v_data jsonb;\n  v_order numeric;\n  v_field_name text;\n  v_field_id uuid;\n  v_field_type text;\n  v_field_config jsonb;\n  v_field_prop_def_id uuid;\n  v_table_field_name text;\n  v_cell_value jsonb;\n  v_inserted_ids uuid[] := array[]::uuid[];\n  v_row_id uuid;\n  v_named_fixed_values jsonb;\n  v_fixed_entry record;\n  v_workspace_id uuid;\nbegin\n  select workspace_id into v_workspace_id\n  from public.tables\n  where id = p_table_id;\n\n  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop\n    v_data := '{}'::jsonb;\n    v_named_fixed_values := '{}'::jsonb;\n    v_order := null;\n\n    if v_row ? 'order' then\n      begin\n        v_order := (v_row->>'order')::numeric;\n      exception when invalid_text_representation then\n        v_order := null;\n      end;\n    end if;\n\n    for v_field_name, v_field_id in\n      select key, public._resolve_table_field_id(p_table_id, key)\n      from jsonb_each(coalesce(v_row->'data', '{}'::jsonb))\n    loop\n      if v_field_id is null then\n        continue;\n      end if;\n\n      select name, type, config, property_definition_id\n      into v_table_field_name, v_field_type, v_field_config, v_field_prop_def_id\n      from public.table_fields\n      where id = v_field_id;\n\n      if v_field_type in ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') then\n        continue;\n      end if;\n\n      v_cell_value := public._resolve_field_value_with_property_def(\n        v_field_type,\n        v_field_config,\n        v_field_prop_def_id,\n        (v_row->'data'->v_field_name)\n      );\n\n      if v_cell_value is null then\n        continue;\n      end if;\n\n      v_data := v_data || jsonb_build_object(v_field_id::text, v_cell_value);\n\n      if v_field_type in ('status', 'priority') and v_table_field_name is not null and btrim(v_table_field_name) <> '' then\n        v_named_fixed_values := v_named_fixed_values || jsonb_build_object(\n          v_table_field_name,\n          jsonb_build_object(\n            'field_type', v_field_type,\n            'value', v_cell_value\n          )\n        );\n      end if;\n    end loop;\n\n    insert into public.table_rows (table_id, data, \"order\", created_by, updated_by)\n    values (p_table_id, v_data, v_order, p_created_by, p_created_by)\n    returning id into v_row_id;\n\n    v_inserted_ids := v_inserted_ids || v_row_id;\n\n    for v_fixed_entry in select key, value from jsonb_each(v_named_fixed_values) loop\n      insert into public.entity_properties (\n        entity_type,\n        entity_id,\n        workspace_id,\n        field_name,\n        field_type,\n        value\n      )\n      values (\n        'table_row',\n        v_row_id,\n        v_workspace_id,\n        v_fixed_entry.key,\n        v_fixed_entry.value->>'field_type',\n        v_fixed_entry.value->'value'\n      )\n      on conflict (entity_type, entity_id, field_name)\n      do update set\n        workspace_id = excluded.workspace_id,\n        field_type = excluded.field_type,\n        value = excluded.value,\n        updated_at = now();\n    end loop;\n\n    -- Remove stale legacy canonical rows when their names do not match real table fields.\n    delete from public.entity_properties ep\n    where ep.entity_type = 'table_row'\n      and ep.entity_id = v_row_id\n      and ep.field_type in ('priority', 'status')\n      and not exists (\n        select 1\n        from public.table_fields tf\n        where tf.table_id = p_table_id\n          and tf.type = ep.field_type\n          and lower(btrim(tf.name)) = lower(btrim(ep.field_name))\n      );\n  end loop;\n\n  return jsonb_build_object('inserted_ids', v_inserted_ids);\nend;\n"
  },
  {
    "routine_name": "bulk_set_task_assignees",
    "routine_definition": "\nDECLARE\n  v_task_id uuid;\n  v_workspace_id uuid;\n  v_assignee jsonb;\n  v_assignee_payload jsonb := COALESCE(p_assignees, '[]'::jsonb);\nBEGIN\n  -- Determine workspace from first task\n  SELECT workspace_id INTO v_workspace_id\n  FROM public.task_items\n  WHERE id = p_task_ids[1];\n\n  IF v_workspace_id IS NULL THEN\n    RETURN jsonb_build_object('updated_count', 0);\n  END IF;\n\n  FOREACH v_task_id IN ARRAY p_task_ids LOOP\n    DELETE FROM public.task_assignees WHERE task_id = v_task_id;\n    FOR v_assignee IN SELECT * FROM jsonb_array_elements(v_assignee_payload) LOOP\n      INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)\n      VALUES (\n        v_task_id,\n        NULLIF(v_assignee->>'id','')::uuid,\n        COALESCE(NULLIF(v_assignee->>'name',''), NULLIF(v_assignee->>'id',''), 'Unknown')\n      );\n    END LOOP;\n\n    IF jsonb_array_length(v_assignee_payload) > 0 THEN\n      INSERT INTO public.entity_properties (\n        workspace_id,\n        entity_type,\n        entity_id,\n        field_name,\n        field_type,\n        value\n      )\n      VALUES (\n        v_workspace_id,\n        'task',\n        v_task_id,\n        'Assignee',\n        'assignee',\n        v_assignee_payload\n      )\n      ON CONFLICT (entity_id, entity_type, field_name)\n      DO UPDATE SET\n        field_type = EXCLUDED.field_type,\n        value = EXCLUDED.value,\n        updated_at = now();\n    ELSE\n      DELETE FROM public.entity_properties\n      WHERE workspace_id = v_workspace_id\n        AND entity_type = 'task'\n        AND entity_id = v_task_id\n        AND field_name = 'Assignee';\n    END IF;\n  END LOOP;\n\n  RETURN jsonb_build_object('updated_count', array_length(p_task_ids, 1));\nEND;\n"
  },
  {
    "routine_name": "cleanup_entity_properties_on_block_delete",
    "routine_definition": "\nBEGIN\n  -- Delete all entity_properties for this block\n  DELETE FROM public.entity_properties\n  WHERE entity_type = 'block'\n    AND entity_id = OLD.id;\n\n  -- Delete all entity_links involving this block\n  DELETE FROM public.entity_links\n  WHERE (source_entity_type = 'block' AND source_entity_id = OLD.id)\n     OR (target_entity_type = 'block' AND target_entity_id = OLD.id);\n\n  RETURN OLD;\nEND;\n"
  },
  {
    "routine_name": "cleanup_entity_properties_on_subtask_delete",
    "routine_definition": "\nBEGIN\n  -- Delete all entity_properties for this subtask\n  DELETE FROM public.entity_properties\n  WHERE entity_type = 'subtask'\n    AND entity_id = OLD.id;\n\n  -- Delete all entity_links involving this subtask\n  DELETE FROM public.entity_links\n  WHERE (source_entity_type = 'subtask' AND source_entity_id = OLD.id)\n     OR (target_entity_type = 'subtask' AND target_entity_id = OLD.id);\n\n  RETURN OLD;\nEND;\n"
  },
  {
    "routine_name": "cleanup_entity_properties_on_table_row_delete",
    "routine_definition": "\nBEGIN\n  -- Delete all entity_properties for this table row\n  DELETE FROM public.entity_properties\n  WHERE entity_type = 'table_row'\n    AND entity_id = OLD.id;\n\n  -- Delete all entity_links involving this table row\n  DELETE FROM public.entity_links\n  WHERE (source_entity_type = 'table_row' AND source_entity_id = OLD.id)\n     OR (target_entity_type = 'table_row' AND target_entity_id = OLD.id);\n\n  RETURN OLD;\nEND;\n"
  },
  {
    "routine_name": "cleanup_entity_properties_on_task_delete",
    "routine_definition": "\nBEGIN\n  -- Delete all entity_properties for this task\n  DELETE FROM public.entity_properties\n  WHERE entity_type = 'task'\n    AND entity_id = OLD.id;\n\n  -- Delete all entity_links involving this task\n  DELETE FROM public.entity_links\n  WHERE (source_entity_type = 'task' AND source_entity_id = OLD.id)\n     OR (target_entity_type = 'task' AND target_entity_id = OLD.id);\n\n  RETURN OLD;\nEND;\n"
  },
  {
    "routine_name": "cleanup_entity_properties_on_timeline_event_delete",
    "routine_definition": "\nBEGIN\n  -- Delete all entity_properties for this timeline event\n  DELETE FROM public.entity_properties\n  WHERE entity_type = 'timeline_event'\n    AND entity_id = OLD.id;\n\n  -- Delete all entity_links involving this timeline event\n  DELETE FROM public.entity_links\n  WHERE (source_entity_type = 'timeline_event' AND source_entity_id = OLD.id)\n     OR (target_entity_type = 'timeline_event' AND target_entity_id = OLD.id);\n\n  RETURN OLD;\nEND;\n"
  },
  {
    "routine_name": "create_default_property_definitions",
    "routine_definition": "\nBEGIN\n  -- Status property (select)\n  INSERT INTO property_definitions (workspace_id, name, type, options)\n  VALUES (\n    NEW.id,\n    'Status',\n    'select',\n    '[\n      {\"id\": \"todo\", \"label\": \"To Do\", \"color\": \"gray\"},\n      {\"id\": \"in_progress\", \"label\": \"In Progress\", \"color\": \"blue\"},\n      {\"id\": \"blocked\", \"label\": \"Blocked\", \"color\": \"red\"},\n      {\"id\": \"done\", \"label\": \"Done\", \"color\": \"green\"}\n    ]'::jsonb\n  );\n\n  -- Assignee property (person)\n  INSERT INTO property_definitions (workspace_id, name, type, options)\n  VALUES (NEW.id, 'Assignee', 'person', '[]'::jsonb);\n\n  -- Due Date property (date)\n  INSERT INTO property_definitions (workspace_id, name, type, options)\n  VALUES (NEW.id, 'Due Date', 'date', '[]'::jsonb);\n\n  -- Priority property (select)\n  INSERT INTO property_definitions (workspace_id, name, type, options)\n  VALUES (\n    NEW.id,\n    'Priority',\n    'select',\n    '[\n      {\"id\": \"low\", \"label\": \"Low\", \"color\": \"gray\"},\n      {\"id\": \"medium\", \"label\": \"Medium\", \"color\": \"yellow\"},\n      {\"id\": \"high\", \"label\": \"High\", \"color\": \"orange\"},\n      {\"id\": \"urgent\", \"label\": \"Urgent\", \"color\": \"red\"}\n    ]'::jsonb\n  );\n\n  RETURN NEW;\nEND;\n"
  },
  {
    "routine_name": "create_table_full",
    "routine_definition": "\nDECLARE\n  v_table_id uuid;\n  v_field jsonb;\n  v_row jsonb;\n  v_row_ids uuid[];\n  v_data jsonb;\n  v_order numeric;\n  v_field_id uuid;\n  v_field_type text;\n  v_field_config jsonb;\n  v_field_name text;\n  v_fields_created int := 0;\n  v_rows_inserted int := 0;\n  v_has_rows boolean := false;\n  v_has_fields boolean := false;\n  v_default_count int := 0;\n  -- Source metadata variables\n  v_source_entity_type text;\n  v_source_entity_id uuid;\n  v_source_sync_mode text;\nBEGIN\n  -- Create the table (now with tab_id support)\n  INSERT INTO public.tables (workspace_id, project_id, tab_id, title, description, created_by)\n  VALUES (p_workspace_id, p_project_id, p_tab_id, COALESCE(p_title, 'Untitled Table'), p_description, p_created_by)\n  RETURNING id INTO v_table_id;\n\n  -- Check if fields are provided\n  v_has_fields := jsonb_typeof(p_fields) = 'array' AND jsonb_array_length(p_fields) > 0;\n\n  -- Only create default fields if no custom fields are provided\n  IF NOT v_has_fields THEN\n    INSERT INTO public.table_fields (table_id, name, type, config, is_primary, \"order\")\n    VALUES\n      (v_table_id, 'Name', 'text', '{}'::jsonb, true, 1),\n      (v_table_id, 'Column 2', 'text', '{}'::jsonb, false, 2),\n      (v_table_id, 'Column 3', 'text', '{}'::jsonb, false, 3);\n  END IF;\n\n  -- Default rows (will be deleted later if custom rows are provided)\n  INSERT INTO public.table_rows (table_id, data, \"order\", created_by, updated_by)\n  VALUES\n    (v_table_id, '{}'::jsonb, 1, p_created_by, p_created_by),\n    (v_table_id, '{}'::jsonb, 2, p_created_by, p_created_by),\n    (v_table_id, '{}'::jsonb, 3, p_created_by, p_created_by);\n\n  -- Default view\n  INSERT INTO public.table_views (table_id, name, type, is_default, created_by, config)\n  VALUES (v_table_id, 'Default view', 'table', true, p_created_by, '{}'::jsonb);\n\n  -- Add custom fields (if provided)\n  -- The first field should always be primary unless explicitly set otherwise\n  FOR v_field IN SELECT * FROM jsonb_array_elements(p_fields) LOOP\n    v_field_name := trim(both ' ' from COALESCE(v_field->>'name', ''));\n    IF v_field_name = '' THEN\n      CONTINUE;\n    END IF;\n    IF EXISTS (\n      SELECT 1 FROM public.table_fields tf\n      WHERE tf.table_id = v_table_id AND lower(tf.name) = lower(v_field_name)\n    ) THEN\n      CONTINUE;\n    END IF;\n\n    INSERT INTO public.table_fields (table_id, name, type, config, is_primary, property_definition_id)\n    VALUES (\n      v_table_id,\n      v_field_name,\n      COALESCE(v_field->>'type', 'text'),\n      COALESCE(v_field->'config', '{}'::jsonb),\n      -- First field is primary by default, others respect LLM's choice\n      CASE\n        WHEN v_fields_created = 0 THEN COALESCE((v_field->>'isPrimary')::boolean, true)\n        ELSE COALESCE((v_field->>'isPrimary')::boolean, false)\n      END,\n      CASE\n        WHEN COALESCE(v_field->>'type', 'text') = 'priority' THEN (\n          SELECT id FROM public.property_definitions\n          WHERE workspace_id = p_workspace_id AND name = 'Priority' AND type = 'select'\n          LIMIT 1\n        )\n        WHEN COALESCE(v_field->>'type', 'text') = 'status' THEN (\n          SELECT id FROM public.property_definitions\n          WHERE workspace_id = p_workspace_id AND name = 'Status' AND type = 'select'\n          LIMIT 1\n        )\n        ELSE NULL\n      END\n    );\n    v_fields_created := v_fields_created + 1;\n  END LOOP;\n\n  -- Rows (optional)\n  v_has_rows := jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0;\n  IF v_has_rows THEN\n    SELECT count(*) INTO v_default_count FROM public.table_rows tr WHERE tr.table_id = v_table_id;\n    IF v_default_count <= 3 THEN\n      DELETE FROM public.table_rows tr\n      WHERE tr.table_id = v_table_id AND (tr.data IS NULL OR tr.data = '{}'::jsonb);\n    END IF;\n  END IF;\n\n  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP\n    v_data := '{}'::jsonb;\n    v_order := NULL;\n    v_source_entity_type := NULL;\n    v_source_entity_id := NULL;\n    v_source_sync_mode := NULL;\n\n    IF v_row ? 'order' THEN\n      BEGIN\n        v_order := (v_row->>'order')::numeric;\n      EXCEPTION WHEN invalid_text_representation THEN\n        v_order := NULL;\n      END;\n    END IF;\n\n    -- Extract source metadata if present\n    IF v_row ? 'source_entity_type' THEN\n      v_source_entity_type := v_row->>'source_entity_type';\n    END IF;\n    IF v_row ? 'source_entity_id' THEN\n      BEGIN\n        v_source_entity_id := (v_row->>'source_entity_id')::uuid;\n      EXCEPTION WHEN invalid_text_representation THEN\n        v_source_entity_id := NULL;\n      END;\n    END IF;\n    IF v_row ? 'source_sync_mode' THEN\n      v_source_sync_mode := v_row->>'source_sync_mode';\n    END IF;\n\n    FOR v_field_name, v_field_id IN\n      SELECT key, public._resolve_table_field_id(v_table_id, key)\n      FROM jsonb_each(COALESCE(v_row->'data', '{}'::jsonb))\n    LOOP\n      IF v_field_id IS NULL THEN\n        CONTINUE;\n      END IF;\n\n      SELECT type, config INTO v_field_type, v_field_config\n      FROM public.table_fields\n      WHERE id = v_field_id;\n\n      IF v_field_type IN ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') THEN\n        CONTINUE;\n      END IF;\n\n      v_data := v_data || jsonb_build_object(v_field_id::text, (v_row->'data'->v_field_name));\n    END LOOP;\n\n    -- Insert row with source metadata support\n    INSERT INTO public.table_rows (\n      table_id,\n      data,\n      \"order\",\n      source_entity_type,\n      source_entity_id,\n      source_sync_mode,\n      created_by,\n      updated_by\n    )\n    VALUES (\n      v_table_id,\n      v_data,\n      v_order,\n      v_source_entity_type,\n      v_source_entity_id,\n      v_source_sync_mode,\n      p_created_by,\n      p_created_by\n    );\n    v_rows_inserted := v_rows_inserted + 1;\n  END LOOP;\n\n  result_table_id := v_table_id;\n  result_fields_created := v_fields_created;\n  result_rows_inserted := v_rows_inserted;\n  RETURN NEXT;\nEND;\n"
  },
  {
    "routine_name": "create_task_full",
    "routine_definition": "\ndeclare\n  v_task public.task_items;\n  v_workspace_id uuid;\n  v_project_id uuid;\n  v_tab_id uuid;\n  v_assignee jsonb;\n  v_assignee_def uuid;\n  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);\n  v_tag text;\n  v_tag_id uuid;\n  v_effective_source_entity_type text;\n  v_effective_source_entity_id uuid;\n  v_effective_source_sync_mode text;\n  v_effective_source_task_id uuid;\nbegin\n  select b.tab_id, t.project_id, p.workspace_id\n  into v_tab_id, v_project_id, v_workspace_id\n  from public.blocks b\n  join public.tabs t on t.id = b.tab_id\n  join public.projects p on p.id = t.project_id\n  where b.id = p_task_block_id and b.type = 'task'\n  limit 1;\n\n  if v_workspace_id is null then\n    raise exception 'Task block not found';\n  end if;\n\n  if p_source_entity_type is not null and p_source_entity_id is not null then\n    v_effective_source_entity_type := p_source_entity_type;\n    v_effective_source_entity_id := p_source_entity_id;\n    v_effective_source_sync_mode := case\n      when p_source_entity_type = 'table_row' then 'snapshot'\n      when p_source_entity_type = 'block' then 'snapshot'\n      else coalesce(p_source_sync_mode, 'snapshot')\n    end;\n\n    if p_source_entity_type = 'task' then\n      v_effective_source_task_id := p_source_entity_id;\n    end if;\n  end if;\n\n  insert into public.task_items (\n    task_block_id,\n    workspace_id,\n    project_id,\n    tab_id,\n    title,\n    status,\n    priorities,\n    description,\n    due_date,\n    due_time,\n    start_date,\n    hide_icons,\n    recurring_enabled,\n    recurring_frequency,\n    recurring_interval,\n    source_task_id,\n    source_entity_type,\n    source_entity_id,\n    source_sync_mode,\n    created_by,\n    updated_by\n  ) values (\n    p_task_block_id,\n    v_workspace_id,\n    v_project_id,\n    v_tab_id,\n    p_title,\n    coalesce(p_status, 'todo'),\n    coalesce(p_priorities, '[]'::jsonb),\n    p_description,\n    p_due_date,\n    p_due_time,\n    p_start_date,\n    coalesce(p_hide_icons, false),\n    coalesce(p_recurring_enabled, false),\n    p_recurring_frequency,\n    p_recurring_interval,\n    v_effective_source_task_id,\n    v_effective_source_entity_type,\n    v_effective_source_entity_id,\n    v_effective_source_sync_mode,\n    p_created_by,\n    p_created_by\n  )\n  returning * into v_task;\n\n  for v_assignee in\n    select * from jsonb_array_elements(v_assignee_payload)\n  loop\n    insert into public.task_assignees (task_id, assignee_id, assignee_name)\n    values (\n      v_task.id,\n      nullif(v_assignee->>'id', '')::uuid,\n      coalesce(nullif(v_assignee->>'name', ''), nullif(v_assignee->>'id', ''), 'Unknown')\n    );\n  end loop;\n\n  select id into v_assignee_def\n  from public.property_definitions\n  where workspace_id = v_workspace_id\n    and name = 'Assignee'\n    and type = 'person'\n  limit 1;\n\n  if jsonb_array_length(v_assignee_payload) > 0 then\n    insert into public.entity_properties (\n      workspace_id,\n      entity_type,\n      entity_id,\n      property_definition_id,\n      field_name,\n      field_type,\n      value\n    )\n    values (\n      v_workspace_id,\n      'task',\n      v_task.id,\n      v_assignee_def,\n      'Assignee',\n      'assignee',\n      v_assignee_payload\n    )\n    on conflict (entity_type, entity_id, field_name)\n    do update set\n      field_type = excluded.field_type,\n      property_definition_id = excluded.property_definition_id,\n      value = excluded.value,\n      updated_at = now();\n  end if;\n\n  for v_tag in\n    select trim(value::text)\n    from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb))\n  loop\n    if v_tag is null or v_tag = '' then\n      continue;\n    end if;\n\n    select id into v_tag_id\n    from public.task_tags\n    where workspace_id = v_workspace_id\n      and name = v_tag\n    limit 1;\n\n    if v_tag_id is null then\n      insert into public.task_tags (workspace_id, name)\n      values (v_workspace_id, v_tag)\n      returning id into v_tag_id;\n    end if;\n\n    insert into public.task_tag_links (task_id, tag_id)\n    values (v_task.id, v_tag_id)\n    on conflict do nothing;\n  end loop;\n\n  return v_task;\nend;\n"
  },
  {
    "routine_name": "duplicate_tasks_to_block",
    "routine_definition": "\ndeclare\n  v_max_order int := 0;\n  v_created_ids uuid[] := array[]::uuid[];\n  v_task record;\n  v_new_id uuid;\n  v_assignee_def uuid;\n  v_assignees record;\n  v_assignee_payload jsonb;\n  v_tag_links record;\n  v_priority_rows_inserted int := 0;\nbegin\n  select coalesce(max(display_order), -1)\n  into v_max_order\n  from public.task_items\n  where task_block_id = p_target_block_id;\n\n  select id into v_assignee_def\n  from public.property_definitions\n  where workspace_id = p_workspace_id\n    and name = 'Assignee'\n    and type = 'person'\n  limit 1;\n\n  for v_task in\n    select *\n    from public.task_items\n    where id = any(p_task_ids)\n      and workspace_id = p_workspace_id\n    order by array_position(p_task_ids, id)\n  loop\n    v_max_order := v_max_order + 1;\n\n    insert into public.task_items (\n      task_block_id,\n      workspace_id,\n      project_id,\n      tab_id,\n      title,\n      status,\n      priorities,\n      description,\n      due_date,\n      due_time,\n      due_time_end,\n      start_date,\n      hide_icons,\n      display_order,\n      recurring_enabled,\n      recurring_frequency,\n      recurring_interval,\n      source_task_id,\n      source_entity_type,\n      source_entity_id,\n      source_sync_mode,\n      created_by,\n      updated_by\n    )\n    values (\n      p_target_block_id,\n      p_workspace_id,\n      p_project_id,\n      p_tab_id,\n      v_task.title,\n      v_task.status,\n      coalesce(v_task.priorities, '[]'::jsonb),\n      v_task.description,\n      v_task.due_date,\n      v_task.due_time,\n      v_task.due_time_end,\n      v_task.start_date,\n      v_task.hide_icons,\n      v_max_order,\n      v_task.recurring_enabled,\n      v_task.recurring_frequency,\n      v_task.recurring_interval,\n      case\n        when v_task.source_entity_type = 'table_row' and v_task.source_entity_id is not null then null\n        when v_task.source_entity_type = 'block' and v_task.source_entity_id is not null then null\n        else v_task.id\n      end,\n      case\n        when v_task.source_entity_type = 'table_row' and v_task.source_entity_id is not null then 'table_row'\n        when v_task.source_entity_type = 'block' and v_task.source_entity_id is not null then 'block'\n        else 'task'\n      end,\n      case\n        when v_task.source_entity_type = 'table_row' and v_task.source_entity_id is not null then v_task.source_entity_id\n        when v_task.source_entity_type = 'block' and v_task.source_entity_id is not null then v_task.source_entity_id\n        else v_task.id\n      end,\n      'snapshot',\n      p_created_by,\n      p_created_by\n    )\n    returning id into v_new_id;\n\n    v_created_ids := v_created_ids || v_new_id;\n\n    insert into public.entity_properties (\n      workspace_id,\n      entity_type,\n      entity_id,\n      field_name,\n      field_type,\n      value\n    )\n    select\n      p_workspace_id,\n      'task',\n      v_new_id,\n      ep.field_name,\n      'priority',\n      ep.value\n    from public.entity_properties ep\n    where ep.entity_type = 'task'\n      and ep.entity_id = v_task.id\n      and ep.field_type = 'priority'\n      and ep.field_name is not null\n      and btrim(ep.field_name) <> ''\n      and jsonb_typeof(ep.value) = 'string'\n      and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')\n    on conflict (entity_type, entity_id, field_name)\n    do update set\n      workspace_id = excluded.workspace_id,\n      field_type = excluded.field_type,\n      value = excluded.value,\n      updated_at = now();\n\n    get diagnostics v_priority_rows_inserted = row_count;\n\n    if v_priority_rows_inserted = 0 then\n      insert into public.entity_properties (\n        workspace_id,\n        entity_type,\n        entity_id,\n        field_name,\n        field_type,\n        value\n      )\n      select\n        p_workspace_id,\n        'task',\n        v_new_id,\n        btrim(elem->>'field_name') as field_name,\n        'priority',\n        to_jsonb(lower(btrim(elem->>'value')))\n      from jsonb_array_elements(coalesce(v_task.priorities, '[]'::jsonb)) as e(elem)\n      where jsonb_typeof(elem) = 'object'\n        and jsonb_typeof(elem->'field_name') = 'string'\n        and btrim(elem->>'field_name') <> ''\n        and jsonb_typeof(elem->'value') = 'string'\n        and lower(btrim(elem->>'value')) in ('low', 'medium', 'high', 'urgent')\n      on conflict (entity_type, entity_id, field_name)\n      do update set\n        workspace_id = excluded.workspace_id,\n        field_type = excluded.field_type,\n        value = excluded.value,\n        updated_at = now();\n    end if;\n\n    if v_task.source_entity_type = 'table_row' and v_task.source_entity_id is not null then\n      insert into public.entity_properties (\n        workspace_id,\n        entity_type,\n        entity_id,\n        field_name,\n        field_type,\n        value\n      )\n      select\n        p_workspace_id,\n        'task',\n        v_new_id,\n        ep.field_name,\n        'priority',\n        ep.value\n      from public.entity_properties ep\n      where ep.entity_type = 'table_row'\n        and ep.entity_id = v_task.source_entity_id\n        and ep.field_type = 'priority'\n        and ep.field_name is not null\n        and btrim(ep.field_name) <> ''\n        and jsonb_typeof(ep.value) = 'string'\n        and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')\n      on conflict (entity_type, entity_id, field_name)\n      do update set\n        workspace_id = excluded.workspace_id,\n        field_type = excluded.field_type,\n        value = excluded.value,\n        updated_at = now();\n    end if;\n\n    update public.task_items t\n    set priorities = coalesce(\n      (\n        select jsonb_agg(\n          jsonb_build_object(\n            'field_name',\n            ep.field_name,\n            'value',\n            lower(btrim(ep.value #>> '{}'))\n          )\n          order by ep.updated_at desc nulls last, ep.created_at desc nulls last, ep.id desc\n        )\n        from public.entity_properties ep\n        where ep.entity_type = 'task'\n          and ep.entity_id = v_new_id\n          and ep.field_type = 'priority'\n          and ep.field_name is not null\n          and btrim(ep.field_name) <> ''\n          and jsonb_typeof(ep.value) = 'string'\n          and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')\n      ),\n      '[]'::jsonb\n    )\n    where t.id = v_new_id;\n\n    if p_include_assignees then\n      for v_assignees in\n        select *\n        from public.task_assignees\n        where task_id = v_task.id\n      loop\n        insert into public.task_assignees (task_id, assignee_id, assignee_name)\n        values (v_new_id, v_assignees.assignee_id, v_assignees.assignee_name);\n      end loop;\n\n      select coalesce(\n        jsonb_agg(\n          jsonb_strip_nulls(\n            jsonb_build_object(\n              'id', ta.assignee_id,\n              'name', ta.assignee_name\n            )\n          )\n        ),\n        '[]'::jsonb\n      )\n      into v_assignee_payload\n      from public.task_assignees ta\n      where ta.task_id = v_new_id;\n\n      if jsonb_array_length(v_assignee_payload) > 0 then\n        insert into public.entity_properties (\n          workspace_id,\n          entity_type,\n          entity_id,\n          property_definition_id,\n          field_name,\n          field_type,\n          value\n        )\n        values (\n          p_workspace_id,\n          'task',\n          v_new_id,\n          v_assignee_def,\n          'Assignee',\n          'assignee',\n          v_assignee_payload\n        )\n        on conflict (entity_type, entity_id, field_name)\n        do update set\n          field_type = excluded.field_type,\n          property_definition_id = excluded.property_definition_id,\n          value = excluded.value,\n          updated_at = now();\n      end if;\n    end if;\n\n    if p_include_tags then\n      for v_tag_links in\n        select *\n        from public.task_tag_links\n        where task_id = v_task.id\n      loop\n        insert into public.task_tag_links (task_id, tag_id)\n        values (v_new_id, v_tag_links.tag_id)\n        on conflict do nothing;\n      end loop;\n    end if;\n  end loop;\n\n  return jsonb_build_object(\n    'created_count',\n    coalesce(array_length(v_created_ids, 1), 0),\n    'created_task_ids',\n    v_created_ids,\n    'skipped',\n    array(\n      select id\n      from unnest(p_task_ids) as id\n      where not exists (\n        select 1\n        from public.task_items t\n        where t.id = id\n          and t.workspace_id = p_workspace_id\n      )\n    )\n  );\nend;\n"
  },
  {
    "routine_name": "entity_properties_populate_named_fields",
    "routine_definition": "\ndeclare\n  v_def_name text;\n  v_inferred_type text;\nbegin\n  if (new.field_name is null or btrim(new.field_name) = '' or new.field_type is null)\n     and new.property_definition_id is not null then\n    select name\n    into v_def_name\n    from public.property_definitions\n    where id = new.property_definition_id;\n  end if;\n\n  if new.field_name is null or btrim(new.field_name) = '' then\n    new.field_name := coalesce(\n      v_def_name,\n      case new.field_type\n        when 'priority' then 'Priority'\n        when 'status' then 'Status'\n        when 'assignee' then 'Assignee'\n        when 'due_date' then 'Due Date'\n        when 'tags' then 'Tags'\n        else null\n      end\n    );\n  end if;\n\n  if new.field_type is null then\n    v_inferred_type := case\n      when lower(coalesce(new.field_name, '')) like '%priority%' then 'priority'\n      when lower(coalesce(new.field_name, '')) like '%status%' then 'status'\n      when lower(coalesce(new.field_name, '')) like '%assignee%' then 'assignee'\n      when lower(coalesce(new.field_name, '')) like '%due date%' or lower(coalesce(new.field_name, '')) like '%due_date%' then 'due_date'\n      when lower(coalesce(new.field_name, '')) like '%tag%' then 'tags'\n      else null\n    end;\n    new.field_type := v_inferred_type;\n  end if;\n\n  if new.field_name is null or btrim(new.field_name) = '' or new.field_type is null then\n    raise exception 'entity_properties requires field_name and field_type for row id=%', coalesce(new.id::text, '<new>');\n  end if;\n\n  return new;\nend;\n"
  },
  {
    "routine_name": "seed_task_priorities_from_source_row",
    "routine_definition": "\nbegin\n  if new.source_entity_type <> 'table_row' or new.source_entity_id is null then\n    return new;\n  end if;\n\n  if new.id is null then\n    new.id := gen_random_uuid();\n  end if;\n\n  -- Sync named priority rows from source table_row -> task entity_properties.\n  delete from public.entity_properties\n  where entity_type = 'task'\n    and entity_id = new.id\n    and field_type = 'priority';\n\n  insert into public.entity_properties (\n    workspace_id,\n    entity_type,\n    entity_id,\n    field_name,\n    field_type,\n    value\n  )\n  select\n    new.workspace_id,\n    'task',\n    new.id,\n    ep.field_name,\n    'priority',\n    to_jsonb(lower(btrim(ep.value #>> '{}')))\n  from public.entity_properties ep\n  where ep.entity_type = 'table_row'\n    and ep.entity_id = new.source_entity_id\n    and ep.field_type = 'priority'\n    and ep.field_name is not null\n    and btrim(ep.field_name) <> ''\n    and jsonb_typeof(ep.value) = 'string'\n    and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')\n  on conflict (entity_type, entity_id, field_name)\n  do update set\n    workspace_id = excluded.workspace_id,\n    field_type = excluded.field_type,\n    value = excluded.value,\n    updated_at = now();\n\n  -- Keep task_items.priorities aligned with the inserted named rows.\n  new.priorities := coalesce(\n    (\n      select jsonb_agg(\n        jsonb_build_object(\n          'field_name', ep.field_name,\n          'value', lower(btrim(ep.value #>> '{}'))\n        )\n        order by ep.updated_at desc nulls last, ep.created_at desc nulls last, ep.id desc\n      )\n      from public.entity_properties ep\n      where ep.entity_type = 'task'\n        and ep.entity_id = new.id\n        and ep.field_type = 'priority'\n        and ep.field_name is not null\n        and btrim(ep.field_name) <> ''\n        and jsonb_typeof(ep.value) = 'string'\n        and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')\n    ),\n    '[]'::jsonb\n  );\n\n  return new;\nend;\n"
  },
  {
    "routine_name": "sync_block_type_to_entity_properties_subtype",
    "routine_definition": "\nbegin\n  if old.type is distinct from new.type then\n    update public.entity_properties ep\n    set entity_subtype = new.type\n    where ep.entity_type = 'block'\n      and ep.entity_id = new.id\n      and ep.entity_subtype is distinct from new.type;\n  end if;\n\n  return new;\nend;\n"
  },
  {
    "routine_name": "sync_live_task_properties_to_source",
    "routine_definition": "\ndeclare\n  v_entity_id uuid;\n  v_workspace_id uuid;\n  v_property_definition_id uuid;\n  v_field_name text;\n  v_field_type text;\n  v_value jsonb;\n  v_source_task_id uuid;\n  v_source_entity_type text;\n  v_source_entity_id uuid;\n  v_sync_mode text;\nbegin\n  if pg_trigger_depth() > 1 then\n    return coalesce(new, old);\n  end if;\n\n  if tg_op = 'DELETE' then\n    if old.entity_type <> 'task' then\n      return old;\n    end if;\n    v_entity_id := old.entity_id;\n    v_workspace_id := old.workspace_id;\n    v_property_definition_id := old.property_definition_id;\n    v_field_name := old.field_name;\n    v_field_type := old.field_type;\n    v_value := null;\n  else\n    if new.entity_type <> 'task' then\n      return new;\n    end if;\n    v_entity_id := new.entity_id;\n    v_workspace_id := new.workspace_id;\n    v_property_definition_id := new.property_definition_id;\n    v_field_name := new.field_name;\n    v_field_type := new.field_type;\n    v_value := new.value;\n  end if;\n\n  select\n    source_task_id,\n    source_entity_type,\n    source_entity_id,\n    source_sync_mode\n  into v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode\n  from public.task_items\n  where id = v_entity_id;\n\n  if v_sync_mode <> 'live' then\n    return coalesce(new, old);\n  end if;\n\n  if v_source_entity_type = 'table_row' or v_source_entity_type = 'block' then\n    return coalesce(new, old);\n  end if;\n\n  if v_source_entity_type = 'task' and v_source_entity_id is not null then\n    v_source_task_id := v_source_entity_id;\n  elsif v_source_task_id is null then\n    return coalesce(new, old);\n  end if;\n\n  if tg_op = 'DELETE' then\n    delete from public.entity_properties\n    where entity_type = 'task'\n      and entity_id = v_source_task_id\n      and field_name = v_field_name;\n  else\n    insert into public.entity_properties (\n      workspace_id,\n      entity_type,\n      entity_id,\n      property_definition_id,\n      field_name,\n      field_type,\n      value\n    )\n    values (\n      v_workspace_id,\n      'task',\n      v_source_task_id,\n      v_property_definition_id,\n      v_field_name,\n      v_field_type,\n      v_value\n    )\n    on conflict (entity_type, entity_id, field_name)\n    do update set\n      value = excluded.value,\n      field_type = excluded.field_type,\n      property_definition_id = excluded.property_definition_id,\n      updated_at = now();\n  end if;\n\n  return coalesce(new, old);\nend;\n"
  },
  {
    "routine_name": "update_table_rows_by_field_names",
    "routine_definition": "\ndeclare\n  v_updates_by_id jsonb := '{}'::jsonb;\n  v_named_fixed_updates jsonb := '{}'::jsonb;\n  v_filter_key text;\n  v_filter_val jsonb;\n  v_filter_text text;\n  v_field_id uuid;\n  v_field_type text;\n  v_field_name text;\n  v_field_config jsonb;\n  v_field_prop_def_id uuid;\n  v_ids uuid[];\n  v_ids_next uuid[];\n  v_limit int := coalesce(p_limit, 500);\n  v_workspace_id uuid;\n  v_fixed_entry record;\n  v_value jsonb;\nbegin\n  select workspace_id into v_workspace_id\n  from public.tables\n  where id = p_table_id;\n\n  -- Resolve updates by table field id and capture named fixed-field updates.\n  for v_filter_key, v_filter_val in\n    select key, value from jsonb_each(coalesce(p_updates, '{}'::jsonb))\n  loop\n    v_field_id := public._resolve_table_field_id(p_table_id, v_filter_key);\n    if v_field_id is null then\n      raise exception 'Unknown field \"%\" in updates', v_filter_key;\n    end if;\n\n    select name, type, config, property_definition_id\n    into v_field_name, v_field_type, v_field_config, v_field_prop_def_id\n    from public.table_fields\n    where id = v_field_id;\n\n    v_value := public._resolve_field_value_with_property_def(\n      v_field_type,\n      v_field_config,\n      v_field_prop_def_id,\n      v_filter_val\n    );\n\n    v_updates_by_id := v_updates_by_id || jsonb_build_object(v_field_id::text, v_value);\n\n    if v_field_type in ('status', 'priority') and v_field_name is not null and btrim(v_field_name) <> '' then\n      v_named_fixed_updates := v_named_fixed_updates || jsonb_build_object(\n        v_field_name,\n        jsonb_build_object(\n          'field_type', v_field_type,\n          'value', v_value\n        )\n      );\n    end if;\n  end loop;\n\n  -- Seed candidate ids.\n  select array_agg(id) into v_ids\n  from public.table_rows\n  where table_id = p_table_id\n  limit v_limit;\n\n  if v_ids is null then\n    updated := 0;\n    row_ids := array[]::uuid[];\n    return next;\n  end if;\n\n  -- Apply filters.\n  if p_filters is not null then\n    for v_filter_key, v_filter_val in select key, value from jsonb_each(p_filters) loop\n      v_field_id := public._resolve_table_field_id(p_table_id, v_filter_key);\n      if v_field_id is null then\n        raise exception 'Unknown field \"%\" in filters', v_filter_key;\n      end if;\n\n      if jsonb_typeof(v_filter_val) not in ('object', 'array') then\n        v_filter_text := trim(both '\"' from v_filter_val::text);\n      else\n        v_filter_text := null;\n      end if;\n\n      v_ids_next := array(\n        select id\n        from public.table_rows\n        where table_id = p_table_id\n          and id = any(v_ids)\n          and (\n            (jsonb_typeof(v_filter_val) = 'object' and (\n              (v_filter_val->>'op' = 'is_null' and (data->>v_field_id::text) is null)\n              or (v_filter_val->>'op' = 'not_null' and (data->>v_field_id::text) is not null)\n              or (v_filter_val->>'op' = 'eq' and lower(coalesce(data->>v_field_id::text, '')) = lower(coalesce(v_filter_val->>'value', '')))\n              or (v_filter_val->>'op' = 'neq' and lower(coalesce(data->>v_field_id::text, '')) <> lower(coalesce(v_filter_val->>'value', '')))\n              or (v_filter_val->>'op' = 'contains' and lower(coalesce(data->>v_field_id::text, '')) like '%' || lower(coalesce(v_filter_val->>'value', '')) || '%')\n            ))\n            or (jsonb_typeof(v_filter_val) = 'array' and lower(coalesce(data->>v_field_id::text, '')) in (\n              select lower(value::text) from jsonb_array_elements_text(v_filter_val)\n            ))\n            or (jsonb_typeof(v_filter_val) not in ('object', 'array') and (\n              v_filter_text is not null\n              and lower(coalesce(data->>v_field_id::text, '')) = lower(v_filter_text)\n            ))\n          )\n      );\n      v_ids := v_ids_next;\n    end loop;\n  end if;\n\n  if v_ids is null or array_length(v_ids, 1) is null then\n    updated := 0;\n    row_ids := array[]::uuid[];\n    return next;\n  end if;\n\n  update public.table_rows\n  set data = coalesce(data, '{}'::jsonb) || v_updates_by_id,\n      updated_by = p_updated_by,\n      edited = case when source_entity_id is not null then true else coalesce(edited, false) end\n  where table_id = p_table_id and id = any(v_ids);\n\n  -- Sync fixed fields by named field_name key, not property_definition_id.\n  for v_fixed_entry in select key, value from jsonb_each(v_named_fixed_updates) loop\n    v_field_name := v_fixed_entry.key;\n    v_field_type := v_fixed_entry.value->>'field_type';\n    v_value := v_fixed_entry.value->'value';\n\n    if v_value is null\n       or jsonb_typeof(v_value) = 'null'\n       or btrim(trim(both '\"' from v_value::text)) = '' then\n      delete from public.entity_properties\n      where entity_type = 'table_row'\n        and entity_id = any(v_ids)\n        and lower(field_name) = lower(v_field_name);\n    else\n      insert into public.entity_properties (\n        entity_type,\n        entity_id,\n        workspace_id,\n        field_name,\n        field_type,\n        value\n      )\n      select\n        'table_row',\n        id,\n        v_workspace_id,\n        v_field_name,\n        v_field_type,\n        v_value\n      from unnest(v_ids) as id\n      on conflict (entity_type, entity_id, field_name)\n      do update set\n        workspace_id = excluded.workspace_id,\n        field_type = excluded.field_type,\n        value = excluded.value,\n        updated_at = now();\n    end if;\n\n    -- Remove stale legacy canonical rows for this field type if no matching table field exists.\n    delete from public.entity_properties ep\n    where ep.entity_type = 'table_row'\n      and ep.entity_id = any(v_ids)\n      and ep.field_type = v_field_type\n      and not exists (\n        select 1\n        from public.table_fields tf\n        where tf.table_id = p_table_id\n          and tf.type = ep.field_type\n          and lower(btrim(tf.name)) = lower(btrim(ep.field_name))\n      );\n  end loop;\n\n  updated := coalesce(array_length(v_ids, 1), 0);\n  row_ids := v_ids;\n  return next;\nend;\n"
  },
  {
    "routine_name": "update_task_full",
    "routine_definition": "\ndeclare\n  v_task public.task_items;\n  v_workspace_id uuid;\n  v_assignee_def uuid;\n  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);\n  v_assignee jsonb;\n  v_tag text;\n  v_tag_id uuid;\n  v_existing_tags uuid[];\n  v_desired_tags uuid[] := array[]::uuid[];\nbegin\n  update public.task_items\n  set\n    title = coalesce(p_updates->>'title', title),\n    status = coalesce(p_updates->>'status', status),\n    priorities = case\n      when p_updates ? 'priorities' then coalesce(p_updates->'priorities', '[]'::jsonb)\n      when p_updates ? 'priority' then\n        case\n          when nullif(btrim(coalesce(p_updates->>'priority', '')), '') is null\n            or lower(p_updates->>'priority') = 'none'\n            then '[]'::jsonb\n          else jsonb_build_array(\n            jsonb_build_object(\n              'field_name',\n              'Priority',\n              'value',\n              lower(p_updates->>'priority')\n            )\n          )\n        end\n      else priorities\n    end,\n    description = coalesce(p_updates->>'description', description),\n    due_date = coalesce((p_updates->>'dueDate')::date, due_date),\n    due_time = coalesce((p_updates->>'dueTime')::time, due_time),\n    start_date = coalesce((p_updates->>'startDate')::date, start_date),\n    hide_icons = coalesce((p_updates->>'hideIcons')::boolean, hide_icons),\n    recurring_enabled = coalesce((p_updates->>'recurringEnabled')::boolean, recurring_enabled),\n    recurring_frequency = coalesce(p_updates->>'recurringFrequency', recurring_frequency),\n    recurring_interval = coalesce((p_updates->>'recurringInterval')::integer, recurring_interval),\n    updated_by = p_updated_by\n  where id = p_task_id\n  returning * into v_task;\n\n  if v_task.id is null then\n    raise exception 'Task not found';\n  end if;\n\n  v_workspace_id := v_task.workspace_id;\n\n  if p_assignees_set then\n    delete from public.task_assignees where task_id = p_task_id;\n\n    for v_assignee in\n      select * from jsonb_array_elements(v_assignee_payload)\n    loop\n      insert into public.task_assignees (task_id, assignee_id, assignee_name)\n      values (\n        p_task_id,\n        nullif(v_assignee->>'id', '')::uuid,\n        coalesce(nullif(v_assignee->>'name', ''), nullif(v_assignee->>'id', ''), 'Unknown')\n      );\n    end loop;\n\n    select id into v_assignee_def\n    from public.property_definitions\n    where workspace_id = v_workspace_id\n      and name = 'Assignee'\n      and type = 'person'\n    limit 1;\n\n    if jsonb_array_length(v_assignee_payload) > 0 then\n      insert into public.entity_properties (\n        workspace_id,\n        entity_type,\n        entity_id,\n        property_definition_id,\n        field_name,\n        field_type,\n        value\n      )\n      values (\n        v_workspace_id,\n        'task',\n        p_task_id,\n        v_assignee_def,\n        'Assignee',\n        'assignee',\n        v_assignee_payload\n      )\n      on conflict (entity_type, entity_id, field_name)\n      do update set\n        field_type = excluded.field_type,\n        property_definition_id = excluded.property_definition_id,\n        value = excluded.value,\n        updated_at = now();\n    else\n      delete from public.entity_properties\n      where workspace_id = v_workspace_id\n        and entity_type = 'task'\n        and entity_id = p_task_id\n        and field_name = 'Assignee';\n    end if;\n  end if;\n\n  if p_tags_set then\n    select array_agg(tag_id)\n    into v_existing_tags\n    from public.task_tag_links\n    where task_id = p_task_id;\n\n    for v_tag in\n      select trim(value::text)\n      from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb))\n    loop\n      if v_tag is null or v_tag = '' then\n        continue;\n      end if;\n\n      select id into v_tag_id\n      from public.task_tags\n      where workspace_id = v_workspace_id\n        and name = v_tag\n      limit 1;\n\n      if v_tag_id is null then\n        insert into public.task_tags (workspace_id, name)\n        values (v_workspace_id, v_tag)\n        returning id into v_tag_id;\n      end if;\n\n      v_desired_tags := v_desired_tags || v_tag_id;\n    end loop;\n\n    insert into public.task_tag_links (task_id, tag_id)\n    select p_task_id, t\n    from unnest(v_desired_tags) as t\n    where not (t = any(coalesce(v_existing_tags, array[]::uuid[])))\n    on conflict do nothing;\n\n    delete from public.task_tag_links\n    where task_id = p_task_id\n      and tag_id = any(coalesce(v_existing_tags, array[]::uuid[]))\n      and not (tag_id = any(v_desired_tags));\n  end if;\n\n  return v_task;\nend;\n"
  }
]
```

---

## 21. entity_properties count by field_type

<!-- Paste results from RUN SEPARATELY: 21 -->

```
[
  {
    "field_type": "priority",
    "count": 38
  },
  {
    "field_type": "status",
    "count": 21
  },
  {
    "field_type": "assignee",
    "count": 11
  },
  {
    "field_type": "due_date",
    "count": 11
  },
  {
    "field_type": "tags",
    "count": 1
  }
]
```

---

## 22. entity_properties sample value per field_type

<!-- Paste results from RUN SEPARATELY: 22 -->

```
[
  {
    "field_type": "assignee",
    "value": [
      {
        "id": "af951fd0-523f-41bb-a35e-08e17dccda03",
        "name": "Amna"
      }
    ]
  },
  {
    "field_type": "due_date",
    "value": {
      "end": null,
      "start": "2026-02-13"
    }
  },
  {
    "field_type": "priority",
    "value": "low"
  },
  {
    "field_type": "status",
    "value": "in_progress"
  },
  {
    "field_type": "tags",
    "value": [
      "vacation"
    ]
  }
]
```
## 23. You didnt ask for this, but here is the timeline_events table schema

create table public.timeline_events (
  id uuid not null default gen_random_uuid (),
  timeline_block_id uuid not null,
  workspace_id uuid not null,
  title text not null,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  assignee_id uuid null,
  progress integer null default 0,
  notes text null,
  color text null default 'bg-blue-500/50'::text,
  is_milestone boolean null default false,
  baseline_start timestamp with time zone null,
  baseline_end timestamp with time zone null,
  display_order integer not null default 0,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  source_entity_type text null,
  source_entity_id uuid null,
  source_sync_mode text null,
  edited boolean null default false,
  priorities jsonb not null default '[]'::jsonb,
  status text not null default 'todo'::text,
  constraint timeline_events_pkey primary key (id),
  constraint timeline_events_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint timeline_events_assignee_id_fkey foreign KEY (assignee_id) references auth.users (id) on delete set null,
  constraint timeline_events_timeline_block_id_fkey foreign KEY (timeline_block_id) references blocks (id) on delete CASCADE,
  constraint timeline_events_updated_by_fkey foreign KEY (updated_by) references auth.users (id) on delete set null,
  constraint timeline_events_workspace_id_fkey foreign KEY (workspace_id) references workspaces (id) on delete CASCADE,
  constraint timeline_events_source_metadata_consistency check (
    (
      (
        (source_entity_type is null)
        and (source_entity_id is null)
        and (source_sync_mode is null)
      )
      or (
        (
          source_entity_type = any (
            array[
              'task'::text,
              'timeline_event'::text,
              'table_row'::text,
              'block'::text
            ]
          )
        )
        and (source_entity_id is not null)
        and (
          source_sync_mode = any (array['snapshot'::text, 'live'::text])
        )
      )
    )
  ),
  constraint timeline_events_source_sync_mode_check check (
    (
      source_sync_mode = any (array['snapshot'::text, 'live'::text])
    )
  ),
  constraint timeline_events_status_check check (
    (
      status = any (
        array[
          'todo'::text,
          'in_progress'::text,
          'blocked'::text,
          'done'::text
        ]
      )
    )
  ),
  constraint timeline_events_date_order check ((start_date <= end_date)),
  constraint timeline_events_priorities_valid_check check (is_valid_timeline_priorities (priorities)),
  constraint timeline_events_progress_check check (
    (
      (progress >= 0)
      and (progress <= 100)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_timeline_events_block on public.timeline_events using btree (timeline_block_id) TABLESPACE pg_default;

create index IF not exists idx_timeline_events_workspace on public.timeline_events using btree (workspace_id) TABLESPACE pg_default;

create index IF not exists idx_timeline_events_dates on public.timeline_events using btree (start_date, end_date) TABLESPACE pg_default;

create index IF not exists idx_timeline_events_assignee on public.timeline_events using btree (assignee_id) TABLESPACE pg_default;

create index IF not exists idx_timeline_events_source_entity on public.timeline_events using btree (source_entity_type, source_entity_id) TABLESPACE pg_default
where
  (source_entity_id is not null);

create index IF not exists idx_timeline_events_source_sync_mode on public.timeline_events using btree (source_sync_mode) TABLESPACE pg_default
where
  (source_entity_id is not null);

create index IF not exists idx_timeline_events_edited on public.timeline_events using btree (edited) TABLESPACE pg_default
where
  (source_entity_id is not null);

create index IF not exists idx_timeline_events_priorities_gin on public.timeline_events using gin (priorities) TABLESPACE pg_default;

create trigger cleanup_entity_properties_on_timeline_event_delete_trigger BEFORE DELETE on timeline_events for EACH row
execute FUNCTION cleanup_entity_properties_on_timeline_event_delete ();

create trigger timeline_events_set_updated_at BEFORE
update on timeline_events for EACH row
execute FUNCTION set_updated_at ();

create trigger trigger_set_edited_flag_on_timeline_event_update BEFORE
update on timeline_events for EACH row
execute FUNCTION set_edited_flag_on_timeline_event_update ();

## 24. Here is the task_items table schema 
create table public.task_items (
  id uuid not null default gen_random_uuid (),
  task_block_id uuid not null,
  workspace_id uuid not null,
  project_id uuid null,
  tab_id uuid null,
  title text not null,
  description text null,
  due_date date null,
  due_time time without time zone null,
  start_date date null,
  hide_icons boolean null default false,
  display_order integer not null default 0,
  recurring_enabled boolean null default false,
  recurring_frequency text null,
  recurring_interval integer null default 1,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  assignee_id uuid null,
  due_time_end time without time zone null,
  source_task_id uuid null,
  source_sync_mode text null,
  source_entity_type text null,
  source_entity_id uuid null,
  edited boolean null default false,
  priorities jsonb not null default '[]'::jsonb,
  status text not null default 'todo'::text,
  constraint task_items_pkey primary key (id),
  constraint task_items_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint task_items_assignee_id_fkey foreign KEY (assignee_id) references auth.users (id) on delete set null,
  constraint task_items_tab_id_fkey foreign KEY (tab_id) references tabs (id) on delete set null,
  constraint task_items_task_block_id_fkey foreign KEY (task_block_id) references blocks (id) on delete CASCADE,
  constraint task_items_updated_by_fkey foreign KEY (updated_by) references auth.users (id) on delete set null,
  constraint task_items_workspace_id_fkey foreign KEY (workspace_id) references workspaces (id) on delete CASCADE,
  constraint task_items_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE,
  constraint task_items_source_task_id_fkey foreign KEY (source_task_id) references task_items (id) on delete set null,
  constraint task_items_priorities_valid_check check (is_valid_task_priorities (priorities)),
  constraint task_items_source_sync_mode_check check (
    (
      source_sync_mode = any (array['snapshot'::text, 'live'::text])
    )
  ),
  constraint task_items_recurring_frequency_check check (
    (
      recurring_frequency = any (
        array['daily'::text, 'weekly'::text, 'monthly'::text]
      )
    )
  ),
  constraint task_items_source_metadata_consistency check (
    (
      (
        (source_entity_type is null)
        and (source_entity_id is null)
        and (source_sync_mode is null)
      )
      or (
        (
          source_entity_type = any (
            array[
              'task'::text,
              'timeline_event'::text,
              'table_row'::text,
              'block'::text
            ]
          )
        )
        and (source_entity_id is not null)
        and (
          source_sync_mode = any (array['snapshot'::text, 'live'::text])
        )
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_task_items_block on public.task_items using btree (task_block_id) TABLESPACE pg_default;

create index IF not exists idx_task_items_workspace on public.task_items using btree (workspace_id) TABLESPACE pg_default;

create index IF not exists idx_task_items_tab on public.task_items using btree (tab_id) TABLESPACE pg_default;

create index IF not exists idx_task_items_due on public.task_items using btree (due_date) TABLESPACE pg_default;

create index IF not exists idx_task_items_assignee on public.task_items using btree (assignee_id) TABLESPACE pg_default;

create index IF not exists idx_task_items_source_task_id on public.task_items using btree (source_task_id) TABLESPACE pg_default
where
  (source_task_id is not null);

create index IF not exists idx_task_items_sync_mode on public.task_items using btree (source_sync_mode) TABLESPACE pg_default
where
  (source_task_id is not null);

create index IF not exists idx_task_items_source_entity on public.task_items using btree (source_entity_type, source_entity_id) TABLESPACE pg_default
where
  (source_entity_id is not null);

create index IF not exists idx_task_items_edited on public.task_items using btree (edited) TABLESPACE pg_default
where
  (source_entity_id is not null);

create trigger cleanup_entity_properties_on_task_delete_trigger BEFORE DELETE on task_items for EACH row
execute FUNCTION cleanup_entity_properties_on_task_delete ();

create trigger sync_live_task_item_to_source_trigger
after
update on task_items for EACH row
execute FUNCTION sync_live_task_item_to_source ();

create trigger task_items_seed_priorities_from_source_row BEFORE INSERT on task_items for EACH row
execute FUNCTION seed_task_priorities_from_source_row ();

create trigger task_items_set_display_order BEFORE INSERT on task_items for EACH row
execute FUNCTION set_task_item_display_order ();

create trigger task_items_set_updated_at BEFORE
update on task_items for EACH row
execute FUNCTION set_updated_at ();

create trigger trigger_set_edited_flag_on_task_item_update BEFORE
update on task_items for EACH row
execute FUNCTION set_edited_flag_on_task_item_update ();

## 25. Sample data from a table that has status and priorty fields. This includes the data from table_rows and table_fields

[
  {
    "table_id": "9c644c05-c4c9-4b06-9f37-9d6d269bb451",
    "table_title": "vacation",
    "workspace_id": "4e52f23e-915d-4673-aac2-b4b485eeb276",
    "project_id": "300d84b0-c09e-44c0-a2fe-a13f7b9cebe3",
    "tab_id": null,
    "description": null,
    "table_created_at": "2026-02-19 20:49:57.893225+00",
    "table_updated_at": "2026-02-19 20:50:06.590133+00",
    "table_fields": [
      {
        "id": "8b055633-01a4-4dd9-864e-ffee1167ac6d",
        "name": "Name",
        "type": "text",
        "order": 1,
        "config": {},
        "created_at": "2026-02-19T20:49:57.979736+00:00",
        "is_primary": true,
        "updated_at": "2026-02-19T20:49:57.979736+00:00",
        "property_definition_id": null
      },
      {
        "id": "b01329c3-4f40-4051-aea7-304cb27960b4",
        "name": "visit priority",
        "type": "priority",
        "order": 2,
        "config": {
          "levels": [
            {
              "id": "pri_1",
              "color": "#ef4444",
              "label": "Critical",
              "order": 4
            },
            {
              "id": "pri_2",
              "color": "#f59e0b",
              "label": "High",
              "order": 3
            },
            {
              "id": "pri_3",
              "color": "#3b82f6",
              "label": "Medium",
              "order": 2
            },
            {
              "id": "pri_4",
              "color": "#6b7280",
              "label": "Low",
              "order": 1
            }
          ]
        },
        "created_at": "2026-02-19T20:49:57.979736+00:00",
        "is_primary": false,
        "updated_at": "2026-02-19T20:50:35.159488+00:00",
        "property_definition_id": null
      },
      {
        "id": "1da40927-0f4e-4fc2-8bbb-d565955234c7",
        "name": "flight priority",
        "type": "priority",
        "order": 3,
        "config": {
          "levels": [
            {
              "id": "pri_1",
              "color": "#ef4444",
              "label": "Critical",
              "order": 4
            },
            {
              "id": "pri_2",
              "color": "#f59e0b",
              "label": "High",
              "order": 3
            },
            {
              "id": "pri_3",
              "color": "#3b82f6",
              "label": "Medium",
              "order": 2
            },
            {
              "id": "pri_4",
              "color": "#6b7280",
              "label": "Low",
              "order": 1
            }
          ]
        },
        "created_at": "2026-02-19T20:49:57.979736+00:00",
        "is_primary": false,
        "updated_at": "2026-02-19T20:50:24.424043+00:00",
        "property_definition_id": null
      },
      {
        "id": "fdc7db4c-8c31-40f3-92b2-5d26d8fb2998",
        "name": "travel date",
        "type": "date",
        "order": 4,
        "config": {},
        "created_at": "2026-02-19T20:50:56.858912+00:00",
        "is_primary": false,
        "updated_at": "2026-02-19T20:51:10.761937+00:00",
        "property_definition_id": null
      }
    ],
    "table_rows": [
      {
        "id": "a203e27a-7113-43cc-82d9-1007308511f0",
        "data": {
          "1da40927-0f4e-4fc2-8bbb-d565955234c7": "urgent",
          "8b055633-01a4-4dd9-864e-ffee1167ac6d": "Dubai",
          "b01329c3-4f40-4051-aea7-304cb27960b4": "high",
          "fdc7db4c-8c31-40f3-92b2-5d26d8fb2998": "2026-02-20"
        },
        "order": 1,
        "created_at": "2026-02-19T20:49:58.055968+00:00",
        "created_by": "af951fd0-523f-41bb-a35e-08e17dccda03",
        "updated_at": "2026-02-19T20:51:17.691488+00:00",
        "updated_by": "af951fd0-523f-41bb-a35e-08e17dccda03",
        "source_entity_id": null,
        "source_sync_mode": null,
        "source_entity_type": null
      },
      {
        "id": "0494317b-39e4-4a4e-ae20-ae171ddb1564",
        "data": {},
        "order": 2,
        "created_at": "2026-02-19T20:49:58.055968+00:00",
        "created_by": "af951fd0-523f-41bb-a35e-08e17dccda03",
        "updated_at": "2026-02-19T20:49:58.055968+00:00",
        "updated_by": "af951fd0-523f-41bb-a35e-08e17dccda03",
        "source_entity_id": null,
        "source_sync_mode": null,
        "source_entity_type": null
      },
      {
        "id": "ad8d34e7-6c30-4367-959c-514aa220b1ff",
        "data": {},
        "order": 3,
        "created_at": "2026-02-19T20:49:58.055968+00:00",
        "created_by": "af951fd0-523f-41bb-a35e-08e17dccda03",
        "updated_at": "2026-02-19T20:49:58.055968+00:00",
        "updated_by": "af951fd0-523f-41bb-a35e-08e17dccda03",
        "source_entity_id": null,
        "source_sync_mode": null,
        "source_entity_type": null
      }
    ]
  }
]