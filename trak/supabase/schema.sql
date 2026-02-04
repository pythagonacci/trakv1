--
-- PostgreSQL database dump
--

\restrict fDoqNd6imQSCYknFDSBD0nMLQPf3Jce0oxwfEC5r1yflz6P5cZtkKOIzhlo0Ha0

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: block_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.block_type AS ENUM (
    'text',
    'link',
    'embed',
    'image',
    'video',
    'pdf',
    'timeline',
    'divider',
    'list',
    'table',
    'task',
    'section',
    'stripe_payment',
    'file',
    'doc_reference',
    'gallery',
    'chart'
);


ALTER TYPE public.block_type OWNER TO postgres;

--
-- Name: TYPE block_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TYPE public.block_type IS 'Types of blocks that can be added to tabs: text, task, link, divider, table, timeline, file, video, image, gallery, embed, pdf, section, doc_reference, chart';


--
-- Name: file_display_mode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.file_display_mode AS ENUM (
    'inline',
    'linked'
);


ALTER TYPE public.file_display_mode OWNER TO postgres;

--
-- Name: highlight_color; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.highlight_color AS ENUM (
    'yellow',
    'green',
    'red',
    'blue'
);


ALTER TYPE public.highlight_color OWNER TO postgres;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'overdue',
    'draft',
    'failed',
    'canceled'
);


ALTER TYPE public.payment_status OWNER TO postgres;

--
-- Name: proj_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.proj_status AS ENUM (
    'not_started',
    'in_progress',
    'complete'
);


ALTER TYPE public.proj_status OWNER TO postgres;

--
-- Name: role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.role AS ENUM (
    'owner',
    'admin',
    'teammate'
);


ALTER TYPE public.role OWNER TO postgres;

--
-- Name: share_permission; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.share_permission AS ENUM (
    'view',
    'comment',
    'edit'
);


ALTER TYPE public.share_permission OWNER TO postgres;

--
-- Name: target_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.target_type AS ENUM (
    'block',
    'tab',
    'project'
);


ALTER TYPE public.target_type OWNER TO postgres;

