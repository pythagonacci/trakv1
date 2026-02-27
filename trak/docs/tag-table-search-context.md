### Tag data model

**Canonical tag-related tables**

- **Workspace-level task tag bank**
  - `public.task_tags`
  - `public.task_tag_links` (join table between tasks and tags)
- **Project-level tag bank**
  - `public.project_tags`
- **Per-entity tag values**
  - `public.entity_properties` with `field_type = 'tags'`
- **Inline project tags**
  - `public.projects.tags` (array of tags on the project itself, separate from the tag bank)

**`task_tags` / `task_tag_links`**

```7965:7974:trak/supabase/schema.sql
-- Name: task_tags; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.task_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
```

```7953:7960:trak/supabase/schema.sql
-- Name: task_tag_links; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.task_tag_links (
    task_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
```

- **Uniqueness & indexes**

```9430:9435:trak/supabase/schema.sql
-- Name: task_tags task_tags_workspace_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_workspace_id_name_key UNIQUE (workspace_id, name);
```

```11436:11445:trak/supabase/schema.sql
-- Name: idx_task_tag_links_tag; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_task_tag_links_tag ON public.task_tag_links USING btree (tag_id);

-- Name: idx_task_tag_links_task; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_task_tag_links_task ON public.task_tag_links USING btree (task_id);
```

```11450:11453:trak/supabase/schema.sql
-- Name: idx_task_tags_workspace; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_task_tags_workspace ON public.task_tags USING btree (workspace_id);
```

- **How they’re used**
  - When creating/updating tasks, tags can be synced into `task_tags`/`task_tag_links` (see functions around lines 2611–2727 and 4258–4288 in `schema.sql`).
  - There’s also a trigger `sync_live_task_tags_to_source_trigger` that keeps tags in sync between live snapshots and source tasks.

**`project_tags` (project-level tag bank)**

```7519:7527:trak/supabase/schema.sql
-- Name: project_tags; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.project_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
```

```10743:10753:trak/supabase/schema.sql
-- Name: idx_project_tags_project_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX idx_project_tags_project_id ON public.project_tags USING btree (project_id);

-- Name: idx_project_tags_project_id_name_lower; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX idx_project_tags_project_id_name_lower
  ON public.project_tags USING btree (project_id, lower(TRIM(BOTH FROM name)));
```

```12985:12989:trak/supabase/schema.sql
ALTER TABLE ONLY public.project_tags
    ADD CONSTRAINT project_tags_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
```

- **RLS policies**

```15722:15725:trak/supabase/schema.sql
ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;
```

```15878:15882:trak/supabase/schema.sql
CREATE POLICY sel_project_tags ON public.project_tags FOR SELECT USING (public.can_access_project(project_id));
```

```15627:15631:trak/supabase/schema.sql
CREATE POLICY ins_project_tags ON public.project_tags FOR INSERT WITH CHECK (public.can_access_project(project_id));
```

```15335:15338:trak/supabase/schema.sql
CREATE POLICY del_project_tags ON public.project_tags FOR DELETE USING (public.can_access_project(project_id));
```

- **Access from app code** (project tag bank / picker)

```435:456:trak/src/app/actions/project.ts
/** Get all tags for a project (tag bank). */
export async function getProjectTags(
  projectId: string,
  opts?: { authContext?: AuthContext }
): Promise<{ data: string[] } | { error: string }> {
  ...
  const { data: rows, error } = await supabase
    .from('project_tags')
    .select('name')
    .eq('project_id', projectId)
    .order('name');

  if (error) return { error: error.message }
  return { data: (rows || []).map((r) => r.name) }
}
```

```459:483:trak/src/app/actions/project.ts
/** Add a tag to a project's tag bank (idempotent). */
export async function addProjectTag(...){
  ...
  const { error } = await supabase.from('project_tags').insert({ project_id: projectId, name: trimmed });

  if (error) {
    if (error.code === '23505') return { data: null }
    return { error: error.message }
  }
  return { data: null }
}
```

- **Project create/edit dialog integration**

```118:125:trak/src/app/dashboard/projects/project-dialog.tsx
// Load tag bank (project_tags) in edit mode
useEffect(() => {
  if (isOpen && mode === "edit" && initialData?.id) {
    getProjectTags(initialData.id).then((result) => {
      if ("data" in result) setTagBank(result.data);
    });
  }
}, [isOpen, mode, initialData?.id]);
```

**Per-entity tags via `entity_properties`**

