--
-- PostgreSQL database dump
--

\restrict d3au8FCGJZNQpDzEZAHTOMY46ksMY0XYN1qN7ZaXOvYXJ7rhX8lH3KaB1RTbX10

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
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_functions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_functions;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: block_type; Type: TYPE; Schema: public; Owner: -
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
    'section_header',
    'stripe_payment',
    'file',
    'doc_reference',
    'gallery',
    'chart',
    'shopify_product'
);


--
-- Name: TYPE block_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.block_type IS 'Types of blocks that can be added to tabs: text, task, link, divider, table, timeline, file, video, image, gallery, embed, pdf, section, section_header, doc_reference, chart, shopify_product';


--
-- Name: file_display_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.file_display_mode AS ENUM (
    'inline',
    'linked'
);


--
-- Name: highlight_color; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.highlight_color AS ENUM (
    'yellow',
    'green',
    'red',
    'blue'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'overdue',
    'draft',
    'failed',
    'canceled'
);


--
-- Name: proj_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.proj_status AS ENUM (
    'not_started',
    'in_progress',
    'complete'
);


--
-- Name: role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role AS ENUM (
    'owner',
    'admin',
    'teammate'
);


--
-- Name: share_permission; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.share_permission AS ENUM (
    'view',
    'comment',
    'edit'
);