--
-- Name: assign_table_field_order(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_table_field_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW."order" IS NULL THEN
    SELECT COALESCE(MAX("order"), 0) + 1 INTO NEW."order"
    FROM table_fields
    WHERE table_id = NEW.table_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.assign_table_field_order() OWNER TO postgres;

--
-- Name: assign_table_row_order(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_table_row_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW."order" IS NULL THEN
    SELECT COALESCE(MAX("order"), 0)::NUMERIC + 1 INTO NEW."order"
    FROM table_rows
    WHERE table_id = NEW.table_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.assign_table_row_order() OWNER TO postgres;

--
-- Name: create_default_property_definitions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_default_property_definitions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Status property (select)
  INSERT INTO property_definitions (workspace_id, name, type, options)
  VALUES (
    NEW.id,
    'Status',
    'select',
    '[
      {"id": "todo", "label": "To Do", "color": "gray"},
      {"id": "in_progress", "label": "In Progress", "color": "blue"},
      {"id": "blocked", "label": "Blocked", "color": "red"},
      {"id": "done", "label": "Done", "color": "green"}
    ]'::jsonb
  );

  -- Assignee property (person)
  INSERT INTO property_definitions (workspace_id, name, type, options)
  VALUES (NEW.id, 'Assignee', 'person', '[]'::jsonb);

  -- Due Date property (date)
  INSERT INTO property_definitions (workspace_id, name, type, options)
  VALUES (NEW.id, 'Due Date', 'date', '[]'::jsonb);

  -- Priority property (select)
  INSERT INTO property_definitions (workspace_id, name, type, options)
  VALUES (
    NEW.id,
    'Priority',
    'select',
    '[
      {"id": "low", "label": "Low", "color": "gray"},
      {"id": "medium", "label": "Medium", "color": "yellow"},
      {"id": "high", "label": "High", "color": "orange"},
      {"id": "urgent", "label": "Urgent", "color": "red"}
    ]'::jsonb
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_default_property_definitions() OWNER TO postgres;

--
-- Name: ensure_single_default_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_single_default_view() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE table_views
    SET is_default = FALSE
    WHERE table_id = NEW.table_id
      AND id <> NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.ensure_single_default_view() OWNER TO postgres;

--
-- Name: generate_payment_number(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_payment_number(workspace_uuid uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_number INTEGER;
  payment_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(payment_number FROM 'PAY-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.payments
  WHERE workspace_id = workspace_uuid AND payment_number IS NOT NULL;
  
  payment_num := 'PAY-' || LPAD(next_number::TEXT, 4, '0');
  RETURN payment_num;
END;
$$;


ALTER FUNCTION public.generate_payment_number(workspace_uuid uuid) OWNER TO postgres;

--
-- Name: generate_public_token(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_public_token() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 32-character token (URL-safe)
    token := encode(gen_random_bytes(24), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := replace(token, '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM projects WHERE public_token = token) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN token;
END;
$$;


ALTER FUNCTION public.generate_public_token() OWNER TO postgres;

--
-- Name: get_next_block_position(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_next_block_position(p_tab_id uuid, p_parent_block_id uuid DEFAULT NULL::uuid, p_column integer DEFAULT 0) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_position INTEGER := 0;
  existing_positions INTEGER[];
  pos_count INTEGER;
BEGIN
  -- Get all existing positions for this tab/parent/column combination, sorted
  IF p_parent_block_id IS NOT NULL THEN
    -- For nested blocks
    SELECT array_agg(position ORDER BY position)
    INTO existing_positions
    FROM blocks
    WHERE parent_block_id = p_parent_block_id;
  ELSE
    -- For top-level blocks
    SELECT array_agg(position ORDER BY position)
    INTO existing_positions
    FROM blocks
    WHERE tab_id = p_tab_id
      AND "column" = p_column
      AND parent_block_id IS NULL;
  END IF;

  -- Find the first available position (starting from 0)
  IF existing_positions IS NOT NULL THEN
    pos_count := array_length(existing_positions, 1);
    IF pos_count > 0 THEN
      -- Look for the first gap or append to end
      FOR i IN 0..pos_count LOOP
        -- If we've reached the end, or found a gap
        IF i = pos_count OR existing_positions[i + 1] > i THEN
          next_position := i;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN next_position;
END;
$$;


ALTER FUNCTION public.get_next_block_position(p_tab_id uuid, p_parent_block_id uuid, p_column integer) OWNER TO postgres;

--
-- Name: get_workspace_id_for_entity(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_workspace_id_for_entity(p_entity_type text, p_entity_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  CASE p_entity_type
    WHEN 'block' THEN
      SELECT p.workspace_id INTO v_workspace_id
      FROM blocks b
      JOIN tabs t ON t.id = b.tab_id
      JOIN projects p ON p.id = t.project_id
      WHERE b.id = p_entity_id;

    WHEN 'task' THEN
      SELECT workspace_id INTO v_workspace_id
      FROM task_items
      WHERE id = p_entity_id;

    WHEN 'timeline_event' THEN
      SELECT workspace_id INTO v_workspace_id
      FROM timeline_events
      WHERE id = p_entity_id;

    WHEN 'table_row' THEN
      SELECT t.workspace_id INTO v_workspace_id
      FROM table_rows r
      JOIN tables t ON t.id = r.table_id
      WHERE r.id = p_entity_id;

    ELSE
      RETURN NULL;
  END CASE;

  RETURN v_workspace_id;
END;
$$;


ALTER FUNCTION public.get_workspace_id_for_entity(p_entity_type text, p_entity_id uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: is_member_of_workspace(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_member_of_workspace(ws_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid()
  );
$$;


ALTER FUNCTION public.is_member_of_workspace(ws_id uuid) OWNER TO postgres;

--
-- Name: set_payment_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_payment_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.payment_number IS NULL THEN
    NEW.payment_number := generate_payment_number(NEW.workspace_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_payment_number() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: update_client_tabs_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_client_tabs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_client_tabs_updated_at() OWNER TO postgres;

--
-- Name: update_docs_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_docs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_docs_updated_at() OWNER TO postgres;

--
-- Name: update_payment_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_payment_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_payment_timestamp() OWNER TO postgres;

--
-- Name: validate_table_row_data(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_table_row_data() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  key TEXT;
  field_record RECORD;
  value JSONB;
BEGIN
  -- Ensure all keys reference existing fields on the table
  FOR key IN SELECT jsonb_object_keys(COALESCE(NEW.data, '{}'::jsonb))
  LOOP
    -- Skip computed metadata keys used by rollups/formulas (not field IDs)
    IF key LIKE '%\_computed_at' ESCAPE '\' THEN
      CONTINUE;
    END IF;

    SELECT id, type, config INTO field_record
    FROM table_fields
    WHERE id = key::uuid
      AND table_id = NEW.table_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown field id % for table %', key, NEW.table_id;
    END IF;

    value := NEW.data -> key;

    -- Basic type validation per field type (lightweight to avoid blocking flexible configs)
    IF field_record.type = 'number' THEN
      IF jsonb_typeof(value) NOT IN ('number', 'string', 'null') THEN
        RAISE EXCEPTION 'Field % expects numeric-compatible value', key;
      END IF;
    ELSIF field_record.type = 'checkbox' THEN
      IF jsonb_typeof(value) NOT IN ('boolean', 'null') THEN
        RAISE EXCEPTION 'Field % expects boolean value', key;
      END IF;
    ELSIF field_record.type IN ('multi_select', 'files', 'relation') THEN
      IF jsonb_typeof(value) NOT IN ('array', 'null') THEN
        RAISE EXCEPTION 'Field % expects array value', key;
      END IF;
    ELSIF field_record.type = 'date' THEN
      IF jsonb_typeof(value) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION 'Field % expects ISO date string', key;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_table_row_data() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: block_highlights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.block_highlights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    block_id uuid NOT NULL,
    color public.highlight_color NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.block_highlights OWNER TO postgres;

--
-- Name: blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tab_id uuid NOT NULL,
    parent_block_id uuid,
    type public.block_type NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "column" integer DEFAULT 0 NOT NULL,
    is_template boolean DEFAULT false,
    template_name text,
    original_block_id uuid,
    CONSTRAINT blocks_column_check CHECK ((("column" >= 0) AND ("column" <= 2)))
);


ALTER TABLE public.blocks OWNER TO postgres;

--
-- Name: COLUMN blocks.is_template; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.blocks.is_template IS 'Whether this block is a reusable template/shared block';


--
-- Name: COLUMN blocks.template_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.blocks.template_name IS 'Optional name for template blocks to make them easier to find';


--
-- Name: COLUMN blocks.original_block_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.blocks.original_block_id IS 'If this is a reference, points to the original block';


--
-- Name: client_page_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    tab_id uuid,
    public_token text NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    user_agent text,
    ip_address text,
    referrer text,
    session_id text,
    view_duration_seconds integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_page_views OWNER TO postgres;

--
-- Name: TABLE client_page_views; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.client_page_views IS 'Analytics tracking for client page views';


--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_id uuid,
    name text NOT NULL,
    status public.proj_status DEFAULT 'not_started'::public.proj_status NOT NULL,
    due_date_date date,
    due_date_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_type text DEFAULT 'project'::text NOT NULL,
    client_page_enabled boolean DEFAULT false,
    public_token text,
    client_comments_enabled boolean DEFAULT false,
    CONSTRAINT chk_projects_due_xor CHECK ((((due_date_date IS NULL) <> (due_date_text IS NULL)) OR ((due_date_date IS NULL) AND (due_date_text IS NULL)))),
    CONSTRAINT projects_project_type_check CHECK ((project_type = ANY (ARRAY['project'::text, 'internal'::text])))
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: COLUMN projects.project_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.projects.project_type IS 'Type of project: project (client work) or internal (company knowledge)';


--
-- Name: COLUMN projects.client_page_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.projects.client_page_enabled IS 'Whether this project has a public client page enabled';


--
-- Name: COLUMN projects.public_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.projects.public_token IS 'Unique token for accessing the public client page';


--
-- Name: client_page_analytics_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.client_page_analytics_summary AS
 SELECT p.id AS project_id,
    p.name AS project_name,
    p.public_token,
    count(DISTINCT cpv.id) AS total_views,
    count(DISTINCT cpv.session_id) AS unique_visitors,
    count(DISTINCT cpv.tab_id) AS tabs_viewed,
    max(cpv.viewed_at) AS last_viewed_at,
    avg(cpv.view_duration_seconds) AS avg_duration_seconds
   FROM (public.projects p
     LEFT JOIN public.client_page_views cpv ON ((cpv.project_id = p.id)))
  WHERE (p.client_page_enabled = true)
  GROUP BY p.id, p.name, p.public_token;


ALTER VIEW public.client_page_analytics_summary OWNER TO postgres;

--
-- Name: VIEW client_page_analytics_summary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.client_page_analytics_summary IS 'Summary analytics for client pages by project';


--
-- Name: client_tab_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_tab_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tab_id uuid NOT NULL,
    type text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb,
    "position" integer DEFAULT 0 NOT NULL,
    "column" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_tab_blocks_column_check CHECK ((("column" >= 0) AND ("column" <= 2)))
);


ALTER TABLE public.client_tab_blocks OWNER TO postgres;

--
-- Name: TABLE client_tab_blocks; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.client_tab_blocks IS 'Content blocks within client tabs (similar to project tab blocks)';


--
-- Name: COLUMN client_tab_blocks."position"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_tab_blocks."position" IS 'Vertical position within column';


--
-- Name: COLUMN client_tab_blocks."column"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_tab_blocks."column" IS 'Column position (0-2 for up to 3 columns)';


--
-- Name: client_tabs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_tabs OWNER TO postgres;

--
-- Name: TABLE client_tabs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.client_tabs IS 'Custom tabs within client detail pages for organizing client-specific information';


--
-- Name: COLUMN client_tabs."position"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_tabs."position" IS 'Display order of tabs (0-based)';


--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    email public.citext,
    company text,
    phone text,
    address text,
    website text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type public.target_type NOT NULL,
    target_id uuid NOT NULL,
    user_id uuid NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: dashboard_projects; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.dashboard_projects WITH (security_invoker='on') AS
 SELECT p.id AS project_id,
    p.workspace_id,
    c.name AS client,
    p.name AS project,
    (p.status)::text AS status,
    COALESCE(to_char((p.due_date_date)::timestamp with time zone, 'YYYY-MM-DD'::text), p.due_date_text, '—'::text) AS due_date
   FROM (public.projects p
     LEFT JOIN public.clients c ON ((c.id = p.client_id)));


ALTER VIEW public.dashboard_projects OWNER TO postgres;

--
-- Name: docs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.docs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    title text DEFAULT 'Untitled Document'::text NOT NULL,
    content jsonb DEFAULT '{"type": "doc", "content": [{"type": "paragraph"}]}'::jsonb,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_edited_by uuid,
    is_archived boolean DEFAULT false
);


ALTER TABLE public.docs OWNER TO postgres;

--
-- Name: TABLE docs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.docs IS 'Stores rich text documents created within Trak';


--
-- Name: COLUMN docs.content; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.docs.content IS 'ProseMirror JSON content from Tiptap editor';


--
-- Name: entity_inherited_display; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_inherited_display (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    source_entity_type text NOT NULL,
    source_entity_id uuid NOT NULL,
    property_definition_id uuid NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    CONSTRAINT entity_inherited_display_entity_type_check CHECK ((entity_type = ANY (ARRAY['block'::text, 'task'::text, 'timeline_event'::text, 'table_row'::text]))),
    CONSTRAINT entity_inherited_display_source_entity_type_check CHECK ((source_entity_type = ANY (ARRAY['block'::text, 'task'::text, 'timeline_event'::text, 'table_row'::text])))
);


ALTER TABLE public.entity_inherited_display OWNER TO postgres;

--
-- Name: entity_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_entity_type text NOT NULL,
    source_entity_id uuid NOT NULL,
    target_entity_type text NOT NULL,
    target_entity_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entity_links_no_self_link CHECK ((NOT ((source_entity_type = target_entity_type) AND (source_entity_id = target_entity_id)))),
    CONSTRAINT entity_links_source_entity_type_check CHECK ((source_entity_type = ANY (ARRAY['block'::text, 'task'::text, 'timeline_event'::text, 'table_row'::text]))),
    CONSTRAINT entity_links_target_entity_type_check CHECK ((target_entity_type = ANY (ARRAY['block'::text, 'task'::text, 'timeline_event'::text, 'table_row'::text])))
);


ALTER TABLE public.entity_links OWNER TO postgres;

--
-- Name: entity_properties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    property_definition_id uuid NOT NULL,
    value jsonb,
    workspace_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entity_properties_entity_type_check1 CHECK ((entity_type = ANY (ARRAY['block'::text, 'task'::text, 'timeline_event'::text, 'table_row'::text])))
);


ALTER TABLE public.entity_properties OWNER TO postgres;

--
-- Name: entity_properties_legacy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_properties_legacy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    status text,
    priority text,
    assignee_id uuid,
    due_date date,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entity_properties_entity_type_check CHECK ((entity_type = ANY (ARRAY['block'::text, 'task'::text, 'timeline_event'::text, 'table_row'::text]))),
    CONSTRAINT entity_properties_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT entity_properties_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text, 'blocked'::text])))
);


ALTER TABLE public.entity_properties_legacy OWNER TO postgres;

--
-- Name: file_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.file_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    block_id uuid NOT NULL,
    display_mode public.file_display_mode DEFAULT 'inline'::public.file_display_mode NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.file_attachments OWNER TO postgres;

--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    file_type text,
    bucket text DEFAULT 'files'::text NOT NULL,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid NOT NULL
);


ALTER TABLE public.files OWNER TO postgres;

--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid,
    workspace_id uuid,
    event_type text NOT NULL,
    stripe_event_id text,
    metadata jsonb,
    occurred_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.payment_events OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid,
    client_id uuid,
    amount numeric(12,2) NOT NULL,
    status public.payment_status DEFAULT 'draft'::public.payment_status NOT NULL,
    due_date date,
    stripe_payment_link text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_number text,
    currency text DEFAULT 'usd'::text,
    description text,
    stripe_payment_link_id text,
    stripe_payment_intent_id text,
    paid_at timestamp with time zone,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payments_amount_check CHECK ((amount >= (0)::numeric))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    name text
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: property_definitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.property_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    options jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT property_definitions_type_check CHECK ((type = ANY (ARRAY['text'::text, 'number'::text, 'date'::text, 'select'::text, 'multi_select'::text, 'person'::text, 'checkbox'::text])))
);


ALTER TABLE public.property_definitions OWNER TO postgres;

--
-- Name: tab_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tab_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tab_id uuid NOT NULL,
    shared_with_email public.citext,
    permissions public.share_permission NOT NULL,
    access_token text NOT NULL,
    password_hash text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tab_shares OWNER TO postgres;

--
-- Name: table_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.table_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    row_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    parent_id uuid,
    resolved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.table_comments OWNER TO postgres;

--
-- Name: table_fields; Type: TABLE; Schema: public; Owner: postgres
--

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
    CONSTRAINT table_fields_type_check CHECK ((type = ANY (ARRAY['text'::text, 'long_text'::text, 'number'::text, 'select'::text, 'multi_select'::text, 'date'::text, 'checkbox'::text, 'url'::text, 'email'::text, 'phone'::text, 'person'::text, 'files'::text, 'created_time'::text, 'last_edited_time'::text, 'created_by'::text, 'last_edited_by'::text, 'formula'::text, 'relation'::text, 'rollup'::text, 'status'::text, 'priority'::text])))
);


ALTER TABLE public.table_fields OWNER TO postgres;

--
-- Name: table_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.table_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_table_id uuid NOT NULL,
    from_field_id uuid NOT NULL,
    from_row_id uuid NOT NULL,
    to_table_id uuid NOT NULL,
    to_row_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.table_relations OWNER TO postgres;

--
-- Name: table_rows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.table_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    "order" numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE public.table_rows OWNER TO postgres;

--
-- Name: table_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.table_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid NOT NULL,
    name text DEFAULT 'Untitled View'::text NOT NULL,
    type text DEFAULT 'table'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT table_views_type_check CHECK ((type = ANY (ARRAY['table'::text, 'board'::text, 'timeline'::text, 'calendar'::text, 'list'::text, 'gallery'::text])))
);


ALTER TABLE public.table_views OWNER TO postgres;

--
-- Name: tables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid,
    title text DEFAULT 'Untitled Table'::text NOT NULL,
    description text,
    icon text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.tables OWNER TO postgres;