```7164:7179:trak/supabase/schema.sql
-- Name: entity_properties; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.entity_properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    value jsonb,
    workspace_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    entity_subtype text,
    field_name text NOT NULL,
    field_type text NOT NULL,
    CONSTRAINT entity_properties_entity_type_check1 CHECK ((entity_type = ANY (ARRAY['block'::text, 'task'::text, 'subtask'::text, 'timeline_event'::text, 'table_row'::text]))),
    CONSTRAINT entity_properties_field_type_check CHECK ((field_type = ANY (ARRAY['priority'::text, 'status'::text, 'assignee'::text, 'due_date'::text, 'tags'::text])))
);
```

- Tags for tasks/blocks/timeline events are primarily read via `entity_properties.field_type = 'tags'` (not directly from `task_tags`) in the AI search code.
- `value` is JSONB; for tags it can be:
  - A simple string tag, e.g. `"frontend"`
  - An object `{ id, name, color? }`
  - Or an array of such values

**Postgres extensions relevant to search**

```124:124:trak/supabase/schema.sql
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
```

```208:208:trak/supabase/schema.sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
```

- No `pg_trgm` or `unaccent` extensions are enabled in `schema.sql`.


### Table rows data model

**Core tables: `tables`, `table_fields`, `table_rows`**

```7825:7838:trak/supabase/schema.sql
-- Name: tables; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid,
    title text DEFAULT 'Untitled Table'::text NOT NULL,
    description text,
    icon text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    tab_id uuid
);
```

```7743:7757:trak/supabase/schema.sql
-- Name: table_fields; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.table_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid NOT NULL,
    name text DEFAULT 'Untitled Field'::text NOT NULL,
    type text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    "order" integer NOT NULL,
    is_primary boolean DEFAULT false,
    width integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_fields_type_check CHECK ((type = ANY (ARRAY[
      'text','long_text','number','select','multi_select','date','checkbox',
      'subtask','url','email','phone','person','files',
      'created_time','last_edited_time','created_by','last_edited_by',
      'formula','relation','rollup','status','priority'
    ]::text[])))
);
```

```7777:7795:trak/supabase/schema.sql
-- Name: table_rows; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.table_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    "order" numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    source_entity_type text,
    source_entity_id uuid,
    source_sync_mode text,
    edited boolean DEFAULT false,
    CONSTRAINT table_rows_source_entity_check CHECK (
      ((source_entity_type IS NULL) AND (source_entity_id IS NULL))
      OR (
        (source_entity_type = ANY (ARRAY['task','timeline_event','table_row','block']))
        AND (source_entity_id IS NOT NULL)
      )
    ),
    CONSTRAINT table_rows_source_metadata_consistency CHECK (
      ((source_entity_type IS NULL) AND (source_entity_id IS NULL) AND (source_sync_mode IS NULL))
      OR (
        (source_entity_type = ANY (ARRAY['task','timeline_event','table_row','block']))
        AND (source_entity_id IS NOT NULL)
        AND (source_sync_mode = ANY (ARRAY['snapshot','live']))
      )
    ),
    CONSTRAINT table_rows_source_sync_mode_check CHECK (
      source_sync_mode = ANY (ARRAY['snapshot','live'])
    )
);
```

- **Row identity fields**
  - `table_rows.id` (PK)
  - `table_rows.table_id` → `tables.id`
  - `table_rows.created_at`, `updated_at`
  - `table_rows.order` numeric (used for ordering and subtask hierarchies)
  - `created_by`, `updated_by` (FKs to `auth.users`)
  - Optional source metadata fields: `source_entity_type`, `source_entity_id`, `source_sync_mode`, `edited`

- **Cell values**
  - Stored in `table_rows.data` JSONB.
  - Keys are the `table_fields.id` UUIDs (stringified) – server-side filters use `data->>fieldId`.
    - Example from table data route handler:

```112:143:trak/src/app/api/tables/data/route.ts
filters.forEach((filter) => {
  const column = `data->>${filter.fieldId}`;
  switch (filter.operator) {
    case "equals":
      working = working.filter(column, "eq", filter.value ?? null);
      break;
    case "contains":
      working = working.filter(column, "ilike", `%${filter.value ?? ""}%`);
      break;
    ...
  }
});
```

  - `table_fields.type` controls semantics (`multi_select`, `person`, `status`, etc.), but values are represented as raw JSON in `data`.

- **Example of in-memory row shape (after hydration)**

From chart tests (not exact DB shape, but representative of `TableRow` typed data):

```115:137:trak/src/lib/charts/normalizeToChartRows.test.ts
describe("table_rows", () => {
  it("produces ChartRow[] with id, Task Title from data, status, assignee, tags", () => {
    const raw = [
      {
        id: "r1",
        data: { Title: "Row one", status: "Active", custom: 42 },
        assignees: [{ id: "u1", name: "Alice" }],
        tags: [{ id: "t1", name: "urgent" }],
        status: "Active",
        priority: "high",
        due_date: "2025-04-01",
      },
    ];
    ...
  });
});
```