--
-- Name: target_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.target_type AS ENUM (
    'block',
    'tab',
    'project'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_event_trigger_ddl_commands() AS ev
      JOIN pg_extension AS ext
      ON ev.objid = ext.oid
      WHERE ext.extname = 'pg_net'
    )
    THEN
      GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

      IF EXISTS (
        SELECT FROM pg_extension
        WHERE extname = 'pg_net'
        -- all versions in use on existing projects as of 2025-02-20
        -- version 0.12.0 onwards don't need these applied
        AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
      ) THEN
        ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
        ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

        ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
        ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

        REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
        REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

        GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
        GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      END IF;
    END IF;
  END;
  $$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: _resolve_field_value(text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._resolve_field_value(p_field_type text, p_config jsonb, p_value jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_options jsonb;
  v_item jsonb;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_field_type IN ('select', 'status', 'priority', 'multi_select') THEN
    IF p_field_type = 'priority' THEN
      v_options := p_config->'levels';
    ELSE
      v_options := p_config->'options';
    END IF;

    IF jsonb_typeof(p_value) = 'array' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_value) LOOP
        v_result := v_result || jsonb_build_array(public._resolve_option_id(v_options, v_item));
      END LOOP;
      RETURN v_result;
    END IF;

    RETURN public._resolve_option_id(v_options, p_value);
  END IF;

  RETURN p_value;
END;
$$;


--
-- Name: _resolve_field_value_with_property_def(text, jsonb, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._resolve_field_value_with_property_def(p_field_type text, p_field_config jsonb, p_property_definition_id uuid, p_value jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_item jsonb;
  v_item_text text;
  v_result jsonb := '[]'::jsonb;
  v_normalized text;
begin
  if p_field_type not in ('status', 'priority') then
    return public._resolve_field_value(p_field_type, p_field_config, p_value);
  end if;

  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for v_item in select * from jsonb_array_elements(p_value) loop
      v_item_text := lower(btrim(v_item #>> '{}'));
      v_normalized := regexp_replace(v_item_text, '[\s-]+', '_', 'g');

      if p_field_type = 'status' then
        if v_normalized in ('todo', 'to_do', 'not_started', 'backlog') then
          v_result := v_result || jsonb_build_array(to_jsonb('todo'::text));
        elsif v_normalized in ('in_progress', 'inprogress', 'doing', 'active', 'working') then
          v_result := v_result || jsonb_build_array(to_jsonb('in_progress'::text));
        elsif v_normalized in ('done', 'complete', 'completed', 'finished') then
          v_result := v_result || jsonb_build_array(to_jsonb('done'::text));
        elsif v_normalized in ('blocked', 'on_hold', 'stuck') then
          v_result := v_result || jsonb_build_array(to_jsonb('blocked'::text));
        end if;
      else
        if v_normalized in ('urgent', 'critical', 'highest', 'p0') then
          v_result := v_result || jsonb_build_array(to_jsonb('urgent'::text));
        elsif v_normalized in ('high', 'p1') then
          v_result := v_result || jsonb_build_array(to_jsonb('high'::text));
        elsif v_normalized in ('medium', 'normal', 'med', 'p2') then
          v_result := v_result || jsonb_build_array(to_jsonb('medium'::text));
        elsif v_normalized in ('low', 'lowest', 'minor', 'p3') then
          v_result := v_result || jsonb_build_array(to_jsonb('low'::text));
        end if;
      end if;
    end loop;
    return v_result;
  end if;

  v_item_text := lower(btrim(p_value #>> '{}'));
  v_normalized := regexp_replace(v_item_text, '[\s-]+', '_', 'g');

  if p_field_type = 'status' then
    if v_normalized in ('todo', 'to_do', 'not_started', 'backlog') then
      return to_jsonb('todo'::text);
    elsif v_normalized in ('in_progress', 'inprogress', 'doing', 'active', 'working') then
      return to_jsonb('in_progress'::text);
    elsif v_normalized in ('done', 'complete', 'completed', 'finished') then
      return to_jsonb('done'::text);
    elsif v_normalized in ('blocked', 'on_hold', 'stuck') then
      return to_jsonb('blocked'::text);
    end if;
    return null;
  end if;

  if v_normalized in ('urgent', 'critical', 'highest', 'p0') then
    return to_jsonb('urgent'::text);
  elsif v_normalized in ('high', 'p1') then
    return to_jsonb('high'::text);
  elsif v_normalized in ('medium', 'normal', 'med', 'p2') then
    return to_jsonb('medium'::text);
  elsif v_normalized in ('low', 'lowest', 'minor', 'p3') then
    return to_jsonb('low'::text);
  end if;

  return null;
end;
$$;


--
-- Name: _resolve_option_id(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._resolve_option_id(p_options jsonb, p_value jsonb) RETURNS jsonb
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


--
-- Name: _resolve_option_id_or_null(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._resolve_option_id_or_null(p_options jsonb, p_value jsonb) RETURNS jsonb
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


--
-- Name: _resolve_table_field_id(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._resolve_table_field_id(p_table_id uuid, p_key text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_field_id uuid;
BEGIN
  -- Try direct UUID
  BEGIN
    v_field_id := p_key::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_field_id := NULL;
  END;

  IF v_field_id IS NOT NULL THEN
    SELECT id INTO v_field_id
    FROM public.table_fields
    WHERE table_id = p_table_id AND id = v_field_id;
    IF FOUND THEN
      RETURN v_field_id;
    END IF;
  END IF;

  -- Try by name (case-insensitive)
  SELECT id INTO v_field_id
  FROM public.table_fields
  WHERE table_id = p_table_id AND lower(name) = lower(p_key)
  LIMIT 1;

  RETURN v_field_id;
END;
$$;


--
-- Name: add_organization_owner_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_organization_owner_on_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$;


--
-- Name: assign_table_field_order(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: assign_table_row_order(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: bulk_delete_rows(uuid, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_delete_rows(p_table_id uuid, p_row_ids uuid[], p_updated_by uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_rel record;
  v_row record;
BEGIN
  -- Delete rows
  DELETE FROM public.table_rows
  WHERE table_id = p_table_id AND id = ANY(p_row_ids);

  -- Clean up relation references (remove deleted ids from relation arrays)
  FOR v_rel IN
    SELECT from_row_id, from_field_id, to_row_id, from_table_id
    FROM public.table_relations
    WHERE to_row_id = ANY(p_row_ids)
  LOOP
    SELECT data INTO v_row FROM public.table_rows WHERE id = v_rel.from_row_id;
    IF v_row.data IS NULL THEN
      CONTINUE;
    END IF;
    UPDATE public.table_rows
    SET data = jsonb_set(
      v_row.data,
      ARRAY[v_rel.from_field_id::text],
      (
        SELECT to_jsonb(
          ARRAY(
            SELECT value::text
            FROM jsonb_array_elements_text(COALESCE(v_row.data->v_rel.from_field_id::text, '[]'::jsonb))
            WHERE value::uuid <> v_rel.to_row_id
          )
        )
      ),
      true
    ),
    updated_by = p_updated_by
    WHERE id = v_rel.from_row_id;
  END LOOP;
END;
$$;


--
-- Name: bulk_duplicate_rows(uuid, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_duplicate_rows(p_table_id uuid, p_row_ids uuid[], p_created_by uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_rows record;
  v_idx int := 0;
BEGIN
  FOR v_rows IN
    SELECT * FROM public.table_rows
    WHERE table_id = p_table_id AND id = ANY(p_row_ids)
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
    VALUES (v_rows.table_id, v_rows.data, COALESCE(v_rows."order", 0) + (0.001 * v_idx), p_created_by, p_created_by);
  END LOOP;
END;
$$;


--
-- Name: bulk_insert_rows(uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_insert_rows(p_table_id uuid, p_rows jsonb, p_created_by uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_row jsonb;
  v_data jsonb;
  v_order numeric;
  v_field_name text;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_table_field_name text;
  v_cell_value jsonb;
  v_inserted_ids uuid[] := array[]::uuid[];
  v_row_id uuid;
  v_named_fixed_values jsonb;
  v_fixed_entry record;
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.tables
  where id = p_table_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_data := '{}'::jsonb;
    v_named_fixed_values := '{}'::jsonb;
    v_order := null;

    if v_row ? 'order' then
      begin
        v_order := (v_row->>'order')::numeric;
      exception when invalid_text_representation then
        v_order := null;
      end;
    end if;

    for v_field_name, v_field_id in
      select key, public._resolve_table_field_id(p_table_id, key)
      from jsonb_each(coalesce(v_row->'data', '{}'::jsonb))
    loop
      if v_field_id is null then
        continue;
      end if;

      select name, type, config
      into v_table_field_name, v_field_type, v_field_config
      from public.table_fields
      where id = v_field_id;

      if v_field_type in ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') then
        continue;
      end if;

      v_cell_value := public._resolve_field_value_with_property_def(
        v_field_type,
        v_field_config,
        null,  -- no property_definition_id
        (v_row->'data'->v_field_name)
      );

      if v_cell_value is null then
        continue;
      end if;

      v_data := v_data || jsonb_build_object(v_field_id::text, v_cell_value);

      if v_field_type in ('status', 'priority') and v_table_field_name is not null and btrim(v_table_field_name) <> '' then
        v_named_fixed_values := v_named_fixed_values || jsonb_build_object(
          v_table_field_name,
          jsonb_build_object(
            'field_type', v_field_type,
            'value', v_cell_value
          )
        );
      end if;
    end loop;

    insert into public.table_rows (table_id, data, "order", created_by, updated_by)
    values (p_table_id, v_data, v_order, p_created_by, p_created_by)
    returning id into v_row_id;

    v_inserted_ids := v_inserted_ids || v_row_id;

    for v_fixed_entry in select key, value from jsonb_each(v_named_fixed_values) loop
      insert into public.entity_properties (
        entity_type,
        entity_id,
        workspace_id,
        field_name,
        field_type,
        value
      )
      values (
        'table_row',
        v_row_id,
        v_workspace_id,
        v_fixed_entry.key,
        v_fixed_entry.value->>'field_type',
        v_fixed_entry.value->'value'
      )
      on conflict (entity_type, entity_id, field_name)
      do update set
        workspace_id = excluded.workspace_id,
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    end loop;

    -- Remove stale legacy rows
    delete from public.entity_properties ep
    where ep.entity_type = 'table_row'
      and ep.entity_id = v_row_id
      and ep.field_type in ('priority', 'status')
      and not exists (
        select 1
        from public.table_fields tf
        where tf.table_id = p_table_id
          and tf.type = ep.field_type
          and lower(btrim(tf.name)) = lower(btrim(ep.field_name))
      );
  end loop;

  return jsonb_build_object('inserted_ids', v_inserted_ids);
end;
$$;


--
-- Name: bulk_move_task_items(uuid[], uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_move_task_items(p_task_ids uuid[], p_target_block_id uuid, p_tab_id uuid, p_project_id uuid, p_workspace_id uuid, p_updated_by uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_skipped uuid[];
  v_max_order int := 0;
  v_moved int := 0;
BEGIN
  SELECT COALESCE(max(display_order), -1) INTO v_max_order
  FROM public.task_items
  WHERE task_block_id = p_target_block_id;

  WITH ordered AS (
    SELECT id, row_number() OVER () AS rn
    FROM unnest(p_task_ids) AS id
  )
  UPDATE public.task_items t
  SET
    task_block_id = p_target_block_id,
    tab_id = p_tab_id,
    project_id = p_project_id,
    workspace_id = p_workspace_id,
    display_order = v_max_order + ordered.rn,
    updated_by = p_updated_by
  FROM ordered
  WHERE t.id = ordered.id AND t.workspace_id = p_workspace_id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;

  v_skipped := ARRAY(
    SELECT id FROM unnest(p_task_ids) AS id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.task_items t WHERE t.id = id AND t.workspace_id = p_workspace_id
    )
  );

  RETURN jsonb_build_object('moved_count', v_moved, 'skipped', COALESCE(v_skipped, ARRAY[]::uuid[]));
END;
$$;


--
-- Name: bulk_set_task_assignees(uuid[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_set_task_assignees(p_task_ids uuid[], p_assignees jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_task_id uuid;
  v_workspace_id uuid;
  v_assignee jsonb;
  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);
begin
  select workspace_id into v_workspace_id
  from public.task_items
  where id = p_task_ids[1];

  if v_workspace_id is null then
    return jsonb_build_object('updated_count', 0);
  end if;

  foreach v_task_id in array p_task_ids loop
    delete from public.task_assignees where task_id = v_task_id;
    for v_assignee in select * from jsonb_array_elements(v_assignee_payload) loop
      insert into public.task_assignees (task_id, assignee_id, assignee_name)
      values (
        v_task_id,
        nullif(v_assignee->>'id','')::uuid,
        coalesce(nullif(v_assignee->>'name',''), nullif(v_assignee->>'id',''), 'Unknown')
      );
    end loop;

    if jsonb_array_length(v_assignee_payload) > 0 then
      insert into public.entity_properties (
        workspace_id,
        entity_type,
        entity_id,
        field_name,
        field_type,
        value
      )
      values (
        v_workspace_id,
        'task',
        v_task_id,
        'Assignee',
        'assignee',
        v_assignee_payload
      )
      on conflict (entity_id, entity_type, field_name)
      do update set
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    else
      delete from public.entity_properties
      where workspace_id = v_workspace_id
        and entity_type = 'task'
        and entity_id = v_task_id
        and field_name = 'Assignee';
    end if;

    -- Keep task_items.assignee_id in sync (denormalized first assignee)
    update public.task_items
    set assignee_id = case
      when jsonb_array_length(v_assignee_payload) > 0 then
        nullif(v_assignee_payload->0->>'id', '')::uuid
      else null
    end
    where id = v_task_id;
  end loop;

  return jsonb_build_object('updated_count', array_length(p_task_ids, 1));
end;
$$;


--
-- Name: bulk_set_task_assignees(uuid[], jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_set_task_assignees(p_task_ids uuid[], p_assignees jsonb, p_updated_by uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_task_id uuid;
  v_workspace_id uuid;
  v_assignee jsonb;
  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);
begin
  select workspace_id into v_workspace_id
  from public.task_items
  where id = p_task_ids[1];

  if v_workspace_id is null then
    return jsonb_build_object('updated_count', 0);
  end if;

  foreach v_task_id in array p_task_ids loop
    delete from public.task_assignees where task_id = v_task_id;
    for v_assignee in select * from jsonb_array_elements(v_assignee_payload) loop
      insert into public.task_assignees (task_id, assignee_id, assignee_name)
      values (
        v_task_id,
        nullif(v_assignee->>'id','')::uuid,
        coalesce(nullif(v_assignee->>'name',''), nullif(v_assignee->>'id',''), 'Unknown')
      );
    end loop;

    if jsonb_array_length(v_assignee_payload) > 0 then
      insert into public.entity_properties (
        workspace_id,
        entity_type,
        entity_id,
        field_name,
        field_type,
        value
      )
      values (
        v_workspace_id,
        'task',
        v_task_id,
        'Assignee',
        'assignee',
        v_assignee_payload
      )
      on conflict (entity_id, entity_type, field_name)
      do update set
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    else
      delete from public.entity_properties
      where workspace_id = v_workspace_id
        and entity_type = 'task'
        and entity_id = v_task_id
        and field_name = 'Assignee';
    end if;

    -- Keep task_items.assignee_id in sync (denormalized first assignee)
    update public.task_items
    set assignee_id = case
      when jsonb_array_length(v_assignee_payload) > 0 then
        nullif(v_assignee_payload->0->>'id', '')::uuid
      else null
    end
    where id = v_task_id;
  end loop;

  return jsonb_build_object('updated_count', array_length(p_task_ids, 1));
end;
$$;


--
-- Name: bulk_update_rows(uuid, uuid[], jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_update_rows(p_table_id uuid, p_row_ids uuid[], p_updates jsonb, p_updated_by uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_updates jsonb := '{}'::jsonb;
  v_entry record;
  v_field_type text;
  v_field_config jsonb;
  v_resolved jsonb;
BEGIN
  FOR v_entry IN
    SELECT key, value
    FROM jsonb_each(COALESCE(p_updates, '{}'::jsonb))
  LOOP
    SELECT type, config
    INTO v_field_type, v_field_config
    FROM public.table_fields
    WHERE table_id = p_table_id
      AND id::text = v_entry.key
    LIMIT 1;

    IF v_field_type IS NULL THEN
      CONTINUE;
    END IF;

    IF jsonb_typeof(v_entry.value) = 'null' THEN
      v_updates := v_updates || jsonb_build_object(v_entry.key, null);
      CONTINUE;
    END IF;

    v_resolved := public._resolve_field_value_with_property_def(
      v_field_type,
      v_field_config,
      null,
      v_entry.value
    );

    v_updates := v_updates || jsonb_build_object(v_entry.key, v_resolved);
  END LOOP;

  UPDATE public.table_rows
  SET data = COALESCE(data, '{}'::jsonb) || v_updates,
      updated_by = p_updated_by,
      edited = CASE WHEN source_entity_id IS NOT NULL THEN true ELSE COALESCE(edited, false) END
  WHERE table_id = p_table_id AND id = ANY(p_row_ids);
END;
$$;


--
-- Name: bulk_update_rows_by_field_names(uuid, jsonb, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_update_rows_by_field_names(p_table_id uuid, p_rows jsonb, p_limit integer, p_updated_by uuid) RETURNS TABLE(updated integer, row_ids uuid[])
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_entry jsonb;
  v_filters jsonb;
  v_updates jsonb;
  v_row_ids uuid[];
  v_total_ids uuid[] := ARRAY[]::uuid[];
  v_total int := 0;
BEGIN
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_filters := v_entry->'filters';
    v_updates := v_entry->'updates';
    IF v_updates IS NULL THEN
      CONTINUE;
    END IF;
    SELECT updated, row_ids INTO v_total, v_row_ids
    FROM public.update_table_rows_by_field_names(p_table_id, v_filters, v_updates, p_limit, p_updated_by)
    LIMIT 1;
    IF v_row_ids IS NOT NULL THEN
      v_total_ids := v_total_ids || v_row_ids;
      v_total_ids := ARRAY(SELECT DISTINCT unnest(v_total_ids));
    END IF;
  END LOOP;

  updated := COALESCE(array_length(v_total_ids, 1), 0);
  row_ids := v_total_ids;
  RETURN NEXT;
END;
$$;


--
-- Name: bulk_update_task_items(uuid[], jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_update_task_items(p_task_ids uuid[], p_updates jsonb, p_updated_by uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_workspace_id uuid;
  v_valid_ids uuid[];
  v_skipped uuid[];
  v_updated_count int := 0;
begin
  select workspace_id into v_workspace_id
  from public.task_items
  where id = p_task_ids[1];

  if v_workspace_id is null then
    return jsonb_build_object('updated_count', 0, 'skipped', p_task_ids);
  end if;

  select array_agg(id) into v_valid_ids
  from public.task_items
  where id = any(p_task_ids) and workspace_id = v_workspace_id;

  v_skipped := array(
    select id from unnest(p_task_ids) as id
    where not (id = any(coalesce(v_valid_ids, array[]::uuid[])))
  );

  if v_valid_ids is not null then
    update public.task_items
    set
      title = coalesce(p_updates->>'title', title),
      status = coalesce(p_updates->>'status', status),
      statuses = case
        when p_updates ? 'statuses' then coalesce(p_updates->'statuses', '[]'::jsonb)
        when p_updates ? 'status' then
          case
            when nullif(btrim(coalesce(p_updates->>'status', '')), '') is null then '[]'::jsonb
            else jsonb_build_array(jsonb_build_object('field_name', 'Status', 'value',
              case
                when lower(p_updates->>'status') = 'in-progress' then 'in_progress'
                when lower(p_updates->>'status') = 'in progress' then 'in_progress'
                when lower(p_updates->>'status') = 'done' then 'done'
                when lower(p_updates->>'status') = 'blocked' then 'blocked'
                else 'todo'
              end
            ))
          end
        else statuses
      end,
      priorities = case
        when p_updates ? 'priorities' then coalesce(p_updates->'priorities', '[]'::jsonb)
        when p_updates ? 'priority' then
          case
            when nullif(btrim(coalesce(p_updates->>'priority', '')), '') is null or lower(p_updates->>'priority') = 'none'
              then '[]'::jsonb
            else jsonb_build_array(jsonb_build_object('field_name', 'Priority', 'value', lower(p_updates->>'priority')))
          end
        else priorities
      end,
      description = coalesce(p_updates->>'description', description),
      due_date = coalesce((p_updates->>'dueDate')::date, due_date),
      due_time = coalesce((p_updates->>'dueTime')::time, due_time),
      start_date = coalesce((p_updates->>'startDate')::date, start_date),
      hide_icons = coalesce((p_updates->>'hideIcons')::boolean, hide_icons),
      recurring_enabled = coalesce((p_updates->>'recurringEnabled')::boolean, recurring_enabled),
      recurring_frequency = coalesce(p_updates->>'recurringFrequency', recurring_frequency),
      recurring_interval = coalesce((p_updates->>'recurringInterval')::integer, recurring_interval),
      updated_by = p_updated_by
    where id = any(v_valid_ids);
    get diagnostics v_updated_count = row_count;
  end if;

  return jsonb_build_object('updated_count', v_updated_count, 'skipped', coalesce(v_skipped, array[]::uuid[]));
end;
$$;


--
-- Name: can_access_project(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_project(project_id_param uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_id_param
      AND public.can_access_project(p.id, p.workspace_id)
  );
$$;


--
-- Name: can_access_project(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_project(project_id_param uuid, workspace_id_param uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT
    public.is_member_of_workspace(workspace_id_param)
    AND (
      -- Workspace owner always has access.
      EXISTS (
        SELECT 1
        FROM public.workspaces ws
        WHERE ws.id = workspace_id_param
          AND ws.owner_id = auth.uid()
      )
      -- No explicit project members => open to all workspace members.
      OR NOT EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = project_id_param
      )
      -- Explicit member access.
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = project_id_param
          AND pm.user_id = auth.uid()
      )
    );
$$;


--
-- Name: cleanup_entity_properties_on_block_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_entity_properties_on_block_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Delete all entity_properties for this block
  DELETE FROM public.entity_properties
  WHERE entity_type = 'block'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this block
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'block' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'block' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;


--
-- Name: FUNCTION cleanup_entity_properties_on_block_delete(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_entity_properties_on_block_delete() IS 'Automatically deletes entity_properties and entity_links when a block is deleted to prevent orphaned records.';


--
-- Name: cleanup_entity_properties_on_subtask_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_entity_properties_on_subtask_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Delete all entity_properties for this subtask
  DELETE FROM public.entity_properties
  WHERE entity_type = 'subtask'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this subtask
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'subtask' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'subtask' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;


--
-- Name: FUNCTION cleanup_entity_properties_on_subtask_delete(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_entity_properties_on_subtask_delete() IS 'Automatically deletes entity_properties and entity_links when a subtask is deleted to prevent orphaned records.';


--
-- Name: cleanup_entity_properties_on_table_row_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_entity_properties_on_table_row_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Delete all entity_properties for this table row
  DELETE FROM public.entity_properties
  WHERE entity_type = 'table_row'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this table row
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'table_row' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'table_row' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;


--
-- Name: FUNCTION cleanup_entity_properties_on_table_row_delete(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_entity_properties_on_table_row_delete() IS 'Automatically deletes entity_properties and entity_links when a table row is deleted to prevent orphaned records.';


--
-- Name: cleanup_entity_properties_on_task_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_entity_properties_on_task_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Delete all entity_properties for this task
  DELETE FROM public.entity_properties
  WHERE entity_type = 'task'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this task
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'task' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'task' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;


--
-- Name: FUNCTION cleanup_entity_properties_on_task_delete(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_entity_properties_on_task_delete() IS 'Automatically deletes entity_properties and entity_links when a task is deleted to prevent orphaned records.';


--
-- Name: cleanup_entity_properties_on_timeline_event_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_entity_properties_on_timeline_event_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Delete all entity_properties for this timeline event
  DELETE FROM public.entity_properties
  WHERE entity_type = 'timeline_event'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this timeline event
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'timeline_event' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'timeline_event' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;


--
-- Name: FUNCTION cleanup_entity_properties_on_timeline_event_delete(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_entity_properties_on_timeline_event_delete() IS 'Automatically deletes entity_properties and entity_links when a timeline event is deleted to prevent orphaned records.';


--
-- Name: cleanup_expired_oauth_states(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_oauth_states() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < now();
END;
$$;


--
-- Name: cleanup_expired_slack_idempotency_keys(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_slack_idempotency_keys() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM slack_idempotency_keys WHERE expires_at < now();
END;
$$;


--
-- Name: cleanup_unstructured_on_source_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_unstructured_on_source_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.unstructured_parents
  WHERE source_type = TG_ARGV[0] AND source_id = OLD.id;
  DELETE FROM public.indexing_jobs
  WHERE resource_type = TG_ARGV[0] AND resource_id = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: create_table_full(uuid, uuid, text, text, uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_table_full(p_workspace_id uuid, p_project_id uuid, p_title text, p_description text, p_created_by uuid, p_fields jsonb DEFAULT '[]'::jsonb, p_rows jsonb DEFAULT '[]'::jsonb) RETURNS TABLE(table_id uuid, fields_created integer, rows_inserted integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_table_id uuid;
  v_field jsonb;
  v_row jsonb;
  v_row_ids uuid[];
  v_data jsonb;
  v_order numeric;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_field_name text;
  v_fields_created int := 0;
  v_rows_inserted int := 0;
  v_has_rows boolean := false;
  v_default_count int := 0;
BEGIN
  INSERT INTO public.tables (workspace_id, project_id, title, description, created_by)
  VALUES (p_workspace_id, p_project_id, COALESCE(p_title, 'Untitled Table'), p_description, p_created_by)
  RETURNING id INTO v_table_id;

  -- Default fields
  INSERT INTO public.table_fields (table_id, name, type, is_primary, "order")
  VALUES
    (v_table_id, 'Name', 'text', true, 1),
    (v_table_id, 'Column 2', 'text', false, 2),
    (v_table_id, 'Column 3', 'text', false, 3);

  -- Default rows
  INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
  VALUES
    (v_table_id, '{}'::jsonb, 1, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 2, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 3, p_created_by, p_created_by);

  -- Default view
  INSERT INTO public.table_views (table_id, name, type, is_default, created_by, config)
  VALUES (v_table_id, 'Default view', 'table', true, p_created_by, '{}'::jsonb);

  -- Extra fields
  FOR v_field IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
    v_field_name := trim(both ' ' from COALESCE(v_field->>'name', ''));
    IF v_field_name = '' THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.table_fields
      WHERE table_id = v_table_id AND lower(name) = lower(v_field_name)
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.table_fields (table_id, name, type, config, is_primary)
    VALUES (
      v_table_id,
      v_field_name,
      COALESCE(v_field->>'type', 'text'),
      v_field->'config',
      COALESCE((v_field->>'isPrimary')::boolean, false)
    );
    v_fields_created := v_fields_created + 1;
  END LOOP;

  -- Rows (optional)
  v_has_rows := jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0;
  IF v_has_rows THEN
    SELECT count(*) INTO v_default_count FROM public.table_rows WHERE table_id = v_table_id;
    IF v_default_count <= 3 THEN
      DELETE FROM public.table_rows
      WHERE table_id = v_table_id AND (data IS NULL OR data = '{}'::jsonb);
    END IF;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_data := '{}'::jsonb;
    v_order := NULL;

    IF v_row ? 'order' THEN
      BEGIN
        v_order := (v_row->>'order')::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        v_order := NULL;
      END;
    END IF;

    FOR v_field_name, v_field_id IN
      SELECT key, public._resolve_table_field_id(v_table_id, key)
      FROM jsonb_each(COALESCE(v_row->'data', '{}'::jsonb))
    LOOP
      IF v_field_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT type, config INTO v_field_type, v_field_config
      FROM public.table_fields
      WHERE id = v_field_id;

      IF v_field_type IN ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') THEN
        CONTINUE;
      END IF;

      v_data := v_data || jsonb_build_object(v_field_id::text, (v_row->'data'->v_field_name));
    END LOOP;

    INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
    VALUES (v_table_id, v_data, v_order, p_created_by, p_created_by);
    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  table_id := v_table_id;
  fields_created := v_fields_created;
  rows_inserted := v_rows_inserted;
  RETURN NEXT;
END;
$$;


--
-- Name: create_table_full(uuid, text, uuid, uuid, uuid, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_table_full(p_workspace_id uuid, p_title text, p_created_by uuid, p_project_id uuid DEFAULT NULL::uuid, p_tab_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text, p_fields jsonb DEFAULT '[]'::jsonb, p_rows jsonb DEFAULT '[]'::jsonb) RETURNS TABLE(result_table_id uuid, result_fields_created integer, result_rows_inserted integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_table_id uuid;
  v_field jsonb;
  v_row jsonb;
  v_row_ids uuid[];
  v_data jsonb;
  v_order numeric;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_field_name text;
  v_fields_created int := 0;
  v_rows_inserted int := 0;
  v_has_rows boolean := false;
  v_has_fields boolean := false;
  v_default_count int := 0;
  -- Source metadata variables
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_source_sync_mode text;
BEGIN
  -- Create the table (now with tab_id support)
  INSERT INTO public.tables (workspace_id, project_id, tab_id, title, description, created_by)
  VALUES (p_workspace_id, p_project_id, p_tab_id, COALESCE(p_title, 'Untitled Table'), p_description, p_created_by)
  RETURNING id INTO v_table_id;

  -- Check if fields are provided
  v_has_fields := jsonb_typeof(p_fields) = 'array' AND jsonb_array_length(p_fields) > 0;

  -- Only create default fields if no custom fields are provided
  IF NOT v_has_fields THEN
    INSERT INTO public.table_fields (table_id, name, type, config, is_primary, "order")
    VALUES
      (v_table_id, 'Name', 'text', '{}'::jsonb, true, 1),
      (v_table_id, 'Column 2', 'text', '{}'::jsonb, false, 2),
      (v_table_id, 'Column 3', 'text', '{}'::jsonb, false, 3);
  END IF;

  -- Default rows (will be deleted later if custom rows are provided)
  INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
  VALUES
    (v_table_id, '{}'::jsonb, 1, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 2, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 3, p_created_by, p_created_by);

  -- Default view
  INSERT INTO public.table_views (table_id, name, type, is_default, created_by, config)
  VALUES (v_table_id, 'Default view', 'table', true, p_created_by, '{}'::jsonb);

  -- Add custom fields (if provided)
  -- The first field should always be primary unless explicitly set otherwise
  FOR v_field IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
    v_field_name := trim(both ' ' from COALESCE(v_field->>'name', ''));
    IF v_field_name = '' THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.table_fields tf
      WHERE tf.table_id = v_table_id AND lower(tf.name) = lower(v_field_name)
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.table_fields (table_id, name, type, config, is_primary, property_definition_id)
    VALUES (
      v_table_id,
      v_field_name,
      COALESCE(v_field->>'type', 'text'),
      COALESCE(v_field->'config', '{}'::jsonb),
      -- First field is primary by default, others respect LLM's choice
      CASE
        WHEN v_fields_created = 0 THEN COALESCE((v_field->>'isPrimary')::boolean, true)
        ELSE COALESCE((v_field->>'isPrimary')::boolean, false)
      END,
      CASE
        WHEN COALESCE(v_field->>'type', 'text') = 'priority' THEN (
          SELECT id FROM public.property_definitions
          WHERE workspace_id = p_workspace_id AND name = 'Priority' AND type = 'select'
          LIMIT 1
        )
        WHEN COALESCE(v_field->>'type', 'text') = 'status' THEN (
          SELECT id FROM public.property_definitions
          WHERE workspace_id = p_workspace_id AND name = 'Status' AND type = 'select'
          LIMIT 1
        )
        ELSE NULL
      END
    );
    v_fields_created := v_fields_created + 1;
  END LOOP;

  -- Rows (optional)
  v_has_rows := jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0;
  IF v_has_rows THEN
    SELECT count(*) INTO v_default_count FROM public.table_rows tr WHERE tr.table_id = v_table_id;
    IF v_default_count <= 3 THEN
      DELETE FROM public.table_rows tr
      WHERE tr.table_id = v_table_id AND (tr.data IS NULL OR tr.data = '{}'::jsonb);
    END IF;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_data := '{}'::jsonb;
    v_order := NULL;
    v_source_entity_type := NULL;
    v_source_entity_id := NULL;
    v_source_sync_mode := NULL;

    IF v_row ? 'order' THEN
      BEGIN
        v_order := (v_row->>'order')::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        v_order := NULL;
      END;
    END IF;

    -- Extract source metadata if present
    IF v_row ? 'source_entity_type' THEN
      v_source_entity_type := v_row->>'source_entity_type';
    END IF;
    IF v_row ? 'source_entity_id' THEN
      BEGIN
        v_source_entity_id := (v_row->>'source_entity_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_source_entity_id := NULL;
      END;
    END IF;
    IF v_row ? 'source_sync_mode' THEN
      v_source_sync_mode := v_row->>'source_sync_mode';
    END IF;

    FOR v_field_name, v_field_id IN
      SELECT key, public._resolve_table_field_id(v_table_id, key)
      FROM jsonb_each(COALESCE(v_row->'data', '{}'::jsonb))
    LOOP
      IF v_field_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT type, config INTO v_field_type, v_field_config
      FROM public.table_fields
      WHERE id = v_field_id;

      IF v_field_type IN ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') THEN
        CONTINUE;
      END IF;

      v_data := v_data || jsonb_build_object(v_field_id::text, (v_row->'data'->v_field_name));
    END LOOP;

    -- Insert row with source metadata support
    INSERT INTO public.table_rows (
      table_id,
      data,
      "order",
      source_entity_type,
      source_entity_id,
      source_sync_mode,
      created_by,
      updated_by
    )
    VALUES (
      v_table_id,
      v_data,
      v_order,
      v_source_entity_type,
      v_source_entity_id,
      v_source_sync_mode,
      p_created_by,
      p_created_by
    );
    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  result_table_id := v_table_id;
  result_fields_created := v_fields_created;
  result_rows_inserted := v_rows_inserted;
  RETURN NEXT;
END;
$$;


--
-- Name: create_table_full(uuid, uuid, uuid, text, text, jsonb, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_table_full(p_workspace_id uuid, p_project_id uuid, p_tab_id uuid DEFAULT NULL::uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_fields jsonb DEFAULT NULL::jsonb, p_rows jsonb DEFAULT NULL::jsonb, p_created_by uuid DEFAULT NULL::uuid, OUT result_table_id uuid, OUT result_fields_created integer, OUT result_rows_inserted integer) RETURNS record
    LANGUAGE plpgsql
    AS $$
declare
  v_table_id uuid;
  v_field jsonb;
  v_row jsonb;
  v_data jsonb;
  v_order numeric;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_field_name text;
  v_fields_created int := 0;
  v_rows_inserted int := 0;
  v_has_rows boolean := false;
  v_has_fields boolean := false;
  v_default_count int := 0;
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_source_sync_mode text;
  v_cell_value jsonb;
begin
  insert into public.tables (workspace_id, project_id, tab_id, title, description, created_by)
  values (p_workspace_id, p_project_id, p_tab_id, coalesce(p_title, 'Untitled Table'), p_description, p_created_by)
  returning id into v_table_id;

  v_has_fields := jsonb_typeof(p_fields) = 'array' and jsonb_array_length(p_fields) > 0;

  if not v_has_fields then
    insert into public.table_fields (table_id, name, type, config, is_primary, "order")
    values
      (v_table_id, 'Name', 'text', '{}'::jsonb, true, 1),
      (v_table_id, 'Column 2', 'text', '{}'::jsonb, false, 2),
      (v_table_id, 'Column 3', 'text', '{}'::jsonb, false, 3);
  end if;

  insert into public.table_rows (table_id, data, "order", created_by, updated_by)
  values
    (v_table_id, '{}'::jsonb, 1, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 2, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 3, p_created_by, p_created_by);

  insert into public.table_views (table_id, name, type, is_default, created_by, config)
  values (v_table_id, 'Default view', 'table', true, p_created_by, '{}'::jsonb);

  for v_field in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) loop
    v_field_name := trim(both ' ' from coalesce(v_field->>'name', ''));
    if v_field_name = '' then
      continue;
    end if;
    if exists (
      select 1 from public.table_fields tf
      where tf.table_id = v_table_id and lower(tf.name) = lower(v_field_name)
    ) then
      continue;
    end if;

    insert into public.table_fields (table_id, name, type, config, is_primary)
    values (
      v_table_id,
      v_field_name,
      coalesce(v_field->>'type', 'text'),
      case
        when coalesce(v_field->>'type', 'text') = 'priority' then
          '{"levels":[{"id":"urgent","label":"Urgent","color":"#ef4444","order":4},{"id":"high","label":"High","color":"#f59e0b","order":3},{"id":"medium","label":"Medium","color":"#3b82f6","order":2},{"id":"low","label":"Low","color":"#6b7280","order":1}]}'::jsonb
        when coalesce(v_field->>'type', 'text') = 'status' then
          '{"options":[{"id":"todo","label":"To Do","color":"#6b7280"},{"id":"in_progress","label":"In Progress","color":"#3b82f6"},{"id":"done","label":"Done","color":"#10b981"},{"id":"blocked","label":"Blocked","color":"#ef4444"}]}'::jsonb
        else
          coalesce(v_field->'config', '{}'::jsonb)
      end,
      case
        when v_fields_created = 0 then coalesce((v_field->>'isPrimary')::boolean, true)
        else coalesce((v_field->>'isPrimary')::boolean, false)
      end
    );
    v_fields_created := v_fields_created + 1;
  end loop;

  v_has_rows := jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) > 0;
  if v_has_rows then
    select count(*) into v_default_count from public.table_rows tr where tr.table_id = v_table_id;
    if v_default_count <= 3 then
      delete from public.table_rows tr
      where tr.table_id = v_table_id and (tr.data is null or tr.data = '{}'::jsonb);
    end if;
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_data := '{}'::jsonb;
    v_order := null;
    v_source_entity_type := null;
    v_source_entity_id := null;
    v_source_sync_mode := null;

    if v_row ? 'order' then
      begin
        v_order := (v_row->>'order')::numeric;
      exception when invalid_text_representation then
        v_order := null;
      end;
    end if;

    if v_row ? 'source_entity_type' then
      v_source_entity_type := v_row->>'source_entity_type';
    end if;
    if v_row ? 'source_entity_id' then
      begin
        v_source_entity_id := (v_row->>'source_entity_id')::uuid;
      exception when invalid_text_representation then
        v_source_entity_id := null;
      end;
    end if;
    if v_row ? 'source_sync_mode' then
      v_source_sync_mode := v_row->>'source_sync_mode';
    end if;

    for v_field_name, v_field_id in
      select key, public._resolve_table_field_id(v_table_id, key)
      from jsonb_each(coalesce(v_row->'data', '{}'::jsonb))
    loop
      if v_field_id is null then
        continue;
      end if;

      select type, config into v_field_type, v_field_config
      from public.table_fields
      where id = v_field_id;

      if v_field_type in ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') then
        continue;
      end if;

      v_cell_value := public._resolve_field_value_with_property_def(
        v_field_type,
        v_field_config,
        null,
        (v_row->'data'->v_field_name)
      );

      if v_cell_value is null then
        continue;
      end if;

      v_data := v_data || jsonb_build_object(v_field_id::text, v_cell_value);
    end loop;

    insert into public.table_rows (
      table_id,
      data,
      "order",
      source_entity_type,
      source_entity_id,
      source_sync_mode,
      created_by,
      updated_by
    )
    values (
      v_table_id,
      v_data,
      v_order,
      v_source_entity_type,
      v_source_entity_id,
      v_source_sync_mode,
      p_created_by,
      p_created_by
    );
    v_rows_inserted := v_rows_inserted + 1;
  end loop;

  result_table_id := v_table_id;
  result_fields_created := v_fields_created;
  result_rows_inserted := v_rows_inserted;
  return;
end;
$$;


--
-- Name: is_valid_task_priorities(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_task_priorities(p_priorities jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  with entries as (
    select elem, ordinality
    from jsonb_array_elements(coalesce(p_priorities, '[]'::jsonb)) with ordinality as t(elem, ordinality)
  ),
  normalized as (
    select
      ordinality,
      btrim(elem->>'field_name') as field_name,
      case
        when jsonb_typeof(elem->'value') = 'string' then lower(btrim(elem->>'value'))
        when jsonb_typeof(elem->'value') = 'null' then null
        else null
      end as priority_value,
      jsonb_typeof(elem) as elem_type,
      jsonb_typeof(elem->'field_name') as field_name_type,
      jsonb_typeof(elem->'value') as value_type,
      (elem ? 'field_name') as has_field_name,
      (elem ? 'value') as has_value
    from entries
  )
  select
    not exists (
      select 1
      from normalized
      where elem_type <> 'object'
        or not has_field_name
        or field_name_type <> 'string'
        or field_name = ''
        or not has_value
        or value_type <> 'string'
        or (value_type = 'string' and priority_value not in ('low', 'medium', 'high', 'urgent'))
    )
    and not exists (
      select 1
      from normalized
      group by lower(field_name)
      having count(*) > 1
    );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: task_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_block_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid,
    tab_id uuid,
    title text NOT NULL,
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
    due_time_end time without time zone,
    source_task_id uuid,
    source_sync_mode text,
    source_entity_type text,
    source_entity_id uuid,
    edited boolean DEFAULT false,
    priorities jsonb DEFAULT '[]'::jsonb NOT NULL,
    statuses jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_placeholder boolean DEFAULT false NOT NULL,
    assignees jsonb DEFAULT '[]'::jsonb NOT NULL,
    due_dates jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT task_items_priorities_valid_check CHECK (public.is_valid_task_priorities(priorities)),
    CONSTRAINT task_items_recurring_frequency_check CHECK ((recurring_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT task_items_source_metadata_consistency CHECK ((((source_entity_type IS NULL) AND (source_entity_id IS NULL) AND (source_sync_mode IS NULL)) OR ((source_entity_type = ANY (ARRAY['task'::text, 'timeline_event'::text, 'table_row'::text, 'block'::text])) AND (source_entity_id IS NOT NULL) AND (source_sync_mode = ANY (ARRAY['snapshot'::text, 'live'::text]))))),
    CONSTRAINT task_items_source_sync_mode_check CHECK ((source_sync_mode = ANY (ARRAY['snapshot'::text, 'live'::text])))
);


--
-- Name: COLUMN task_items.due_time_end; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_items.due_time_end IS 'End time for the due date (optional range with due_time).';


--
-- Name: COLUMN task_items.source_task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_items.source_task_id IS 'DEPRECATED: Use source_entity_type + source_entity_id instead. Kept for backward compatibility.';


--
-- Name: COLUMN task_items.edited; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_items.edited IS 'Tracks whether this snapshot has been modified by the user. Always false for original data (source_entity_id IS NULL). Set to true when user edits a snapshot.';


--
-- Name: COLUMN task_items.is_placeholder; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.task_items.is_placeholder IS 'True for the initial empty task in a new task block; cleared on first edit so it does not pollute search.';


--
-- Name: create_task_full(uuid, text, text, jsonb, jsonb, text, date, time without time zone, date, boolean, boolean, text, integer, jsonb, jsonb, uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_task_full(p_task_block_id uuid, p_title text, p_status text, p_priorities jsonb DEFAULT '[]'::jsonb, p_statuses jsonb DEFAULT '[]'::jsonb, p_description text DEFAULT NULL::text, p_due_date date DEFAULT NULL::date, p_due_time time without time zone DEFAULT NULL::time without time zone, p_start_date date DEFAULT NULL::date, p_hide_icons boolean DEFAULT NULL::boolean, p_recurring_enabled boolean DEFAULT NULL::boolean, p_recurring_frequency text DEFAULT NULL::text, p_recurring_interval integer DEFAULT NULL::integer, p_assignees jsonb DEFAULT '[]'::jsonb, p_tags jsonb DEFAULT '[]'::jsonb, p_created_by uuid DEFAULT NULL::uuid, p_source_entity_type text DEFAULT NULL::text, p_source_entity_id uuid DEFAULT NULL::uuid, p_source_sync_mode text DEFAULT NULL::text) RETURNS public.task_items
    LANGUAGE plpgsql
    AS $$
declare
  v_task public.task_items;
  v_workspace_id uuid;
  v_project_id uuid;
  v_tab_id uuid;
  v_assignee jsonb;
  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);
  v_statuses jsonb;
  v_tag text;
  v_tag_id uuid;
  v_tag_names jsonb := '[]'::jsonb;
  v_priority_entry jsonb;
  v_effective_source_entity_type text;
  v_effective_source_entity_id uuid;
  v_effective_source_sync_mode text;
  v_effective_source_task_id uuid;
  v_named_assignee_ids text[] := array[]::text[];
  v_primary_assignee_id uuid;
  v_due_dates jsonb;
begin
  select b.tab_id, t.project_id, p.workspace_id
  into v_tab_id, v_project_id, v_workspace_id
  from public.blocks b
  join public.tabs t on t.id = b.tab_id
  join public.projects p on p.id = t.project_id
  where b.id = p_task_block_id and b.type = 'task'
  limit 1;

  if v_workspace_id is null then
    raise exception 'Task block not found';
  end if;

  if p_source_entity_type is not null and p_source_entity_id is not null then
    v_effective_source_entity_type := p_source_entity_type;
    v_effective_source_entity_id := p_source_entity_id;
    v_effective_source_sync_mode := case
      when p_source_entity_type = 'table_row' then 'snapshot'
      when p_source_entity_type = 'block' then 'snapshot'
      else coalesce(p_source_sync_mode, 'snapshot')
    end;

    if p_source_entity_type = 'task' then
      v_effective_source_task_id := p_source_entity_id;
    end if;
  end if;

  v_statuses := case
    when jsonb_array_length(coalesce(p_statuses, '[]'::jsonb)) > 0 then coalesce(p_statuses, '[]'::jsonb)
    else jsonb_build_array(
      jsonb_build_object(
        'field_name', 'Status',
        'value',
        case
          when lower(coalesce(nullif(trim(p_status), ''), 'todo')) = 'in-progress' then 'in_progress'
          when lower(coalesce(nullif(trim(p_status), ''), 'todo')) = 'in progress' then 'in_progress'
          when lower(coalesce(nullif(trim(p_status), ''), 'todo')) = 'done' then 'done'
          when lower(coalesce(nullif(trim(p_status), ''), 'todo')) = 'blocked' then 'blocked'
          else 'todo'
        end
      )
    )
  end;

  select coalesce(array_remove(array_agg(nullif(elem->>'id', '')), null), array[]::text[])
  into v_named_assignee_ids
  from jsonb_array_elements(v_assignee_payload) elem;

  v_primary_assignee_id := case
    when coalesce(array_length(v_named_assignee_ids, 1), 0) > 0 then v_named_assignee_ids[1]::uuid
    else null
  end;

  v_due_dates := case
    when p_start_date is null and p_due_date is null then '[]'::jsonb
    else jsonb_build_array(
      jsonb_build_object(
        'field_name', 'Due Date',
        'value', jsonb_build_object('start', p_start_date, 'end', p_due_date)
      )
    )
  end;

  insert into public.task_items (
    task_block_id, workspace_id, project_id, tab_id,
    title, statuses, priorities, assignees, due_dates, assignee_id, description, due_date, due_time, start_date,
    hide_icons, recurring_enabled, recurring_frequency, recurring_interval,
    source_task_id, source_entity_type, source_entity_id, source_sync_mode,
    created_by, updated_by
  ) values (
    p_task_block_id, v_workspace_id, v_project_id, v_tab_id,
    p_title, v_statuses, coalesce(p_priorities, '[]'::jsonb),
    case
      when coalesce(array_length(v_named_assignee_ids, 1), 0) = 0 then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object('field_name', 'Assignee', 'value', to_jsonb(v_named_assignee_ids)))
    end,
    v_due_dates,
    v_primary_assignee_id,
    p_description, p_due_date, p_due_time, p_start_date,
    coalesce(p_hide_icons, false), coalesce(p_recurring_enabled, false), p_recurring_frequency, p_recurring_interval,
    v_effective_source_task_id, v_effective_source_entity_type, v_effective_source_entity_id, v_effective_source_sync_mode,
    p_created_by, p_created_by
  ) returning * into v_task;

  for v_assignee in select * from jsonb_array_elements(v_assignee_payload) loop
    insert into public.task_assignees (task_id, assignee_id, assignee_name)
    values (
      v_task.id,
      nullif(v_assignee->>'id', '')::uuid,
      coalesce(nullif(v_assignee->>'name', ''), nullif(v_assignee->>'id', ''), 'Unknown')
    );
  end loop;

  if jsonb_array_length(v_assignee_payload) > 0 then
    insert into public.entity_properties (
      workspace_id, entity_type, entity_id, field_name, field_type, value
    )
    values (
      v_workspace_id, 'task', v_task.id, 'Assignee', 'assignee', v_assignee_payload
    )
    on conflict (entity_type, entity_id, field_name)
    do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
  end if;

  insert into public.entity_properties (
    workspace_id, entity_type, entity_id, field_name, field_type, value
  )
  values (
    v_workspace_id,
    'task',
    v_task.id,
    'Status',
    'status',
    coalesce(v_statuses->0->'value', '"todo"'::jsonb)
  )
  on conflict (entity_type, entity_id, field_name)
  do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();

  for v_priority_entry in select * from jsonb_array_elements(coalesce(p_priorities, '[]'::jsonb)) loop
    if v_priority_entry ? 'field_name' and v_priority_entry ? 'value' then
      insert into public.entity_properties (
        workspace_id, entity_type, entity_id, field_name, field_type, value
      )
      values (
        v_workspace_id,
        'task',
        v_task.id,
        coalesce(nullif(trim(v_priority_entry->>'field_name'), ''), 'Priority'),
        'priority',
        to_jsonb(v_priority_entry->>'value')
      )
      on conflict (entity_type, entity_id, field_name)
      do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
    end if;
  end loop;

  for v_tag in select trim(value::text) from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) loop
    if v_tag is null or v_tag = '' then continue; end if;
    v_tag_names := v_tag_names || to_jsonb(v_tag);
    select id into v_tag_id from public.task_tags where workspace_id = v_workspace_id and name = v_tag limit 1;
    if v_tag_id is null then
      insert into public.task_tags (workspace_id, name) values (v_workspace_id, v_tag) returning id into v_tag_id;
    end if;
    insert into public.task_tag_links (task_id, tag_id) values (v_task.id, v_tag_id) on conflict do nothing;
  end loop;

  if jsonb_array_length(v_tag_names) > 0 then
    insert into public.entity_properties (
      workspace_id, entity_type, entity_id, field_name, field_type, value
    )
    values (
      v_workspace_id, 'task', v_task.id, 'Tags', 'tags', v_tag_names
    )
    on conflict (entity_type, entity_id, field_name)
    do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
  end if;

  return v_task;
end;
$$;


--
-- Name: duplicate_tasks_to_block(uuid[], uuid, uuid, uuid, uuid, boolean, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.duplicate_tasks_to_block(p_task_ids uuid[], p_target_block_id uuid, p_tab_id uuid, p_project_id uuid, p_workspace_id uuid, p_include_assignees boolean, p_include_tags boolean, p_created_by uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_max_order int := 0;
  v_created_ids uuid[] := ARRAY[]::uuid[];
  v_task record;
  v_new_id uuid;
  v_assignees record;
  v_tag_links record;
BEGIN
  SELECT COALESCE(max(display_order), -1) INTO v_max_order
  FROM public.task_items
  WHERE task_block_id = p_target_block_id;

  FOR v_task IN
    SELECT * FROM public.task_items
    WHERE id = ANY(p_task_ids) AND workspace_id = p_workspace_id
    ORDER BY array_position(p_task_ids, id)
  LOOP
    v_max_order := v_max_order + 1;
    INSERT INTO public.task_items (
      task_block_id, workspace_id, project_id, tab_id,
      title, statuses, priorities, description, due_date, due_time, due_time_end, start_date,
      hide_icons, display_order, recurring_enabled, recurring_frequency, recurring_interval,
      source_task_id, source_entity_type, source_entity_id, source_sync_mode,
      created_by, updated_by
    )
    VALUES (
      p_target_block_id, p_workspace_id, p_project_id, p_tab_id,
      v_task.title, v_task.statuses, v_task.priorities, v_task.description, v_task.due_date, v_task.due_time, v_task.due_time_end, v_task.start_date,
      v_task.hide_icons, v_max_order, v_task.recurring_enabled, v_task.recurring_frequency, v_task.recurring_interval,
      CASE
        WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN NULL
        ELSE v_task.id
      END,
      CASE
        WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN 'table_row'
        ELSE 'task'
      END,
      CASE
        WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN v_task.source_entity_id
        ELSE v_task.id
      END,
      'snapshot',
      p_created_by, p_created_by
    )
    RETURNING id INTO v_new_id;

    v_created_ids := v_created_ids || v_new_id;

    IF p_include_assignees THEN
      FOR v_assignees IN
        SELECT * FROM public.task_assignees WHERE task_id = v_task.id
      LOOP
        INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
        VALUES (v_new_id, v_assignees.assignee_id, v_assignees.assignee_name);
      END LOOP;
    END IF;

    IF p_include_tags THEN
      FOR v_tag_links IN
        SELECT * FROM public.task_tag_links WHERE task_id = v_task.id
      LOOP
        INSERT INTO public.task_tag_links (task_id, tag_id)
        VALUES (v_new_id, v_tag_links.tag_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created_count', COALESCE(array_length(v_created_ids, 1), 0),
    'created_task_ids', v_created_ids,
    'skipped', ARRAY(
      SELECT id FROM unnest(p_task_ids) AS id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.task_items t WHERE t.id = id AND t.workspace_id = p_workspace_id
      )
    )
  );
END;
$$;


--
-- Name: ensure_single_default_view(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: entity_properties_populate_named_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.entity_properties_populate_named_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_inferred_type text;
begin
  -- If field_name is missing, derive from field_type
  if new.field_name is null or btrim(new.field_name) = '' then
    new.field_name := case new.field_type
      when 'priority' then 'Priority'
      when 'status' then 'Status'
      when 'assignee' then 'Assignee'
      when 'due_date' then 'Due Date'
      when 'tags' then 'Tags'
      else null
    end;
  end if;

  -- If field_type is missing, infer from field_name
  if new.field_type is null then
    v_inferred_type := case
      when lower(coalesce(new.field_name, '')) like '%priority%' then 'priority'
      when lower(coalesce(new.field_name, '')) like '%status%' then 'status'
      when lower(coalesce(new.field_name, '')) like '%assignee%' then 'assignee'
      when lower(coalesce(new.field_name, '')) like '%due date%' or lower(coalesce(new.field_name, '')) like '%due_date%' then 'due_date'
      when lower(coalesce(new.field_name, '')) like '%tag%' then 'tags'
      else null
    end;
    new.field_type := v_inferred_type;
  end if;

  if new.field_name is null or btrim(new.field_name) = '' or new.field_type is null then
    raise exception 'entity_properties requires field_name and field_type for row id=%', coalesce(new.id::text, '<new>');
  end if;

  return new;
end;
$$;


--
-- Name: entity_properties_set_subtype(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.entity_properties_set_subtype() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.entity_subtype := public.resolve_entity_subtype(new.entity_type, new.entity_id);
  return new;
end;
$$;


--
-- Name: entity_properties_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.entity_properties_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: generate_payment_number(uuid); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: generate_public_token(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: get_next_block_position(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: get_or_create_workspace_analysis_project(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_workspace_analysis_project(p_workspace_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT id
    INTO v_project_id
  FROM public.projects
  WHERE workspace_id = p_workspace_id
    AND is_workspace_analysis_project = true
  LIMIT 1;

  IF v_project_id IS NOT NULL THEN
    RETURN v_project_id;
  END IF;

  BEGIN
    INSERT INTO public.projects (workspace_id, name, project_type, is_workspace_analysis_project)
    VALUES (p_workspace_id, 'Workspace Analysis', 'internal', true)
    RETURNING id INTO v_project_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id
      INTO v_project_id
    FROM public.projects
    WHERE workspace_id = p_workspace_id
      AND is_workspace_analysis_project = true
    LIMIT 1;
  END;

  RETURN v_project_id;
END;
$$;


--
-- Name: get_workspace_id_for_entity(text, uuid); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: get_workspace_id_from_slack_team(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_workspace_id_from_slack_team(team_id text) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT workspace_id
  FROM slack_workspace_connections
  WHERE slack_team_id = team_id
    AND connection_status = 'active'
  LIMIT 1;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: is_member_of_organization(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member_of_organization(org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = org_id AND om.user_id = auth.uid()
  );
$$;


--
-- Name: is_member_of_workspace(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member_of_workspace(ws_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid()
  );
$$;


--
-- Name: is_slack_user_linked(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_slack_user_linked(team_id text, slack_user_id text) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT sul.trak_user_id
  FROM slack_user_links sul
  INNER JOIN slack_workspace_connections swc ON swc.id = sul.slack_connection_id
  WHERE swc.slack_team_id = team_id
    AND sul.slack_user_id = slack_user_id
    AND sul.link_status = 'active'
    AND swc.connection_status = 'active'
  LIMIT 1;
$$;


--
-- Name: is_valid_timeline_event_priorities(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_timeline_event_priorities(p_priorities jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select public.is_valid_timeline_priorities(p_priorities);
$$;


--
-- Name: is_valid_timeline_priorities(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_timeline_priorities(p_priorities jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  with entries as (
    select value as entry
    from jsonb_array_elements(coalesce(p_priorities, '[]'::jsonb))
  ), parsed as (
    select
      nullif(btrim(entry->>'field_name'), '') as field_name,
      entry->>'value' as value
    from entries
  )
  select
    jsonb_typeof(coalesce(p_priorities, '[]'::jsonb)) = 'array'
    and not exists (
      select 1
      from entries
      where jsonb_typeof(entry) <> 'object'
    )
    and not exists (
      select 1
      from parsed
      where field_name is null
         or value not in ('low', 'medium', 'high', 'urgent')
    )
    and not exists (
      select 1
      from (
        select lower(field_name) as key, count(*) as cnt
        from parsed
        group by lower(field_name)
      ) dups
      where dups.cnt > 1
    );
$$;


--
-- Name: match_unstructured_parents(double precision[], double precision, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_unstructured_parents(match_embedding double precision[], match_threshold double precision, match_count integer, filter_workspace_id uuid) RETURNS TABLE(id uuid, source_type text, source_id uuid, summary text, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Validate embedding dimension
  IF array_length(match_embedding, 1) IS NULL OR array_length(match_embedding, 1) != 1536 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.source_type,
    p.source_id,
    p.summary,
    (1 - (p.summary_embedding <=> match_embedding::vector(1536)))::float as similarity
  FROM public.unstructured_parents p
  WHERE p.workspace_id = filter_workspace_id
    AND p.summary_embedding IS NOT NULL
    AND (1 - (p.summary_embedding <=> match_embedding::vector(1536))) > match_threshold
  ORDER BY p.summary_embedding <=> match_embedding::vector(1536)
  LIMIT match_count;
END;
$$;


--
-- Name: match_unstructured_parents(double precision[], uuid, integer, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_unstructured_parents(match_embedding double precision[], match_workspace_id uuid, match_count integer DEFAULT 10, match_threshold double precision DEFAULT 0.5) RETURNS TABLE(parent_id uuid, source_type text, source_id uuid, summary text, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as parent_id,
    p.source_type,
    p.source_id,
    p.summary,
    CASE
      WHEN p.summary_embedding IS NOT NULL
        THEN 1 - ((p.summary_embedding) <=> (match_embedding::vector(1536)))
      ELSE 0
    END as similarity
  FROM public.unstructured_parents p
  WHERE p.workspace_id = match_workspace_id
    AND p.summary_embedding IS NOT NULL
    AND 1 - ((p.summary_embedding) <=> (match_embedding::vector(1536))) > match_threshold
  ORDER BY (p.summary_embedding) <=> (match_embedding::vector(1536))
  LIMIT match_count;
END;
$$;


--
-- Name: resolve_entity_subtype(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_entity_subtype(p_entity_type text, p_entity_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
declare
  resolved_subtype text;
begin
  if p_entity_type = 'block' then
    select b.type
      into resolved_subtype
    from public.blocks b
    where b.id = p_entity_id;

    return coalesce(resolved_subtype, 'block');
  end if;

  if p_entity_type in ('task', 'subtask', 'timeline_event', 'table_row') then
    return p_entity_type;
  end if;

  return null;
end;
$$;


--
-- Name: search_table_rows_fuzzy(uuid, text, uuid[], uuid[], uuid[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_table_rows_fuzzy(filter_workspace_id uuid, search_text text, filter_table_ids uuid[] DEFAULT NULL::uuid[], filter_project_ids uuid[] DEFAULT NULL::uuid[], filter_row_ids uuid[] DEFAULT NULL::uuid[], result_limit integer DEFAULT 200) RETURNS TABLE(id uuid, data jsonb, "order" integer, table_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, table_title text, project_id uuid, project_name text, score real)
    LANGUAGE sql STABLE
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


--
-- Name: search_tags_fuzzy(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_tags_fuzzy(filter_workspace_id uuid, search_text text, result_limit integer DEFAULT 200) RETURNS TABLE(id text, name text, color text, score real)
    LANGUAGE sql STABLE
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


--
-- Name: seed_task_priorities_from_source_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_task_priorities_from_source_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.source_entity_type <> 'table_row' or new.source_entity_id is null then
    return new;
  end if;

  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  -- Sync named priority rows from source table_row -> task entity_properties.
  delete from public.entity_properties
  where entity_type = 'task'
    and entity_id = new.id
    and field_type = 'priority';

  insert into public.entity_properties (
    workspace_id,
    entity_type,
    entity_id,
    field_name,
    field_type,
    value
  )
  select
    new.workspace_id,
    'task',
    new.id,
    ep.field_name,
    'priority',
    to_jsonb(lower(btrim(ep.value #>> '{}')))
  from public.entity_properties ep
  where ep.entity_type = 'table_row'
    and ep.entity_id = new.source_entity_id
    and ep.field_type = 'priority'
    and ep.field_name is not null
    and btrim(ep.field_name) <> ''
    and jsonb_typeof(ep.value) = 'string'
    and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')
  on conflict (entity_type, entity_id, field_name)
  do update set
    workspace_id = excluded.workspace_id,
    field_type = excluded.field_type,
    value = excluded.value,
    updated_at = now();

  -- Keep task_items.priorities aligned with the inserted named rows.
  new.priorities := coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'field_name', ep.field_name,
          'value', lower(btrim(ep.value #>> '{}'))
        )
        order by ep.updated_at desc nulls last, ep.created_at desc nulls last, ep.id desc
      )
      from public.entity_properties ep
      where ep.entity_type = 'task'
        and ep.entity_id = new.id
        and ep.field_type = 'priority'
        and ep.field_name is not null
        and btrim(ep.field_name) <> ''
        and jsonb_typeof(ep.value) = 'string'
        and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')
    ),
    '[]'::jsonb
  );

  return new;
end;
$$;


--
-- Name: set_edited_flag_on_task_item_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_edited_flag_on_task_item_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.source_entity_id IS NOT NULL AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.statuses IS DISTINCT FROM OLD.statuses OR
    NEW.priorities IS DISTINCT FROM OLD.priorities OR
    NEW.due_date IS DISTINCT FROM OLD.due_date OR
    NEW.start_date IS DISTINCT FROM OLD.start_date
  ) THEN
    NEW.edited := true;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_edited_flag_on_timeline_event_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_edited_flag_on_timeline_event_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.source_entity_id IS NOT NULL AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.notes IS DISTINCT FROM OLD.notes OR
    NEW.start_date IS DISTINCT FROM OLD.start_date OR
    NEW.end_date IS DISTINCT FROM OLD.end_date OR
    NEW.statuses IS DISTINCT FROM OLD.statuses OR
    NEW.priorities IS DISTINCT FROM OLD.priorities OR
    NEW.assignee_id IS DISTINCT FROM OLD.assignee_id OR
    NEW.progress IS DISTINCT FROM OLD.progress OR
    NEW.color IS DISTINCT FROM OLD.color OR
    NEW.is_milestone IS DISTINCT FROM OLD.is_milestone
  ) THEN
    NEW.edited := true;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_payment_number(); Type: FUNCTION; Schema: public; Owner: -
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


--
-- Name: set_task_item_display_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_task_item_display_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  SELECT COALESCE(MAX(display_order), 0) + 1
  INTO NEW.display_order
  FROM public.task_items
  WHERE task_block_id = NEW.task_block_id;
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: sync_block_type_to_entity_properties_subtype(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_block_type_to_entity_properties_subtype() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if old.type is distinct from new.type then
    update public.entity_properties ep
    set entity_subtype = new.type
    where ep.entity_type = 'block'
      and ep.entity_id = new.id
      and ep.entity_subtype is distinct from new.type;
  end if;

  return new;
end;
$$;


--
-- Name: sync_live_task_assignees_to_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_live_task_assignees_to_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_task_id uuid;
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_sync_mode text;
  v_workspace_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;

  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT source_task_id, source_entity_type, source_entity_id, source_sync_mode, workspace_id
  INTO v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode, v_workspace_id
  FROM public.task_items WHERE id = v_task_id;

  IF v_source_entity_type = 'table_row' OR v_source_entity_type = 'block' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

  IF v_source_task_id IS NULL OR v_sync_mode <> 'live' THEN RETURN COALESCE(NEW, OLD); END IF;

  DELETE FROM public.task_assignees WHERE task_id = v_source_task_id;
  INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
  SELECT v_source_task_id, assignee_id, assignee_name FROM public.task_assignees WHERE task_id = v_task_id;

  UPDATE public.task_items
  SET assignee_id = (SELECT assignee_id FROM public.task_assignees WHERE task_id = v_task_id LIMIT 1), updated_at = now()
  WHERE id = v_source_task_id AND workspace_id = v_workspace_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: sync_live_task_item_to_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_live_task_item_to_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  v_source_task_id := new.source_task_id;
  v_source_entity_type := new.source_entity_type;
  v_source_entity_id := new.source_entity_id;

  IF v_source_entity_type = 'table_row' OR v_source_entity_type = 'block' THEN
    RETURN NEW;
  END IF;

  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

  IF v_source_task_id IS NULL OR new.source_sync_mode <> 'live' THEN RETURN NEW; END IF;
  IF v_source_task_id = new.id THEN RETURN NEW; END IF;

  IF new.title IS DISTINCT FROM old.title
     OR new.statuses IS DISTINCT FROM old.statuses
     OR new.priorities IS DISTINCT FROM old.priorities
     OR new.description IS DISTINCT FROM old.description
     OR new.due_date IS DISTINCT FROM old.due_date
     OR new.due_time IS DISTINCT FROM old.due_time
     OR new.start_date IS DISTINCT FROM old.start_date
     OR new.hide_icons IS DISTINCT FROM old.hide_icons
     OR new.recurring_enabled IS DISTINCT FROM old.recurring_enabled
     OR new.recurring_frequency IS DISTINCT FROM old.recurring_frequency
     OR new.recurring_interval IS DISTINCT FROM old.recurring_interval
     OR new.assignee_id IS DISTINCT FROM old.assignee_id THEN
    UPDATE public.task_items
    SET title = new.title,
        statuses = new.statuses,
        priorities = new.priorities,
        description = new.description,
        due_date = new.due_date,
        due_time = new.due_time,
        start_date = new.start_date,
        hide_icons = new.hide_icons,
        recurring_enabled = new.recurring_enabled,
        recurring_frequency = new.recurring_frequency,
        recurring_interval = new.recurring_interval,
        assignee_id = new.assignee_id,
        updated_by = new.updated_by,
        updated_at = now()
    WHERE id = v_source_task_id AND workspace_id = new.workspace_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION sync_live_task_item_to_source(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_live_task_item_to_source() IS 'Syncs task_items changes from a snapshot task to its source task when source_sync_mode = ''live''. Supports both legacy source_task_id and universal source_entity_type/source_entity_id tracking. table_row sources are snapshot-only.';


--
-- Name: sync_live_task_properties_to_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_live_task_properties_to_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_entity_id uuid;
  v_workspace_id uuid;
  v_field_name text;
  v_field_type text;
  v_value jsonb;
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_sync_mode text;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.entity_type <> 'task' then
      return old;
    end if;
    v_entity_id := old.entity_id;
    v_workspace_id := old.workspace_id;
    v_field_name := old.field_name;
    v_field_type := old.field_type;
    v_value := null;
  else
    if new.entity_type <> 'task' then
      return new;
    end if;
    v_entity_id := new.entity_id;
    v_workspace_id := new.workspace_id;
    v_field_name := new.field_name;
    v_field_type := new.field_type;
    v_value := new.value;
  end if;

  select
    source_task_id,
    source_entity_type,
    source_entity_id,
    source_sync_mode
  into v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode
  from public.task_items
  where id = v_entity_id;

  if v_sync_mode <> 'live' then
    return coalesce(new, old);
  end if;

  if v_source_entity_type = 'table_row' or v_source_entity_type = 'block' then
    return coalesce(new, old);
  end if;

  if v_source_entity_type = 'task' and v_source_entity_id is not null then
    v_source_task_id := v_source_entity_id;
  elsif v_source_task_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    delete from public.entity_properties
    where entity_type = 'task'
      and entity_id = v_source_task_id
      and field_name = v_field_name;
  else
    insert into public.entity_properties (
      workspace_id,
      entity_type,
      entity_id,
      field_name,
      field_type,
      value
    )
    values (
      v_workspace_id,
      'task',
      v_source_task_id,
      v_field_name,
      v_field_type,
      v_value
    )
    on conflict (entity_type, entity_id, field_name)
    do update set
      value = excluded.value,
      field_type = excluded.field_type,
      updated_at = now();
  end if;

  return coalesce(new, old);
end;
$$;


--
-- Name: FUNCTION sync_live_task_properties_to_source(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_live_task_properties_to_source() IS 'Syncs named entity_properties from live snapshot tasks to their source tasks using field_name uniqueness.';


--
-- Name: sync_live_task_tags_to_source(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_live_task_tags_to_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_task_id uuid;
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_sync_mode text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;

  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT source_task_id, source_entity_type, source_entity_id, source_sync_mode
  INTO v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode
  FROM public.task_items WHERE id = v_task_id;

  IF v_source_entity_type = 'table_row' OR v_source_entity_type = 'block' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

  IF v_source_task_id IS NULL OR v_sync_mode <> 'live' THEN RETURN COALESCE(NEW, OLD); END IF;

  DELETE FROM public.task_tag_links WHERE task_id = v_source_task_id;
  INSERT INTO public.task_tag_links (task_id, tag_id)
  SELECT v_source_task_id, tag_id FROM public.task_tag_links WHERE task_id = v_task_id ON CONFLICT DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: sync_table_row_property_names_on_field_rename(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_table_row_property_names_on_field_rename() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Only relevant for renamed status/priority fields.
  if new.name is not distinct from old.name then
    return new;
  end if;
  if new.type not in ('priority', 'status') then
    return new;
  end if;
  if old.name is null or btrim(old.name) = '' or new.name is null or btrim(new.name) = '' then
    return new;
  end if;

  -- If a row already has both old and new names, keep the new-name row and drop old.
  delete from public.entity_properties ep_old
  using public.table_rows tr
  where tr.table_id = new.table_id
    and ep_old.entity_type = 'table_row'
    and ep_old.entity_id = tr.id
    and ep_old.field_type = new.type
    and ep_old.field_name = old.name
    and exists (
      select 1
      from public.entity_properties ep_new
      where ep_new.entity_type = 'table_row'
        and ep_new.entity_id = ep_old.entity_id
        and ep_new.field_type = new.type
        and ep_new.field_name = new.name
    );

  -- Rename remaining old-name rows to the new field name.
  update public.entity_properties ep
  set field_name = new.name,
      updated_at = now()
  from public.table_rows tr
  where tr.table_id = new.table_id
    and ep.entity_type = 'table_row'
    and ep.entity_id = tr.id
    and ep.field_type = new.type
    and ep.field_name = old.name;

  return new;
end;
$$;


--
-- Name: trigger_indexing_worker_http(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_indexing_worker_http() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  worker_url TEXT;
  cron_secret TEXT;
  request_id BIGINT;
BEGIN
  -- Get configuration from a settings table
  SELECT value INTO worker_url
  FROM app_settings
  WHERE key = 'indexing_worker_url'
  LIMIT 1;

  SELECT value INTO cron_secret
  FROM app_settings
  WHERE key = 'cron_secret'
  LIMIT 1;

  -- Fallback to environment variable or hardcoded value if not in settings
  IF worker_url IS NULL OR worker_url = '' THEN
    -- You should set this via INSERT into app_settings or use a vault secret
    worker_url := 'https://your-deployment-url.vercel.app/api/internal/indexing/worker';
    RAISE WARNING 'Worker URL not configured. Using fallback. Set indexing_worker_url in app_settings table.';
  END IF;

  -- Make async HTTP POST request using Supabase's pg_net
  SELECT INTO request_id
    net.http_post(
      url := worker_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(cron_secret, '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000  -- 30 second timeout
    );

  -- Log the request (optional)
  RAISE NOTICE 'Triggered indexing worker. Request ID: %', request_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the cron job
    RAISE WARNING 'Failed to trigger indexing worker: %', SQLERRM;
END;
$$;


--
-- Name: FUNCTION trigger_indexing_worker_http(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_indexing_worker_http() IS 'Triggers the indexing worker via HTTP. Called by pg_cron.';


--
-- Name: trigger_shopify_sync_worker(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_shopify_sync_worker() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  app_url text;
  cron_secret text;
BEGIN
  -- Read from config table
  SELECT value INTO app_url FROM app_config WHERE key = 'shopify_sync_url';
  SELECT value INTO cron_secret FROM app_config WHERE key = 'cron_secret';

  IF app_url IS NULL OR app_url = '' THEN
    RAISE NOTICE 'Shopify sync URL not configured';
    RETURN;
  END IF;

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE NOTICE 'Cron secret not configured';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := app_url || '/api/shopify/sync/worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;


--
-- Name: update_client_tabs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_client_tabs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_docs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_docs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_payment_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_payment_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_table_full(uuid, text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_full(p_table_id uuid, p_title text, p_description text, p_updated_by uuid, p_add_fields jsonb DEFAULT '[]'::jsonb, p_update_fields jsonb DEFAULT '[]'::jsonb, p_delete_fields jsonb DEFAULT '[]'::jsonb, p_insert_rows jsonb DEFAULT '[]'::jsonb, p_update_rows jsonb DEFAULT NULL::jsonb, p_delete_row_ids jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_field jsonb;
  v_row jsonb;
  v_row_ids uuid[];
  v_data jsonb;
  v_field_id uuid;
  v_field_name text;
  v_updates jsonb;
  v_filters jsonb;
  v_result jsonb := '{}'::jsonb;
  v_fields_added int := 0;
  v_fields_updated int := 0;
  v_fields_deleted int := 0;
  v_rows_inserted int := 0;
  v_rows_updated int := 0;
  v_rows_deleted int := 0;
  v_field_type text;
  v_field_config jsonb;
  v_cell_value jsonb;
begin
  if p_title is not null or p_description is not null then
    update public.tables
    set title = coalesce(p_title, title),
        description = coalesce(p_description, description),
        updated_at = now()
    where id = p_table_id;
  end if;

  for v_field in select * from jsonb_array_elements(coalesce(p_add_fields, '[]'::jsonb)) loop
    v_field_name := trim(both ' ' from coalesce(v_field->>'name', ''));
    if v_field_name = '' then
      continue;
    end if;
    if exists (
      select 1 from public.table_fields
      where table_id = p_table_id and lower(name) = lower(v_field_name)
    ) then
      continue;
    end if;
    insert into public.table_fields (table_id, name, type, config, is_primary)
    values (
      p_table_id,
      v_field_name,
      coalesce(v_field->>'type', 'text'),
      case
        when coalesce(v_field->>'type', 'text') = 'priority' then
          '{"levels":[{"id":"urgent","label":"Urgent","color":"#ef4444","order":4},{"id":"high","label":"High","color":"#f59e0b","order":3},{"id":"medium","label":"Medium","color":"#3b82f6","order":2},{"id":"low","label":"Low","color":"#6b7280","order":1}]}'::jsonb
        when coalesce(v_field->>'type', 'text') = 'status' then
          '{"options":[{"id":"todo","label":"To Do","color":"#6b7280"},{"id":"in_progress","label":"In Progress","color":"#3b82f6"},{"id":"done","label":"Done","color":"#10b981"},{"id":"blocked","label":"Blocked","color":"#ef4444"}]}'::jsonb
        else
          coalesce(v_field->'config', '{}'::jsonb)
      end,
      coalesce((v_field->>'isPrimary')::boolean, false)
    );
    v_fields_added := v_fields_added + 1;
  end loop;

  for v_field in select * from jsonb_array_elements(coalesce(p_update_fields, '[]'::jsonb)) loop
    v_field_id := null;
    v_field_name := coalesce(v_field->>'fieldId', null);
    if v_field_name is not null then
      begin
        v_field_id := v_field_name::uuid;
      exception when invalid_text_representation then
        v_field_id := null;
      end;
    end if;
    if v_field_id is null and v_field ? 'fieldName' then
      v_field_id := public._resolve_table_field_id(p_table_id, v_field->>'fieldName');
    end if;
    if v_field_id is null then
      continue;
    end if;

    select type into v_field_type
    from public.table_fields
    where id = v_field_id;

    update public.table_fields
    set name = coalesce(v_field->>'name', name),
        config = case
          when v_field_type = 'priority' then
            '{"levels":[{"id":"urgent","label":"Urgent","color":"#ef4444","order":4},{"id":"high","label":"High","color":"#f59e0b","order":3},{"id":"medium","label":"Medium","color":"#3b82f6","order":2},{"id":"low","label":"Low","color":"#6b7280","order":1}]}'::jsonb
          when v_field_type = 'status' then
            '{"options":[{"id":"todo","label":"To Do","color":"#6b7280"},{"id":"in_progress","label":"In Progress","color":"#3b82f6"},{"id":"done","label":"Done","color":"#10b981"},{"id":"blocked","label":"Blocked","color":"#ef4444"}]}'::jsonb
          when v_field ? 'config' then coalesce(v_field->'config', '{}'::jsonb)
          else config
        end,
        updated_at = now()
    where id = v_field_id;
    v_fields_updated := v_fields_updated + 1;
  end loop;

  for v_field_name in select * from jsonb_array_elements_text(coalesce(p_delete_fields, '[]'::jsonb)) loop
    v_field_id := public._resolve_table_field_id(p_table_id, v_field_name);
    if v_field_id is null then
      continue;
    end if;
    delete from public.table_fields where id = v_field_id;
    v_fields_deleted := v_fields_deleted + 1;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_insert_rows, '[]'::jsonb)) loop
    v_data := '{}'::jsonb;
    for v_field_name, v_field_id in
      select key, public._resolve_table_field_id(p_table_id, key)
      from jsonb_each(coalesce(v_row->'data', '{}'::jsonb))
    loop
      if v_field_id is null then
        continue;
      end if;

      select type, config
      into v_field_type, v_field_config
      from public.table_fields
      where id = v_field_id;

      v_cell_value := public._resolve_field_value_with_property_def(
        v_field_type,
        v_field_config,
        null,
        (v_row->'data'->v_field_name)
      );
      if v_cell_value is null then
        continue;
      end if;

      v_data := v_data || jsonb_build_object(v_field_id::text, v_cell_value);
    end loop;
    insert into public.table_rows (table_id, data, created_by, updated_by)
    values (p_table_id, v_data, p_updated_by, p_updated_by);
    v_rows_inserted := v_rows_inserted + 1;
  end loop;

  if p_update_rows is not null then
    v_filters := p_update_rows->'filters';
    v_updates := p_update_rows->'updates';
    if v_updates is not null then
      select updated, row_ids into v_rows_updated, v_row_ids
      from public.update_table_rows_by_field_names(p_table_id, v_filters, v_updates, null, p_updated_by)
      limit 1;
    end if;
  end if;

  if jsonb_typeof(p_delete_row_ids) = 'array' and jsonb_array_length(p_delete_row_ids) > 0 then
    delete from public.table_rows
    where table_id = p_table_id and id in (
      select (value::text)::uuid from jsonb_array_elements_text(p_delete_row_ids)
    );
    get diagnostics v_rows_deleted = row_count;
  end if;

  v_result := v_result || jsonb_build_object('fieldsAdded', v_fields_added);
  v_result := v_result || jsonb_build_object('fieldsUpdated', v_fields_updated);
  v_result := v_result || jsonb_build_object('fieldsDeleted', v_fields_deleted);
  v_result := v_result || jsonb_build_object('rowsInserted', v_rows_inserted);
  v_result := v_result || jsonb_build_object('rowsUpdated', v_rows_updated);
  v_result := v_result || jsonb_build_object('rowsDeleted', v_rows_deleted);

  return v_result;
end;
$$;


--
-- Name: update_table_rows_by_field_names(uuid, jsonb, jsonb, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_rows_by_field_names(p_table_id uuid, p_filters jsonb DEFAULT NULL::jsonb, p_updates jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 500, p_updated_by uuid DEFAULT NULL::uuid, OUT updated integer, OUT row_ids uuid[]) RETURNS record
    LANGUAGE plpgsql
    AS $$
declare
  v_updates_by_id jsonb := '{}'::jsonb;
  v_named_fixed_updates jsonb := '{}'::jsonb;
  v_filter_key text;
  v_filter_val jsonb;
  v_filter_text text;
  v_field_id uuid;
  v_field_type text;
  v_field_name text;
  v_field_config jsonb;
  v_ids uuid[];
  v_ids_next uuid[];
  v_limit int := coalesce(p_limit, 500);
  v_workspace_id uuid;
  v_fixed_entry record;
  v_value jsonb;
begin
  select workspace_id into v_workspace_id
  from public.tables
  where id = p_table_id;

  -- Resolve updates by table field id
  for v_filter_key, v_filter_val in
    select key, value from jsonb_each(coalesce(p_updates, '{}'::jsonb))
  loop
    v_field_id := public._resolve_table_field_id(p_table_id, v_filter_key);
    if v_field_id is null then
      raise exception 'Unknown field "%" in updates', v_filter_key;
    end if;

    select name, type, config
    into v_field_name, v_field_type, v_field_config
    from public.table_fields
    where id = v_field_id;

    v_value := public._resolve_field_value_with_property_def(
      v_field_type,
      v_field_config,
      null,  -- no property_definition_id
      v_filter_val
    );

    v_updates_by_id := v_updates_by_id || jsonb_build_object(v_field_id::text, v_value);

    if v_field_type in ('status', 'priority') and v_field_name is not null and btrim(v_field_name) <> '' then
      v_named_fixed_updates := v_named_fixed_updates || jsonb_build_object(
        v_field_name,
        jsonb_build_object(
          'field_type', v_field_type,
          'value', v_value
        )
      );
    end if;
  end loop;

  -- Seed candidate ids
  select array_agg(id) into v_ids
  from public.table_rows
  where table_id = p_table_id
  limit v_limit;

  if v_ids is null then
    updated := 0;
    row_ids := array[]::uuid[];
    return;
  end if;

  -- Apply filters
  if p_filters is not null then
    for v_filter_key, v_filter_val in select key, value from jsonb_each(p_filters) loop
      v_field_id := public._resolve_table_field_id(p_table_id, v_filter_key);
      if v_field_id is null then
        raise exception 'Unknown field "%" in filters', v_filter_key;
      end if;

      if jsonb_typeof(v_filter_val) not in ('object', 'array') then
        v_filter_text := trim(both '"' from v_filter_val::text);
      else
        v_filter_text := null;
      end if;

      v_ids_next := array(
        select id
        from public.table_rows
        where table_id = p_table_id
          and id = any(v_ids)
          and (
            (jsonb_typeof(v_filter_val) = 'object' and (
              (v_filter_val->>'op' = 'is_null' and (data->>v_field_id::text) is null)
              or (v_filter_val->>'op' = 'not_null' and (data->>v_field_id::text) is not null)
              or (v_filter_val->>'op' = 'eq' and lower(coalesce(data->>v_field_id::text, '')) = lower(coalesce(v_filter_val->>'value', '')))
              or (v_filter_val->>'op' = 'neq' and lower(coalesce(data->>v_field_id::text, '')) <> lower(coalesce(v_filter_val->>'value', '')))
              or (v_filter_val->>'op' = 'contains' and lower(coalesce(data->>v_field_id::text, '')) like '%' || lower(coalesce(v_filter_val->>'value', '')) || '%')
            ))
            or (jsonb_typeof(v_filter_val) = 'array' and lower(coalesce(data->>v_field_id::text, '')) in (
              select lower(value::text) from jsonb_array_elements_text(v_filter_val)
            ))
            or (jsonb_typeof(v_filter_val) not in ('object', 'array') and (
              v_filter_text is not null
              and lower(coalesce(data->>v_field_id::text, '')) = lower(v_filter_text)
            ))
          )
      );
      v_ids := v_ids_next;
    end loop;
  end if;

  if v_ids is null or array_length(v_ids, 1) is null then
    updated := 0;
    row_ids := array[]::uuid[];
    return;
  end if;

  update public.table_rows
  set data = coalesce(data, '{}'::jsonb) || v_updates_by_id,
      updated_by = p_updated_by,
      edited = case when source_entity_id is not null then true else coalesce(edited, false) end
  where table_id = p_table_id and id = any(v_ids);

  -- Sync fixed fields by named field_name key
  for v_fixed_entry in select key, value from jsonb_each(v_named_fixed_updates) loop
    v_field_name := v_fixed_entry.key;
    v_field_type := v_fixed_entry.value->>'field_type';
    v_value := v_fixed_entry.value->'value';

    if v_value is null
       or jsonb_typeof(v_value) = 'null'
       or btrim(trim(both '"' from v_value::text)) = '' then
      delete from public.entity_properties
      where entity_type = 'table_row'
        and entity_id = any(v_ids)
        and lower(field_name) = lower(v_field_name);
    else
      insert into public.entity_properties (
        entity_type,
        entity_id,
        workspace_id,
        field_name,
        field_type,
        value
      )
      select
        'table_row',
        id,
        v_workspace_id,
        v_field_name,
        v_field_type,
        v_value
      from unnest(v_ids) as id
      on conflict (entity_type, entity_id, field_name)
      do update set
        workspace_id = excluded.workspace_id,
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    end if;

    -- Remove stale legacy rows
    delete from public.entity_properties ep
    where ep.entity_type = 'table_row'
      and ep.entity_id = any(v_ids)
      and ep.field_type = v_field_type
      and not exists (
        select 1
        from public.table_fields tf
        where tf.table_id = p_table_id
          and tf.type = ep.field_type
          and lower(btrim(tf.name)) = lower(btrim(ep.field_name))
      );
  end loop;

  updated := coalesce(array_length(v_ids, 1), 0);
  row_ids := v_ids;
  return;
end;
$$;


--
-- Name: update_task_full(uuid, jsonb, jsonb, boolean, jsonb, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task_full(p_task_id uuid, p_updates jsonb, p_assignees jsonb, p_assignees_set boolean, p_tags jsonb, p_tags_set boolean, p_updated_by uuid) RETURNS public.task_items
    LANGUAGE plpgsql
    AS $$
declare
  v_task public.task_items;
  v_workspace_id uuid;
  v_primary_assignee jsonb;
  v_primary_assignee_id uuid;
  v_assignee_id_text text;
  v_named_assignee_ids text[] := array[]::text[];
  v_tag text;
  v_tag_id uuid;
  v_existing_tags uuid[];
  v_desired_tags uuid[] := array[]::uuid[];
  v_statuses jsonb;
  v_priorities jsonb;
  v_status_entry jsonb;
  v_priority_entry jsonb;
begin
  update public.task_items
  set
    title = coalesce(p_updates->>'title', title),
    statuses = case
      when p_updates ? 'statuses' then coalesce(p_updates->'statuses', '[]'::jsonb)
      when p_updates ? 'status' then
        case
          when nullif(btrim(coalesce(p_updates->>'status', '')), '') is null then '[]'::jsonb
          else jsonb_build_array(jsonb_build_object('field_name', 'Status', 'value',
            case
              when lower(p_updates->>'status') = 'in-progress' then 'in_progress'
              when lower(p_updates->>'status') = 'in progress' then 'in_progress'
              when lower(p_updates->>'status') = 'done' then 'done'
              when lower(p_updates->>'status') = 'blocked' then 'blocked'
              else 'todo'
            end
          ))
        end
      else statuses
    end,
    priorities = case
      when p_updates ? 'priorities' then coalesce(p_updates->'priorities', '[]'::jsonb)
      when p_updates ? 'priority' then
        case
          when nullif(btrim(coalesce(p_updates->>'priority', '')), '') is null or lower(p_updates->>'priority') = 'none'
            then '[]'::jsonb
          else jsonb_build_array(jsonb_build_object('field_name', 'Priority', 'value', lower(p_updates->>'priority')))
        end
      else priorities
    end,
    due_dates = case
      when p_updates ? 'due_dates' then coalesce(p_updates->'due_dates', '[]'::jsonb)
      when p_updates ? 'dueDate' or p_updates ? 'startDate' then
        case
          when coalesce((p_updates->>'startDate')::date, start_date) is null
               and coalesce((p_updates->>'dueDate')::date, due_date) is null
            then '[]'::jsonb
          else jsonb_build_array(
            jsonb_build_object(
              'field_name', 'Due Date',
              'value', jsonb_build_object(
                'start', coalesce((p_updates->>'startDate')::date, start_date),
                'end', coalesce((p_updates->>'dueDate')::date, due_date)
              )
            )
          )
        end
      else due_dates
    end,
    description = coalesce(p_updates->>'description', description),
    due_date = coalesce((p_updates->>'dueDate')::date, due_date),
    due_time = coalesce((p_updates->>'dueTime')::time, due_time),
    start_date = coalesce((p_updates->>'startDate')::date, start_date),
    hide_icons = coalesce((p_updates->>'hideIcons')::boolean, hide_icons),
    recurring_enabled = coalesce((p_updates->>'recurringEnabled')::boolean, recurring_enabled),
    recurring_frequency = coalesce(p_updates->>'recurringFrequency', recurring_frequency),
    recurring_interval = coalesce((p_updates->>'recurringInterval')::integer, recurring_interval),
    updated_by = p_updated_by
  where id = p_task_id
  returning * into v_task;

  if v_task.id is null then
    raise exception 'Task not found';
  end if;

  v_workspace_id := v_task.workspace_id;

  if p_updates ? 'statuses' or p_updates ? 'status' then
    v_statuses := v_task.statuses;
    delete from public.entity_properties
    where entity_type = 'task' and entity_id = p_task_id and field_type = 'status';

    for v_status_entry in select * from jsonb_array_elements(coalesce(v_statuses, '[]'::jsonb)) loop
      if (v_status_entry ? 'field_name') and (v_status_entry ? 'value') then
        insert into public.entity_properties (
          workspace_id, entity_type, entity_id, field_name, field_type, value
        )
        values (
          v_workspace_id,
          'task',
          p_task_id,
          coalesce(nullif(trim(v_status_entry->>'field_name'), ''), 'Status'),
          'status',
          to_jsonb(v_status_entry->>'value')
        )
        on conflict (entity_type, entity_id, field_name)
        do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
      end if;
    end loop;
  end if;

  if p_updates ? 'priorities' or p_updates ? 'priority' then
    v_priorities := v_task.priorities;
    delete from public.entity_properties
    where entity_type = 'task' and entity_id = p_task_id and field_type = 'priority';

    for v_priority_entry in select * from jsonb_array_elements(coalesce(v_priorities, '[]'::jsonb)) loop
      if (v_priority_entry ? 'field_name') and (v_priority_entry ? 'value') then
        insert into public.entity_properties (
          workspace_id, entity_type, entity_id, field_name, field_type, value
        )
        values (
          v_workspace_id,
          'task',
          p_task_id,
          coalesce(nullif(trim(v_priority_entry->>'field_name'), ''), 'Priority'),
          'priority',
          to_jsonb(v_priority_entry->>'value')
        )
        on conflict (entity_type, entity_id, field_name)
        do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
      end if;
    end loop;
  end if;

  if p_assignees_set then
    v_primary_assignee_id := null;
    v_named_assignee_ids := array[]::text[];
    delete from public.task_assignees where task_id = p_task_id;

    for v_primary_assignee in select * from jsonb_array_elements(coalesce(p_assignees, '[]'::jsonb)) loop
      v_assignee_id_text := nullif(v_primary_assignee->>'id', '');
      if v_assignee_id_text is not null then
        v_named_assignee_ids := array_append(v_named_assignee_ids, v_assignee_id_text);
      end if;

      insert into public.task_assignees (task_id, assignee_id, assignee_name)
      values (
        p_task_id,
        v_assignee_id_text::uuid,
        coalesce(nullif(v_primary_assignee->>'name', ''), v_assignee_id_text, 'Unknown')
      );
    end loop;

    if jsonb_array_length(coalesce(p_assignees, '[]'::jsonb)) > 0 then
      select * into v_primary_assignee from jsonb_array_elements(coalesce(p_assignees, '[]'::jsonb)) limit 1;
      v_primary_assignee_id := nullif(v_primary_assignee->>'id', '')::uuid;
      insert into public.entity_properties (
        workspace_id, entity_type, entity_id, field_name, field_type, value
      )
      values (
        v_workspace_id, 'task', p_task_id, 'Assignee', 'assignee',
        jsonb_build_object(
          'id', nullif(v_primary_assignee->>'id', ''),
          'name', coalesce(nullif(v_primary_assignee->>'name', ''), nullif(v_primary_assignee->>'id', ''))
        )
      )
      on conflict (entity_type, entity_id, field_name)
      do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
    else
      delete from public.entity_properties
      where workspace_id = v_workspace_id and entity_type = 'task' and entity_id = p_task_id and field_name = 'Assignee';
    end if;

    update public.task_items
    set assignee_id = v_primary_assignee_id,
        assignees = case
          when coalesce(array_length(v_named_assignee_ids, 1), 0) = 0 then '[]'::jsonb
          else jsonb_build_array(
            jsonb_build_object('field_name', 'Assignee', 'value', to_jsonb(v_named_assignee_ids))
          )
        end,
        updated_by = p_updated_by
    where id = p_task_id;
  end if;

  if p_tags_set then
    select array_agg(tag_id) into v_existing_tags
    from public.task_tag_links where task_id = p_task_id;

    for v_tag in select trim(value::text) from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) loop
      if v_tag is null or v_tag = '' then continue; end if;
      select id into v_tag_id from public.task_tags where workspace_id = v_workspace_id and name = v_tag limit 1;
      if v_tag_id is null then
        insert into public.task_tags (workspace_id, name) values (v_workspace_id, v_tag) returning id into v_tag_id;
      end if;
      v_desired_tags := v_desired_tags || v_tag_id;
    end loop;

    insert into public.task_tag_links (task_id, tag_id)
    select p_task_id, t from unnest(v_desired_tags) as t
    where not (t = any(coalesce(v_existing_tags, array[]::uuid[])))
    on conflict do nothing;
  end if;

  select * into v_task from public.task_items where id = p_task_id;
  return v_task;
end;
$$;


--
-- Name: validate_table_row_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_table_row_data() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  key TEXT;
  field_record RECORD;
  value JSONB;

  start_value JSONB;
  end_value JSONB;
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
      IF jsonb_typeof(value) = 'null' THEN
        CONTINUE;
      ELSIF jsonb_typeof(value) = 'string' THEN
        -- Accept plain ISO date and datetime-like strings.
        IF (value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}([T\s].*)?$' THEN
          RAISE EXCEPTION 'Field % expects ISO date string', key;
        END IF;
      ELSIF jsonb_typeof(value) = 'object' THEN
        start_value := COALESCE(value -> 'start', value -> 'startDate');
        end_value := COALESCE(value -> 'end', value -> 'endDate');

        IF start_value IS NULL AND end_value IS NULL THEN
          RAISE EXCEPTION 'Field % expects date range object with start/end', key;
        END IF;

        IF start_value IS NOT NULL THEN
          IF jsonb_typeof(start_value) NOT IN ('string', 'null') THEN
            RAISE EXCEPTION 'Field % expects date range start as string|null', key;
          END IF;
          IF jsonb_typeof(start_value) = 'string' AND (start_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}([T\s].*)?$' THEN
            RAISE EXCEPTION 'Field % expects date range start as ISO date string', key;
          END IF;
        END IF;

        IF end_value IS NOT NULL THEN
          IF jsonb_typeof(end_value) NOT IN ('string', 'null') THEN
            RAISE EXCEPTION 'Field % expects date range end as string|null', key;
          END IF;
          IF jsonb_typeof(end_value) = 'string' AND (end_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}([T\s].*)?$' THEN
            RAISE EXCEPTION 'Field % expects date range end as ISO date string', key;
          END IF;
        END IF;
      ELSE
        RAISE EXCEPTION 'Field % expects ISO date string or range object', key;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$_$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: http_request(); Type: FUNCTION; Schema: supabase_functions; Owner: -
--

CREATE FUNCTION supabase_functions.http_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'supabase_functions'
    AS $$
    DECLARE
      request_id bigint;
      payload jsonb;
      url text := TG_ARGV[0]::text;
      method text := TG_ARGV[1]::text;
      headers jsonb DEFAULT '{}'::jsonb;
      params jsonb DEFAULT '{}'::jsonb;
      timeout_ms integer DEFAULT 1000;
    BEGIN
      IF url IS NULL OR url = 'null' THEN
        RAISE EXCEPTION 'url argument is missing';
      END IF;

      IF method IS NULL OR method = 'null' THEN
        RAISE EXCEPTION 'method argument is missing';
      END IF;

      IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
        headers = '{"Content-Type": "application/json"}'::jsonb;
      ELSE
        headers = TG_ARGV[2]::jsonb;
      END IF;

      IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
        params = '{}'::jsonb;
      ELSE
        params = TG_ARGV[3]::jsonb;
      END IF;

      IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
        timeout_ms = 1000;
      ELSE
        timeout_ms = TG_ARGV[4]::integer;
      END IF;

      CASE
        WHEN method = 'GET' THEN
          SELECT http_get INTO request_id FROM net.http_get(
            url,
            params,
            headers,
            timeout_ms
          );
        WHEN method = 'POST' THEN
          payload = jsonb_build_object(
            'old_record', OLD,
            'record', NEW,
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA
          );

          SELECT http_post INTO request_id FROM net.http_post(
            url,
            payload,
            params,
            headers,
            timeout_ms
          );
        ELSE
          RAISE EXCEPTION 'method argument % is invalid', method;
      END CASE;

      INSERT INTO supabase_functions.hooks
        (hook_table_id, hook_name, request_id)
      VALUES
        (TG_RELID, TG_NAME, request_id);

      RETURN NEW;
    END
  $$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_config (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE app_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.app_settings IS 'Application-wide settings including URLs and secrets for cron jobs';


--
-- Name: block_highlights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_highlights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    block_id uuid NOT NULL,
    color public.highlight_color NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: block_references; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_references (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    block_id uuid NOT NULL,
    reference_type text NOT NULL,
    reference_id uuid NOT NULL,
    table_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT block_references_reference_type_check CHECK ((reference_type = ANY (ARRAY['doc'::text, 'table_row'::text, 'task'::text, 'block'::text])))
);


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
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
    locked boolean DEFAULT false NOT NULL,
    CONSTRAINT blocks_column_check CHECK ((("column" >= 0) AND ("column" <= 2)))
);


--
-- Name: COLUMN blocks.is_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.blocks.is_template IS 'Whether this block is a reusable template/shared block';


--
-- Name: COLUMN blocks.template_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.blocks.template_name IS 'Optional name for template blocks to make them easier to find';


--
-- Name: COLUMN blocks.original_block_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.blocks.original_block_id IS 'If this is a reference, points to the original block';


--
-- Name: client_page_views; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE client_page_views; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.client_page_views IS 'Analytics tracking for client page views';


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
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
    folder_id uuid,
    is_workspace_analysis_project boolean DEFAULT false NOT NULL,
    client_editing_enabled boolean DEFAULT false,
    internal_group_id uuid,
    priority text,
    tags text[] DEFAULT '{}'::text[],
    CONSTRAINT chk_projects_due_xor CHECK ((((due_date_date IS NULL) <> (due_date_text IS NULL)) OR ((due_date_date IS NULL) AND (due_date_text IS NULL)))),
    CONSTRAINT projects_project_type_check CHECK ((project_type = ANY (ARRAY['project'::text, 'internal'::text])))
);


--
-- Name: COLUMN projects.project_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.project_type IS 'Type of project: project (client work) or internal (company knowledge)';


--
-- Name: COLUMN projects.client_page_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.client_page_enabled IS 'Whether this project has a public client page enabled';


--
-- Name: COLUMN projects.public_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.public_token IS 'Unique token for accessing the public client page';


--
-- Name: COLUMN projects.client_editing_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.client_editing_enabled IS 'Allow visitors with the public link to edit blocks and content';


--
-- Name: COLUMN projects.priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.priority IS 'Project priority: low, medium, high, urgent, or null for none';


--
-- Name: COLUMN projects.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.tags IS 'Tags assigned to this project (labels on the project). Distinct from project_tags table which is the tag bank for tasks.';


--
-- Name: client_page_analytics_summary; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: VIEW client_page_analytics_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.client_page_analytics_summary IS 'Summary analytics for client pages by project';


--
-- Name: client_tab_blocks; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: TABLE client_tab_blocks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.client_tab_blocks IS 'Content blocks within client tabs (similar to project tab blocks)';


--
-- Name: COLUMN client_tab_blocks."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.client_tab_blocks."position" IS 'Vertical position within column';


--
-- Name: COLUMN client_tab_blocks."column"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.client_tab_blocks."column" IS 'Column position (0-2 for up to 3 columns)';


--
-- Name: client_tabs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE client_tabs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.client_tabs IS 'Custom tabs within client detail pages for organizing client-specific information';


--
-- Name: COLUMN client_tabs."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.client_tabs."position" IS 'Display order of tabs (0-based)';


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: dashboard_ai_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_ai_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    content jsonb NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dashboard_projects; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: doc_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doc_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE doc_folders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.doc_folders IS 'Folders for grouping docs in the docs list.';


--
-- Name: docs; Type: TABLE; Schema: public; Owner: -
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
    is_archived boolean DEFAULT false,
    folder_id uuid
);


--
-- Name: TABLE docs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.docs IS 'Stores rich text documents created within Trak';


--
-- Name: COLUMN docs.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.docs.content IS 'ProseMirror JSON content from Tiptap editor';


--
-- Name: entity_inherited_display; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_inherited_display (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    source_entity_type text NOT NULL,
    source_entity_id uuid NOT NULL,
    property_definition_id uuid NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    CONSTRAINT entity_inherited_display_entity_type_check CHECK ((entity_type = ANY (ARRAY['block'::text, 'task'::text, 'subtask'::text, 'timeline_event'::text, 'table_row'::text]))),
    CONSTRAINT entity_inherited_display_source_entity_type_check CHECK ((source_entity_type = ANY (ARRAY['block'::text, 'task'::text, 'subtask'::text, 'timeline_event'::text, 'table_row'::text])))
);


--
-- Name: entity_links; Type: TABLE; Schema: public; Owner: -
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
    CONSTRAINT entity_links_source_entity_type_check CHECK ((source_entity_type = ANY (ARRAY['block'::text, 'task'::text, 'subtask'::text, 'timeline_event'::text, 'table_row'::text]))),
    CONSTRAINT entity_links_target_entity_type_check CHECK ((target_entity_type = ANY (ARRAY['block'::text, 'task'::text, 'subtask'::text, 'timeline_event'::text, 'table_row'::text])))
);


--
-- Name: entity_properties; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: entity_properties_legacy; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: file_analysis_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_analysis_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    extracted_text text,
    extracted_tables jsonb,
    page_count integer,
    row_count integer,
    column_count integer,
    token_estimate integer,
    error text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT file_analysis_artifacts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'error'::text])))
);


--
-- Name: file_analysis_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_analysis_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artifact_id uuid NOT NULL,
    file_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    token_count integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding public.vector(1536)
);


--
-- Name: file_analysis_citations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_analysis_citations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    file_id uuid NOT NULL,
    chunk_id uuid,
    page_number integer,
    row_start integer,
    row_end integer,
    excerpt text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: file_analysis_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_analysis_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT file_analysis_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: file_analysis_session_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_analysis_session_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    file_id uuid NOT NULL,
    source text DEFAULT 'upload'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT file_analysis_session_files_source_check CHECK ((source = ANY (ARRAY['upload'::text, 'mention'::text, 'attached'::text])))
);


--
-- Name: file_analysis_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_analysis_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid,
    tab_id uuid,
    user_id uuid NOT NULL,
    scope_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone,
    CONSTRAINT file_analysis_sessions_scope_check CHECK ((scope_type = ANY (ARRAY['tab'::text, 'project'::text, 'workspace'::text])))
);


--
-- Name: file_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    block_id uuid NOT NULL,
    display_mode public.file_display_mode DEFAULT 'inline'::public.file_display_mode NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: file_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    user_id uuid NOT NULL,
    analysis_message_id uuid,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: google_calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    google_account_email text,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    scope text,
    token_type text,
    expires_at timestamp with time zone,
    calendar_id text DEFAULT 'primary'::text NOT NULL,
    sync_token text,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: indexing_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indexing_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT indexing_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: internal_space_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_space_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE internal_space_groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.internal_space_groups IS 'Groups for organizing internal spaces on the Internal page.';


--
-- Name: oauth_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state text NOT NULL,
    nonce text NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
);


--
-- Name: TABLE organization_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_members IS 'Users can be in multiple organizations; role: owner, admin, member.';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizations IS 'Organizations group workspaces; a user can be in multiple organizations.';


--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    name text
);


--
-- Name: project_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE project_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_members IS 'Project-level access control. If NO rows exist for a project, it is accessible to ALL workspace members (default). If ANY rows exist, only listed users + workspace owner have access.';


--
-- Name: project_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE project_tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_tags IS 'Tag bank per project. Tags created in project create modal or when adding a tag in the properties modal (for entities in that project) are stored here.';


--
-- Name: shopify_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shopify_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    shop_domain text NOT NULL,
    access_token_encrypted text NOT NULL,
    encryption_key_id text DEFAULT 'v1'::text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    sync_status text DEFAULT 'active'::text NOT NULL,
    shop_name text,
    shop_email text,
    shop_currency text,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shopify_connections_sync_status_check CHECK ((sync_status = ANY (ARRAY['active'::text, 'error'::text, 'disconnected'::text])))
);


--
-- Name: shopify_sync_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shopify_sync_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    job_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_items integer DEFAULT 0,
    processed_items integer DEFAULT 0,
    failed_items integer DEFAULT 0,
    attempts integer DEFAULT 0,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shopify_sync_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['full_sync'::text, 'inventory_sync'::text, 'metadata_sync'::text, 'initial_import'::text, 'sales_computation'::text]))),
    CONSTRAINT shopify_sync_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: slack_command_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_command_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slack_connection_id uuid NOT NULL,
    slack_user_id text NOT NULL,
    trak_user_id uuid,
    command_text text NOT NULL,
    channel_id text NOT NULL,
    channel_name text,
    request_id text,
    ip_address inet,
    user_agent text,
    response_status text DEFAULT 'pending'::text NOT NULL,
    response_summary text,
    error_message text,
    execution_time_ms integer,
    tools_used text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT slack_command_audit_log_response_status_check CHECK ((response_status = ANY (ARRAY['pending'::text, 'success'::text, 'error'::text, 'unauthorized'::text, 'rate_limited'::text])))
);


--
-- Name: TABLE slack_command_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.slack_command_audit_log IS 'Audit log for all Slack slash commands';


--
-- Name: slack_idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_idempotency_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idempotency_key text NOT NULL,
    response_payload jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE slack_idempotency_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.slack_idempotency_keys IS 'Idempotency cache for Slack command deduplication (24hr TTL)';


--
-- Name: slack_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    request_count integer DEFAULT 1 NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    last_request_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE slack_rate_limits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.slack_rate_limits IS 'Rate limiting state for Slack commands (sliding window)';


--
-- Name: slack_user_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_user_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slack_connection_id uuid NOT NULL,
    slack_user_id text NOT NULL,
    trak_user_id uuid NOT NULL,
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    link_status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT slack_user_links_link_status_check CHECK ((link_status = ANY (ARRAY['active'::text, 'revoked'::text])))
);


--
-- Name: TABLE slack_user_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.slack_user_links IS 'Maps Slack users to Trak users for account linking';


--
-- Name: slack_workspace_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_workspace_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    slack_team_id text NOT NULL,
    slack_team_name text NOT NULL,
    bot_access_token_encrypted text NOT NULL,
    encryption_key_id text DEFAULT 'v1'::text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    bot_user_id text NOT NULL,
    connection_status text DEFAULT 'active'::text NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT slack_workspace_connections_connection_status_check CHECK ((connection_status = ANY (ARRAY['active'::text, 'error'::text, 'disconnected'::text])))
);


--
-- Name: TABLE slack_workspace_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.slack_workspace_connections IS 'Stores Slack workspace OAuth connections with encrypted bot tokens';


--
-- Name: tab_shares; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: table_comments; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: table_fields; Type: TABLE; Schema: public; Owner: -
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
    CONSTRAINT table_fields_type_check CHECK ((type = ANY (ARRAY['text'::text, 'long_text'::text, 'number'::text, 'select'::text, 'multi_select'::text, 'date'::text, 'checkbox'::text, 'subtask'::text, 'url'::text, 'email'::text, 'phone'::text, 'person'::text, 'files'::text, 'created_time'::text, 'last_edited_time'::text, 'created_by'::text, 'last_edited_by'::text, 'formula'::text, 'relation'::text, 'rollup'::text, 'status'::text, 'priority'::text, 'tags'::text])))
);


--
-- Name: table_relations; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: table_rows; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT table_rows_source_entity_check CHECK ((((source_entity_type IS NULL) AND (source_entity_id IS NULL)) OR ((source_entity_type = ANY (ARRAY['task'::text, 'timeline_event'::text, 'table_row'::text, 'block'::text, 'subtask'::text])) AND (source_entity_id IS NOT NULL)))),
    CONSTRAINT table_rows_source_metadata_consistency CHECK ((((source_entity_type IS NULL) AND (source_entity_id IS NULL) AND (source_sync_mode IS NULL)) OR ((source_entity_type = ANY (ARRAY['task'::text, 'timeline_event'::text, 'table_row'::text, 'block'::text, 'subtask'::text])) AND (source_entity_id IS NOT NULL) AND (source_sync_mode = ANY (ARRAY['snapshot'::text, 'live'::text]))))),
    CONSTRAINT table_rows_source_sync_mode_check CHECK ((source_sync_mode = ANY (ARRAY['snapshot'::text, 'live'::text])))
);


--
-- Name: COLUMN table_rows.edited; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_rows.edited IS 'Tracks whether this snapshot has been modified by the user. Always false for original data (source_entity_id IS NULL). Set to true when user edits a snapshot.';


--
-- Name: table_views; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: tables; Type: TABLE; Schema: public; Owner: -
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
    created_by uuid,
    tab_id uuid
);


--
-- Name: tabs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    parent_tab_id uuid,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_client_visible boolean DEFAULT false,
    client_title text,
    is_workflow_page boolean DEFAULT false NOT NULL,
    workflow_metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: COLUMN tabs.is_client_visible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tabs.is_client_visible IS 'Whether this tab is visible on the public client page';


--
-- Name: COLUMN tabs.client_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tabs.client_title IS 'Optional custom title to display on client page (overrides internal tab name)';


--
-- Name: task_assignees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_assignees (
    task_id uuid NOT NULL,
    assignee_id uuid,
    assignee_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_assignees_has_identifier CHECK (((assignee_id IS NOT NULL) OR ((assignee_name IS NOT NULL) AND (length(TRIM(BOTH FROM assignee_name)) > 0))))
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_references; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: task_subtask_references; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_subtask_references (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    subtask_id uuid NOT NULL,
    reference_type text NOT NULL,
    reference_id uuid NOT NULL,
    table_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_subtask_references_reference_type_check CHECK ((reference_type = ANY (ARRAY['doc'::text, 'table_row'::text, 'task'::text, 'block'::text, 'tab'::text])))
);


--
-- Name: task_subtasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_subtasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    title text NOT NULL,
    completed boolean DEFAULT false,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    source_entity_type text,
    source_entity_id uuid,
    source_sync_mode text,
    CONSTRAINT task_subtasks_source_metadata_consistency CHECK ((((source_entity_type IS NULL) AND (source_entity_id IS NULL) AND (source_sync_mode IS NULL)) OR ((source_entity_type = ANY (ARRAY['task'::text, 'timeline_event'::text, 'table_row'::text, 'block'::text, 'subtask'::text])) AND (source_entity_id IS NOT NULL) AND (source_sync_mode = ANY (ARRAY['snapshot'::text, 'live'::text])))))
);


--
-- Name: task_tag_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_tag_links (
    task_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: timeline_dependencies; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: timeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    timeline_block_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    title text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
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
    source_entity_type text,
    source_entity_id uuid,
    source_sync_mode text,
    edited boolean DEFAULT false,
    priorities jsonb DEFAULT '[]'::jsonb NOT NULL,
    statuses jsonb DEFAULT '[]'::jsonb NOT NULL,
    assignee_team_id uuid,
    parent_event_id uuid,
    assignees jsonb DEFAULT '[]'::jsonb NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT timeline_events_date_order CHECK ((start_date <= end_date)),
    CONSTRAINT timeline_events_priorities_valid_check CHECK (public.is_valid_timeline_priorities(priorities)),
    CONSTRAINT timeline_events_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT timeline_events_source_metadata_consistency CHECK ((((source_entity_type IS NULL) AND (source_entity_id IS NULL) AND (source_sync_mode IS NULL)) OR ((source_entity_type = ANY (ARRAY['task'::text, 'timeline_event'::text, 'table_row'::text, 'block'::text, 'subtask'::text])) AND (source_entity_id IS NOT NULL) AND (source_sync_mode = ANY (ARRAY['snapshot'::text, 'live'::text]))))),
    CONSTRAINT timeline_events_source_sync_mode_check CHECK ((source_sync_mode = ANY (ARRAY['snapshot'::text, 'live'::text])))
);


--
-- Name: COLUMN timeline_events.edited; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_events.edited IS 'Tracks whether this snapshot has been modified by the user. Always false for original data (source_entity_id IS NULL). Set to true when user edits a snapshot.';


--
-- Name: COLUMN timeline_events.assignee_team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeline_events.assignee_team_id IS 'When set, the event is assigned to this workspace team (assignee_id is ignored for display).';


--
-- Name: timeline_references; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: trak_product_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trak_product_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variant_id uuid NOT NULL,
    location_id text NOT NULL,
    location_name text NOT NULL,
    available integer DEFAULT 0 NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trak_product_sales_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trak_product_sales_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    units_sold integer DEFAULT 0 NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trak_product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trak_product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    shopify_variant_id text NOT NULL,
    title text NOT NULL,
    sku text,
    barcode text,
    price numeric(10,2),
    compare_at_price numeric(10,2),
    option1_name text,
    option1_value text,
    option2_name text,
    option2_value text,
    option3_name text,
    option3_value text,
    inventory_item_id text,
    image_url text,
    available_for_sale boolean DEFAULT true,
    inventory_tracked boolean DEFAULT true,
    available_total integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trak_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trak_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    shopify_product_id text NOT NULL,
    title text NOT NULL,
    description text,
    product_type text,
    vendor text,
    tags text[] DEFAULT '{}'::text[],
    featured_image_url text,
    status text DEFAULT 'active'::text NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    shopify_created_at timestamp with time zone,
    shopify_updated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: unstructured_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unstructured_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding public.vector(1536),
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, content)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: unstructured_parents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unstructured_parents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_id uuid,
    tab_id uuid,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    summary text,
    summary_embedding public.vector(1536),
    content_hash text,
    last_indexed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_block_ids uuid[] DEFAULT ARRAY[]::uuid[],
    CONSTRAINT workflow_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: workflow_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    tab_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone
);


--
-- Name: workspace_invitations; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
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
    stripe_connected_at timestamp with time zone,
    organization_id uuid
);


--
-- Name: workspace_members_view; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: workspace_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_team_members (
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE workspace_team_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_team_members IS 'Junction: workspace members (user_id) in each team.';


--
-- Name: workspace_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE workspace_teams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_teams IS 'Teams are groups of workspace members; used when assigning to tasks/items.';


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hooks; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.hooks (
    id bigint NOT NULL,
    hook_table_id integer NOT NULL,
    hook_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id bigint
);


--
-- Name: TABLE hooks; Type: COMMENT; Schema: supabase_functions; Owner: -
--

COMMENT ON TABLE supabase_functions.hooks IS 'Supabase Functions Hooks: Audit trail for triggered hooks.';


--
-- Name: hooks_id_seq; Type: SEQUENCE; Schema: supabase_functions; Owner: -
--

CREATE SEQUENCE supabase_functions.hooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hooks_id_seq; Type: SEQUENCE OWNED BY; Schema: supabase_functions; Owner: -
--

ALTER SEQUENCE supabase_functions.hooks_id_seq OWNED BY supabase_functions.hooks.id;


--
-- Name: migrations; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.migrations (
    version text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: hooks id; Type: DEFAULT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks ALTER COLUMN id SET DEFAULT nextval('supabase_functions.hooks_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: block_highlights block_highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_highlights
    ADD CONSTRAINT block_highlights_pkey PRIMARY KEY (id);


--
-- Name: block_references block_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_references
    ADD CONSTRAINT block_references_pkey PRIMARY KEY (id);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);


--
-- Name: client_page_views client_page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_page_views
    ADD CONSTRAINT client_page_views_pkey PRIMARY KEY (id);


--
-- Name: client_tab_blocks client_tab_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tab_blocks
    ADD CONSTRAINT client_tab_blocks_pkey PRIMARY KEY (id);


--
-- Name: client_tabs client_tabs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tabs
    ADD CONSTRAINT client_tabs_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: dashboard_ai_insights dashboard_ai_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_ai_insights
    ADD CONSTRAINT dashboard_ai_insights_pkey PRIMARY KEY (id);


--
-- Name: dashboard_ai_insights dashboard_ai_insights_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_ai_insights
    ADD CONSTRAINT dashboard_ai_insights_workspace_id_key UNIQUE (workspace_id);


--
-- Name: doc_folders doc_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_folders
    ADD CONSTRAINT doc_folders_pkey PRIMARY KEY (id);


--
-- Name: docs docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_pkey PRIMARY KEY (id);


--
-- Name: entity_inherited_display entity_inherited_display_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_inherited_display
    ADD CONSTRAINT entity_inherited_display_pkey PRIMARY KEY (id);


--
-- Name: entity_inherited_display entity_inherited_display_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_inherited_display
    ADD CONSTRAINT entity_inherited_display_unique UNIQUE (entity_type, entity_id, source_entity_type, source_entity_id, property_definition_id);


--
-- Name: entity_links entity_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_links
    ADD CONSTRAINT entity_links_pkey PRIMARY KEY (id);


--
-- Name: entity_links entity_links_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_links
    ADD CONSTRAINT entity_links_unique UNIQUE (source_entity_type, source_entity_id, target_entity_type, target_entity_id);


--
-- Name: entity_properties_legacy entity_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_properties_legacy
    ADD CONSTRAINT entity_properties_pkey PRIMARY KEY (id);


--
-- Name: entity_properties entity_properties_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_properties
    ADD CONSTRAINT entity_properties_pkey1 PRIMARY KEY (id);


--
-- Name: entity_properties_legacy entity_properties_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_properties_legacy
    ADD CONSTRAINT entity_properties_unique UNIQUE (entity_type, entity_id);


--
-- Name: file_analysis_artifacts file_analysis_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_artifacts
    ADD CONSTRAINT file_analysis_artifacts_pkey PRIMARY KEY (id);


--
-- Name: file_analysis_chunks file_analysis_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_chunks
    ADD CONSTRAINT file_analysis_chunks_pkey PRIMARY KEY (id);


--
-- Name: file_analysis_citations file_analysis_citations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_citations
    ADD CONSTRAINT file_analysis_citations_pkey PRIMARY KEY (id);


--
-- Name: file_analysis_messages file_analysis_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_messages
    ADD CONSTRAINT file_analysis_messages_pkey PRIMARY KEY (id);


--
-- Name: file_analysis_session_files file_analysis_session_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_session_files
    ADD CONSTRAINT file_analysis_session_files_pkey PRIMARY KEY (id);


--
-- Name: file_analysis_sessions file_analysis_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_sessions
    ADD CONSTRAINT file_analysis_sessions_pkey PRIMARY KEY (id);


--
-- Name: file_attachments file_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_pkey PRIMARY KEY (id);


--
-- Name: file_comments file_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_comments
    ADD CONSTRAINT file_comments_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_connections google_calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (id);


--
-- Name: indexing_jobs indexing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indexing_jobs
    ADD CONSTRAINT indexing_jobs_pkey PRIMARY KEY (id);


--
-- Name: internal_space_groups internal_space_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_space_groups
    ADD CONSTRAINT internal_space_groups_pkey PRIMARY KEY (id);


--
-- Name: oauth_states oauth_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_states oauth_states_state_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_state_key UNIQUE (state);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_folders project_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_folders
    ADD CONSTRAINT project_folders_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_tags project_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tags
    ADD CONSTRAINT project_tags_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_public_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_public_token_key UNIQUE (public_token);


--
-- Name: shopify_connections shopify_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopify_connections
    ADD CONSTRAINT shopify_connections_pkey PRIMARY KEY (id);


--
-- Name: shopify_sync_jobs shopify_sync_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopify_sync_jobs
    ADD CONSTRAINT shopify_sync_jobs_pkey PRIMARY KEY (id);


--
-- Name: slack_command_audit_log slack_command_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_command_audit_log
    ADD CONSTRAINT slack_command_audit_log_pkey PRIMARY KEY (id);


--
-- Name: slack_idempotency_keys slack_idempotency_keys_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_idempotency_keys
    ADD CONSTRAINT slack_idempotency_keys_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: slack_idempotency_keys slack_idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_idempotency_keys
    ADD CONSTRAINT slack_idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: slack_rate_limits slack_rate_limits_identifier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_rate_limits
    ADD CONSTRAINT slack_rate_limits_identifier_key UNIQUE (identifier);


--
-- Name: slack_rate_limits slack_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_rate_limits
    ADD CONSTRAINT slack_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: slack_user_links slack_user_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_user_links
    ADD CONSTRAINT slack_user_links_pkey PRIMARY KEY (id);


--
-- Name: slack_workspace_connections slack_workspace_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_workspace_connections
    ADD CONSTRAINT slack_workspace_connections_pkey PRIMARY KEY (id);


--
-- Name: slack_workspace_connections slack_workspace_connections_slack_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_workspace_connections
    ADD CONSTRAINT slack_workspace_connections_slack_team_id_key UNIQUE (slack_team_id);


--
-- Name: tab_shares tab_shares_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tab_shares
    ADD CONSTRAINT tab_shares_access_token_key UNIQUE (access_token);


--
-- Name: tab_shares tab_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tab_shares
    ADD CONSTRAINT tab_shares_pkey PRIMARY KEY (id);


--
-- Name: table_comments table_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_comments
    ADD CONSTRAINT table_comments_pkey PRIMARY KEY (id);


--
-- Name: table_fields table_fields_order_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_fields
    ADD CONSTRAINT table_fields_order_unique UNIQUE (table_id, "order");


--
-- Name: table_fields table_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_fields
    ADD CONSTRAINT table_fields_pkey PRIMARY KEY (id);


--
-- Name: table_relations table_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_pkey PRIMARY KEY (id);


--
-- Name: table_relations table_relations_unique_link; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_unique_link UNIQUE (from_row_id, from_field_id, to_row_id);


--
-- Name: table_rows table_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_rows
    ADD CONSTRAINT table_rows_pkey PRIMARY KEY (id);


--
-- Name: table_views table_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_views
    ADD CONSTRAINT table_views_pkey PRIMARY KEY (id);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: tabs tabs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabs
    ADD CONSTRAINT tabs_pkey PRIMARY KEY (id);


--
-- Name: task_assignees task_assignees_unique_assignee; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_unique_assignee UNIQUE (task_id, assignee_id, assignee_name);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_items task_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_pkey PRIMARY KEY (id);


--
-- Name: task_references task_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_pkey PRIMARY KEY (id);


--
-- Name: task_subtask_references task_subtask_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_subtask_references
    ADD CONSTRAINT task_subtask_references_pkey PRIMARY KEY (id);


--
-- Name: task_subtasks task_subtasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_subtasks
    ADD CONSTRAINT task_subtasks_pkey PRIMARY KEY (id);


--
-- Name: task_tag_links task_tag_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_pkey PRIMARY KEY (task_id, tag_id);


--
-- Name: task_tags task_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_pkey PRIMARY KEY (id);


--
-- Name: task_tags task_tags_workspace_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_workspace_id_name_key UNIQUE (workspace_id, name);


--
-- Name: timeline_dependencies timeline_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_pkey PRIMARY KEY (id);


--
-- Name: timeline_events timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_pkey PRIMARY KEY (id);


--
-- Name: timeline_references timeline_references_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_pkey PRIMARY KEY (id);


--
-- Name: trak_product_inventory trak_product_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_product_inventory
    ADD CONSTRAINT trak_product_inventory_pkey PRIMARY KEY (id);


--
-- Name: trak_product_sales_cache trak_product_sales_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_product_sales_cache
    ADD CONSTRAINT trak_product_sales_cache_pkey PRIMARY KEY (id);


--
-- Name: trak_product_variants trak_product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_product_variants
    ADD CONSTRAINT trak_product_variants_pkey PRIMARY KEY (id);


--
-- Name: trak_products trak_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_products
    ADD CONSTRAINT trak_products_pkey PRIMARY KEY (id);


--
-- Name: workflow_sessions unique_workflow_session_per_tab; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_sessions
    ADD CONSTRAINT unique_workflow_session_per_tab UNIQUE (tab_id);


--
-- Name: unstructured_chunks unstructured_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unstructured_chunks
    ADD CONSTRAINT unstructured_chunks_pkey PRIMARY KEY (id);


--
-- Name: unstructured_parents unstructured_parents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unstructured_parents
    ADD CONSTRAINT unstructured_parents_pkey PRIMARY KEY (id);


--
-- Name: unstructured_parents unstructured_parents_source_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unstructured_parents
    ADD CONSTRAINT unstructured_parents_source_unique UNIQUE (source_id, source_type);


--
-- Name: shopify_connections uq_shopify_connections_workspace_shop; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopify_connections
    ADD CONSTRAINT uq_shopify_connections_workspace_shop UNIQUE (workspace_id, shop_domain);


--
-- Name: slack_user_links uq_slack_user_link_per_team; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_user_links
    ADD CONSTRAINT uq_slack_user_link_per_team UNIQUE (slack_connection_id, slack_user_id);


--
-- Name: slack_workspace_connections uq_slack_workspace_per_trak_workspace; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_workspace_connections
    ADD CONSTRAINT uq_slack_workspace_per_trak_workspace UNIQUE (workspace_id);


--
-- Name: trak_product_inventory uq_trak_product_inventory_variant_location; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_product_inventory
    ADD CONSTRAINT uq_trak_product_inventory_variant_location UNIQUE (variant_id, location_id);


--
-- Name: trak_product_sales_cache uq_trak_product_sales_cache_product_dates; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_product_sales_cache
    ADD CONSTRAINT uq_trak_product_sales_cache_product_dates UNIQUE (product_id, start_date, end_date);


--
-- Name: trak_product_variants uq_trak_product_variants_product_shopify_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_product_variants
    ADD CONSTRAINT uq_trak_product_variants_product_shopify_id UNIQUE (product_id, shopify_variant_id);


--
-- Name: trak_products uq_trak_products_connection_shopify_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_products
    ADD CONSTRAINT uq_trak_products_connection_shopify_id UNIQUE (connection_id, shopify_product_id);


--
-- Name: workflow_messages workflow_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_messages
    ADD CONSTRAINT workflow_messages_pkey PRIMARY KEY (id);


--
-- Name: workflow_sessions workflow_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_sessions
    ADD CONSTRAINT workflow_sessions_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_token_key UNIQUE (token);


--
-- Name: workspace_invitations workspace_invitations_workspace_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_email_key UNIQUE (workspace_id, email);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspace_team_members workspace_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_team_members
    ADD CONSTRAINT workspace_team_members_pkey PRIMARY KEY (team_id, user_id);


--
-- Name: workspace_teams workspace_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_teams
    ADD CONSTRAINT workspace_teams_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_stripe_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_stripe_account_id_key UNIQUE (stripe_account_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: hooks hooks_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks
    ADD CONSTRAINT hooks_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (version);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: idx_block_highlights_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_highlights_block ON public.block_highlights USING btree (block_id);


--
-- Name: idx_block_references_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_references_block ON public.block_references USING btree (block_id);


--
-- Name: idx_block_references_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_references_target ON public.block_references USING btree (reference_type, reference_id);


--
-- Name: idx_block_references_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_references_workspace ON public.block_references USING btree (workspace_id);


--
-- Name: idx_blocks_column_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_column_position ON public.blocks USING btree (tab_id, "column", "position") WHERE (parent_block_id IS NULL);


--
-- Name: idx_blocks_gin_content; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_gin_content ON public.blocks USING gin (content);


--
-- Name: idx_blocks_id_tab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_id_tab ON public.blocks USING btree (id, tab_id);


--
-- Name: INDEX idx_blocks_id_tab; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_blocks_id_tab IS 'Optimizes file_attachments RLS policy join: blocks.id → blocks.tab_id';


--
-- Name: idx_blocks_is_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_is_template ON public.blocks USING btree (is_template) WHERE (is_template = true);


--
-- Name: idx_blocks_locked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_locked ON public.blocks USING btree (locked);


--
-- Name: idx_blocks_original_block_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_original_block_id ON public.blocks USING btree (original_block_id) WHERE (original_block_id IS NOT NULL);


--
-- Name: idx_blocks_parent_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_parent_position ON public.blocks USING btree (parent_block_id, "position") WHERE (parent_block_id IS NOT NULL);


--
-- Name: INDEX idx_blocks_parent_position; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_blocks_parent_position IS 'Optimizes getChildBlocks() queries for nested section blocks';


--
-- Name: idx_blocks_tab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_tab ON public.blocks USING btree (tab_id);


--
-- Name: idx_blocks_tab_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_tab_position ON public.blocks USING btree (tab_id, "position");


--
-- Name: idx_blocks_tab_toplevel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_tab_toplevel ON public.blocks USING btree (tab_id, "column", "position") WHERE (parent_block_id IS NULL);


--
-- Name: idx_client_page_views_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_page_views_project ON public.client_page_views USING btree (project_id, viewed_at DESC);


--
-- Name: idx_client_page_views_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_page_views_session ON public.client_page_views USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: idx_client_page_views_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_page_views_token ON public.client_page_views USING btree (public_token, viewed_at DESC);


--
-- Name: idx_client_tab_blocks_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_tab_blocks_position ON public.client_tab_blocks USING btree (tab_id, "column", "position");


--
-- Name: idx_client_tab_blocks_tab_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_tab_blocks_tab_id ON public.client_tab_blocks USING btree (tab_id);


--
-- Name: idx_client_tabs_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_tabs_client_id ON public.client_tabs USING btree (client_id);


--
-- Name: idx_client_tabs_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_tabs_position ON public.client_tabs USING btree (client_id, "position");


--
-- Name: idx_clients_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_workspace ON public.clients USING btree (workspace_id, name);


--
-- Name: idx_clients_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_ws ON public.clients USING btree (workspace_id);


--
-- Name: idx_comments_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_target ON public.comments USING btree (target_type, target_id);


--
-- Name: idx_dashboard_ai_insights_generated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_ai_insights_generated_at ON public.dashboard_ai_insights USING btree (generated_at DESC);


--
-- Name: idx_dashboard_ai_insights_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_ai_insights_workspace ON public.dashboard_ai_insights USING btree (workspace_id);


--
-- Name: idx_doc_folders_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_folders_workspace_id ON public.doc_folders USING btree (workspace_id);


--
-- Name: idx_docs_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_archived ON public.docs USING btree (is_archived);


--
-- Name: idx_docs_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_created_by ON public.docs USING btree (created_by);


--
-- Name: idx_docs_folder_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_folder_id ON public.docs USING btree (folder_id);


--
-- Name: idx_docs_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_updated_at ON public.docs USING btree (updated_at DESC);


--
-- Name: idx_docs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_workspace ON public.docs USING btree (workspace_id);


--
-- Name: idx_entity_inherited_display_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_inherited_display_entity ON public.entity_inherited_display USING btree (entity_type, entity_id);


--
-- Name: idx_entity_inherited_display_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_inherited_display_source ON public.entity_inherited_display USING btree (source_entity_type, source_entity_id);


--
-- Name: idx_entity_links_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_links_source ON public.entity_links USING btree (source_entity_type, source_entity_id);


--
-- Name: idx_entity_links_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_links_target ON public.entity_links USING btree (target_entity_type, target_entity_id);


--
-- Name: idx_entity_links_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_links_workspace ON public.entity_links USING btree (workspace_id);


--
-- Name: idx_entity_properties_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_assignee ON public.entity_properties_legacy USING btree (assignee_id) WHERE (assignee_id IS NOT NULL);


--
-- Name: idx_entity_properties_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_due_date ON public.entity_properties_legacy USING btree (workspace_id, due_date) WHERE (due_date IS NOT NULL);


--
-- Name: idx_entity_properties_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_entity ON public.entity_properties_legacy USING btree (entity_type, entity_id);


--
-- Name: idx_entity_properties_entity_field_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_entity_field_type ON public.entity_properties USING btree (entity_id, field_type);


--
-- Name: idx_entity_properties_entity_id_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_entity_id_entity_type ON public.entity_properties USING btree (entity_id, entity_type);


--
-- Name: idx_entity_properties_entity_type_subtype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_entity_type_subtype ON public.entity_properties USING btree (entity_type, entity_subtype);


--
-- Name: idx_entity_properties_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_priority ON public.entity_properties_legacy USING btree (workspace_id, priority) WHERE (priority IS NOT NULL);


--
-- Name: idx_entity_properties_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_status ON public.entity_properties_legacy USING btree (workspace_id, status) WHERE (status IS NOT NULL);


--
-- Name: idx_entity_properties_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_tags ON public.entity_properties_legacy USING gin (tags);


--
-- Name: idx_entity_properties_tags_value_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_tags_value_trgm ON public.entity_properties USING gin (lower((value)::text) public.gin_trgm_ops) WHERE (field_type = 'tags'::text);


--
-- Name: idx_entity_properties_unique_named_field; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_entity_properties_unique_named_field ON public.entity_properties USING btree (entity_type, entity_id, field_name);


--
-- Name: idx_entity_properties_value_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_value_gin ON public.entity_properties USING gin (value);


--
-- Name: idx_entity_properties_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_workspace ON public.entity_properties_legacy USING btree (workspace_id);


--
-- Name: idx_entity_properties_workspace_field_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_properties_workspace_field_type ON public.entity_properties USING btree (workspace_id, field_type);


--
-- Name: idx_entity_props_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_props_entity ON public.entity_properties USING btree (entity_type, entity_id, workspace_id);


--
-- Name: idx_entity_props_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_props_entity_id ON public.entity_properties USING btree (entity_id);


--
-- Name: idx_entity_props_value_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_props_value_gin ON public.entity_properties USING gin (value);


--
-- Name: idx_file_analysis_artifacts_file; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_file_analysis_artifacts_file ON public.file_analysis_artifacts USING btree (file_id);


--
-- Name: idx_file_analysis_chunks_artifact_index; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_file_analysis_chunks_artifact_index ON public.file_analysis_chunks USING btree (artifact_id, chunk_index);


--
-- Name: idx_file_analysis_chunks_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_analysis_chunks_file ON public.file_analysis_chunks USING btree (file_id);


--
-- Name: idx_file_analysis_citations_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_analysis_citations_message ON public.file_analysis_citations USING btree (message_id);


--
-- Name: idx_file_analysis_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_analysis_messages_session ON public.file_analysis_messages USING btree (session_id, created_at);


--
-- Name: idx_file_analysis_session_files_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_file_analysis_session_files_unique ON public.file_analysis_session_files USING btree (session_id, file_id);


--
-- Name: idx_file_analysis_sessions_user_project; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_file_analysis_sessions_user_project ON public.file_analysis_sessions USING btree (user_id, project_id) WHERE ((tab_id IS NULL) AND (project_id IS NOT NULL));


--
-- Name: idx_file_analysis_sessions_user_tab; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_file_analysis_sessions_user_tab ON public.file_analysis_sessions USING btree (user_id, tab_id) WHERE (tab_id IS NOT NULL);


--
-- Name: idx_file_analysis_sessions_user_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_file_analysis_sessions_user_workspace ON public.file_analysis_sessions USING btree (user_id, workspace_id) WHERE ((tab_id IS NULL) AND (project_id IS NULL));


--
-- Name: idx_file_attachments_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_attachments_block ON public.file_attachments USING btree (block_id);


--
-- Name: idx_file_attachments_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_attachments_file ON public.file_attachments USING btree (file_id);


--
-- Name: idx_file_comments_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_comments_file ON public.file_comments USING btree (file_id, created_at);


--
-- Name: idx_files_bucket_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_bucket_path ON public.files USING btree (bucket, storage_path);


--
-- Name: idx_files_id_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_id_workspace ON public.files USING btree (id, workspace_id);


--
-- Name: INDEX idx_files_id_workspace; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_files_id_workspace IS 'Optimizes batched file URL generation with workspace verification';


--
-- Name: idx_files_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_project ON public.files USING btree (project_id);


--
-- Name: idx_files_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_files_ws ON public.files USING btree (workspace_id);


--
-- Name: idx_google_calendar_connections_user_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_google_calendar_connections_user_workspace ON public.google_calendar_connections USING btree (user_id, workspace_id);


--
-- Name: idx_google_calendar_connections_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_google_calendar_connections_workspace ON public.google_calendar_connections USING btree (workspace_id);


--
-- Name: idx_indexing_jobs_processing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indexing_jobs_processing ON public.indexing_jobs USING btree (status, created_at) WHERE (status = 'pending'::text);


--
-- Name: idx_indexing_jobs_resource_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_indexing_jobs_resource_unique ON public.indexing_jobs USING btree (resource_type, resource_id);


--
-- Name: idx_internal_space_groups_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_space_groups_workspace_id ON public.internal_space_groups USING btree (workspace_id);


--
-- Name: idx_oauth_states_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states USING btree (expires_at);


--
-- Name: idx_oauth_states_state_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oauth_states_state_provider ON public.oauth_states USING btree (state, provider);


--
-- Name: idx_organization_members_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_members_organization_id ON public.organization_members USING btree (organization_id);


--
-- Name: idx_organization_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_members_user_id ON public.organization_members USING btree (user_id);


--
-- Name: idx_organizations_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_name ON public.organizations USING btree (name);


--
-- Name: idx_payment_events_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_events_payment ON public.payment_events USING btree (payment_id);


--
-- Name: idx_payments_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_client ON public.payments USING btree (client_id);


--
-- Name: idx_payments_payment_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_payment_number ON public.payments USING btree (payment_number);


--
-- Name: idx_payments_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_project ON public.payments USING btree (project_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_ws ON public.payments USING btree (workspace_id);


--
-- Name: idx_project_folders_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_folders_workspace_id ON public.project_folders USING btree (workspace_id);


--
-- Name: idx_project_members_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_members_project_id ON public.project_members USING btree (project_id);


--
-- Name: idx_project_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_members_user_id ON public.project_members USING btree (user_id);


--
-- Name: idx_project_tags_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_tags_project_id ON public.project_tags USING btree (project_id);


--
-- Name: idx_project_tags_project_id_name_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_project_tags_project_id_name_lower ON public.project_tags USING btree (project_id, lower(TRIM(BOTH FROM name)));


--
-- Name: idx_projects_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_client ON public.projects USING btree (client_id);


--
-- Name: idx_projects_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_created_at ON public.projects USING btree (workspace_id, created_at DESC);


--
-- Name: idx_projects_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_due_date ON public.projects USING btree (workspace_id, due_date_date DESC NULLS LAST);


--
-- Name: idx_projects_folder_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_folder_id ON public.projects USING btree (folder_id);


--
-- Name: idx_projects_internal_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_internal_group_id ON public.projects USING btree (internal_group_id);


--
-- Name: idx_projects_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_name ON public.projects USING btree (workspace_id, name);


--
-- Name: idx_projects_public_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_public_token ON public.projects USING btree (public_token) WHERE (public_token IS NOT NULL);


--
-- Name: idx_projects_public_token_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_public_token_enabled ON public.projects USING btree (public_token, client_page_enabled) WHERE ((public_token IS NOT NULL) AND (client_page_enabled = true));


--
-- Name: INDEX idx_projects_public_token_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_projects_public_token_enabled IS 'Optimizes public client page token validation queries';


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (workspace_id, status);


--
-- Name: idx_projects_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_type ON public.projects USING btree (project_type);


--
-- Name: idx_projects_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_updated_at ON public.projects USING btree (workspace_id, updated_at DESC);


--
-- Name: idx_projects_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_workspace ON public.projects USING btree (workspace_id, id);


--
-- Name: idx_projects_workspace_analysis_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_projects_workspace_analysis_unique ON public.projects USING btree (workspace_id) WHERE (is_workspace_analysis_project = true);


--
-- Name: idx_projects_workspace_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_workspace_type ON public.projects USING btree (workspace_id, project_type) WHERE (project_type = 'project'::text);


--
-- Name: idx_projects_workspace_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_workspace_type_status ON public.projects USING btree (workspace_id, project_type, status, created_at DESC);


--
-- Name: idx_projects_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_ws ON public.projects USING btree (workspace_id);


--
-- Name: idx_shopify_connections_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shopify_connections_sync_status ON public.shopify_connections USING btree (sync_status);


--
-- Name: idx_shopify_connections_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shopify_connections_workspace_id ON public.shopify_connections USING btree (workspace_id);


--
-- Name: idx_shopify_sync_jobs_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shopify_sync_jobs_connection_id ON public.shopify_sync_jobs USING btree (connection_id);


--
-- Name: idx_shopify_sync_jobs_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shopify_sync_jobs_status_created ON public.shopify_sync_jobs USING btree (status, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));


--
-- Name: idx_shopify_sync_jobs_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shopify_sync_jobs_workspace_id ON public.shopify_sync_jobs USING btree (workspace_id);


--
-- Name: idx_slack_command_audit_log_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_command_audit_log_connection_id ON public.slack_command_audit_log USING btree (slack_connection_id);


--
-- Name: idx_slack_command_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_command_audit_log_created_at ON public.slack_command_audit_log USING btree (created_at DESC);


--
-- Name: idx_slack_command_audit_log_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_command_audit_log_request_id ON public.slack_command_audit_log USING btree (request_id) WHERE (request_id IS NOT NULL);


--
-- Name: idx_slack_command_audit_log_slack_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_command_audit_log_slack_user_id ON public.slack_command_audit_log USING btree (slack_user_id);


--
-- Name: idx_slack_command_audit_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_command_audit_log_status ON public.slack_command_audit_log USING btree (response_status);


--
-- Name: idx_slack_command_audit_log_trak_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_command_audit_log_trak_user_id ON public.slack_command_audit_log USING btree (trak_user_id);


--
-- Name: idx_slack_idempotency_keys_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_idempotency_keys_expires_at ON public.slack_idempotency_keys USING btree (expires_at);


--
-- Name: idx_slack_idempotency_keys_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_idempotency_keys_key ON public.slack_idempotency_keys USING btree (idempotency_key);


--
-- Name: idx_slack_rate_limits_identifier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_rate_limits_identifier ON public.slack_rate_limits USING btree (identifier);


--
-- Name: idx_slack_rate_limits_window_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_rate_limits_window_start ON public.slack_rate_limits USING btree (window_start);


--
-- Name: idx_slack_user_links_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_user_links_connection_id ON public.slack_user_links USING btree (slack_connection_id);


--
-- Name: idx_slack_user_links_slack_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_user_links_slack_user_id ON public.slack_user_links USING btree (slack_user_id);


--
-- Name: idx_slack_user_links_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_user_links_status ON public.slack_user_links USING btree (link_status);


--
-- Name: idx_slack_user_links_trak_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_user_links_trak_user_id ON public.slack_user_links USING btree (trak_user_id);


--
-- Name: idx_slack_workspace_connections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_workspace_connections_status ON public.slack_workspace_connections USING btree (connection_status);


--
-- Name: idx_slack_workspace_connections_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_workspace_connections_team_id ON public.slack_workspace_connections USING btree (slack_team_id);


--
-- Name: idx_slack_workspace_connections_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slack_workspace_connections_workspace_id ON public.slack_workspace_connections USING btree (workspace_id);


--
-- Name: idx_tab_shares_tab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tab_shares_tab ON public.tab_shares USING btree (tab_id);


--
-- Name: idx_table_comments_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_comments_parent_id ON public.table_comments USING btree (parent_id);


--
-- Name: idx_table_comments_row_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_comments_row_id ON public.table_comments USING btree (row_id);


--
-- Name: idx_table_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_comments_user_id ON public.table_comments USING btree (user_id);


--
-- Name: idx_table_fields_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_fields_order ON public.table_fields USING btree (table_id, "order");


--
-- Name: idx_table_fields_table_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_fields_table_id ON public.table_fields USING btree (table_id);


--
-- Name: idx_table_fields_table_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_fields_table_order ON public.table_fields USING btree (table_id, "order");


--
-- Name: idx_table_relations_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_relations_from ON public.table_relations USING btree (from_row_id, from_field_id);


--
-- Name: idx_table_relations_from_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_relations_from_table ON public.table_relations USING btree (from_table_id);


--
-- Name: idx_table_relations_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_relations_to ON public.table_relations USING btree (to_row_id);


--
-- Name: idx_table_relations_to_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_relations_to_table ON public.table_relations USING btree (to_table_id);


--
-- Name: idx_table_rows_data_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_rows_data_gin ON public.table_rows USING gin (data);


--
-- Name: idx_table_rows_data_text_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_rows_data_text_trgm ON public.table_rows USING gin (lower((data)::text) public.gin_trgm_ops);


--
-- Name: idx_table_rows_edited; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_rows_edited ON public.table_rows USING btree (edited) WHERE (source_entity_id IS NOT NULL);


--
-- Name: idx_table_rows_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_rows_order ON public.table_rows USING btree (table_id, "order");


--
-- Name: idx_table_rows_source_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_rows_source_entity ON public.table_rows USING btree (source_entity_type, source_entity_id) WHERE (source_entity_id IS NOT NULL);


--
-- Name: idx_table_rows_source_sync_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_rows_source_sync_mode ON public.table_rows USING btree (source_sync_mode) WHERE (source_entity_id IS NOT NULL);


--
-- Name: idx_table_rows_table_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_rows_table_id ON public.table_rows USING btree (table_id);


--
-- Name: idx_table_rows_table_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_rows_table_order ON public.table_rows USING btree (table_id, "order");


--
-- Name: idx_table_views_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_views_created_by ON public.table_views USING btree (created_by);


--
-- Name: idx_table_views_default_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_table_views_default_unique ON public.table_views USING btree (table_id) WHERE is_default;


--
-- Name: idx_table_views_table_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_views_table_id ON public.table_views USING btree (table_id);


--
-- Name: idx_tables_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tables_created_by ON public.tables USING btree (created_by);


--
-- Name: idx_tables_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tables_project_id ON public.tables USING btree (project_id);


--
-- Name: idx_tables_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tables_title_trgm ON public.tables USING gin (lower(title) public.gin_trgm_ops);


--
-- Name: idx_tables_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tables_workspace_id ON public.tables USING btree (workspace_id);


--
-- Name: idx_tabs_client_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tabs_client_visible ON public.tabs USING btree (project_id, is_client_visible) WHERE (is_client_visible = true);


--
-- Name: idx_tabs_id_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tabs_id_project ON public.tabs USING btree (id, project_id);


--
-- Name: INDEX idx_tabs_id_project; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_tabs_id_project IS 'Optimizes blocks RLS policy join: tabs.id → tabs.project_id';


--
-- Name: idx_tabs_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tabs_parent ON public.tabs USING btree (parent_tab_id);


--
-- Name: idx_tabs_parent_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tabs_parent_project ON public.tabs USING btree (project_id, parent_tab_id, "position");


--
-- Name: idx_tabs_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tabs_project ON public.tabs USING btree (project_id);


--
-- Name: idx_tabs_project_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tabs_project_position ON public.tabs USING btree (project_id, "position");


--
-- Name: idx_tabs_workflow_pages; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tabs_workflow_pages ON public.tabs USING btree (project_id, is_workflow_page) WHERE (is_workflow_page = true);


--
-- Name: idx_task_assignees_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignees_assignee ON public.task_assignees USING btree (assignee_id);


--
-- Name: idx_task_assignees_assignee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignees_assignee_id ON public.task_assignees USING btree (assignee_id) WHERE (assignee_id IS NOT NULL);


--
-- Name: idx_task_assignees_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignees_task ON public.task_assignees USING btree (task_id);


--
-- Name: idx_task_assignees_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignees_task_id ON public.task_assignees USING btree (task_id);


--
-- Name: idx_task_comments_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_comments_task ON public.task_comments USING btree (task_id);


--
-- Name: idx_task_comments_task_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_comments_task_created ON public.task_comments USING btree (task_id, created_at);


--
-- Name: idx_task_items_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_assignee ON public.task_items USING btree (assignee_id);


--
-- Name: idx_task_items_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_block ON public.task_items USING btree (task_block_id);


--
-- Name: idx_task_items_block_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_block_order ON public.task_items USING btree (task_block_id, display_order);


--
-- Name: idx_task_items_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_due ON public.task_items USING btree (due_date);


--
-- Name: idx_task_items_edited; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_edited ON public.task_items USING btree (edited) WHERE (source_entity_id IS NOT NULL);


--
-- Name: idx_task_items_source_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_source_entity ON public.task_items USING btree (source_entity_type, source_entity_id) WHERE (source_entity_id IS NOT NULL);


--
-- Name: idx_task_items_source_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_source_task_id ON public.task_items USING btree (source_task_id) WHERE (source_task_id IS NOT NULL);


--
-- Name: idx_task_items_sync_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_sync_mode ON public.task_items USING btree (source_sync_mode) WHERE (source_task_id IS NOT NULL);


--
-- Name: idx_task_items_tab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_tab ON public.task_items USING btree (tab_id);


--
-- Name: idx_task_items_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_items_workspace ON public.task_items USING btree (workspace_id);


--
-- Name: idx_task_references_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_references_table ON public.task_references USING btree (table_id) WHERE (table_id IS NOT NULL);


--
-- Name: idx_task_references_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_references_target ON public.task_references USING btree (reference_type, reference_id);


--
-- Name: idx_task_references_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_references_task ON public.task_references USING btree (task_id);


--
-- Name: idx_task_references_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_references_workspace ON public.task_references USING btree (workspace_id);


--
-- Name: idx_task_subtask_references_subtask; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_subtask_references_subtask ON public.task_subtask_references USING btree (subtask_id);


--
-- Name: idx_task_subtask_references_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_subtask_references_table ON public.task_subtask_references USING btree (table_id) WHERE (table_id IS NOT NULL);


--
-- Name: idx_task_subtask_references_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_subtask_references_target ON public.task_subtask_references USING btree (reference_type, reference_id);


--
-- Name: idx_task_subtask_references_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_subtask_references_workspace ON public.task_subtask_references USING btree (workspace_id);


--
-- Name: idx_task_subtasks_source_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_subtasks_source_entity_id ON public.task_subtasks USING btree (source_entity_id) WHERE (source_entity_id IS NOT NULL);


--
-- Name: idx_task_subtasks_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_subtasks_task ON public.task_subtasks USING btree (task_id);


--
-- Name: idx_task_subtasks_task_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_subtasks_task_order ON public.task_subtasks USING btree (task_id, display_order);


--
-- Name: idx_task_tag_links_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_tag_links_tag ON public.task_tag_links USING btree (tag_id);


--
-- Name: idx_task_tag_links_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_tag_links_task ON public.task_tag_links USING btree (task_id);


--
-- Name: idx_task_tags_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_tags_workspace ON public.task_tags USING btree (workspace_id);


--
-- Name: idx_timeline_dependencies_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_dependencies_block ON public.timeline_dependencies USING btree (timeline_block_id);


--
-- Name: idx_timeline_dependencies_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_dependencies_from ON public.timeline_dependencies USING btree (from_id);


--
-- Name: idx_timeline_dependencies_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_dependencies_to ON public.timeline_dependencies USING btree (to_id);


--
-- Name: idx_timeline_dependencies_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_timeline_dependencies_unique ON public.timeline_dependencies USING btree (timeline_block_id, from_id, to_id);


--
-- Name: idx_timeline_events_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_assignee ON public.timeline_events USING btree (assignee_id);


--
-- Name: idx_timeline_events_assignee_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_assignee_team_id ON public.timeline_events USING btree (assignee_team_id) WHERE (assignee_team_id IS NOT NULL);


--
-- Name: idx_timeline_events_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_block ON public.timeline_events USING btree (timeline_block_id);


--
-- Name: idx_timeline_events_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_dates ON public.timeline_events USING btree (start_date, end_date);


--
-- Name: idx_timeline_events_edited; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_edited ON public.timeline_events USING btree (edited) WHERE (source_entity_id IS NOT NULL);


--
-- Name: idx_timeline_events_parent_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_parent_event_id ON public.timeline_events USING btree (parent_event_id) WHERE (parent_event_id IS NOT NULL);


--
-- Name: idx_timeline_events_priorities_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_priorities_gin ON public.timeline_events USING gin (priorities);


--
-- Name: idx_timeline_events_source_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_source_entity ON public.timeline_events USING btree (source_entity_type, source_entity_id) WHERE (source_entity_id IS NOT NULL);


--
-- Name: idx_timeline_events_source_sync_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_source_sync_mode ON public.timeline_events USING btree (source_sync_mode) WHERE (source_entity_id IS NOT NULL);


--
-- Name: idx_timeline_events_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_events_workspace ON public.timeline_events USING btree (workspace_id);


--
-- Name: idx_timeline_references_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_references_event ON public.timeline_references USING btree (event_id);


--
-- Name: idx_timeline_references_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_references_table ON public.timeline_references USING btree (table_id) WHERE (table_id IS NOT NULL);


--
-- Name: idx_timeline_references_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_references_target ON public.timeline_references USING btree (reference_type, reference_id);


--
-- Name: idx_timeline_references_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_references_workspace ON public.timeline_references USING btree (workspace_id);


--
-- Name: idx_trak_product_inventory_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_product_inventory_location_id ON public.trak_product_inventory USING btree (location_id);


--
-- Name: idx_trak_product_inventory_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_product_inventory_variant_id ON public.trak_product_inventory USING btree (variant_id);


--
-- Name: idx_trak_product_sales_cache_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_product_sales_cache_dates ON public.trak_product_sales_cache USING btree (start_date, end_date);


--
-- Name: idx_trak_product_sales_cache_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_product_sales_cache_product_id ON public.trak_product_sales_cache USING btree (product_id);


--
-- Name: idx_trak_product_variants_inventory_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_product_variants_inventory_item_id ON public.trak_product_variants USING btree (inventory_item_id);


--
-- Name: idx_trak_product_variants_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_product_variants_product_id ON public.trak_product_variants USING btree (product_id);


--
-- Name: idx_trak_product_variants_shopify_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_product_variants_shopify_variant_id ON public.trak_product_variants USING btree (shopify_variant_id);


--
-- Name: idx_trak_product_variants_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_product_variants_sku ON public.trak_product_variants USING btree (sku) WHERE (sku IS NOT NULL);


--
-- Name: idx_trak_products_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_products_connection_id ON public.trak_products USING btree (connection_id);


--
-- Name: idx_trak_products_shopify_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_products_shopify_product_id ON public.trak_products USING btree (shopify_product_id);


--
-- Name: idx_trak_products_title_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_products_title_search ON public.trak_products USING gin (to_tsvector('english'::regconfig, title));


--
-- Name: idx_trak_products_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trak_products_workspace_id ON public.trak_products USING btree (workspace_id);


--
-- Name: idx_unstructured_chunks_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unstructured_chunks_fts ON public.unstructured_chunks USING gin (fts);


--
-- Name: idx_unstructured_chunks_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unstructured_chunks_parent ON public.unstructured_chunks USING btree (parent_id);


--
-- Name: idx_unstructured_parents_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unstructured_parents_source ON public.unstructured_parents USING btree (source_id, source_type);


--
-- Name: idx_unstructured_parents_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unstructured_parents_workspace ON public.unstructured_parents USING btree (workspace_id);


--
-- Name: idx_workflow_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_messages_session ON public.workflow_messages USING btree (session_id, created_at);


--
-- Name: idx_workflow_sessions_tab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_sessions_tab ON public.workflow_sessions USING btree (tab_id);


--
-- Name: idx_workflow_sessions_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_sessions_workspace ON public.workflow_sessions USING btree (workspace_id, created_at);


--
-- Name: idx_workspace_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_user ON public.workspace_members USING btree (user_id);


--
-- Name: idx_workspace_members_workspace_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_workspace_user ON public.workspace_members USING btree (workspace_id, user_id);


--
-- Name: idx_workspace_members_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_ws ON public.workspace_members USING btree (workspace_id);


--
-- Name: idx_workspace_team_members_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_team_members_team_id ON public.workspace_team_members USING btree (team_id);


--
-- Name: idx_workspace_team_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_team_members_user_id ON public.workspace_team_members USING btree (user_id);


--
-- Name: idx_workspace_teams_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_teams_workspace_id ON public.workspace_teams USING btree (workspace_id);


--
-- Name: idx_workspaces_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_organization_id ON public.workspaces USING btree (organization_id);


--
-- Name: idx_workspaces_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_owner ON public.workspaces USING btree (owner_id);


--
-- Name: idx_workspaces_stripe_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_stripe_account ON public.workspaces USING btree (stripe_account_id);


--
-- Name: tables_tab_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tables_tab_id_idx ON public.tables USING btree (tab_id);


--
-- Name: uq_clients_ws_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_clients_ws_email ON public.clients USING btree (workspace_id, email) WHERE (email IS NOT NULL);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: supabase_functions_hooks_h_table_id_h_name_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name);


--
-- Name: supabase_functions_hooks_request_id_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: block_references block_references_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER block_references_set_updated_at BEFORE UPDATE ON public.block_references FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: blocks cleanup_entity_properties_on_block_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_entity_properties_on_block_delete_trigger BEFORE DELETE ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.cleanup_entity_properties_on_block_delete();


--
-- Name: task_subtasks cleanup_entity_properties_on_subtask_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_entity_properties_on_subtask_delete_trigger BEFORE DELETE ON public.task_subtasks FOR EACH ROW EXECUTE FUNCTION public.cleanup_entity_properties_on_subtask_delete();


--
-- Name: table_rows cleanup_entity_properties_on_table_row_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_entity_properties_on_table_row_delete_trigger BEFORE DELETE ON public.table_rows FOR EACH ROW EXECUTE FUNCTION public.cleanup_entity_properties_on_table_row_delete();


--
-- Name: task_items cleanup_entity_properties_on_task_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_entity_properties_on_task_delete_trigger BEFORE DELETE ON public.task_items FOR EACH ROW EXECUTE FUNCTION public.cleanup_entity_properties_on_task_delete();


--
-- Name: timeline_events cleanup_entity_properties_on_timeline_event_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_entity_properties_on_timeline_event_delete_trigger BEFORE DELETE ON public.timeline_events FOR EACH ROW EXECUTE FUNCTION public.cleanup_entity_properties_on_timeline_event_delete();


--
-- Name: blocks cleanup_search_index_on_block_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_search_index_on_block_delete AFTER DELETE ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.cleanup_unstructured_on_source_delete('block');


--
-- Name: docs cleanup_search_index_on_doc_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_search_index_on_doc_delete AFTER DELETE ON public.docs FOR EACH ROW EXECUTE FUNCTION public.cleanup_unstructured_on_source_delete('doc');


--
-- Name: files cleanup_search_index_on_file_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_search_index_on_file_delete AFTER DELETE ON public.files FOR EACH ROW EXECUTE FUNCTION public.cleanup_unstructured_on_source_delete('file');


--
-- Name: tables cleanup_search_index_on_table_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cleanup_search_index_on_table_delete AFTER DELETE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.cleanup_unstructured_on_source_delete('table');


--
-- Name: client_tab_blocks client_tab_blocks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER client_tab_blocks_updated_at BEFORE UPDATE ON public.client_tab_blocks FOR EACH ROW EXECUTE FUNCTION public.update_client_tabs_updated_at();


--
-- Name: client_tabs client_tabs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER client_tabs_updated_at BEFORE UPDATE ON public.client_tabs FOR EACH ROW EXECUTE FUNCTION public.update_client_tabs_updated_at();


--
-- Name: docs docs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER docs_updated_at BEFORE UPDATE ON public.docs FOR EACH ROW EXECUTE FUNCTION public.update_docs_updated_at();


--
-- Name: entity_properties entity_properties_populate_named_fields_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER entity_properties_populate_named_fields_trigger BEFORE INSERT OR UPDATE ON public.entity_properties FOR EACH ROW EXECUTE FUNCTION public.entity_properties_populate_named_fields();


--
-- Name: entity_properties entity_properties_set_subtype; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER entity_properties_set_subtype BEFORE INSERT OR UPDATE OF entity_type, entity_id ON public.entity_properties FOR EACH ROW EXECUTE FUNCTION public.entity_properties_set_subtype();


--
-- Name: entity_properties entity_properties_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER entity_properties_set_updated_at BEFORE UPDATE ON public.entity_properties FOR EACH ROW EXECUTE FUNCTION public.entity_properties_set_updated_at();


--
-- Name: payments payment_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_number_trigger BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_payment_number();


--
-- Name: payments payment_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_updated_at_trigger BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_payment_timestamp();


--
-- Name: file_analysis_artifacts set_updated_at_file_analysis_artifacts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_file_analysis_artifacts BEFORE UPDATE ON public.file_analysis_artifacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: file_analysis_sessions set_updated_at_file_analysis_sessions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_file_analysis_sessions BEFORE UPDATE ON public.file_analysis_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: file_comments set_updated_at_file_comments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_file_comments BEFORE UPDATE ON public.file_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: google_calendar_connections set_updated_at_google_calendar_connections; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_google_calendar_connections BEFORE UPDATE ON public.google_calendar_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: indexing_jobs set_updated_at_indexing_jobs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_indexing_jobs BEFORE UPDATE ON public.indexing_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: workflow_sessions set_updated_at_workflow_sessions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_workflow_sessions BEFORE UPDATE ON public.workflow_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shopify_connections shopify_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shopify_connections_updated_at BEFORE UPDATE ON public.shopify_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shopify_sync_jobs shopify_sync_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shopify_sync_jobs_updated_at BEFORE UPDATE ON public.shopify_sync_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: slack_rate_limits slack_rate_limits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER slack_rate_limits_updated_at BEFORE UPDATE ON public.slack_rate_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: slack_user_links slack_user_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER slack_user_links_updated_at BEFORE UPDATE ON public.slack_user_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: slack_workspace_connections slack_workspace_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER slack_workspace_connections_updated_at BEFORE UPDATE ON public.slack_workspace_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: blocks sync_block_type_to_entity_properties_subtype_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_block_type_to_entity_properties_subtype_trigger AFTER UPDATE OF type ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.sync_block_type_to_entity_properties_subtype();


--
-- Name: task_assignees sync_live_task_assignees_to_source_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_live_task_assignees_to_source_trigger AFTER INSERT OR DELETE OR UPDATE ON public.task_assignees FOR EACH ROW EXECUTE FUNCTION public.sync_live_task_assignees_to_source();


--
-- Name: task_items sync_live_task_item_to_source_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_live_task_item_to_source_trigger AFTER UPDATE ON public.task_items FOR EACH ROW EXECUTE FUNCTION public.sync_live_task_item_to_source();


--
-- Name: entity_properties sync_live_task_properties_to_source_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_live_task_properties_to_source_trigger AFTER INSERT OR DELETE OR UPDATE ON public.entity_properties FOR EACH ROW EXECUTE FUNCTION public.sync_live_task_properties_to_source();


--
-- Name: task_tag_links sync_live_task_tags_to_source_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_live_task_tags_to_source_trigger AFTER INSERT OR DELETE OR UPDATE ON public.task_tag_links FOR EACH ROW EXECUTE FUNCTION public.sync_live_task_tags_to_source();


--
-- Name: table_comments table_comments_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_comments_set_updated_at BEFORE UPDATE ON public.table_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_fields table_fields_set_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_fields_set_order BEFORE INSERT ON public.table_fields FOR EACH ROW EXECUTE FUNCTION public.assign_table_field_order();


--
-- Name: table_fields table_fields_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_fields_set_updated_at BEFORE UPDATE ON public.table_fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_rows table_rows_set_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_rows_set_order BEFORE INSERT ON public.table_rows FOR EACH ROW EXECUTE FUNCTION public.assign_table_row_order();


--
-- Name: table_rows table_rows_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_rows_set_updated_at BEFORE UPDATE ON public.table_rows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_rows table_rows_validate_data; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_rows_validate_data BEFORE INSERT OR UPDATE ON public.table_rows FOR EACH ROW EXECUTE FUNCTION public.validate_table_row_data();


--
-- Name: table_views table_views_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_views_set_updated_at BEFORE UPDATE ON public.table_views FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_views table_views_single_default; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_views_single_default BEFORE INSERT OR UPDATE ON public.table_views FOR EACH ROW WHEN ((new.is_default IS TRUE)) EXECUTE FUNCTION public.ensure_single_default_view();


--
-- Name: tables tables_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tables_set_updated_at BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_comments task_comments_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_comments_set_updated_at BEFORE UPDATE ON public.task_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_items task_items_seed_priorities_from_source_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_items_seed_priorities_from_source_row BEFORE INSERT ON public.task_items FOR EACH ROW EXECUTE FUNCTION public.seed_task_priorities_from_source_row();


--
-- Name: task_items task_items_set_display_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_items_set_display_order BEFORE INSERT ON public.task_items FOR EACH ROW EXECUTE FUNCTION public.set_task_item_display_order();


--
-- Name: task_items task_items_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_items_set_updated_at BEFORE UPDATE ON public.task_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_references task_references_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_references_set_updated_at BEFORE UPDATE ON public.task_references FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_subtask_references task_subtask_references_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_subtask_references_set_updated_at BEFORE UPDATE ON public.task_subtask_references FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_subtasks task_subtasks_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_subtasks_set_updated_at BEFORE UPDATE ON public.task_subtasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: task_tags task_tags_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_tags_set_updated_at BEFORE UPDATE ON public.task_tags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: timeline_events timeline_events_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER timeline_events_set_updated_at BEFORE UPDATE ON public.timeline_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: timeline_references timeline_references_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER timeline_references_set_updated_at BEFORE UPDATE ON public.timeline_references FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: trak_product_inventory trak_product_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trak_product_inventory_updated_at BEFORE UPDATE ON public.trak_product_inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: trak_product_variants trak_product_variants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trak_product_variants_updated_at BEFORE UPDATE ON public.trak_product_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: trak_products trak_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trak_products_updated_at BEFORE UPDATE ON public.trak_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: blocks trg_blocks_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_blocks_updated BEFORE UPDATE ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: comments trg_comments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects trg_projects_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: workspaces trg_workspaces_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organizations trigger_add_organization_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_add_organization_owner AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.add_organization_owner_on_insert();


--
-- Name: task_items trigger_set_edited_flag_on_task_item_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_edited_flag_on_task_item_update BEFORE UPDATE ON public.task_items FOR EACH ROW EXECUTE FUNCTION public.set_edited_flag_on_task_item_update();


--
-- Name: timeline_events trigger_set_edited_flag_on_timeline_event_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_edited_flag_on_timeline_event_update BEFORE UPDATE ON public.timeline_events FOR EACH ROW EXECUTE FUNCTION public.set_edited_flag_on_timeline_event_update();


--
-- Name: table_fields trigger_sync_table_row_property_names_on_field_rename; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_table_row_property_names_on_field_rename AFTER UPDATE OF name ON public.table_fields FOR EACH ROW EXECUTE FUNCTION public.sync_table_row_property_names_on_field_rename();


--
-- Name: entity_properties_legacy update_entity_properties_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_entity_properties_updated_at BEFORE UPDATE ON public.entity_properties_legacy FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: block_highlights block_highlights_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_highlights
    ADD CONSTRAINT block_highlights_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: block_highlights block_highlights_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_highlights
    ADD CONSTRAINT block_highlights_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: block_references block_references_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_references
    ADD CONSTRAINT block_references_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: block_references block_references_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_references
    ADD CONSTRAINT block_references_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: block_references block_references_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_references
    ADD CONSTRAINT block_references_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- Name: block_references block_references_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_references
    ADD CONSTRAINT block_references_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_original_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_original_block_id_fkey FOREIGN KEY (original_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_parent_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_parent_block_id_fkey FOREIGN KEY (parent_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: client_page_views client_page_views_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_page_views
    ADD CONSTRAINT client_page_views_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: client_page_views client_page_views_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_page_views
    ADD CONSTRAINT client_page_views_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE SET NULL;


--
-- Name: client_tab_blocks client_tab_blocks_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tab_blocks
    ADD CONSTRAINT client_tab_blocks_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.client_tabs(id) ON DELETE CASCADE;


--
-- Name: client_tabs client_tabs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_tabs
    ADD CONSTRAINT client_tabs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: clients clients_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: dashboard_ai_insights dashboard_ai_insights_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_ai_insights
    ADD CONSTRAINT dashboard_ai_insights_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: doc_folders doc_folders_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_folders
    ADD CONSTRAINT doc_folders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: docs docs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: docs docs_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.doc_folders(id) ON DELETE SET NULL;


--
-- Name: docs docs_last_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_last_edited_by_fkey FOREIGN KEY (last_edited_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: docs docs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: entity_links entity_links_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_links
    ADD CONSTRAINT entity_links_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: entity_properties_legacy entity_properties_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_properties_legacy
    ADD CONSTRAINT entity_properties_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.workspace_members(id) ON DELETE SET NULL;


--
-- Name: entity_properties_legacy entity_properties_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_properties_legacy
    ADD CONSTRAINT entity_properties_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: entity_properties entity_properties_workspace_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_properties
    ADD CONSTRAINT entity_properties_workspace_id_fkey1 FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: file_analysis_artifacts file_analysis_artifacts_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_artifacts
    ADD CONSTRAINT file_analysis_artifacts_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_analysis_chunks file_analysis_chunks_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_chunks
    ADD CONSTRAINT file_analysis_chunks_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.file_analysis_artifacts(id) ON DELETE CASCADE;


--
-- Name: file_analysis_chunks file_analysis_chunks_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_chunks
    ADD CONSTRAINT file_analysis_chunks_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_analysis_citations file_analysis_citations_chunk_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_citations
    ADD CONSTRAINT file_analysis_citations_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES public.file_analysis_chunks(id) ON DELETE SET NULL;


--
-- Name: file_analysis_citations file_analysis_citations_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_citations
    ADD CONSTRAINT file_analysis_citations_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_analysis_citations file_analysis_citations_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_citations
    ADD CONSTRAINT file_analysis_citations_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.file_analysis_messages(id) ON DELETE CASCADE;


--
-- Name: file_analysis_messages file_analysis_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_messages
    ADD CONSTRAINT file_analysis_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.file_analysis_sessions(id) ON DELETE CASCADE;


--
-- Name: file_analysis_session_files file_analysis_session_files_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_session_files
    ADD CONSTRAINT file_analysis_session_files_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_analysis_session_files file_analysis_session_files_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_session_files
    ADD CONSTRAINT file_analysis_session_files_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.file_analysis_sessions(id) ON DELETE CASCADE;


--
-- Name: file_analysis_sessions file_analysis_sessions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_sessions
    ADD CONSTRAINT file_analysis_sessions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: file_analysis_sessions file_analysis_sessions_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_sessions
    ADD CONSTRAINT file_analysis_sessions_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: file_analysis_sessions file_analysis_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_sessions
    ADD CONSTRAINT file_analysis_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: file_analysis_sessions file_analysis_sessions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_analysis_sessions
    ADD CONSTRAINT file_analysis_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: file_attachments file_attachments_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: file_attachments file_attachments_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_comments file_comments_analysis_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_comments
    ADD CONSTRAINT file_comments_analysis_message_id_fkey FOREIGN KEY (analysis_message_id) REFERENCES public.file_analysis_messages(id) ON DELETE SET NULL;


--
-- Name: file_comments file_comments_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_comments
    ADD CONSTRAINT file_comments_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: file_comments file_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_comments
    ADD CONSTRAINT file_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: files files_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: files files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: files files_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: google_calendar_connections google_calendar_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: google_calendar_connections google_calendar_connections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: indexing_jobs indexing_jobs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indexing_jobs
    ADD CONSTRAINT indexing_jobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: internal_space_groups internal_space_groups_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_space_groups
    ADD CONSTRAINT internal_space_groups_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: oauth_states oauth_states_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_states oauth_states_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payment_events payment_events_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: payment_events payment_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: payments payments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payments payments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: payments payments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_folders project_folders_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_folders
    ADD CONSTRAINT project_folders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_tags project_tags_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_tags
    ADD CONSTRAINT project_tags_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: projects projects_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.project_folders(id) ON DELETE SET NULL;


--
-- Name: projects projects_internal_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_internal_group_id_fkey FOREIGN KEY (internal_group_id) REFERENCES public.internal_space_groups(id) ON DELETE SET NULL;


--
-- Name: projects projects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: shopify_connections shopify_connections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopify_connections
    ADD CONSTRAINT shopify_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: shopify_sync_jobs shopify_sync_jobs_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopify_sync_jobs
    ADD CONSTRAINT shopify_sync_jobs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.shopify_connections(id) ON DELETE CASCADE;


--
-- Name: shopify_sync_jobs shopify_sync_jobs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopify_sync_jobs
    ADD CONSTRAINT shopify_sync_jobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: slack_command_audit_log slack_command_audit_log_slack_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_command_audit_log
    ADD CONSTRAINT slack_command_audit_log_slack_connection_id_fkey FOREIGN KEY (slack_connection_id) REFERENCES public.slack_workspace_connections(id) ON DELETE CASCADE;


--
-- Name: slack_command_audit_log slack_command_audit_log_trak_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_command_audit_log
    ADD CONSTRAINT slack_command_audit_log_trak_user_id_fkey FOREIGN KEY (trak_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: slack_user_links slack_user_links_slack_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_user_links
    ADD CONSTRAINT slack_user_links_slack_connection_id_fkey FOREIGN KEY (slack_connection_id) REFERENCES public.slack_workspace_connections(id) ON DELETE CASCADE;


--
-- Name: slack_user_links slack_user_links_trak_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_user_links
    ADD CONSTRAINT slack_user_links_trak_user_id_fkey FOREIGN KEY (trak_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: slack_workspace_connections slack_workspace_connections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_workspace_connections
    ADD CONSTRAINT slack_workspace_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: tab_shares tab_shares_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tab_shares
    ADD CONSTRAINT tab_shares_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tab_shares tab_shares_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tab_shares
    ADD CONSTRAINT tab_shares_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: table_comments table_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_comments
    ADD CONSTRAINT table_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.table_comments(id) ON DELETE CASCADE;


--
-- Name: table_comments table_comments_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_comments
    ADD CONSTRAINT table_comments_row_id_fkey FOREIGN KEY (row_id) REFERENCES public.table_rows(id) ON DELETE CASCADE;


--
-- Name: table_comments table_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_comments
    ADD CONSTRAINT table_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: table_fields table_fields_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_fields
    ADD CONSTRAINT table_fields_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_from_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_from_field_id_fkey FOREIGN KEY (from_field_id) REFERENCES public.table_fields(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_from_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_from_row_id_fkey FOREIGN KEY (from_row_id) REFERENCES public.table_rows(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_from_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_from_table_id_fkey FOREIGN KEY (from_table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_to_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_to_row_id_fkey FOREIGN KEY (to_row_id) REFERENCES public.table_rows(id) ON DELETE CASCADE;


--
-- Name: table_relations table_relations_to_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_relations
    ADD CONSTRAINT table_relations_to_table_id_fkey FOREIGN KEY (to_table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: table_rows table_rows_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_rows
    ADD CONSTRAINT table_rows_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: table_rows table_rows_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_rows
    ADD CONSTRAINT table_rows_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: table_rows table_rows_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_rows
    ADD CONSTRAINT table_rows_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: table_views table_views_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_views
    ADD CONSTRAINT table_views_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: table_views table_views_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_views
    ADD CONSTRAINT table_views_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: tables tables_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: tables tables_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tables tables_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: tables tables_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: tabs tabs_parent_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabs
    ADD CONSTRAINT tabs_parent_tab_id_fkey FOREIGN KEY (parent_tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: tabs tabs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabs
    ADD CONSTRAINT tabs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_assignees task_assignees_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_items task_items_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_items task_items_source_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_source_task_id_fkey FOREIGN KEY (source_task_id) REFERENCES public.task_items(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_task_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_task_block_id_fkey FOREIGN KEY (task_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: task_items task_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_items task_items_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: task_references task_references_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_references task_references_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- Name: task_references task_references_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_references task_references_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_references
    ADD CONSTRAINT task_references_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: task_subtask_references task_subtask_references_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_subtask_references
    ADD CONSTRAINT task_subtask_references_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_subtask_references task_subtask_references_subtask_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_subtask_references
    ADD CONSTRAINT task_subtask_references_subtask_id_fkey FOREIGN KEY (subtask_id) REFERENCES public.task_subtasks(id) ON DELETE CASCADE;


--
-- Name: task_subtask_references task_subtask_references_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_subtask_references
    ADD CONSTRAINT task_subtask_references_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- Name: task_subtask_references task_subtask_references_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_subtask_references
    ADD CONSTRAINT task_subtask_references_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: task_subtasks task_subtasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_subtasks
    ADD CONSTRAINT task_subtasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_tag_links task_tag_links_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.task_tags(id) ON DELETE CASCADE;


--
-- Name: task_tag_links task_tag_links_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_tag_links
    ADD CONSTRAINT task_tag_links_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_items(id) ON DELETE CASCADE;


--
-- Name: task_tags task_tags_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: timeline_dependencies timeline_dependencies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_dependencies timeline_dependencies_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_from_id_fkey FOREIGN KEY (from_id) REFERENCES public.timeline_events(id) ON DELETE CASCADE;


--
-- Name: timeline_dependencies timeline_dependencies_timeline_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_timeline_block_id_fkey FOREIGN KEY (timeline_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: timeline_dependencies timeline_dependencies_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_to_id_fkey FOREIGN KEY (to_id) REFERENCES public.timeline_events(id) ON DELETE CASCADE;


--
-- Name: timeline_dependencies timeline_dependencies_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_dependencies
    ADD CONSTRAINT timeline_dependencies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: timeline_events timeline_events_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_events timeline_events_assignee_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_assignee_team_id_fkey FOREIGN KEY (assignee_team_id) REFERENCES public.workspace_teams(id) ON DELETE SET NULL;


--
-- Name: timeline_events timeline_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_events timeline_events_parent_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_parent_event_id_fkey FOREIGN KEY (parent_event_id) REFERENCES public.timeline_events(id) ON DELETE CASCADE;


--
-- Name: timeline_events timeline_events_timeline_block_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_timeline_block_id_fkey FOREIGN KEY (timeline_block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: timeline_events timeline_events_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_events timeline_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_events
    ADD CONSTRAINT timeline_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: timeline_references timeline_references_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: timeline_references timeline_references_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.timeline_events(id) ON DELETE CASCADE;


--
-- Name: timeline_references timeline_references_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;


--
-- Name: timeline_references timeline_references_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeline_references
    ADD CONSTRAINT timeline_references_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: trak_product_inventory trak_product_inventory_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_product_inventory
    ADD CONSTRAINT trak_product_inventory_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.trak_product_variants(id) ON DELETE CASCADE;


--
-- Name: trak_product_sales_cache trak_product_sales_cache_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_product_sales_cache
    ADD CONSTRAINT trak_product_sales_cache_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trak_products(id) ON DELETE CASCADE;


--
-- Name: trak_product_variants trak_product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_product_variants
    ADD CONSTRAINT trak_product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trak_products(id) ON DELETE CASCADE;


--
-- Name: trak_products trak_products_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_products
    ADD CONSTRAINT trak_products_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.shopify_connections(id) ON DELETE CASCADE;


--
-- Name: trak_products trak_products_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trak_products
    ADD CONSTRAINT trak_products_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: unstructured_chunks unstructured_chunks_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unstructured_chunks
    ADD CONSTRAINT unstructured_chunks_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.unstructured_parents(id) ON DELETE CASCADE;


--
-- Name: unstructured_parents unstructured_parents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unstructured_parents
    ADD CONSTRAINT unstructured_parents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: unstructured_parents unstructured_parents_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unstructured_parents
    ADD CONSTRAINT unstructured_parents_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: unstructured_parents unstructured_parents_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unstructured_parents
    ADD CONSTRAINT unstructured_parents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workflow_messages workflow_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_messages
    ADD CONSTRAINT workflow_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.workflow_sessions(id) ON DELETE CASCADE;


--
-- Name: workflow_sessions workflow_sessions_tab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_sessions
    ADD CONSTRAINT workflow_sessions_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;


--
-- Name: workflow_sessions workflow_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_sessions
    ADD CONSTRAINT workflow_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workflow_sessions workflow_sessions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_sessions
    ADD CONSTRAINT workflow_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: workspace_invitations workspace_invitations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_team_members workspace_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_team_members
    ADD CONSTRAINT workspace_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.workspace_teams(id) ON DELETE CASCADE;


--
-- Name: workspace_team_members workspace_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_team_members
    ADD CONSTRAINT workspace_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_teams workspace_teams_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_teams
    ADD CONSTRAINT workspace_teams_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: client_tabs Admins and owners can delete client tabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and owners can delete client tabs" ON public.client_tabs FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = client_tabs.client_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['admin'::public.role, 'owner'::public.role]))))));


--
-- Name: slack_workspace_connections Admins can delete their workspace's Slack connection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete their workspace's Slack connection" ON public.slack_workspace_connections FOR DELETE USING ((public.is_member_of_workspace(workspace_id) AND (EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = slack_workspace_connections.workspace_id) AND (workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role])))))));


--
-- Name: slack_workspace_connections Admins can insert Slack connections for their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert Slack connections for their workspace" ON public.slack_workspace_connections FOR INSERT WITH CHECK ((public.is_member_of_workspace(workspace_id) AND (EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = slack_workspace_connections.workspace_id) AND (workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role])))))));


--
-- Name: slack_workspace_connections Admins can update their workspace's Slack connection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update their workspace's Slack connection" ON public.slack_workspace_connections FOR UPDATE USING ((public.is_member_of_workspace(workspace_id) AND (EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = slack_workspace_connections.workspace_id) AND (workspace_members.user_id = auth.uid()) AND (workspace_members.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role])))))));


--
-- Name: slack_command_audit_log Admins can view audit logs for their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit logs for their workspace" ON public.slack_command_audit_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.slack_workspace_connections swc
     JOIN public.workspace_members wm ON ((wm.workspace_id = swc.workspace_id)))
  WHERE ((swc.id = slack_command_audit_log.slack_connection_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role]))))));


--
-- Name: client_page_views Anyone can track client page views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can track client page views" ON public.client_page_views FOR INSERT WITH CHECK (true);


--
-- Name: organizations Authenticated users can create organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: block_references Block references deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Block references deletable by workspace members" ON public.block_references FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: block_references Block references insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Block references insertable by workspace members" ON public.block_references FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: block_references Block references updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Block references updatable by workspace members" ON public.block_references FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: block_references Block references visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Block references visible to workspace members" ON public.block_references FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_links Entity links deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Entity links deletable by workspace members" ON public.entity_links FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_links Entity links insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Entity links insertable by workspace members" ON public.entity_links FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_links Entity links visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Entity links visible to workspace members" ON public.entity_links FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties Entity properties deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Entity properties deletable by workspace members" ON public.entity_properties FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties Entity properties insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Entity properties insertable by workspace members" ON public.entity_properties FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties Entity properties updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Entity properties updatable by workspace members" ON public.entity_properties FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties Entity properties visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Entity properties visible to workspace members" ON public.entity_properties FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: organization_members Org owners and admins can delete members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners and admins can delete members" ON public.organization_members FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_members.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: organization_members Org owners and admins can insert members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners and admins can insert members" ON public.organization_members FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_members.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: organizations Org owners and admins can update their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners and admins can update their organization" ON public.organizations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organizations.id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: organization_members Org owners and admins can update/delete members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners and admins can update/delete members" ON public.organization_members FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_members.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: blocks Public can view blocks in client-visible tabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view blocks in client-visible tabs" ON public.blocks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.tabs
     JOIN public.projects ON ((projects.id = tabs.project_id)))
  WHERE ((tabs.id = blocks.tab_id) AND (tabs.is_client_visible = true) AND (projects.client_page_enabled = true) AND (projects.public_token IS NOT NULL)))));


--
-- Name: tabs Public can view client-visible tabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view client-visible tabs" ON public.tabs FOR SELECT USING (((is_client_visible = true) AND (EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = tabs.project_id) AND (projects.client_page_enabled = true) AND (projects.public_token IS NOT NULL))))));


--
-- Name: projects Public can view projects via public_token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view projects via public_token" ON public.projects FOR SELECT USING (((client_page_enabled = true) AND (public_token IS NOT NULL)));


--
-- Name: slack_command_audit_log Service can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert audit logs" ON public.slack_command_audit_log FOR INSERT WITH CHECK (true);


--
-- Name: table_comments Table comments deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table comments deletable by workspace members" ON public.table_comments FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.table_rows r
     JOIN public.tables t ON ((t.id = r.table_id)))
  WHERE ((r.id = table_comments.row_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_comments Table comments insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table comments insertable by workspace members" ON public.table_comments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.table_rows r
     JOIN public.tables t ON ((t.id = r.table_id)))
  WHERE ((r.id = table_comments.row_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_comments Table comments updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table comments updatable by workspace members" ON public.table_comments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.table_rows r
     JOIN public.tables t ON ((t.id = r.table_id)))
  WHERE ((r.id = table_comments.row_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_comments Table comments visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table comments visible to workspace members" ON public.table_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.table_rows r
     JOIN public.tables t ON ((t.id = r.table_id)))
  WHERE ((r.id = table_comments.row_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_fields Table fields deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table fields deletable by workspace members" ON public.table_fields FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_fields.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_fields Table fields insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table fields insertable by workspace members" ON public.table_fields FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_fields.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_fields Table fields updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table fields updatable by workspace members" ON public.table_fields FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_fields.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_fields Table fields visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table fields visible to workspace members" ON public.table_fields FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_fields.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_relations Table relations deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table relations deletable by workspace members" ON public.table_relations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_relations.from_table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_relations Table relations insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table relations insertable by workspace members" ON public.table_relations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_relations.from_table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_relations Table relations visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table relations visible to workspace members" ON public.table_relations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_relations.from_table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_rows Table rows deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table rows deletable by workspace members" ON public.table_rows FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_rows Table rows insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table rows insertable by workspace members" ON public.table_rows FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_rows Table rows updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table rows updatable by workspace members" ON public.table_rows FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_rows Table rows visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table rows visible to workspace members" ON public.table_rows FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_rows.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_views Table views deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table views deletable by workspace members" ON public.table_views FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_views.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_views Table views insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table views insertable by workspace members" ON public.table_views FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_views.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_views Table views updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table views updatable by workspace members" ON public.table_views FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_views.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: table_views Table views visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Table views visible to workspace members" ON public.table_views FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tables t
  WHERE ((t.id = table_views.table_id) AND (t.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid())))))));


--
-- Name: tables Tables are visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tables are visible to workspace members" ON public.tables FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: tables Tables can be created by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tables can be created by workspace members" ON public.tables FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: tables Tables can be deleted by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tables can be deleted by workspace members" ON public.tables FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: tables Tables can be updated by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tables can be updated by workspace members" ON public.tables FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_assignees Task assignees deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task assignees deletable by workspace members" ON public.task_assignees FOR DELETE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_assignees Task assignees insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task assignees insertable by workspace members" ON public.task_assignees FOR INSERT WITH CHECK ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_assignees Task assignees visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task assignees visible to workspace members" ON public.task_assignees FOR SELECT USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_comments Task comments deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task comments deletable by workspace members" ON public.task_comments FOR DELETE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_comments Task comments insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task comments insertable by workspace members" ON public.task_comments FOR INSERT WITH CHECK ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_comments Task comments updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task comments updatable by workspace members" ON public.task_comments FOR UPDATE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_comments Task comments visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task comments visible to workspace members" ON public.task_comments FOR SELECT USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_items Task items deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task items deletable by workspace members" ON public.task_items FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_items Task items insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task items insertable by workspace members" ON public.task_items FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_items Task items updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task items updatable by workspace members" ON public.task_items FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_items Task items visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task items visible to workspace members" ON public.task_items FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_references Task references deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task references deletable by workspace members" ON public.task_references FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_references Task references insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task references insertable by workspace members" ON public.task_references FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_references Task references updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task references updatable by workspace members" ON public.task_references FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_references Task references visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task references visible to workspace members" ON public.task_references FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_subtask_references Task subtask references deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task subtask references deletable by workspace members" ON public.task_subtask_references FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_subtask_references Task subtask references insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task subtask references insertable by workspace members" ON public.task_subtask_references FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_subtask_references Task subtask references updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task subtask references updatable by workspace members" ON public.task_subtask_references FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_subtask_references Task subtask references visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task subtask references visible to workspace members" ON public.task_subtask_references FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_subtasks Task subtasks deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task subtasks deletable by workspace members" ON public.task_subtasks FOR DELETE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_subtasks Task subtasks insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task subtasks insertable by workspace members" ON public.task_subtasks FOR INSERT WITH CHECK ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_subtasks Task subtasks updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task subtasks updatable by workspace members" ON public.task_subtasks FOR UPDATE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_subtasks Task subtasks visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task subtasks visible to workspace members" ON public.task_subtasks FOR SELECT USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_tag_links Task tag links deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task tag links deletable by workspace members" ON public.task_tag_links FOR DELETE USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_tag_links Task tag links insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task tag links insertable by workspace members" ON public.task_tag_links FOR INSERT WITH CHECK ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_tag_links Task tag links visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task tag links visible to workspace members" ON public.task_tag_links FOR SELECT USING ((task_id IN ( SELECT task_items.id
   FROM public.task_items
  WHERE (task_items.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = auth.uid()))))));


--
-- Name: task_tags Task tags deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task tags deletable by workspace members" ON public.task_tags FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_tags Task tags insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task tags insertable by workspace members" ON public.task_tags FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_tags Task tags updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task tags updatable by workspace members" ON public.task_tags FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: task_tags Task tags visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Task tags visible to workspace members" ON public.task_tags FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_dependencies Timeline dependencies deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline dependencies deletable by workspace members" ON public.timeline_dependencies FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_dependencies Timeline dependencies insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline dependencies insertable by workspace members" ON public.timeline_dependencies FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_dependencies Timeline dependencies visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline dependencies visible to workspace members" ON public.timeline_dependencies FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_events Timeline events deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline events deletable by workspace members" ON public.timeline_events FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_events Timeline events insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline events insertable by workspace members" ON public.timeline_events FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_events Timeline events updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline events updatable by workspace members" ON public.timeline_events FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_events Timeline events visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline events visible to workspace members" ON public.timeline_events FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_references Timeline references deletable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline references deletable by workspace members" ON public.timeline_references FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_references Timeline references insertable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline references insertable by workspace members" ON public.timeline_references FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_references Timeline references updatable by workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline references updatable by workspace members" ON public.timeline_references FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: timeline_references Timeline references visible to workspace members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Timeline references visible to workspace members" ON public.timeline_references FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: client_tab_blocks Users can create client tab blocks in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create client tab blocks in their workspace" ON public.client_tab_blocks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.client_tabs ct
     JOIN public.clients c ON ((c.id = ct.client_id)))
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((ct.id = client_tab_blocks.tab_id) AND (wm.user_id = auth.uid())))));


--
-- Name: client_tabs Users can create client tabs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create client tabs in their workspace" ON public.client_tabs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = client_tabs.client_id) AND (wm.user_id = auth.uid())))));


--
-- Name: docs Users can create docs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create docs in their workspace" ON public.docs FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: project_folders Users can create folders in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create folders in their workspace" ON public.project_folders FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = project_folders.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: client_tab_blocks Users can delete client tab blocks in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete client tab blocks in their workspace" ON public.client_tab_blocks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ((public.client_tabs ct
     JOIN public.clients c ON ((c.id = ct.client_id)))
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((ct.id = client_tab_blocks.tab_id) AND (wm.user_id = auth.uid())))));


--
-- Name: docs Users can delete docs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete docs in their workspace" ON public.docs FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: project_folders Users can delete folders in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete folders in their workspace" ON public.project_folders FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = project_folders.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: trak_product_inventory Users can delete inventory of their workspace's variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete inventory of their workspace's variants" ON public.trak_product_inventory FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.trak_product_variants
     JOIN public.trak_products ON ((trak_products.id = trak_product_variants.product_id)))
  WHERE ((trak_product_variants.id = trak_product_inventory.variant_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: trak_product_sales_cache Users can delete sales cache of their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete sales cache of their workspace's products" ON public.trak_product_sales_cache FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.trak_products
  WHERE ((trak_products.id = trak_product_sales_cache.product_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: slack_user_links Users can delete their own Slack links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own Slack links" ON public.slack_user_links FOR DELETE USING ((trak_user_id = auth.uid()));


--
-- Name: shopify_connections Users can delete their workspace's Shopify connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their workspace's Shopify connections" ON public.shopify_connections FOR DELETE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: trak_products Users can delete their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their workspace's products" ON public.trak_products FOR DELETE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: shopify_sync_jobs Users can delete their workspace's sync jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their workspace's sync jobs" ON public.shopify_sync_jobs FOR DELETE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: trak_product_variants Users can delete variants of their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete variants of their workspace's products" ON public.trak_product_variants FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.trak_products
  WHERE ((trak_products.id = trak_product_variants.product_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: shopify_connections Users can insert Shopify connections for their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert Shopify connections for their workspace" ON public.shopify_connections FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: trak_product_inventory Users can insert inventory for their workspace's variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert inventory for their workspace's variants" ON public.trak_product_inventory FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.trak_product_variants
     JOIN public.trak_products ON ((trak_products.id = trak_product_variants.product_id)))
  WHERE ((trak_product_variants.id = trak_product_inventory.variant_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: trak_products Users can insert products for their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert products for their workspace" ON public.trak_products FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: trak_product_sales_cache Users can insert sales cache for their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert sales cache for their workspace's products" ON public.trak_product_sales_cache FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.trak_products
  WHERE ((trak_products.id = trak_product_sales_cache.product_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: shopify_sync_jobs Users can insert sync jobs for their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert sync jobs for their workspace" ON public.shopify_sync_jobs FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: slack_user_links Users can insert their own Slack links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own Slack links" ON public.slack_user_links FOR INSERT WITH CHECK ((trak_user_id = auth.uid()));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: trak_product_variants Users can insert variants for their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert variants for their workspace's products" ON public.trak_product_variants FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.trak_products
  WHERE ((trak_products.id = trak_product_variants.product_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: dashboard_ai_insights Users can manage dashboard insights for their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage dashboard insights for their workspace" ON public.dashboard_ai_insights USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: client_tab_blocks Users can update client tab blocks in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update client tab blocks in their workspace" ON public.client_tab_blocks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ((public.client_tabs ct
     JOIN public.clients c ON ((c.id = ct.client_id)))
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((ct.id = client_tab_blocks.tab_id) AND (wm.user_id = auth.uid())))));


--
-- Name: client_tabs Users can update client tabs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update client tabs in their workspace" ON public.client_tabs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = client_tabs.client_id) AND (wm.user_id = auth.uid())))));


--
-- Name: docs Users can update docs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update docs in their workspace" ON public.docs FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: project_folders Users can update folders in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update folders in their workspace" ON public.project_folders FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = project_folders.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: trak_product_inventory Users can update inventory of their workspace's variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update inventory of their workspace's variants" ON public.trak_product_inventory FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.trak_product_variants
     JOIN public.trak_products ON ((trak_products.id = trak_product_variants.product_id)))
  WHERE ((trak_product_variants.id = trak_product_inventory.variant_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: trak_product_sales_cache Users can update sales cache of their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update sales cache of their workspace's products" ON public.trak_product_sales_cache FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.trak_products
  WHERE ((trak_products.id = trak_product_sales_cache.product_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: slack_user_links Users can update their own Slack links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own Slack links" ON public.slack_user_links FOR UPDATE USING ((trak_user_id = auth.uid()));


--
-- Name: shopify_connections Users can update their workspace's Shopify connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their workspace's Shopify connections" ON public.shopify_connections FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: trak_products Users can update their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their workspace's products" ON public.trak_products FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: shopify_sync_jobs Users can update their workspace's sync jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their workspace's sync jobs" ON public.shopify_sync_jobs FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: trak_product_variants Users can update variants of their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update variants of their workspace's products" ON public.trak_product_variants FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.trak_products
  WHERE ((trak_products.id = trak_product_variants.product_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);


--
-- Name: client_tab_blocks Users can view client tab blocks in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view client tab blocks in their workspace" ON public.client_tab_blocks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.client_tabs ct
     JOIN public.clients c ON ((c.id = ct.client_id)))
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((ct.id = client_tab_blocks.tab_id) AND (wm.user_id = auth.uid())))));


--
-- Name: client_tabs Users can view client tabs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view client tabs in their workspace" ON public.client_tabs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.workspace_members wm ON ((wm.workspace_id = c.workspace_id)))
  WHERE ((c.id = client_tabs.client_id) AND (wm.user_id = auth.uid())))));


--
-- Name: dashboard_ai_insights Users can view dashboard insights for their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view dashboard insights for their workspace" ON public.dashboard_ai_insights FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: docs Users can view docs in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view docs in their workspace" ON public.docs FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: project_folders Users can view folders in their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view folders in their workspace" ON public.project_folders FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspace_members
  WHERE ((workspace_members.workspace_id = project_folders.workspace_id) AND (workspace_members.user_id = auth.uid())))));


--
-- Name: trak_product_inventory Users can view inventory of their workspace's variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view inventory of their workspace's variants" ON public.trak_product_inventory FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.trak_product_variants
     JOIN public.trak_products ON ((trak_products.id = trak_product_variants.product_id)))
  WHERE ((trak_product_variants.id = trak_product_inventory.variant_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: organization_members Users can view members of their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view members of their organizations" ON public.organization_members FOR SELECT USING (public.is_member_of_organization(organization_id));


--
-- Name: organizations Users can view organizations they belong to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view organizations they belong to" ON public.organizations FOR SELECT USING (public.is_member_of_organization(id));


--
-- Name: trak_product_sales_cache Users can view sales cache of their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sales cache of their workspace's products" ON public.trak_product_sales_cache FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.trak_products
  WHERE ((trak_products.id = trak_product_sales_cache.product_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: slack_user_links Users can view their own Slack links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own Slack links" ON public.slack_user_links FOR SELECT USING ((trak_user_id = auth.uid()));


--
-- Name: shopify_connections Users can view their workspace's Shopify connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace's Shopify connections" ON public.shopify_connections FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: slack_workspace_connections Users can view their workspace's Slack connection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace's Slack connection" ON public.slack_workspace_connections FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: trak_products Users can view their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace's products" ON public.trak_products FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: shopify_sync_jobs Users can view their workspace's sync jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their workspace's sync jobs" ON public.shopify_sync_jobs FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: trak_product_variants Users can view variants of their workspace's products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view variants of their workspace's products" ON public.trak_product_variants FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.trak_products
  WHERE ((trak_products.id = trak_product_variants.product_id) AND public.is_member_of_workspace(trak_products.workspace_id)))));


--
-- Name: entity_properties_legacy Workspace members can delete entity properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can delete entity properties" ON public.entity_properties_legacy FOR DELETE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties_legacy Workspace members can insert entity properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can insert entity properties" ON public.entity_properties_legacy FOR INSERT WITH CHECK ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: entity_properties_legacy Workspace members can update entity properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can update entity properties" ON public.entity_properties_legacy FOR UPDATE USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: client_page_views Workspace members can view client page analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view client page analytics" ON public.client_page_views FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = client_page_views.project_id) AND (wm.user_id = auth.uid())))));


--
-- Name: entity_properties_legacy Workspace members can view entity properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view entity properties" ON public.entity_properties_legacy FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));


--
-- Name: workspace_invitations Workspace members can view invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view invitations" ON public.workspace_invitations FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workspace_invitations Workspace owners/admins can create invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners/admins can create invitations" ON public.workspace_invitations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = workspace_invitations.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role]))))));


--
-- Name: indexing_jobs all_indexing_jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY all_indexing_jobs ON public.indexing_jobs USING (public.is_member_of_workspace(workspace_id));


--
-- Name: unstructured_chunks all_unstructured_chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY all_unstructured_chunks ON public.unstructured_chunks USING ((EXISTS ( SELECT 1
   FROM public.unstructured_parents p
  WHERE ((p.id = unstructured_chunks.parent_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: unstructured_parents all_unstructured_parents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY all_unstructured_parents ON public.unstructured_parents USING (public.is_member_of_workspace(workspace_id));


--
-- Name: block_highlights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.block_highlights ENABLE ROW LEVEL SECURITY;

--
-- Name: block_references; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.block_references ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: client_page_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_page_views ENABLE ROW LEVEL SECURITY;

--
-- Name: client_tab_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_tab_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: client_tabs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_tabs ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboard_ai_insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboard_ai_insights ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks del_blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_blocks ON public.blocks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tabs t
  WHERE ((t.id = blocks.tab_id) AND public.can_access_project(t.project_id)))));


--
-- Name: clients del_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_clients ON public.clients FOR DELETE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: comments del_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_comments ON public.comments FOR DELETE USING (true);


--
-- Name: file_analysis_messages del_file_analysis_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_file_analysis_messages ON public.file_analysis_messages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.file_analysis_sessions s
  WHERE ((s.id = file_analysis_messages.session_id) AND (s.user_id = auth.uid()) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: file_analysis_session_files del_file_analysis_session_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_file_analysis_session_files ON public.file_analysis_session_files FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.file_analysis_sessions s
  WHERE ((s.id = file_analysis_session_files.session_id) AND (s.user_id = auth.uid()) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: file_analysis_sessions del_file_analysis_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_file_analysis_sessions ON public.file_analysis_sessions FOR DELETE USING (((user_id = auth.uid()) AND public.is_member_of_workspace(workspace_id)));


--
-- Name: file_comments del_file_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_file_comments ON public.file_comments FOR DELETE USING (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_comments.file_id) AND public.is_member_of_workspace(f.workspace_id))))));


--
-- Name: google_calendar_connections del_google_calendar_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_google_calendar_connections ON public.google_calendar_connections FOR DELETE USING (((user_id = auth.uid()) AND public.is_member_of_workspace(workspace_id)));


--
-- Name: project_members del_project_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_project_members ON public.project_members FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = project_members.project_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role]))))));


--
-- Name: project_tags del_project_tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_project_tags ON public.project_tags FOR DELETE USING (public.can_access_project(project_id));


--
-- Name: projects del_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_projects ON public.projects FOR DELETE USING (public.can_access_project(id, workspace_id));


--
-- Name: tabs del_tabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_tabs ON public.tabs FOR DELETE USING (public.can_access_project(project_id));


--
-- Name: workspace_members del_wm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_wm ON public.workspace_members FOR DELETE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workflow_messages del_workflow_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_workflow_messages ON public.workflow_messages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workflow_sessions s
  WHERE ((s.id = workflow_messages.session_id) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: workflow_sessions del_workflow_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_workflow_sessions ON public.workflow_sessions FOR DELETE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workspaces del_workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY del_workspaces ON public.workspaces FOR DELETE USING ((auth.uid() = owner_id));


--
-- Name: docs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_inherited_display; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entity_inherited_display ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entity_properties ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_properties_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entity_properties_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: file_analysis_artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_analysis_artifacts ENABLE ROW LEVEL SECURITY;

--
-- Name: file_analysis_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_analysis_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: file_analysis_citations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_analysis_citations ENABLE ROW LEVEL SECURITY;

--
-- Name: file_analysis_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_analysis_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: file_analysis_session_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_analysis_session_files ENABLE ROW LEVEL SECURITY;

--
-- Name: file_analysis_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_analysis_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: file_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: file_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

--
-- Name: google_calendar_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: indexing_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.indexing_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: block_highlights ins_block_highlights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_block_highlights ON public.block_highlights FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.blocks b
     JOIN public.tabs t ON ((t.id = b.tab_id)))
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((b.id = block_highlights.block_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: blocks ins_blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_blocks ON public.blocks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tabs t
  WHERE ((t.id = blocks.tab_id) AND public.can_access_project(t.project_id)))));


--
-- Name: clients ins_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_clients ON public.clients FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: comments ins_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_comments ON public.comments FOR INSERT WITH CHECK (true);


--
-- Name: file_analysis_artifacts ins_file_analysis_artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_file_analysis_artifacts ON public.file_analysis_artifacts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_analysis_artifacts.file_id) AND public.is_member_of_workspace(f.workspace_id)))));


--
-- Name: file_analysis_chunks ins_file_analysis_chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_file_analysis_chunks ON public.file_analysis_chunks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_analysis_chunks.file_id) AND public.is_member_of_workspace(f.workspace_id)))));


--
-- Name: file_analysis_citations ins_file_analysis_citations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_file_analysis_citations ON public.file_analysis_citations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.file_analysis_messages m
     JOIN public.file_analysis_sessions s ON ((s.id = m.session_id)))
  WHERE ((m.id = file_analysis_citations.message_id) AND (s.user_id = auth.uid()) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: file_analysis_messages ins_file_analysis_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_file_analysis_messages ON public.file_analysis_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.file_analysis_sessions s
  WHERE ((s.id = file_analysis_messages.session_id) AND (s.user_id = auth.uid()) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: file_analysis_session_files ins_file_analysis_session_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_file_analysis_session_files ON public.file_analysis_session_files FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.file_analysis_sessions s
  WHERE ((s.id = file_analysis_session_files.session_id) AND (s.user_id = auth.uid()) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: file_analysis_sessions ins_file_analysis_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_file_analysis_sessions ON public.file_analysis_sessions FOR INSERT WITH CHECK (((user_id = auth.uid()) AND public.is_member_of_workspace(workspace_id)));


--
-- Name: file_attachments ins_file_attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_file_attachments ON public.file_attachments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.blocks b
     JOIN public.tabs t ON ((t.id = b.tab_id)))
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((b.id = file_attachments.block_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: file_comments ins_file_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_file_comments ON public.file_comments FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_comments.file_id) AND public.is_member_of_workspace(f.workspace_id))))));


--
-- Name: files ins_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_files ON public.files FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: google_calendar_connections ins_google_calendar_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_google_calendar_connections ON public.google_calendar_connections FOR INSERT WITH CHECK (((user_id = auth.uid()) AND public.is_member_of_workspace(workspace_id)));


--
-- Name: payment_events ins_payment_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_payment_events ON public.payment_events FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: payments ins_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_payments ON public.payments FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: project_members ins_project_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_project_members ON public.project_members FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.workspace_members wm ON ((wm.workspace_id = p.workspace_id)))
  WHERE ((p.id = project_members.project_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role]))))));


--
-- Name: project_tags ins_project_tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_project_tags ON public.project_tags FOR INSERT WITH CHECK (public.can_access_project(project_id));


--
-- Name: projects ins_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_projects ON public.projects FOR INSERT WITH CHECK (public.is_member_of_workspace(workspace_id));


--
-- Name: tab_shares ins_tab_shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_tab_shares ON public.tab_shares FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.tabs t
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = tab_shares.tab_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: tabs ins_tabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_tabs ON public.tabs FOR INSERT WITH CHECK (public.can_access_project(project_id));


--
-- Name: workspace_members ins_wm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_wm ON public.workspace_members FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = workspace_members.workspace_id) AND (w.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.workspace_members m
  WHERE ((m.workspace_id = m.workspace_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role])))))));