--
-- Name: tabs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    parent_tab_id uuid,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_client_visible boolean DEFAULT false,
    client_title text
);


ALTER TABLE public.tabs OWNER TO postgres;

--
-- Name: COLUMN tabs.is_client_visible; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tabs.is_client_visible IS 'Whether this tab is visible on the public client page';


--
-- Name: COLUMN tabs.client_title; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tabs.client_title IS 'Optional custom title to display on client page (overrides internal tab name)';


--
-- Name: task_assignees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_assignees (
    task_id uuid NOT NULL,
    assignee_id uuid NOT NULL,
    assignee_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_assignees OWNER TO postgres;

--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_comments OWNER TO postgres;

--
-- Name: task_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_block_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid,
    tab_id uuid,
    title text NOT NULL,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'none'::text,
    description text,
    due_date date,
    due_time time without time zone,
    start_date date,
    hide_icons boolean DEFAULT false,
    display_order integer DEFAULT 0 NOT NULL,
    recurring_enabled boolean DEFAULT false,
    recurring_frequency text,
    recurring_interval integer DEFAULT 1,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assignee_id uuid,
    CONSTRAINT task_items_priority_check CHECK ((priority = ANY (ARRAY['urgent'::text, 'high'::text, 'medium'::text, 'low'::text, 'none'::text]))),
    CONSTRAINT task_items_recurring_frequency_check CHECK ((recurring_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT task_items_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in-progress'::text, 'done'::text])))
);


ALTER TABLE public.task_items OWNER TO postgres;

--
-- Name: task_references; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_references (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    task_id uuid NOT NULL,
    reference_type text NOT NULL,
    reference_id uuid NOT NULL,
    table_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_references_reference_type_check CHECK ((reference_type = ANY (ARRAY['doc'::text, 'table_row'::text, 'task'::text, 'block'::text, 'tab'::text])))
);


ALTER TABLE public.task_references OWNER TO postgres;

--
-- Name: task_subtasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_subtasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    title text NOT NULL,
    completed boolean DEFAULT false,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_subtasks OWNER TO postgres;

--
-- Name: task_tag_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_tag_links (
    task_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_tag_links OWNER TO postgres;

--
-- Name: task_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_tags OWNER TO postgres;

--
-- Name: timeline_dependencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.timeline_dependencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    timeline_block_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    from_id uuid NOT NULL,
    to_id uuid NOT NULL,
    dependency_type text DEFAULT 'finish-to-start'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT timeline_dependencies_dependency_type_check CHECK ((dependency_type = ANY (ARRAY['finish-to-start'::text, 'start-to-start'::text, 'finish-to-finish'::text, 'start-to-finish'::text]))),
    CONSTRAINT timeline_dependencies_no_self_ref CHECK ((from_id <> to_id))
);


ALTER TABLE public.timeline_dependencies OWNER TO postgres;

--
-- Name: timeline_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    timeline_block_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    title text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    status text DEFAULT 'planned'::text,
    assignee_id uuid,
    progress integer DEFAULT 0,
    notes text,
    color text DEFAULT 'bg-blue-500/50'::text,
    is_milestone boolean DEFAULT false,
    baseline_start timestamp with time zone,
    baseline_end timestamp with time zone,
    display_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT timeline_events_date_order CHECK ((start_date <= end_date)),
    CONSTRAINT timeline_events_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT timeline_events_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'in-progress'::text, 'blocked'::text, 'done'::text])))
);


ALTER TABLE public.timeline_events OWNER TO postgres;

--
-- Name: timeline_references; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.timeline_references (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    event_id uuid NOT NULL,
    reference_type text NOT NULL,
    reference_id uuid NOT NULL,
    table_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT timeline_references_reference_type_check CHECK ((reference_type = ANY (ARRAY['doc'::text, 'table_row'::text, 'task'::text, 'block'::text])))
);


ALTER TABLE public.timeline_references OWNER TO postgres;

--
-- Name: workspace_invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    email text NOT NULL,
    role text NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workspace_invitations_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'teammate'::text])))
);


ALTER TABLE public.workspace_invitations OWNER TO postgres;

--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspace_members OWNER TO postgres;

--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_account_id text,
    stripe_account_status text,
    onboarding_completed boolean DEFAULT false,
    charges_enabled boolean DEFAULT false,
    payouts_enabled boolean DEFAULT false,
    stripe_connected_at timestamp with time zone
);


ALTER TABLE public.workspaces OWNER TO postgres;

--
-- Name: workspace_members_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.workspace_members_view AS
 SELECT wm.id,
    wm.workspace_id,
    w.name AS workspace_name,
    wm.user_id,
    au.email AS user_email,
    wm.role,
    wm.created_at
   FROM ((public.workspace_members wm
     JOIN public.workspaces w ON ((wm.workspace_id = w.id)))
     JOIN auth.users au ON ((wm.user_id = au.id)));


ALTER VIEW public.workspace_members_view OWNER TO postgres;

--
-- Name: block_highlights block_highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.block_highlights
    ADD CONSTRAINT block_highlights_pkey PRIMARY KEY (id);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);


--
-- Name: client_page_views client_page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_page_views
    ADD CONSTRAINT client_page_views_pkey PRIMARY KEY (id);


--
-- Name: client_tab_blocks client_tab_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_tab_blocks
    ADD CONSTRAINT client_tab_blocks_pkey PRIMARY KEY (id);


--
-- Name: client_tabs client_tabs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_tabs
    ADD CONSTRAINT client_tabs_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: docs docs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_pkey PRIMARY KEY (id);


--
-- Name: entity_inherited_display entity_inherited_display_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_inherited_display
    ADD CONSTRAINT entity_inherited_display_pkey PRIMARY KEY (id);


--
-- Name: entity_inherited_display entity_inherited_display_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_inherited_display
    ADD CONSTRAINT entity_inherited_display_unique UNIQUE (entity_type, entity_id, source_entity_type, source_entity_id, property_definition_id);


--
-- Name: entity_links entity_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_links
    ADD CONSTRAINT entity_links_pkey PRIMARY KEY (id);


--
-- Name: entity_links entity_links_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_links
    ADD CONSTRAINT entity_links_unique UNIQUE (source_entity_type, source_entity_id, target_entity_type, target_entity_id);


--
-- Name: entity_properties entity_properties_entity_property_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_properties
    ADD CONSTRAINT entity_properties_entity_property_unique UNIQUE (entity_type, entity_id, property_definition_id);


--
-- Name: entity_properties_legacy entity_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_properties_legacy
    ADD CONSTRAINT entity_properties_pkey PRIMARY KEY (id);


--
-- Name: entity_properties entity_properties_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_properties
    ADD CONSTRAINT entity_properties_pkey1 PRIMARY KEY (id);


--
-- Name: entity_properties_legacy entity_properties_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_properties_legacy
    ADD CONSTRAINT entity_properties_unique UNIQUE (entity_type, entity_id);


--
-- Name: file_attachments file_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_public_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_public_token_key UNIQUE (public_token);


--
-- Name: property_definitions property_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.property_definitions
    ADD CONSTRAINT property_definitions_pkey PRIMARY KEY (id);


--
-- Name: property_definitions property_definitions_workspace_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.property_definitions
    ADD CONSTRAINT property_definitions_workspace_name_unique UNIQUE (workspace_id, name);


--
-- Name: tab_shares tab_shares_access_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tab_shares
    ADD CONSTRAINT tab_shares_access_token_key UNIQUE (access_token);


--
-- Name: tab_shares tab_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tab_shares
    ADD CONSTRAINT tab_shares_pkey PRIMARY KEY (id);


--
-- Name: table_comments table_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_comments
    ADD CONSTRAINT table_comments_pkey PRIMARY KEY (id);


--
-- Name: table_fields table_fields_order_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_fields
    ADD CONSTRAINT table_fields_order_unique UNIQUE (table_id, "order");


--
-- Name: table_fields table_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_fields
    ADD CONSTRAINT table_fields_pkey PRIMARY KEY (id);


--
-- Name: table_relations table_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_pkey PRIMARY KEY (id);


--
-- Name: table_relations table_relations_unique_link; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_unique_link UNIQUE (from_row_id, from_field_id, to_row_id);


--
-- Name: table_rows table_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_rows
    ADD CONSTRAINT table_rows_pkey PRIMARY KEY (id);


--
-- Name: table_views table_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_views
    ADD CONSTRAINT table_views_pkey PRIMARY KEY (id);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: tabs tabs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tabs
    ADD CONSTRAINT tabs_pkey PRIMARY KEY (id);


--
-- Name: task_assignees task_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_pkey PRIMARY KEY (task_id, assignee_id, assignee_name);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_items task_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_pkey PRIMARY KEY (id);


--
-- Name: task_references task_references_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_pkey PRIMARY KEY (id);


--
-- Name: task_subtasks task_subtasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_subtasks
    ADD CONSTRAINT task_subtasks_pkey PRIMARY KEY (id);


--
-- Name: task_tag_links task_tag_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_pkey PRIMARY KEY (task_id, tag_id);


--
-- Name: task_tags task_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_pkey PRIMARY KEY (id);


--
-- Name: task_tags task_tags_workspace_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_workspace_id_name_key UNIQUE (workspace_id, name);


--
-- Name: timeline_dependencies timeline_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_pkey PRIMARY KEY (id);


--
-- Name: timeline_events timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_pkey PRIMARY KEY (id);


--
-- Name: timeline_references timeline_references_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_token_key UNIQUE (token);


--
-- Name: workspace_invitations workspace_invitations_workspace_id_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_email_key UNIQUE (workspace_id, email);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_stripe_account_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_stripe_account_id_key UNIQUE (stripe_account_id);


--
-- Name: idx_block_highlights_block; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_block_highlights_block ON public.block_highlights USING btree (block_id);


--
-- Name: idx_blocks_column_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocks_column_position ON public.blocks USING btree (tab_id, "column", "position") WHERE (parent_block_id IS NULL);


--
-- Name: idx_blocks_gin_content; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocks_gin_content ON public.blocks USING gin (content);


--
-- Name: idx_blocks_id_tab; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocks_id_tab ON public.blocks USING btree (id, tab_id);


--
-- Name: INDEX idx_blocks_id_tab; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_blocks_id_tab IS 'Optimizes file_attachments RLS policy join: blocks.id → blocks.tab_id';