In the real DB, instead of `"Title"`/`"status"` keys, `data` would use field IDs; the UI maps those to names via `table_fields`.

- **Column definition table**
  - `table_fields` as above.
  - Uniqueness and indexes:

```9302:9307:trak/supabase/schema.sql
ALTER TABLE ONLY public.table_fields
    ADD CONSTRAINT table_fields_order_unique UNIQUE (table_id, "order");
```

```11058:11075:trak/supabase/schema.sql
CREATE INDEX idx_table_fields_order ON public.table_fields USING btree (table_id, "order");
CREATE INDEX idx_table_fields_table_id ON public.table_fields USING btree (table_id);
CREATE INDEX idx_table_fields_table_order ON public.table_fields USING btree (table_id, "order");
```

- **Indexes on `table_rows` for filtering/sorting**

```11107:11152:trak/supabase/schema.sql
CREATE INDEX idx_table_rows_data_gin ON public.table_rows USING gin (data);
CREATE INDEX idx_table_rows_edited ON public.table_rows USING btree (edited) WHERE (source_entity_id IS NOT NULL);
CREATE INDEX idx_table_rows_order ON public.table_rows USING btree (table_id, "order");
CREATE INDEX idx_table_rows_source_entity ON public.table_rows USING btree (source_entity_type, source_entity_id) WHERE (source_entity_id IS NOT NULL);
CREATE INDEX idx_table_rows_source_sync_mode ON public.table_rows USING btree (source_sync_mode) WHERE (source_entity_id IS NOT NULL);
CREATE INDEX idx_table_rows_table_id ON public.table_rows USING btree (table_id);
CREATE INDEX idx_table_rows_table_order ON public.table_rows USING btree (table_id, "order");
```

- **Universal properties for table rows**
  - `entity_properties` supports `entity_type = 'table_row'` with `field_type` including `'tags'`, `'status'`, `'priority'`, etc.
  - There are helper functions that sync from `table_rows` into `entity_properties` and back (e.g., for priorities; see lines 3233–3285 in `schema.sql`).

### Current query paths

#### Tag picker / tag search UI

**Project tag bank in properties menu**

- Component: `property-menu.tsx`
  - Shows project tag bank if `projectId` is provided.
  - No dedicated “search”; it renders a list of tags and a free-text input.

```667:683:trak/src/components/properties/property-menu.tsx
{(focusedGroup === undefined || focusedGroup === "tags") && (
  <>
    <div className="...">Tags</div>
    {projectId && projectTagBank.length > 0 && (
      <div className="...">
        <p className="...">Project tag bank</p>
        <div className="flex flex-wrap gap-0.5">
          {projectTagBank.map((tag) => {
            const currentTags = direct?.tags || [];
            const isOnEntity = currentTags.some((t) => t.toLowerCase() === tag.toLowerCase());
            return (
              <button
                key={tag}
                type="button"
                disabled={isOnEntity}
                onClick={() => {
                  if (!isOnEntity)
                    addTagMutation.mutate(tag, {
                      onSuccess: () => projectId && addProjectTagMutation.mutate(tag)
                    });
                }}
              >
                ...
              </button>
            );
          })}
        </div>
      </div>
    )}
    <div className="flex items-center ...">
      <input
        type="text"
        value={newTagInput}
        onChange={(e) => setNewTagInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(); }}
        placeholder="Add tag…"
        ...
      />
      <button type="button" onClick={handleAddTag}>+</button>
    </div>
    {(direct?.tags ?? []).length > 0 && (
      <div className="flex flex-wrap gap-0.5 mt-0.5">
        {(direct?.tags ?? []).map((tag) => (
          <span key={tag} ...>
            <TagIcon ... />
            {tag}
            <button type="button" onClick={() => handleRemoveTag(tag)}><X ... /></button>
          </span>
        ))}
      </div>
    )}
  </>
)}
```

- Under the hood:
  - `projectTagBank` comes from `useProjectTags` hook (`getProjectTags` server action).
  - Adding/removing tags on the entity uses `useAddTag` / `useRemoveTag` which hit `/app/actions/entity-properties` (working through `entity_properties`).

**AI-side tag search (`searchTags`)**

- Server action: `searchTags` in `ai-search.ts` (tag search endpoint used by AI tools / intent parser).

```3848:3866:trak/src/app/actions/ai-search.ts
export async function searchTags(params: {
  searchText?: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TagResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  // Aggregate tags from entity_properties (field_type="tags") across entities
  const { data, error } = await supabase
    .from("entity_properties")
    .select("entity_id, value")
    .eq("workspace_id", workspaceId)
    .eq("field_type", "tags")
    .in("entity_type", ["task", "block", "timeline_event"]);
```