--
-- Name: workflow_messages ins_workflow_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_workflow_messages ON public.workflow_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workflow_sessions s
  WHERE ((s.id = workflow_messages.session_id) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: workflow_sessions ins_workflow_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_workflow_sessions ON public.workflow_sessions FOR INSERT WITH CHECK ((public.is_member_of_workspace(workspace_id) AND (user_id = auth.uid())));


--
-- Name: workspaces ins_workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ins_workspaces ON public.workspaces FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: project_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

--
-- Name: project_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: block_highlights sel_block_highlights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_block_highlights ON public.block_highlights FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.blocks b
     JOIN public.tabs t ON ((t.id = b.tab_id)))
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((b.id = block_highlights.block_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: blocks sel_blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_blocks ON public.blocks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tabs t
  WHERE ((t.id = blocks.tab_id) AND public.can_access_project(t.project_id)))));


--
-- Name: clients sel_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_clients ON public.clients FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: comments sel_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_comments ON public.comments FOR SELECT USING (true);


--
-- Name: file_analysis_artifacts sel_file_analysis_artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_file_analysis_artifacts ON public.file_analysis_artifacts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_analysis_artifacts.file_id) AND public.is_member_of_workspace(f.workspace_id)))));


--
-- Name: file_analysis_chunks sel_file_analysis_chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_file_analysis_chunks ON public.file_analysis_chunks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_analysis_chunks.file_id) AND public.is_member_of_workspace(f.workspace_id)))));