--
-- Name: idx_blocks_is_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocks_is_template ON public.blocks USING btree (is_template) WHERE (is_template = true);


--
-- Name: idx_blocks_original_block_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocks_original_block_id ON public.blocks USING btree (original_block_id) WHERE (original_block_id IS NOT NULL);


--
-- Name: idx_blocks_parent_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocks_parent_position ON public.blocks USING btree (parent_block_id, "position") WHERE (parent_block_id IS NOT NULL);


--
-- Name: INDEX idx_blocks_parent_position; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_blocks_parent_position IS 'Optimizes getChildBlocks() queries for nested section blocks';


--
-- Name: idx_blocks_tab; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocks_tab ON public.blocks USING btree (tab_id);


--
-- Name: idx_blocks_tab_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocks_tab_position ON public.blocks USING btree (tab_id, "position");


--
-- Name: idx_blocks_tab_toplevel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocks_tab_toplevel ON public.blocks USING btree (tab_id, "column", "position") WHERE (parent_block_id IS NULL);


--
-- Name: idx_client_page_views_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_page_views_project ON public.client_page_views USING btree (project_id, viewed_at DESC);


--
-- Name: idx_client_page_views_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_page_views_session ON public.client_page_views USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: idx_client_page_views_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_page_views_token ON public.client_page_views USING btree (public_token, viewed_at DESC);


--
-- Name: idx_client_tab_blocks_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_tab_blocks_position ON public.client_tab_blocks USING btree (tab_id, "column", "position");


--
-- Name: idx_client_tab_blocks_tab_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_tab_blocks_tab_id ON public.client_tab_blocks USING btree (tab_id);


--
-- Name: idx_client_tabs_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_tabs_client_id ON public.client_tabs USING btree (client_id);


--
-- Name: idx_client_tabs_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_tabs_position ON public.client_tabs USING btree (client_id, "position");


--
-- Name: idx_clients_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_workspace ON public.clients USING btree (workspace_id, name);


--
-- Name: idx_clients_ws; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_ws ON public.clients USING btree (workspace_id);


--
-- Name: idx_comments_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_target ON public.comments USING btree (target_type, target_id);


--
-- Name: idx_docs_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_docs_archived ON public.docs USING btree (is_archived);


--
-- Name: idx_docs_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_docs_created_by ON public.docs USING btree (created_by);


--
-- Name: idx_docs_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_docs_updated_at ON public.docs USING btree (updated_at DESC);


--
-- Name: idx_docs_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_docs_workspace ON public.docs USING btree (workspace_id);


--
-- Name: idx_entity_inherited_display_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_inherited_display_entity ON public.entity_inherited_display USING btree (entity_type, entity_id);


--
-- Name: idx_entity_inherited_display_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_inherited_display_source ON public.entity_inherited_display USING btree (source_entity_type, source_entity_id);


--
-- Name: idx_entity_links_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_links_source ON public.entity_links USING btree (source_entity_type, source_entity_id);


--
-- Name: idx_entity_links_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_links_target ON public.entity_links USING btree (target_entity_type, target_entity_id);


--
-- Name: idx_entity_links_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_links_workspace ON public.entity_links USING btree (workspace_id);


--
-- Name: idx_entity_properties_assignee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_properties_assignee ON public.entity_properties_legacy USING btree (assignee_id) WHERE (assignee_id IS NOT NULL);


--
-- Name: idx_entity_properties_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_properties_due_date ON public.entity_properties_legacy USING btree (workspace_id, due_date) WHERE (due_date IS NOT NULL);


--
-- Name: idx_entity_properties_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_properties_entity ON public.entity_properties_legacy USING btree (entity_type, entity_id);


--
-- Name: idx_entity_properties_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_properties_priority ON public.entity_properties_legacy USING btree (workspace_id, priority) WHERE (priority IS NOT NULL);


--
-- Name: idx_entity_properties_property_definition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_properties_property_definition ON public.entity_properties USING btree (property_definition_id);


--
-- Name: idx_entity_properties_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_properties_status ON public.entity_properties_legacy USING btree (workspace_id, status) WHERE (status IS NOT NULL);


--
-- Name: idx_entity_properties_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_properties_tags ON public.entity_properties_legacy USING gin (tags);


--
-- Name: idx_entity_properties_value_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_properties_value_gin ON public.entity_properties USING gin (value);


--
-- Name: idx_entity_properties_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_properties_workspace ON public.entity_properties_legacy USING btree (workspace_id);


--
-- Name: idx_file_attachments_block; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_file_attachments_block ON public.file_attachments USING btree (block_id);


--
-- Name: idx_file_attachments_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_file_attachments_file ON public.file_attachments USING btree (file_id);


--
-- Name: idx_files_bucket_path; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_bucket_path ON public.files USING btree (bucket, storage_path);


--
-- Name: idx_files_id_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_id_workspace ON public.files USING btree (id, workspace_id);


--
-- Name: INDEX idx_files_id_workspace; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_files_id_workspace IS 'Optimizes batched file URL generation with workspace verification';


--
-- Name: idx_files_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_project ON public.files USING btree (project_id);


--
-- Name: idx_files_ws; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_ws ON public.files USING btree (workspace_id);


--
-- Name: idx_payment_events_payment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_events_payment ON public.payment_events USING btree (payment_id);


--
-- Name: idx_payments_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_client ON public.payments USING btree (client_id);


--
-- Name: idx_payments_payment_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_payment_number ON public.payments USING btree (payment_number);