- Fuzzy/typo-tolerant behavior is implemented in JS (see “Search UX” section).

- Invocation path:
  - AI deterministic parser maps natural language “tags” queries to a `searchTags` tool/action:

```241:248:trak/src/lib/ai/deterministic-parser.ts
const searchTags = matchSearchEntity(cleaned, normalized, tokens, "tag", "searchTags");
if (searchTags) candidates.push(searchTags);
```

- This is a **Next.js server action** (not a Postgres RPC), using Supabase client with RLS.

#### Table row filtering/search

**Primary data fetch**

- API route: `src/app/api/tables/data/route.ts` – server-side filtering & sorting on `table_rows.data` based on `table_views.config.filters`.

```63:75:trak/src/app/api/tables/data/route.ts
const { query: filteredQuery, unsupportedFilters } = applyServerFilters(
  supabase
    .from("table_rows")
    .select("id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by")
    .eq("table_id", tableId),
  filters
);

const sortedQuery = applyServerSorts(filteredQuery, sorts);

const { data: rows, error, count } = await (sortedQuery as PostgrestFilterBuilder<any, any, any, any>)
  .order("order", { ascending: true })
  .range(offset, offset + limit - 1);
```

- `applyServerFilters`:
  - Builds SQL expressions against `data->>fieldId` (string comparison, numeric comparisons, null checks).
  - Unsupported operators fall back to client-side JS filtering.

**Table row search endpoint**

- Server action: `searchTableRows` in `tables/query-actions.ts`.