--
-- Name: file_analysis_citations sel_file_analysis_citations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_file_analysis_citations ON public.file_analysis_citations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.file_analysis_messages m
     JOIN public.file_analysis_sessions s ON ((s.id = m.session_id)))
  WHERE ((m.id = file_analysis_citations.message_id) AND (s.user_id = auth.uid()) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: file_analysis_messages sel_file_analysis_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_file_analysis_messages ON public.file_analysis_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.file_analysis_sessions s
  WHERE ((s.id = file_analysis_messages.session_id) AND (s.user_id = auth.uid()) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: file_analysis_session_files sel_file_analysis_session_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_file_analysis_session_files ON public.file_analysis_session_files FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.file_analysis_sessions s
  WHERE ((s.id = file_analysis_session_files.session_id) AND (s.user_id = auth.uid()) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: file_analysis_sessions sel_file_analysis_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_file_analysis_sessions ON public.file_analysis_sessions FOR SELECT USING (((user_id = auth.uid()) AND public.is_member_of_workspace(workspace_id)));


--
-- Name: file_attachments sel_file_attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_file_attachments ON public.file_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.blocks b
     JOIN public.tabs t ON ((t.id = b.tab_id)))
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((b.id = file_attachments.block_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: file_comments sel_file_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_file_comments ON public.file_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_comments.file_id) AND public.is_member_of_workspace(f.workspace_id)))));