--
-- Name: idx_payments_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_project ON public.payments USING btree (project_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_ws; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_ws ON public.payments USING btree (workspace_id);


--
-- Name: idx_projects_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_client ON public.projects USING btree (client_id);


--
-- Name: idx_projects_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_created_at ON public.projects USING btree (workspace_id, created_at DESC);


--
-- Name: idx_projects_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_due_date ON public.projects USING btree (workspace_id, due_date_date DESC NULLS LAST);


--
-- Name: idx_projects_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_name ON public.projects USING btree (workspace_id, name);


--
-- Name: idx_projects_public_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_public_token ON public.projects USING btree (public_token) WHERE (public_token IS NOT NULL);


--
-- Name: idx_projects_public_token_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_public_token_enabled ON public.projects USING btree (public_token, client_page_enabled) WHERE ((public_token IS NOT NULL) AND (client_page_enabled = true));


--
-- Name: INDEX idx_projects_public_token_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_projects_public_token_enabled IS 'Optimizes public client page token validation queries';


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_status ON public.projects USING btree (workspace_id, status);


--
-- Name: idx_projects_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_type ON public.projects USING btree (project_type);


--
-- Name: idx_projects_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_updated_at ON public.projects USING btree (workspace_id, updated_at DESC);


--
-- Name: idx_projects_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_workspace ON public.projects USING btree (workspace_id, id);


--
-- Name: idx_projects_workspace_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_workspace_type ON public.projects USING btree (workspace_id, project_type) WHERE (project_type = 'project'::text);


--
-- Name: idx_projects_workspace_type_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_workspace_type_status ON public.projects USING btree (workspace_id, project_type, status, created_at DESC);


--
-- Name: idx_projects_ws; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_ws ON public.projects USING btree (workspace_id);


--
-- Name: idx_property_definitions_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_property_definitions_workspace ON public.property_definitions USING btree (workspace_id);


--
-- Name: idx_tab_shares_tab; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tab_shares_tab ON public.tab_shares USING btree (tab_id);


--
-- Name: idx_table_comments_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_comments_parent_id ON public.table_comments USING btree (parent_id);


--
-- Name: idx_table_comments_row_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_comments_row_id ON public.table_comments USING btree (row_id);


--
-- Name: idx_table_comments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_comments_user_id ON public.table_comments USING btree (user_id);


--
-- Name: idx_table_fields_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_fields_order ON public.table_fields USING btree (table_id, "order");


--
-- Name: idx_table_fields_table_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_fields_table_id ON public.table_fields USING btree (table_id);


--
-- Name: idx_table_relations_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_relations_from ON public.table_relations USING btree (from_row_id, from_field_id);


--
-- Name: idx_table_relations_from_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_relations_from_table ON public.table_relations USING btree (from_table_id);


--
-- Name: idx_table_relations_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_relations_to ON public.table_relations USING btree (to_row_id);


--
-- Name: idx_table_relations_to_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_relations_to_table ON public.table_relations USING btree (to_table_id);


--
-- Name: idx_table_rows_data_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_rows_data_gin ON public.table_rows USING gin (data);


--
-- Name: idx_table_rows_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_rows_order ON public.table_rows USING btree (table_id, "order");


--
-- Name: idx_table_rows_table_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_rows_table_id ON public.table_rows USING btree (table_id);


--
-- Name: idx_table_views_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_views_created_by ON public.table_views USING btree (created_by);


--
-- Name: idx_table_views_default_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_table_views_default_unique ON public.table_views USING btree (table_id) WHERE is_default;


--
-- Name: idx_table_views_table_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_table_views_table_id ON public.table_views USING btree (table_id);


--
-- Name: idx_tables_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tables_created_by ON public.tables USING btree (created_by);


--
-- Name: idx_tables_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tables_project_id ON public.tables USING btree (project_id);


--
-- Name: idx_tables_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tables_workspace_id ON public.tables USING btree (workspace_id);


--
-- Name: idx_tabs_client_visible; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tabs_client_visible ON public.tabs USING btree (project_id, is_client_visible) WHERE (is_client_visible = true);


--
-- Name: idx_tabs_id_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tabs_id_project ON public.tabs USING btree (id, project_id);


--
-- Name: INDEX idx_tabs_id_project; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_tabs_id_project IS 'Optimizes blocks RLS policy join: tabs.id → tabs.project_id';


--
-- Name: idx_tabs_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tabs_parent ON public.tabs USING btree (parent_tab_id);


--
-- Name: idx_tabs_parent_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tabs_parent_project ON public.tabs USING btree (project_id, parent_tab_id, "position");


--
-- Name: idx_tabs_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tabs_project ON public.tabs USING btree (project_id);


--
-- Name: idx_tabs_project_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tabs_project_position ON public.tabs USING btree (project_id, "position");


--
-- Name: idx_task_assignees_assignee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_assignees_assignee ON public.task_assignees USING btree (assignee_id);


--
-- Name: idx_task_assignees_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_assignees_task ON public.task_assignees USING btree (task_id);


--
-- Name: idx_task_comments_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_comments_task ON public.task_comments USING btree (task_id);


--
-- Name: idx_task_items_assignee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_items_assignee ON public.task_items USING btree (assignee_id);


--
-- Name: idx_task_items_block; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_items_block ON public.task_items USING btree (task_block_id);


--
-- Name: idx_task_items_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_items_due ON public.task_items USING btree (due_date);


--
-- Name: idx_task_items_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_items_status ON public.task_items USING btree (status);


--
-- Name: idx_task_items_tab; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_items_tab ON public.task_items USING btree (tab_id);


--
-- Name: idx_task_items_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_items_workspace ON public.task_items USING btree (workspace_id);


--
-- Name: idx_task_references_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_references_table ON public.task_references USING btree (table_id) WHERE (table_id IS NOT NULL);


--
-- Name: idx_task_references_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_references_target ON public.task_references USING btree (reference_type, reference_id);


--
-- Name: idx_task_references_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_references_task ON public.task_references USING btree (task_id);


--
-- Name: idx_task_references_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_references_workspace ON public.task_references USING btree (workspace_id);


--
-- Name: idx_task_subtasks_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_subtasks_task ON public.task_subtasks USING btree (task_id);


--
-- Name: idx_task_tag_links_tag; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_tag_links_tag ON public.task_tag_links USING btree (tag_id);


--
-- Name: idx_task_tag_links_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_tag_links_task ON public.task_tag_links USING btree (task_id);


--
-- Name: idx_task_tags_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_tags_workspace ON public.task_tags USING btree (workspace_id);


--
-- Name: idx_timeline_dependencies_block; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_dependencies_block ON public.timeline_dependencies USING btree (timeline_block_id);


--
-- Name: idx_timeline_dependencies_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_dependencies_from ON public.timeline_dependencies USING btree (from_id);


--
-- Name: idx_timeline_dependencies_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_dependencies_to ON public.timeline_dependencies USING btree (to_id);


--
-- Name: idx_timeline_dependencies_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_timeline_dependencies_unique ON public.timeline_dependencies USING btree (timeline_block_id, from_id, to_id);


--
-- Name: idx_timeline_events_assignee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_events_assignee ON public.timeline_events USING btree (assignee_id);


--
-- Name: idx_timeline_events_block; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_events_block ON public.timeline_events USING btree (timeline_block_id);


--
-- Name: idx_timeline_events_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_events_dates ON public.timeline_events USING btree (start_date, end_date);


--
-- Name: idx_timeline_events_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_events_workspace ON public.timeline_events USING btree (workspace_id);


--
-- Name: idx_timeline_references_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_references_event ON public.timeline_references USING btree (event_id);


--
-- Name: idx_timeline_references_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_references_table ON public.timeline_references USING btree (table_id) WHERE (table_id IS NOT NULL);


--
-- Name: idx_timeline_references_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_references_target ON public.timeline_references USING btree (reference_type, reference_id);


--
-- Name: idx_timeline_references_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_references_workspace ON public.timeline_references USING btree (workspace_id);


--
-- Name: idx_workspace_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspace_members_user ON public.workspace_members USING btree (user_id);


--
-- Name: idx_workspace_members_workspace_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspace_members_workspace_user ON public.workspace_members USING btree (workspace_id, user_id);


--
-- Name: idx_workspace_members_ws; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspace_members_ws ON public.workspace_members USING btree (workspace_id);


--
-- Name: idx_workspaces_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspaces_owner ON public.workspaces USING btree (owner_id);


--
-- Name: idx_workspaces_stripe_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workspaces_stripe_account ON public.workspaces USING btree (stripe_account_id);


--
-- Name: uq_clients_ws_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_clients_ws_email ON public.clients USING btree (workspace_id, email) WHERE (email IS NOT NULL);


--
-- Name: client_tab_blocks client_tab_blocks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER client_tab_blocks_updated_at BEFORE UPDATE ON public.client_tab_blocks FOR EACH ROW EXECUTE FUNCTION public.update_client_tabs_updated_at();


--
-- Name: client_tabs client_tabs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER client_tabs_updated_at BEFORE UPDATE ON public.client_tabs FOR EACH ROW EXECUTE FUNCTION public.update_client_tabs_updated_at();


--
-- Name: workspaces create_default_properties_on_workspace; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER create_default_properties_on_workspace AFTER INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.create_default_property_definitions();


--
-- Name: docs docs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER docs_updated_at BEFORE UPDATE ON public.docs FOR EACH ROW EXECUTE FUNCTION public.update_docs_updated_at();


--
-- Name: entity_properties entity_properties_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER entity_properties_set_updated_at BEFORE UPDATE ON public.entity_properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payments payment_number_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER payment_number_trigger BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_payment_number();


--
-- Name: payments payment_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER payment_updated_at_trigger BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_payment_timestamp();


--
-- Name: property_definitions property_definitions_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER property_definitions_set_updated_at BEFORE UPDATE ON public.property_definitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_comments table_comments_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER table_comments_set_updated_at BEFORE UPDATE ON public.table_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_fields table_fields_set_order; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER table_fields_set_order BEFORE INSERT ON public.table_fields FOR EACH ROW EXECUTE FUNCTION public.assign_table_field_order();


--
-- Name: table_fields table_fields_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER table_fields_set_updated_at BEFORE UPDATE ON public.table_fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_rows table_rows_set_order; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER table_rows_set_order BEFORE INSERT ON public.table_rows FOR EACH ROW EXECUTE FUNCTION public.assign_table_row_order();


--
-- Name: table_rows table_rows_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER table_rows_set_updated_at BEFORE UPDATE ON public.table_rows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_rows table_rows_validate_data; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER table_rows_validate_data BEFORE INSERT OR UPDATE ON public.table_rows FOR EACH ROW EXECUTE FUNCTION public.validate_table_row_data();


--
-- Name: table_views table_views_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER table_views_set_updated_at BEFORE UPDATE ON public.table_views FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_views table_views_single_default; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER table_views_single_default BEFORE INSERT OR UPDATE ON public.table_views FOR EACH ROW WHEN ((new.is_default IS TRUE)) EXECUTE FUNCTION public.ensure_single_default_view();


--
-- Name: tables tables_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tables_set_updated_at BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_comments task_comments_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER task_comments_set_updated_at BEFORE UPDATE ON public.task_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_items task_items_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER task_items_set_updated_at BEFORE UPDATE ON public.task_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_references task_references_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER task_references_set_updated_at BEFORE UPDATE ON public.task_references FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_subtasks task_subtasks_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER task_subtasks_set_updated_at BEFORE UPDATE ON public.task_subtasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_tags task_tags_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER task_tags_set_updated_at BEFORE UPDATE ON public.task_tags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: timeline_events timeline_events_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER timeline_events_set_updated_at BEFORE UPDATE ON public.timeline_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: timeline_references timeline_references_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER timeline_references_set_updated_at BEFORE UPDATE ON public.timeline_references FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: blocks trg_blocks_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_blocks_updated BEFORE UPDATE ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: comments trg_comments_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects trg_projects_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: workspaces trg_workspaces_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: entity_properties_legacy update_entity_properties_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_entity_properties_updated_at BEFORE UPDATE ON public.entity_properties_legacy FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: block_highlights block_highlights_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.block_highlights
    ADD CONSTRAINT block_highlights_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: block_highlights block_highlights_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.block_highlights
    ADD CONSTRAINT block_highlights_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: blocks blocks_original_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_original_block_id_fkey FOREIGN KEY (original_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_parent_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_parent_block_id_fkey FOREIGN KEY (parent_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: client_page_views client_page_views_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_page_views
    ADD CONSTRAINT client_page_views_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: client_page_views client_page_views_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_page_views
    ADD CONSTRAINT client_page_views_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE SET NULL;


--
-- Name: client_tab_blocks client_tab_blocks_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_tab_blocks
    ADD CONSTRAINT client_tab_blocks_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.client_tabs(id) ON DELETE CASCADE;


--
-- Name: client_tabs client_tabs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_tabs
    ADD CONSTRAINT client_tabs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: clients clients_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: docs docs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: docs docs_last_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_last_edited_by_fkey FOREIGN KEY (last_edited_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: docs docs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: entity_links entity_links_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_links
    ADD CONSTRAINT entity_links_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: entity_properties_legacy entity_properties_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_properties_legacy
    ADD CONSTRAINT entity_properties_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.workspace_members(id) ON DELETE SET NULL;


--
-- Name: entity_properties entity_properties_property_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_properties
    ADD CONSTRAINT entity_properties_property_definition_id_fkey FOREIGN KEY (property_definition_id) REFERENCES public.property_definitions(id) ON DELETE CASCADE;


--
-- Name: entity_properties_legacy entity_properties_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_properties_legacy
    ADD CONSTRAINT entity_properties_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: entity_properties entity_properties_workspace_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_properties
    ADD CONSTRAINT entity_properties_workspace_id_fkey1 FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: file_attachments file_attachments_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: file_attachments file_attachments_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: files files_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: files files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: files files_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: payment_events payment_events_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: payment_events payment_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: payments payments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payments payments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: payments payments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: projects projects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: property_definitions property_definitions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.property_definitions
    ADD CONSTRAINT property_definitions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: tab_shares tab_shares_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tab_shares
    ADD CONSTRAINT tab_shares_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tab_shares tab_shares_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tab_shares
    ADD CONSTRAINT tab_shares_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: table_comments table_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_comments
    ADD CONSTRAINT table_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.table_comments(id) ON DELETE CASCADE;


--
-- Name: table_comments table_comments_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_comments
    ADD CONSTRAINT table_comments_row_id_fkey FOREIGN KEY (row_id) REFERENCES public.table_rows(id) ON DELETE CASCADE;


--
-- Name: table_comments table_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_comments
    ADD CONSTRAINT table_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: table_fields table_fields_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_fields
    ADD CONSTRAINT table_fields_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_from_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_from_field_id_fkey FOREIGN KEY (from_field_id) REFERENCES public.table_fields(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_from_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_from_row_id_fkey FOREIGN KEY (from_row_id) REFERENCES public.table_rows(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_from_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_from_table_id_fkey FOREIGN KEY (from_table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_to_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_to_row_id_fkey FOREIGN KEY (to_row_id) REFERENCES public.table_rows(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_to_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_to_table_id_fkey FOREIGN KEY (to_table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: table_rows table_rows_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_rows
    ADD CONSTRAINT table_rows_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: table_rows table_rows_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_rows
    ADD CONSTRAINT table_rows_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: table_rows table_rows_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_rows
    ADD CONSTRAINT table_rows_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: table_views table_views_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_views
    ADD CONSTRAINT table_views_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: table_views table_views_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.table_views
    ADD CONSTRAINT table_views_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: tables tables_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: tables tables_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tables tables_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: tabs tabs_parent_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tabs
    ADD CONSTRAINT tabs_parent_tab_id_fkey FOREIGN KEY (parent_tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: tabs tabs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tabs
    ADD CONSTRAINT tabs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_assignees task_assignees_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_items task_items_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_task_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_task_block_id_fkey FOREIGN KEY (task_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: task_items task_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: task_references task_references_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_references task_references_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- Name: task_references task_references_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_references task_references_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: task_subtasks task_subtasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_subtasks
    ADD CONSTRAINT task_subtasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_tag_links task_tag_links_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.task_tags(id) ON DELETE CASCADE;


--
-- Name: task_tag_links task_tag_links_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_tags task_tags_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: timeline_dependencies timeline_dependencies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_dependencies timeline_dependencies_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_from_id_fkey FOREIGN KEY (from_id) REFERENCES public.timeline_events(id) ON DELETE CASCADE;


--
-- Name: timeline_dependencies timeline_dependencies_timeline_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_timeline_block_id_fkey FOREIGN KEY (timeline_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: timeline_dependencies timeline_dependencies_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_to_id_fkey FOREIGN KEY (to_id) REFERENCES public.timeline_events(id) ON DELETE CASCADE;


--
-- Name: timeline_dependencies timeline_dependencies_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: timeline_events timeline_events_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_events timeline_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_events timeline_events_timeline_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_timeline_block_id_fkey FOREIGN KEY (timeline_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: timeline_events timeline_events_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_events timeline_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: timeline_references timeline_references_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_references timeline_references_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.timeline_events(id) ON DELETE CASCADE;


--
-- Name: timeline_references timeline_references_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- Name: timeline_references timeline_references_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: workspace_invitations workspace_invitations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: client_tabs Admins and owners can delete client tabs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins and owners can delete client tabs" ON public.client_tabs FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = client_tabs.client_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['admin'::public.role, 'owner'::public.role]))))));


--
-- Name: client_page_views Anyone can track client page views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can track client page views" ON public.client_page_views FOR INSERT WITH CHECK (true);


--
-- Name: entity_inherited_display Entity inherited display deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity inherited display deletable by workspace members" ON public.entity_inherited_display FOR DELETE USING ((property_definition_id IN ( SELECT property_definitions.id
   FROM public.property_definitions
  WHERE (property_definitions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: entity_inherited_display Entity inherited display insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity inherited display insertable by workspace members" ON public.entity_inherited_display FOR INSERT WITH CHECK ((property_definition_id IN ( SELECT property_definitions.id
   FROM public.property_definitions
  WHERE (property_definitions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: entity_inherited_display Entity inherited display updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity inherited display updatable by workspace members" ON public.entity_inherited_display FOR UPDATE USING ((property_definition_id IN ( SELECT property_definitions.id
   FROM public.property_definitions
  WHERE (property_definitions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: entity_inherited_display Entity inherited display visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity inherited display visible to workspace members" ON public.entity_inherited_display FOR SELECT USING ((property_definition_id IN ( SELECT property_definitions.id
   FROM public.property_definitions
  WHERE (property_definitions.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: entity_links Entity links deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity links deletable by workspace members" ON public.entity_links FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_links Entity links insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity links insertable by workspace members" ON public.entity_links FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_links Entity links visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity links visible to workspace members" ON public.entity_links FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties Entity properties deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity properties deletable by workspace members" ON public.entity_properties FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties Entity properties insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity properties insertable by workspace members" ON public.entity_properties FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties Entity properties updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity properties updatable by workspace members" ON public.entity_properties FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties Entity properties visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Entity properties visible to workspace members" ON public.entity_properties FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: property_definitions Property definitions deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Property definitions deletable by workspace members" ON public.property_definitions FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: property_definitions Property definitions insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Property definitions insertable by workspace members" ON public.property_definitions FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: property_definitions Property definitions updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Property definitions updatable by workspace members" ON public.property_definitions FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: property_definitions Property definitions visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Property definitions visible to workspace members" ON public.property_definitions FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: blocks Public can view blocks in client-visible tabs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view blocks in client-visible tabs" ON public.blocks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.tabs
     JOIN public.projects ON ((projects.id = tabs.project_id)))
  WHERE ((tabs.id = blocks.tab_id) AND (tabs.is_client_visible = true) AND (projects.client_page_enabled = true) AND (projects.public_token IS NOT NULL)))));


--
-- Name: tabs Public can view client-visible tabs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view client-visible tabs" ON public.tabs FOR SELECT USING (((is_client_visible = true) AND (EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = tabs.project_id) AND (projects.client_page_enabled = true) AND (projects.public_token IS NOT NULL))))));


--
-- Name: projects Public can view projects via public_token; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view projects via public_token" ON public.projects FOR SELECT USING (((client_page_enabled = true) AND (public_token IS NOT NULL)));


--
-- Name: table_comments Table comments deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table comments deletable by workspace members" ON public.table_comments FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.table_rows r
     JOIN public.tables t ON ((t.id = r.table_id)))
  WHERE ((r.id = table_comments.row_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_comments Table comments insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table comments insertable by workspace members" ON public.table_comments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.table_rows r
     JOIN public.tables t ON ((t.id = r.table_id)))
  WHERE ((r.id = table_comments.row_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_comments Table comments updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table comments updatable by workspace members" ON public.table_comments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.table_rows r
     JOIN public.tables t ON ((t.id = r.table_id)))
  WHERE ((r.id = table_comments.row_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_comments Table comments visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table comments visible to workspace members" ON public.table_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.table_rows r
     JOIN public.tables t ON ((t.id = r.table_id)))
  WHERE ((r.id = table_comments.row_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_fields Table fields deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table fields deletable by workspace members" ON public.table_fields FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_fields.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_fields Table fields insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table fields insertable by workspace members" ON public.table_fields FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_fields.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_fields Table fields updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table fields updatable by workspace members" ON public.table_fields FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_fields.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_fields Table fields visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table fields visible to workspace members" ON public.table_fields FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_fields.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_relations Table relations deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table relations deletable by workspace members" ON public.table_relations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_relations.from_table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_relations Table relations insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table relations insertable by workspace members" ON public.table_relations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_relations.from_table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_relations Table relations visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table relations visible to workspace members" ON public.table_relations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_relations.from_table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_rows Table rows deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table rows deletable by workspace members" ON public.table_rows FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_rows Table rows insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table rows insertable by workspace members" ON public.table_rows FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_rows Table rows updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table rows updatable by workspace members" ON public.table_rows FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_rows Table rows visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table rows visible to workspace members" ON public.table_rows FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_views Table views deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table views deletable by workspace members" ON public.table_views FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_views.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_views Table views insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table views insertable by workspace members" ON public.table_views FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_views.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_views Table views updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table views updatable by workspace members" ON public.table_views FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_views.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_views Table views visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Table views visible to workspace members" ON public.table_views FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_views.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: tables Tables are visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tables are visible to workspace members" ON public.tables FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: tables Tables can be created by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tables can be created by workspace members" ON public.tables FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: tables Tables can be deleted by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tables can be deleted by workspace members" ON public.tables FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: tables Tables can be updated by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tables can be updated by workspace members" ON public.tables FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_assignees Task assignees deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task assignees deletable by workspace members" ON public.task_assignees FOR DELETE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_assignees Task assignees insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task assignees insertable by workspace members" ON public.task_assignees FOR INSERT WITH CHECK ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_assignees Task assignees visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task assignees visible to workspace members" ON public.task_assignees FOR SELECT USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_comments Task comments deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task comments deletable by workspace members" ON public.task_comments FOR DELETE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_comments Task comments insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task comments insertable by workspace members" ON public.task_comments FOR INSERT WITH CHECK ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_comments Task comments updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task comments updatable by workspace members" ON public.task_comments FOR UPDATE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_comments Task comments visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task comments visible to workspace members" ON public.task_comments FOR SELECT USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_items Task items deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task items deletable by workspace members" ON public.task_items FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_items Task items insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task items insertable by workspace members" ON public.task_items FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_items Task items updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task items updatable by workspace members" ON public.task_items FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_items Task items visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task items visible to workspace members" ON public.task_items FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_references Task references deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task references deletable by workspace members" ON public.task_references FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_references Task references insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task references insertable by workspace members" ON public.task_references FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_references Task references updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task references updatable by workspace members" ON public.task_references FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_references Task references visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task references visible to workspace members" ON public.task_references FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_subtasks Task subtasks deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task subtasks deletable by workspace members" ON public.task_subtasks FOR DELETE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_subtasks Task subtasks insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task subtasks insertable by workspace members" ON public.task_subtasks FOR INSERT WITH CHECK ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_subtasks Task subtasks updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task subtasks updatable by workspace members" ON public.task_subtasks FOR UPDATE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_subtasks Task subtasks visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task subtasks visible to workspace members" ON public.task_subtasks FOR SELECT USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_tag_links Task tag links deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task tag links deletable by workspace members" ON public.task_tag_links FOR DELETE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_tag_links Task tag links insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task tag links insertable by workspace members" ON public.task_tag_links FOR INSERT WITH CHECK ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_tag_links Task tag links visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task tag links visible to workspace members" ON public.task_tag_links FOR SELECT USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_tags Task tags deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task tags deletable by workspace members" ON public.task_tags FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_tags Task tags insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task tags insertable by workspace members" ON public.task_tags FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_tags Task tags updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task tags updatable by workspace members" ON public.task_tags FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_tags Task tags visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Task tags visible to workspace members" ON public.task_tags FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_dependencies Timeline dependencies deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline dependencies deletable by workspace members" ON public.timeline_dependencies FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_dependencies Timeline dependencies insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline dependencies insertable by workspace members" ON public.timeline_dependencies FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_dependencies Timeline dependencies visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline dependencies visible to workspace members" ON public.timeline_dependencies FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_events Timeline events deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline events deletable by workspace members" ON public.timeline_events FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_events Timeline events insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline events insertable by workspace members" ON public.timeline_events FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_events Timeline events updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline events updatable by workspace members" ON public.timeline_events FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_events Timeline events visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline events visible to workspace members" ON public.timeline_events FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_references Timeline references deletable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline references deletable by workspace members" ON public.timeline_references FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_references Timeline references insertable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline references insertable by workspace members" ON public.timeline_references FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_references Timeline references updatable by workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline references updatable by workspace members" ON public.timeline_references FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_references Timeline references visible to workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Timeline references visible to workspace members" ON public.timeline_references FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: client_tab_blocks Users can create client tab blocks in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create client tab blocks in their workspace" ON public.client_tab_blocks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.client_tabs ct
     JOIN public.clients c ON ((c.id = ct.client_id)))
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((ct.id = client_tab_blocks.tab_id) AND (wm.user_id = auth.uid())))));


--
-- Name: client_tabs Users can create client tabs in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create client tabs in their workspace" ON public.client_tabs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = client_tabs.client_id) AND (wm.user_id = auth.uid())))));


--
-- Name: docs Users can create docs in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create docs in their workspace" ON public.docs FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: client_tab_blocks Users can delete client tab blocks in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete client tab blocks in their workspace" ON public.client_tab_blocks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ((public.client_tabs ct
     JOIN public.clients c ON ((c.id = ct.client_id)))
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((ct.id = client_tab_blocks.tab_id) AND (wm.user_id = auth.uid())))));


--
-- Name: docs Users can delete docs in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete docs in their workspace" ON public.docs FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: client_tab_blocks Users can update client tab blocks in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update client tab blocks in their workspace" ON public.client_tab_blocks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ((public.client_tabs ct
     JOIN public.clients c ON ((c.id = ct.client_id)))
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((ct.id = client_tab_blocks.tab_id) AND (wm.user_id = auth.uid())))));


--
-- Name: client_tabs Users can update client tabs in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update client tabs in their workspace" ON public.client_tabs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = client_tabs.client_id) AND (wm.user_id = auth.uid())))));


--
-- Name: docs Users can update docs in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update docs in their workspace" ON public.docs FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);


--
-- Name: client_tab_blocks Users can view client tab blocks in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view client tab blocks in their workspace" ON public.client_tab_blocks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.client_tabs ct
     JOIN public.clients c ON ((c.id = ct.client_id)))
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((ct.id = client_tab_blocks.tab_id) AND (wm.user_id = auth.uid())))));


--
-- Name: client_tabs Users can view client tabs in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view client tabs in their workspace" ON public.client_tabs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = client_tabs.client_id) AND (wm.user_id = auth.uid())))));


--
-- Name: docs Users can view docs in their workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view docs in their workspace" ON public.docs FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties_legacy Workspace members can delete entity properties; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace members can delete entity properties" ON public.entity_properties_legacy FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties_legacy Workspace members can insert entity properties; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace members can insert entity properties" ON public.entity_properties_legacy FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties_legacy Workspace members can update entity properties; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace members can update entity properties" ON public.entity_properties_legacy FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: client_page_views Workspace members can view client page analytics; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace members can view client page analytics" ON public.client_page_views FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = client_page_views.project_id) AND (wm.user_id = auth.uid())))));


--
-- Name: entity_properties_legacy Workspace members can view entity properties; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace members can view entity properties" ON public.entity_properties_legacy FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_invitations Workspace members can view invitations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace members can view invitations" ON public.workspace_invitations FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workspace_invitations Workspace owners/admins can create invitations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace owners/admins can create invitations" ON public.workspace_invitations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = workspace_invitations.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role]))))));


--
-- Name: block_highlights; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.block_highlights ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: client_page_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.client_page_views ENABLE ROW LEVEL SECURITY;

--
-- Name: client_tab_blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.client_tab_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: client_tabs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.client_tabs ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks del_blocks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY del_blocks ON public.blocks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.tabs t
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = blocks.tab_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: clients del_clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY del_clients ON public.clients FOR DELETE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: comments del_comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY del_comments ON public.comments FOR DELETE USING (true);


--
-- Name: projects del_projects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY del_projects ON public.projects FOR DELETE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: tabs del_tabs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY del_tabs ON public.tabs FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = tabs.project_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: workspace_members del_wm; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY del_wm ON public.workspace_members FOR DELETE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workspaces del_workspaces; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY del_workspaces ON public.workspaces FOR DELETE USING ((auth.uid() = owner_id));


--
-- Name: docs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_inherited_display; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.entity_inherited_display ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_properties; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.entity_properties ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_properties_legacy; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.entity_properties_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: file_attachments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: files; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

--
-- Name: block_highlights ins_block_highlights; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_block_highlights ON public.block_highlights FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.blocks b
     JOIN public.tabs t ON ((t.id = b.tab_id)))
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((b.id = block_highlights.block_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: blocks ins_blocks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_blocks ON public.blocks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.tabs t
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = blocks.tab_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: clients ins_clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_clients ON public.clients FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: comments ins_comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_comments ON public.comments FOR INSERT WITH CHECK (true);


--
-- Name: file_attachments ins_file_attachments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_file_attachments ON public.file_attachments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.blocks b
     JOIN public.tabs t ON ((t.id = b.tab_id)))
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((b.id = file_attachments.block_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: files ins_files; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_files ON public.files FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: payment_events ins_payment_events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_payment_events ON public.payment_events FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: payments ins_payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_payments ON public.payments FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: projects ins_projects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_projects ON public.projects FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: tab_shares ins_tab_shares; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_tab_shares ON public.tab_shares FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.tabs t
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = tab_shares.tab_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: tabs ins_tabs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_tabs ON public.tabs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = tabs.project_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: workspace_members ins_wm; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_wm ON public.workspace_members FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = workspace_members.workspace_id) AND (w.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.workspace_members m
  WHERE ((m.workspace_id = m.workspace_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role])))))));


--
-- Name: workspaces ins_workspaces; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ins_workspaces ON public.workspaces FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: payment_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: property_definitions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.property_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: block_highlights sel_block_highlights; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_block_highlights ON public.block_highlights FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.blocks b
     JOIN public.tabs t ON ((t.id = b.tab_id)))
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((b.id = block_highlights.block_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: blocks sel_blocks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_blocks ON public.blocks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.tabs t
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = blocks.tab_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: clients sel_clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_clients ON public.clients FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: comments sel_comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_comments ON public.comments FOR SELECT USING (true);


--
-- Name: file_attachments sel_file_attachments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_file_attachments ON public.file_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.blocks b
     JOIN public.tabs t ON ((t.id = b.tab_id)))
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((b.id = file_attachments.block_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: files sel_files; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_files ON public.files FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: payment_events sel_payment_events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_payment_events ON public.payment_events FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: payments sel_payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_payments ON public.payments FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: projects sel_projects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_projects ON public.projects FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: tab_shares sel_tab_shares; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_tab_shares ON public.tab_shares FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.tabs t
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = tab_shares.tab_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: tabs sel_tabs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_tabs ON public.tabs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = tabs.project_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: workspace_members sel_wm; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_wm ON public.workspace_members FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workspaces sel_workspaces; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sel_workspaces ON public.workspaces FOR SELECT USING (public.is_member_of_workspace(id));


--
-- Name: tab_shares; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tab_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: table_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.table_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: table_fields; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.table_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: table_relations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.table_relations ENABLE ROW LEVEL SECURITY;

--
-- Name: table_rows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.table_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: table_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.table_views ENABLE ROW LEVEL SECURITY;

--
-- Name: tables; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

--
-- Name: tabs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tabs ENABLE ROW LEVEL SECURITY;

--
-- Name: task_assignees; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

--
-- Name: task_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;

--
-- Name: task_references; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.task_references ENABLE ROW LEVEL SECURITY;

--
-- Name: task_subtasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

--
-- Name: task_tag_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.task_tag_links ENABLE ROW LEVEL SECURITY;

--
-- Name: task_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: timeline_dependencies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.timeline_dependencies ENABLE ROW LEVEL SECURITY;

--
-- Name: timeline_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

--
-- Name: timeline_references; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.timeline_references ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks upd_blocks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY upd_blocks ON public.blocks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.tabs t
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = blocks.tab_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: clients upd_clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY upd_clients ON public.clients FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: comments upd_comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY upd_comments ON public.comments FOR UPDATE USING (true);


--
-- Name: payments upd_payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY upd_payments ON public.payments FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: projects upd_projects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY upd_projects ON public.projects FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: tabs upd_tabs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY upd_tabs ON public.tabs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = tabs.project_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: workspace_members upd_wm; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY upd_wm ON public.workspace_members FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workspaces upd_workspaces; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY upd_workspaces ON public.workspaces FOR UPDATE USING (public.is_member_of_workspace(id));


--
-- Name: workspace_invitations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION assign_table_field_order(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.assign_table_field_order() TO anon;
GRANT ALL ON FUNCTION public.assign_table_field_order() TO authenticated;
GRANT ALL ON FUNCTION public.assign_table_field_order() TO service_role;


--
-- Name: FUNCTION assign_table_row_order(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.assign_table_row_order() TO anon;
GRANT ALL ON FUNCTION public.assign_table_row_order() TO authenticated;
GRANT ALL ON FUNCTION public.assign_table_row_order() TO service_role;


--
-- Name: FUNCTION create_default_property_definitions(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_default_property_definitions() TO anon;
GRANT ALL ON FUNCTION public.create_default_property_definitions() TO authenticated;
GRANT ALL ON FUNCTION public.create_default_property_definitions() TO service_role;


--
-- Name: FUNCTION ensure_single_default_view(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.ensure_single_default_view() TO anon;
GRANT ALL ON FUNCTION public.ensure_single_default_view() TO authenticated;
GRANT ALL ON FUNCTION public.ensure_single_default_view() TO service_role;


--
-- Name: FUNCTION generate_payment_number(workspace_uuid uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_payment_number(workspace_uuid uuid) TO anon;
GRANT ALL ON FUNCTION public.generate_payment_number(workspace_uuid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.generate_payment_number(workspace_uuid uuid) TO service_role;


--
-- Name: FUNCTION generate_public_token(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_public_token() TO anon;
GRANT ALL ON FUNCTION public.generate_public_token() TO authenticated;
GRANT ALL ON FUNCTION public.generate_public_token() TO service_role;


--
-- Name: FUNCTION get_next_block_position(p_tab_id uuid, p_parent_block_id uuid, p_column integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_next_block_position(p_tab_id uuid, p_parent_block_id uuid, p_column integer) TO anon;
GRANT ALL ON FUNCTION public.get_next_block_position(p_tab_id uuid, p_parent_block_id uuid, p_column integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_next_block_position(p_tab_id uuid, p_parent_block_id uuid, p_column integer) TO service_role;


--
-- Name: FUNCTION get_workspace_id_for_entity(p_entity_type text, p_entity_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_workspace_id_for_entity(p_entity_type text, p_entity_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_workspace_id_for_entity(p_entity_type text, p_entity_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_workspace_id_for_entity(p_entity_type text, p_entity_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_member_of_workspace(ws_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_member_of_workspace(ws_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_member_of_workspace(ws_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_member_of_workspace(ws_id uuid) TO service_role;


--
-- Name: FUNCTION set_payment_number(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_payment_number() TO anon;
GRANT ALL ON FUNCTION public.set_payment_number() TO authenticated;
GRANT ALL ON FUNCTION public.set_payment_number() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION update_client_tabs_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_client_tabs_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_client_tabs_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_client_tabs_updated_at() TO service_role;


--
-- Name: FUNCTION update_docs_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_docs_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_docs_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_docs_updated_at() TO service_role;


--
-- Name: FUNCTION update_payment_timestamp(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_payment_timestamp() TO anon;
GRANT ALL ON FUNCTION public.update_payment_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.update_payment_timestamp() TO service_role;


--
-- Name: FUNCTION validate_table_row_data(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.validate_table_row_data() TO anon;
GRANT ALL ON FUNCTION public.validate_table_row_data() TO authenticated;
GRANT ALL ON FUNCTION public.validate_table_row_data() TO service_role;


--
-- Name: TABLE block_highlights; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.block_highlights TO anon;
GRANT ALL ON TABLE public.block_highlights TO authenticated;
GRANT ALL ON TABLE public.block_highlights TO service_role;


--
-- Name: TABLE blocks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.blocks TO anon;
GRANT ALL ON TABLE public.blocks TO authenticated;
GRANT ALL ON TABLE public.blocks TO service_role;


--
-- Name: TABLE client_page_views; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.client_page_views TO anon;
GRANT ALL ON TABLE public.client_page_views TO authenticated;
GRANT ALL ON TABLE public.client_page_views TO service_role;


--
-- Name: TABLE projects; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.projects TO anon;
GRANT ALL ON TABLE public.projects TO authenticated;
GRANT ALL ON TABLE public.projects TO service_role;


--
-- Name: TABLE client_page_analytics_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.client_page_analytics_summary TO anon;
GRANT ALL ON TABLE public.client_page_analytics_summary TO authenticated;
GRANT ALL ON TABLE public.client_page_analytics_summary TO service_role;


--
-- Name: TABLE client_tab_blocks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.client_tab_blocks TO anon;
GRANT ALL ON TABLE public.client_tab_blocks TO authenticated;
GRANT ALL ON TABLE public.client_tab_blocks TO service_role;


--
-- Name: TABLE client_tabs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.client_tabs TO anon;
GRANT ALL ON TABLE public.client_tabs TO authenticated;
GRANT ALL ON TABLE public.client_tabs TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comments TO anon;
GRANT ALL ON TABLE public.comments TO authenticated;
GRANT ALL ON TABLE public.comments TO service_role;


--
-- Name: TABLE dashboard_projects; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dashboard_projects TO anon;
GRANT ALL ON TABLE public.dashboard_projects TO authenticated;
GRANT ALL ON TABLE public.dashboard_projects TO service_role;


--
-- Name: TABLE docs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.docs TO anon;
GRANT ALL ON TABLE public.docs TO authenticated;
GRANT ALL ON TABLE public.docs TO service_role;


--
-- Name: TABLE entity_inherited_display; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_inherited_display TO anon;
GRANT ALL ON TABLE public.entity_inherited_display TO authenticated;
GRANT ALL ON TABLE public.entity_inherited_display TO service_role;


--
-- Name: TABLE entity_links; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_links TO anon;
GRANT ALL ON TABLE public.entity_links TO authenticated;
GRANT ALL ON TABLE public.entity_links TO service_role;


--
-- Name: TABLE entity_properties; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_properties TO anon;
GRANT ALL ON TABLE public.entity_properties TO authenticated;
GRANT ALL ON TABLE public.entity_properties TO service_role;


--
-- Name: TABLE entity_properties_legacy; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_properties_legacy TO anon;
GRANT ALL ON TABLE public.entity_properties_legacy TO authenticated;
GRANT ALL ON TABLE public.entity_properties_legacy TO service_role;


--
-- Name: TABLE file_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.file_attachments TO anon;
GRANT ALL ON TABLE public.file_attachments TO authenticated;
GRANT ALL ON TABLE public.file_attachments TO service_role;


--
-- Name: TABLE files; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.files TO anon;
GRANT ALL ON TABLE public.files TO authenticated;
GRANT ALL ON TABLE public.files TO service_role;


--
-- Name: TABLE payment_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payment_events TO anon;
GRANT ALL ON TABLE public.payment_events TO authenticated;
GRANT ALL ON TABLE public.payment_events TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE property_definitions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.property_definitions TO anon;
GRANT ALL ON TABLE public.property_definitions TO authenticated;
GRANT ALL ON TABLE public.property_definitions TO service_role;


--
-- Name: TABLE tab_shares; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tab_shares TO anon;
GRANT ALL ON TABLE public.tab_shares TO authenticated;
GRANT ALL ON TABLE public.tab_shares TO service_role;


--
-- Name: TABLE table_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.table_comments TO anon;
GRANT ALL ON TABLE public.table_comments TO authenticated;
GRANT ALL ON TABLE public.table_comments TO service_role;


--
-- Name: TABLE table_fields; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.table_fields TO anon;
GRANT ALL ON TABLE public.table_fields TO authenticated;
GRANT ALL ON TABLE public.table_fields TO service_role;


--
-- Name: TABLE table_relations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.table_relations TO anon;
GRANT ALL ON TABLE public.table_relations TO authenticated;
GRANT ALL ON TABLE public.table_relations TO service_role;


--
-- Name: TABLE table_rows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.table_rows TO anon;
GRANT ALL ON TABLE public.table_rows TO authenticated;
GRANT ALL ON TABLE public.table_rows TO service_role;


--
-- Name: TABLE table_views; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.table_views TO anon;
GRANT ALL ON TABLE public.table_views TO authenticated;
GRANT ALL ON TABLE public.table_views TO service_role;


--
-- Name: TABLE tables; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tables TO anon;
GRANT ALL ON TABLE public.tables TO authenticated;
GRANT ALL ON TABLE public.tables TO service_role;


--
-- Name: TABLE tabs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tabs TO anon;
GRANT ALL ON TABLE public.tabs TO authenticated;
GRANT ALL ON TABLE public.tabs TO service_role;


--
-- Name: TABLE task_assignees; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_assignees TO anon;
GRANT ALL ON TABLE public.task_assignees TO authenticated;
GRANT ALL ON TABLE public.task_assignees TO service_role;


--
-- Name: TABLE task_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_comments TO anon;
GRANT ALL ON TABLE public.task_comments TO authenticated;
GRANT ALL ON TABLE public.task_comments TO service_role;


--
-- Name: TABLE task_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_items TO anon;
GRANT ALL ON TABLE public.task_items TO authenticated;
GRANT ALL ON TABLE public.task_items TO service_role;


--
-- Name: TABLE task_references; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_references TO anon;
GRANT ALL ON TABLE public.task_references TO authenticated;
GRANT ALL ON TABLE public.task_references TO service_role;


--
-- Name: TABLE task_subtasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_subtasks TO anon;
GRANT ALL ON TABLE public.task_subtasks TO authenticated;
GRANT ALL ON TABLE public.task_subtasks TO service_role;


--
-- Name: TABLE task_tag_links; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_tag_links TO anon;
GRANT ALL ON TABLE public.task_tag_links TO authenticated;
GRANT ALL ON TABLE public.task_tag_links TO service_role;


--
-- Name: TABLE task_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.task_tags TO anon;
GRANT ALL ON TABLE public.task_tags TO authenticated;
GRANT ALL ON TABLE public.task_tags TO service_role;


--
-- Name: TABLE timeline_dependencies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.timeline_dependencies TO anon;
GRANT ALL ON TABLE public.timeline_dependencies TO authenticated;
GRANT ALL ON TABLE public.timeline_dependencies TO service_role;


--
-- Name: TABLE timeline_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.timeline_events TO anon;
GRANT ALL ON TABLE public.timeline_events TO authenticated;
GRANT ALL ON TABLE public.timeline_events TO service_role;


--
-- Name: TABLE timeline_references; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.timeline_references TO anon;
GRANT ALL ON TABLE public.timeline_references TO authenticated;
GRANT ALL ON TABLE public.timeline_references TO service_role;


--
-- Name: TABLE workspace_invitations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.workspace_invitations TO anon;
GRANT ALL ON TABLE public.workspace_invitations TO authenticated;
GRANT ALL ON TABLE public.workspace_invitations TO service_role;


--
-- Name: TABLE workspace_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.workspace_members TO anon;
GRANT ALL ON TABLE public.workspace_members TO authenticated;
GRANT ALL ON TABLE public.workspace_members TO service_role;


--
-- Name: TABLE workspaces; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.workspaces TO anon;
GRANT ALL ON TABLE public.workspaces TO authenticated;
GRANT ALL ON TABLE public.workspaces TO service_role;


--
-- Name: TABLE workspace_members_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.workspace_members_view TO anon;
GRANT ALL ON TABLE public.workspace_members_view TO authenticated;
GRANT ALL ON TABLE public.workspace_members_view TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict fDoqNd6imQSCYknFDSBD0nMLQPf3Jce0oxwfEC5r1yflz6P5cZtkKOIzhlo0Ha0