```92:113:trak/src/app/actions/tables/query-actions.ts
export async function searchTableRows(tableId: string, query: string): Promise<ActionResult<TableRow[]>> {
  const _t0 = performance.now();
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] searchTableRows tableId=${tableId}`);
  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Server-side search: cast JSONB data to text and use ILIKE for matching.
  // Stabilization fix — still seq scans on large tables; future: GIN/FTS indexes.
  const { data: rows, error } = await supabase
    .from("table_rows")
    .select("id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by")
    .eq("table_id", tableId)
    .filter("data::text", "ilike", `%${query}%`)
    .limit(50);

  if (error || !rows) {
    ...
    return { error: "Failed to search rows" };
  }
  ...
  return { data: rows as TableRow[] };
}
```

- This is **server-side SQL search**, not client filtering.

**Client integration for table search**

- Hook: `useSearchTableRows` wraps the server action with React Query:

```544:553:trak/src/lib/hooks/use-table-queries.ts
export function useSearchTableRows(tableId: string, search: string) {
  return useQuery({
    queryKey: ['tableSearch', tableId, search],
    queryFn: async () => {
      if (!search) return [];
      const result = await searchTableRows(tableId, search);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(search),
  });
}
```

- `TableView` wires it to the search box:

```292:374:trak/src/components/tables/table-view.tsx
const [search, setSearch] = useState("");
const searchResult = useSearchTableRows(tableId, search);
...
const rows: TableRowType[] = search
  ? ((searchResult.data ?? []) as TableRowType[])
  : (rowData?.rows ?? []);
```

- UI search inputs:
  - `table-header-compact.tsx` search input (compact header):

```258:265:trak/src/components/tables/table-header-compact.tsx
<input
  ... placeholder="Search table..."
  value={search}
  ref={searchInputRef}
  onChange={(e) => {
    const q = e.target.value;
    setSearch(q);
    onSearch?.(q);
  }}
/>
```

  - `table-toolbar.tsx` (alternate toolbar):

```46:53:trak/src/components/tables/table-toolbar.tsx
<input
  className="..."
  placeholder="Search rows..."
  value={search}
  onChange={(e) => {
    const q = e.target.value;
    setSearch(q);
    onSearch?.(q);
  }}
/>
```

  - In `TableView`, `onSearch` is wired to `setSearch`, which in turn triggers `useSearchTableRows`.

**Other search endpoints (for context)**

- Global search uses AI search actions (`searchProjects`, `searchTasks`, `searchDocs`, `searchBlocks`, `searchTabs`), all from `ai-search.ts`, with client in `global-search.tsx`.
- There is a generic `searchEntityProperties` action in `ai-search.ts` for property-level searches.


### Search UX requirements (current + inferred)

**Tag search (AI-side `searchTags`)**

- **Match behavior**
  - Fuzzy/typo-tolerant search over tag names implemented in JS:

```3873:3908:trak/src/app/actions/ai-search.ts
const searchLower = params.searchText?.toLowerCase() ?? null;
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizedSearch = searchLower ? normalize(searchLower) : null;
...
const isFuzzyMatch = (name: string): boolean => {
  if (!searchLower || !normalizedSearch) return true;
  const nameLower = name.toLowerCase();
  const normalizedName = normalize(name);
  if (nameLower.includes(searchLower)) return true;
  if (normalizedName.includes(normalizedSearch)) return true;

  const maxEdits = normalizedSearch.length <= 4 ? 1 : normalizedSearch.length <= 7 ? 2 : 3;
  return editDistance(normalizedName, normalizedSearch) <= maxEdits;
};
```

  - So it supports:
    - Case-insensitive substring match.
    - Normalized substring match (remove non-alphanumerics).
    - Levenshtein distance with 1–3 allowed edits depending on query length.

- **Ranking**
  - Results are sorted **alphabetically by name** (`a.name.localeCompare(b.name)`), not by closeness or frequency.

- **Scope**
  - Reads from `entity_properties` for entity types `task`, `block`, `timeline_event`.
  - Ignores `task_tags` and `project_tags` today.

- **Limits**
  - `limit` parameter (default 50) is applied after JS filtering and sorting.

- **UX hints**
  - There is no dedicated UI component in this repo that calls `searchTags` directly (it is exposed for AI / tooling; any tag picker autocomplete would likely be built on top of this or `searchEntityProperties`).

**Tag UI picker (property menu)**

- Behaviors:
  - No fuzzy search; user either:
    - Clicks from project tag bank (exact tags, case-insensitive membership check when deciding disabled state).
    - Types free-form tag name to add (no autocomplete suggestions).
  - Tag values on an entity (`direct?.tags`) are rendered as simple strings with remove buttons.
- There is no explicit ranking or pagination; it’s all in-memory arrays.

**Table row search**

- **Match behavior**
  - Search is **contains match** over the whole JSON row, via `data::text ILIKE '%query%'`.
  - Case-insensitive due to `ILIKE`.
  - No typo tolerance server-side; any fuzzy behavior must be added client-side (none exists currently).

- **Columns searched**
  - All columns serialized into `data::text` are searched; there’s no per-column restriction for the search endpoint.
  - More precise filtering is done via `filters` in views (for specific fields) rather than via search.

- **Ranking**
  - No explicit ranking; rows returned in unspecified order except for implicit Postgres ordering; query doesn’t `ORDER BY` anything beyond existing order filter, so whichever order Postgres chooses (likely `table_id` + physical order).

- **Result limits & pagination**
  - Search endpoint caps at 50 rows (`.limit(50)`).
  - No pagination for search results; table search is more of a quick find rather than an infinite scroll.

- **Debounce**
  - Table search inputs **do not explicitly debounce**; they call `onSearch` on every key stroke.
  - React Query’s `enabled: Boolean(search)` prevents requests when search string is falsy, but there’s no delay timer; server load depends on user typing speed and React Query deduping.

**Global search (projects/tasks/docs/blocks/tabs)**

- `global-search.tsx` implements:
  - A 200ms debounce (`setTimeout(..., 200)`).
  - Minimum query length of 2 characters (`if (!query.trim() || query.length < 2) ...`).
  - Per-type limits (10 overall, slicing merged results).
  - No explicit typo-tolerance beyond whatever the underlying actions implement.

**Search across multiple columns / cell values**

- Table row search:
  - `data::text ILIKE` implicitly spans all columns/cell values.
- Property search:
  - `searchEntityProperties` supports `valueFilter.op = "contains" | "eq" | "gte" | "lte"` across arbitrary `field_name`/`field_type` combinations, but is separate from table row JSON search.


### Scale & performance constraints

**Observed design for scale (from code & migrations)**

- **Indexes**:
  - `idx_table_rows_data_gin` GIN index on `table_rows.data` exists, but `searchTableRows` currently uses `filter("data::text", "ilike", ...)`, which will not use this GIN index effectively and will likely degrade into sequential scans for large tables.
  - `20260224000000_add_perf_indexes.sql` explicitly calls out “hot path” performance for tables:

```19:24:trak/supabase/migrations/20260224000000_add_perf_indexes.sql
-- Hot path indexes for table loading
CREATE INDEX IF NOT EXISTS idx_table_rows_table_order
  ON table_rows(table_id, "order");

CREATE INDEX IF NOT EXISTS idx_table_fields_table_order
  ON table_fields(table_id, "order");
```

- **Perf comments**
  - `searchTableRows` notes:

```99:101:trak/src/app/actions/tables/query-actions.ts
// Server-side search: cast JSONB data to text and use ILIKE for matching.
// Stabilization fix — still seq scans on large tables; future: GIN/FTS indexes.
```

  - This is an explicit acknowledgement that current JSONB search is **not optimized** for large tables and that GIN/FTS is expected in future.

- **Overfetch patterns**
  - `searchEntityProperties` and some AI search paths overfetch (`limit * 10`) when they need JS-side value filtering, implying expected cardinalities in the few thousands to tens of thousands per workspace / entity_type, but no concrete numbers are encoded.

**Explicit scale numbers / latency targets**

- There are **no explicit numeric targets** (tags per workspace, rows per table, p50/p95 latency) coded into the repo.
- Logging is present:
  - `searchTableRows` logs ms timings when `PERF_DEBUG === "1"`.
  - `/api/tables/data` route logs timings similarly.
- There are no checked-in EXPLAIN plans or performance dashboards.

**Practical constraints (inferred)**

- Given:
  - JSONB GIN index on `table_rows.data`.
  - Comments about seq scans and future FTS.
  - Overfetching patterns for property search.
- It’s reasonable to assume:
  - Tables may reach at least low tens of thousands of rows per table, enough that unindexed `data::text ILIKE` is undesirable.
  - Workspaces may have dozens of tables; each with many fields, but the primary perf concern is row count and JSON search.


### RLS & security constraints

**Tags (workspace-level `task_tags` / `task_tag_links`)**

```14578:14610:trak/supabase/schema.sql
CREATE POLICY "Task tags deletable by workspace members" ON public.task_tags FOR DELETE USING ((workspace_id IN (
  SELECT workspace_members.workspace_id FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())
)));