--
-- Name: files sel_files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_files ON public.files FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: google_calendar_connections sel_google_calendar_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_google_calendar_connections ON public.google_calendar_connections FOR SELECT USING (((user_id = auth.uid()) AND public.is_member_of_workspace(workspace_id)));


--
-- Name: payment_events sel_payment_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_payment_events ON public.payment_events FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: payments sel_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_payments ON public.payments FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: project_members sel_project_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_project_members ON public.project_members FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_members.project_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: project_tags sel_project_tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_project_tags ON public.project_tags FOR SELECT USING (public.can_access_project(project_id));


--
-- Name: projects sel_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_projects ON public.projects FOR SELECT USING (public.can_access_project(id, workspace_id));


--
-- Name: tab_shares sel_tab_shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_tab_shares ON public.tab_shares FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.tabs t
     JOIN public.projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = tab_shares.tab_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: tabs sel_tabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_tabs ON public.tabs FOR SELECT USING (public.can_access_project(project_id));


--
-- Name: unstructured_chunks sel_unstructured_chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_unstructured_chunks ON public.unstructured_chunks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.unstructured_parents p
  WHERE ((p.id = unstructured_chunks.parent_id) AND public.is_member_of_workspace(p.workspace_id)))));


--
-- Name: unstructured_parents sel_unstructured_parents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_unstructured_parents ON public.unstructured_parents FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workspace_members sel_wm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_wm ON public.workspace_members FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workflow_messages sel_workflow_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_workflow_messages ON public.workflow_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workflow_sessions s
  WHERE ((s.id = workflow_messages.session_id) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: workflow_sessions sel_workflow_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_workflow_sessions ON public.workflow_sessions FOR SELECT USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workspaces sel_workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sel_workspaces ON public.workspaces FOR SELECT USING (public.is_member_of_workspace(id));


--
-- Name: shopify_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shopify_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: shopify_sync_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shopify_sync_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: slack_command_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_command_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: slack_user_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_user_links ENABLE ROW LEVEL SECURITY;

--
-- Name: slack_workspace_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_workspace_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: tab_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tab_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: table_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: table_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: table_relations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_relations ENABLE ROW LEVEL SECURITY;

--
-- Name: table_rows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: table_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_views ENABLE ROW LEVEL SECURITY;

--
-- Name: tables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

--
-- Name: tabs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tabs ENABLE ROW LEVEL SECURITY;

--
-- Name: task_assignees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

--
-- Name: task_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;

--
-- Name: task_references; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_references ENABLE ROW LEVEL SECURITY;

--
-- Name: task_subtask_references; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_subtask_references ENABLE ROW LEVEL SECURITY;

--
-- Name: task_subtasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

--
-- Name: task_tag_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_tag_links ENABLE ROW LEVEL SECURITY;

--
-- Name: task_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: timeline_dependencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.timeline_dependencies ENABLE ROW LEVEL SECURITY;

--
-- Name: timeline_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

--
-- Name: timeline_references; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.timeline_references ENABLE ROW LEVEL SECURITY;

--
-- Name: trak_product_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trak_product_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: trak_product_sales_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trak_product_sales_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: trak_product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trak_product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: trak_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trak_products ENABLE ROW LEVEL SECURITY;

--
-- Name: unstructured_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unstructured_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: unstructured_parents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unstructured_parents ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks upd_blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_blocks ON public.blocks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tabs t
  WHERE ((t.id = blocks.tab_id) AND public.can_access_project(t.project_id)))));


--
-- Name: clients upd_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_clients ON public.clients FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: comments upd_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_comments ON public.comments FOR UPDATE USING (true);


--
-- Name: file_analysis_artifacts upd_file_analysis_artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_file_analysis_artifacts ON public.file_analysis_artifacts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_analysis_artifacts.file_id) AND public.is_member_of_workspace(f.workspace_id)))));


--
-- Name: file_analysis_messages upd_file_analysis_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_file_analysis_messages ON public.file_analysis_messages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.file_analysis_sessions s
  WHERE ((s.id = file_analysis_messages.session_id) AND (s.user_id = auth.uid()) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: file_analysis_sessions upd_file_analysis_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_file_analysis_sessions ON public.file_analysis_sessions FOR UPDATE USING (((user_id = auth.uid()) AND public.is_member_of_workspace(workspace_id)));


--
-- Name: file_comments upd_file_comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_file_comments ON public.file_comments FOR UPDATE USING (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.files f
  WHERE ((f.id = file_comments.file_id) AND public.is_member_of_workspace(f.workspace_id))))));


--
-- Name: google_calendar_connections upd_google_calendar_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_google_calendar_connections ON public.google_calendar_connections FOR UPDATE USING (((user_id = auth.uid()) AND public.is_member_of_workspace(workspace_id)));