CREATE POLICY "Task tags insertable by workspace members" ON public.task_tags FOR INSERT WITH CHECK ((workspace_id IN (
  SELECT workspace_members.workspace_id FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())
)));

CREATE POLICY "Task tags updatable by workspace members" ON public.task_tags FOR UPDATE USING ((workspace_id IN (
  SELECT workspace_members.workspace_id FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())
)));

CREATE POLICY "Task tags visible to workspace members" ON public.task_tags FOR SELECT USING ((workspace_id IN (
  SELECT workspace_members.workspace_id FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid())
)));
```

```14545:14571:trak/supabase/schema.sql
CREATE POLICY "Task tag links deletable by workspace members" ON public.task_tag_links FOR DELETE USING ((task_id IN (
  SELECT task_items.id FROM public.task_items
  WHERE (task_items.workspace_id IN (SELECT workspace_members.workspace_id FROM public.workspace_members
    WHERE (workspace_members.user_id = auth.uid()))
))));

CREATE POLICY "Task tag links insertable by workspace members" ON public.task_tag_links FOR INSERT WITH CHECK ((task_id IN (
  SELECT task_items.id FROM public.task_items
  WHERE (task_items.workspace_id IN (SELECT workspace_members.workspace_id FROM public.workspace_members
    WHERE (workspace_members.user_id = auth.uid()))
))));

CREATE POLICY "Task tag links visible to workspace members" ON public.task_tag_links FOR SELECT USING ((task_id IN (
  SELECT task_items.id FROM public.task_items
  WHERE (task_items.workspace_id IN (SELECT workspace_members.workspace_id FROM public.workspace_members
    WHERE (workspace_members.user_id = auth.uid()))
))));
```

- **Implication**: Tag bank and tag links are fully constrained to workspaces; users only see tags linked to tasks in workspaces they belong to.

**Project-level `project_tags`**

- Uses `public.can_access_project(project_id)` in all policies (see above).
- This ties visibility strictly to project-level access controls.

**Entity properties (universal tags, statuses, etc.)**

```15404:15407:trak/supabase/schema.sql
ALTER TABLE public.entity_properties ENABLE ROW LEVEL SECURITY;
```

```13998:14028:trak/supabase/schema.sql
CREATE POLICY "Entity properties deletable by workspace members" ON public.entity_properties FOR DELETE USING ((workspace_id IN (
  SELECT workspace_members.workspace_id FROM public.workspace_members WHERE (workspace_members.user_id = auth.uid())
)));

CREATE POLICY "Entity properties insertable by workspace members" ON public.entity_properties FOR INSERT WITH CHECK ((workspace_id IN (
  SELECT workspace_members.workspace_id FROM public.workspace_members WHERE (workspace_members.user_id = auth.uid())
)));

CREATE POLICY "Entity properties updatable by workspace members" ON public.entity_properties FOR UPDATE USING ((workspace_id IN (
  SELECT workspace_members.workspace_id FROM public.workspace_members WHERE (workspace_members.user_id = auth.uid())
)));