--
-- Name: payments upd_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_payments ON public.payments FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: projects upd_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_projects ON public.projects FOR UPDATE USING (public.can_access_project(id, workspace_id));


--
-- Name: tabs upd_tabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_tabs ON public.tabs FOR UPDATE USING (public.can_access_project(project_id));


--
-- Name: workspace_members upd_wm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_wm ON public.workspace_members FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workflow_messages upd_workflow_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_workflow_messages ON public.workflow_messages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workflow_sessions s
  WHERE ((s.id = workflow_messages.session_id) AND public.is_member_of_workspace(s.workspace_id)))));


--
-- Name: workflow_sessions upd_workflow_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_workflow_sessions ON public.workflow_sessions FOR UPDATE USING (public.is_member_of_workspace(workspace_id));


--
-- Name: workspaces upd_workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY upd_workspaces ON public.workspaces FOR UPDATE USING (public.is_member_of_workspace(id));


--
-- Name: workflow_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: objects delete_own_or_admin_files 1m0cqf_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "delete_own_or_admin_files 1m0cqf_0" ON storage.objects FOR DELETE USING (((bucket_id = 'files'::text) AND ((owner = auth.uid()) OR ((storage.foldername(name))[1] IN ( SELECT (w.id)::text AS id
   FROM (public.workspaces w
     JOIN public.workspace_members wm ON ((wm.workspace_id = w.id)))
  WHERE ((wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::public.role, 'admin'::public.role]))))))));


--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: objects read_workspace_files 1m0cqf_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "read_workspace_files 1m0cqf_0" ON storage.objects FOR SELECT USING (((bucket_id = 'files'::text) AND ((storage.foldername(name))[1] IN ( SELECT (w.id)::text AS id
   FROM (public.workspaces w
     JOIN public.workspace_members wm ON ((wm.workspace_id = w.id)))
  WHERE (wm.user_id = auth.uid())))));


--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: objects upload_to_workspace_folder 1m0cqf_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "upload_to_workspace_folder 1m0cqf_0" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'files'::text) AND ((storage.foldername(name))[1] IN ( SELECT (w.id)::text AS id
   FROM (public.workspaces w
     JOIN public.workspace_members wm ON ((wm.workspace_id = w.id)))
  WHERE (wm.user_id = auth.uid())))));


--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict d3au8FCGJZNQpDzEZAHTOMY46ksMY0XYN1qN7ZaXOvYXJ7rhX8lH3KaB1RTbX10