CREATE POLICY "Entity properties visible to workspace members" ON public.entity_properties FOR SELECT USING ((workspace_id IN (
  SELECT workspace_members.workspace_id FROM public.workspace_members WHERE (workspace_members.user_id = auth.uid())
)));
```

- **Implication**:
  - `searchTags` and `searchEntityProperties` are limited to properties in the caller’s workspaces (they also explicitly filter by `workspace_id` in SQL).
  - No cross-workspace leakage via search actions.

**Table rows**

```16009:16012:trak/supabase/schema.sql
-- Name: table_rows; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.table_rows ENABLE ROW LEVEL SECURITY;
```

```14191:14220:trak/supabase/schema.sql
CREATE POLICY "Table rows deletable by workspace members" ON public.table_rows FOR DELETE USING ((EXISTS (
  SELECT 1 FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN (
    SELECT workspace_members.workspace_id FROM public.workspace_members
    WHERE (workspace_members.user_id = auth.uid())
  )))
)));

CREATE POLICY "Table rows insertable by workspace members" ON public.table_rows FOR INSERT WITH CHECK ((EXISTS (
  SELECT 1 FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN (
    SELECT workspace_members.workspace_id FROM public.workspace_members
    WHERE (workspace_members.user_id = auth.uid())
  )))
)));

CREATE POLICY "Table rows updatable by workspace members" ON public.table_rows FOR UPDATE USING ((EXISTS (
  SELECT 1 FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN (
    SELECT workspace_members.workspace_id FROM public.workspace_members
    WHERE (workspace_members.user_id = auth.uid())
  )))
)));
```

- **Note**: There is no explicit `SELECT` policy snippet in the shown block, but enabling RLS and the pattern of other tables implies there is a corresponding select policy elsewhere, likely via similar `tables.workspace_id IN workspace_members` pattern (the grep output was truncated just after the updatable policy).

**RPCs vs server actions**

- Search functionality for tags and table rows is implemented **in Next.js server actions / API routes**, not as Postgres `SECURITY DEFINER` RPCs.
- Supabase clients in `ai-search.ts` and `tables/query-actions.ts` are regular RLS-respecting clients constructed via server-side helpers:
  - `createClient` in `@/lib/supabase/server`
  - `getSearchContext` in `ai-search.ts` (wraps workspace membership + supabase client)
  - `requireTableAccess` / `requireWorkspaceAccessForTables` for tables

**Leakage concerns**

- Since all search queries filter by `workspace_id` and/or `table_id` with RLS enforcing workspace membership, leakage between workspaces is minimized.
- There is potential for **information about existence** of tags or rows to leak across entities inside the same workspace (which is intended).
- No use of `service_role` for search endpoints is visible in the codebase for tags or table rows; RLS is always in effect.


### Proposed search integration points

*(Where to integrate enhanced fuzzy/typo-tolerant search, not the full design.)*

**Tags**

- **Primary integration point**: `searchTags` in `ai-search.ts`.
  - This is already the canonical workspace-wide tag search action used by the AI tooling.
  - To move fuzzy logic into the DB:
    - Add a dedicated tag search **RPC** that:
      - Aggregates tag names from `entity_properties` and/or `task_tags`.
      - Optionally uses FTS (`tsvector`) or trigram matching (would require enabling `pg_trgm`).
    - Replace or augment the in-JS Levenshtein filtering in `searchTags` with a call to that RPC.
- **Secondary integration point**: tag pickers
  - `property-menu.tsx` currently doesn’t call `searchTags`; it reads:
    - Project tag bank via `getProjectTags` (exact names).
    - Free-text input for new tags.
  - A future tag autocomplete could:
    - Call `searchTags` as the user types.
    - Or call `searchEntityProperties` with `field_type = 'tags'` and a `valueFilter.contains`.

**Table rows**

- **Primary integration point**: `searchTableRows` in `tables/query-actions.ts`.
  - Currently: `data::text ILIKE '%query%'` with a hard limit 50.
  - Candidate enhancements:
    - Swap to an RPC that:
      - Uses `GIN` on `data` (jsonb path queries) or a generated `tsvector` column.
      - Limits to a subset of fields (e.g., primary text columns) for relevance.
    - Keep the same server action shape; only internal SQL changes.
- **Secondary integration point**: `/api/tables/data` route
  - For more structured, filter-based search (rather than free-form), enhancements should land in:
    - `applyServerFilters` for additional operators (e.g. case-insensitive contains, prefix).
    - DB indexes on specific `data` paths (via generated columns) if needed.

**Cross-entity / universal property search**

- Integration via `searchEntityProperties` in `ai-search.ts`:
  - If you want to search tags *and* table row universal properties in a single call, this action is already structured for that.
  - An SQL RPC could be added later to implement more efficient workspace-wide property search using FTS or trigram, with this action as the call site.

**Layering**

- **DB layer**:
  - Introduce optional FTS/trigram indexes and/or generated columns for:
    - Tag names.
    - Selected `table_rows.data` fields.
  - Implement new RPCs:
    - `search_table_rows_fts(table_id, query, limit, offset)`
    - `search_tags_fts(workspace_id, query, limit)`
- **API / server actions**:
  - Keep using:
    - `searchTableRows` as the main table search action.
    - `searchTags` / `searchEntityProperties` as tag/property search entry points.
  - Change their internal implementation to call the RPCs.
- **Client layer**:
  - Maintain existing hooks:
    - `useSearchTableRows`, `useProjectTags`, `useEntityProperties`, `useAddTag`, etc.
  - Optionally:
    - Add debounce for `useSearchTableRows` caller (table search inputs).
    - Introduce an explicit tag search hook that calls `searchTags` for tag pickers.

**Caching**

- Current caching:
  - React Query caches:
    - `['tableSearch', tableId, search]` for row search.
    - `entityProperties` and `entitiesProperties` for properties.
    - `workspaceTables`, `tableRows`, etc.
  - There is no dedicated application-level caching layer (Redis, etc.) in the repo for search.
- Integration:
  - Any DB-level search can continue to rely on React Query caching by reusing the existing hooks; no structural change required.


### Code pointers

**Tags**

- **Server actions / search**
  - Tag search + property search:
    - `src/app/actions/ai-search.ts`
      - `searchTags`
      - `searchEntityProperties`
      - `searchTasks`, `searchBlocks`, etc. for context
  - Project tags CRUD:
    - `src/app/actions/project.ts`
      - `getProjectTags`
      - `addProjectTag`
      - `removeProjectTag`
- **Tag picker / properties UI**
  - Universal properties + tag picker:
    - `src/components/properties/property-menu.tsx`
  - Hooks for properties & tags:
    - `src/lib/hooks/use-property-queries.ts`
      - `useEntityProperties`
      - `useAddTag`, `useRemoveTag`
      - `useProjectTags`, `useAddProjectTag`
- **Tag data model SQL**
  - Tag bank and links:
    - `trak/supabase/schema.sql`
      - `public.task_tags`
      - `public.task_tag_links`
      - `public.entity_properties`
      - `public.project_tags`
  - Project tag migration:
    - `trak/supabase/migrations/20260222000000_add_project_tags.sql`
- **AI tooling integrations**
  - Deterministic intent parser mapping to `searchTags`:
    - `src/lib/ai/deterministic-parser.ts`

**Table rows & table search**

- **Row & column schema**
  - `trak/supabase/schema.sql`
    - `public.tables`
    - `public.table_fields`
    - `public.table_rows`
    - Related indexes (e.g. `idx_table_rows_data_gin`, `idx_table_rows_table_order`)
- **Table server actions**
  - Table metadata:
    - `src/app/actions/tables/table-actions.ts`
      - `createTable`, `getTable`, `updateTable`, `deleteTable`, `duplicateTable`, `listWorkspaceTables`
  - Row querying and search:
    - `src/app/actions/tables/query-actions.ts`
      - `getTableData` (if present above the snippet)
      - `searchTableRows`
      - `getFilteredRows`
      - `getTableRows`
- **Table APIs & hooks**
  - API route for paginated data:
    - `src/app/api/tables/data/route.ts`
  - React Query hooks:
    - `src/lib/hooks/use-table-queries.ts`
      - `useTableBootstrap`, `useInfiniteTableRows`
      - `useTableRows`
      - `useSearchTableRows`
      - `useFilteredRows`
- **Table UI (search/filtering)**
  - Main table view:
    - `src/components/tables/table-view.tsx`
  - Search headers:
    - `src/components/tables/table-header-compact.tsx`
    - `src/components/tables/table-toolbar.tsx`

**Search utilities / infra**

- **AI search orchestration**
  - `src/app/actions/ai-search.ts` (central hub for entity search).
- **Unstructured search / RAG**
  - `trak/supabase/migrations/20260130235900_unstructured_search_v1.sql`
    - `unstructured_parents`, `unstructured_chunks`, `fts` tsvector column with GIN index.
  - This is separate from tags/table rows but shows existing FTS patterns.
- **Performance indexes**
  - `trak/supabase/migrations/20260224000000_add_perf_indexes.sql`

---

### Example Supabase queries in use

**Tag search (`searchTags`)**

```3860:3866:trak/src/app/actions/ai-search.ts
const { data, error } = await supabase
  .from("entity_properties")
  .select("entity_id, value")
  .eq("workspace_id", workspaceId)
  .eq("field_type", "tags")
  .in("entity_type", ["task", "block", "timeline_event"]);
```

**Table row search (`searchTableRows`)**

```101:106:trak/src/app/actions/tables/query-actions.ts
const { data: rows, error } = await supabase
  .from("table_rows")
  .select("id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by")
  .eq("table_id", tableId)
  .filter("data::text", "ilike", `%${query}%`)
  .limit(50);
```

