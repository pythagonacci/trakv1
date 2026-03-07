-- Google Drive integration: workspace OAuth connection + external assets + entity links + project folder mapping

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_workspace(workspace_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_id_param
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_asset_entity(
  entity_type_param text,
  entity_id_param text,
  workspace_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF NOT public.is_member_of_workspace(workspace_id_param) THEN
    RETURN false;
  END IF;

  -- Project-level links
  IF entity_type_param = 'project' THEN
    IF entity_id_param !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN false;
    END IF;
    RETURN public.can_access_project(entity_id_param::uuid);
  END IF;

  -- Tab-level links inherit project permissions
  IF entity_type_param = 'tab' THEN
    IF entity_id_param !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN false;
    END IF;
    RETURN EXISTS (
      SELECT 1
      FROM public.tabs t
      WHERE t.id = entity_id_param::uuid
        AND public.can_access_project(t.project_id)
    );
  END IF;

  -- Block-level links inherit tab/project permissions
  IF entity_type_param = 'block' THEN
    IF entity_id_param !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN false;
    END IF;
    RETURN EXISTS (
      SELECT 1
      FROM public.blocks b
      INNER JOIN public.tabs t ON t.id = b.tab_id
      WHERE b.id = entity_id_param::uuid
        AND public.can_access_project(t.project_id)
    );
  END IF;

  -- Task-level links inherit task tab/project permissions
  IF entity_type_param = 'task' THEN
    IF entity_id_param !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN false;
    END IF;
    RETURN EXISTS (
      SELECT 1
      FROM public.task_items ti
      INNER JOIN public.tabs t ON t.id = ti.tab_id
      WHERE ti.id = entity_id_param::uuid
        AND public.can_access_project(t.project_id)
    );
  END IF;

  -- Doc links: workspace membership + project access if doc belongs to a project
  IF entity_type_param = 'doc' THEN
    IF entity_id_param !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN false;
    END IF;
    RETURN EXISTS (
      SELECT 1
      FROM public.docs d
      WHERE d.id = entity_id_param::uuid
        AND d.workspace_id = workspace_id_param
        AND (d.project_id IS NULL OR public.can_access_project(d.project_id))
    );
  END IF;

  -- Fallback for other entity types in v1: workspace-level membership only
  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Workspace-scoped Google Drive OAuth connection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drive_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  google_account_email text NOT NULL,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  encryption_key_id text NOT NULL DEFAULT 'v1',
  token_expiry timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_drive_connections_workspace UNIQUE (workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_connections_workspace_id
  ON public.drive_connections(workspace_id);

CREATE TRIGGER drive_connections_updated_at
  BEFORE UPDATE ON public.drive_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.drive_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel_drive_connections
  ON public.drive_connections FOR SELECT
  USING (public.is_member_of_workspace(workspace_id));

CREATE POLICY ins_drive_connections
  ON public.drive_connections FOR INSERT
  WITH CHECK (
    public.is_member_of_workspace(workspace_id)
    AND public.can_manage_workspace(workspace_id)
  );

CREATE POLICY upd_drive_connections
  ON public.drive_connections FOR UPDATE
  USING (
    public.is_member_of_workspace(workspace_id)
    AND public.can_manage_workspace(workspace_id)
  );

CREATE POLICY del_drive_connections
  ON public.drive_connections FOR DELETE
  USING (
    public.is_member_of_workspace(workspace_id)
    AND public.can_manage_workspace(workspace_id)
  );

-- ---------------------------------------------------------------------------
-- 2) First-class external assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_drive')),
  provider_item_id text NOT NULL,
  item_kind text NOT NULL CHECK (item_kind IN ('file', 'folder')),
  name text NOT NULL,
  mime_type text,
  web_view_link text,
  web_content_link text,
  thumbnail_link text,
  icon_link text,
  size_bytes bigint,
  modified_time timestamptz,
  owner_display text,
  stale_state text NOT NULL DEFAULT 'active' CHECK (stale_state IN ('active', 'not_found', 'trashed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_external_assets_provider_item UNIQUE (workspace_id, provider, provider_item_id)
);

CREATE INDEX IF NOT EXISTS idx_external_assets_workspace_provider
  ON public.external_assets(workspace_id, provider);

CREATE INDEX IF NOT EXISTS idx_external_assets_modified_time
  ON public.external_assets(modified_time DESC);

CREATE TRIGGER external_assets_updated_at
  BEFORE UPDATE ON public.external_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.external_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY ins_external_assets
  ON public.external_assets FOR INSERT
  WITH CHECK (public.is_member_of_workspace(workspace_id));

CREATE POLICY upd_external_assets
  ON public.external_assets FOR UPDATE
  USING (public.is_member_of_workspace(workspace_id));

CREATE POLICY del_external_assets
  ON public.external_assets FOR DELETE
  USING (public.is_member_of_workspace(workspace_id));

-- ---------------------------------------------------------------------------
-- 3) External asset links to Trak entities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.external_assets(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_asset_links_entity UNIQUE (workspace_id, asset_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_links_entity
  ON public.asset_links(workspace_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_asset_links_asset
  ON public.asset_links(workspace_id, asset_id);

ALTER TABLE public.asset_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel_asset_links
  ON public.asset_links FOR SELECT
  USING (
    public.is_member_of_workspace(workspace_id)
    AND public.can_access_asset_entity(entity_type, entity_id, workspace_id)
  );

CREATE POLICY ins_asset_links
  ON public.asset_links FOR INSERT
  WITH CHECK (
    public.is_member_of_workspace(workspace_id)
    AND public.can_access_asset_entity(entity_type, entity_id, workspace_id)
  );

CREATE POLICY del_asset_links
  ON public.asset_links FOR DELETE
  USING (
    public.is_member_of_workspace(workspace_id)
    AND public.can_access_asset_entity(entity_type, entity_id, workspace_id)
  );

-- ---------------------------------------------------------------------------
-- 4) Per-project canonical Drive folder mapping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  drive_folder_asset_id uuid NOT NULL REFERENCES public.external_assets(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_project_drive_folders_project UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_drive_folders_workspace
  ON public.project_drive_folders(workspace_id, project_id);

CREATE TRIGGER project_drive_folders_updated_at
  BEFORE UPDATE ON public.project_drive_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.project_drive_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel_project_drive_folders
  ON public.project_drive_folders FOR SELECT
  USING (
    public.is_member_of_workspace(workspace_id)
    AND public.can_access_project(project_id)
  );

CREATE POLICY ins_project_drive_folders
  ON public.project_drive_folders FOR INSERT
  WITH CHECK (
    public.is_member_of_workspace(workspace_id)
    AND public.can_access_project(project_id)
  );

CREATE POLICY upd_project_drive_folders
  ON public.project_drive_folders FOR UPDATE
  USING (
    public.is_member_of_workspace(workspace_id)
    AND public.can_access_project(project_id)
  );

CREATE POLICY del_project_drive_folders
  ON public.project_drive_folders FOR DELETE
  USING (
    public.is_member_of_workspace(workspace_id)
    AND public.can_access_project(project_id)
  );

-- external_assets SELECT policy depends on asset_links and project_drive_folders.
CREATE POLICY sel_external_assets
  ON public.external_assets FOR SELECT
  USING (
    public.is_member_of_workspace(workspace_id)
    AND (
      EXISTS (
        SELECT 1
        FROM public.asset_links al
        WHERE al.asset_id = external_assets.id
          AND public.can_access_asset_entity(al.entity_type, al.entity_id, al.workspace_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_drive_folders pdf
        WHERE pdf.drive_folder_asset_id = external_assets.id
          AND public.can_access_project(pdf.project_id)
      )
      OR created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Integration event audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_drive_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_drive_audit_log_workspace_created
  ON public.google_drive_audit_log(workspace_id, created_at DESC);

ALTER TABLE public.google_drive_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel_google_drive_audit_log
  ON public.google_drive_audit_log FOR SELECT
  USING (
    public.is_member_of_workspace(workspace_id)
    AND public.can_manage_workspace(workspace_id)
  );

CREATE POLICY ins_google_drive_audit_log
  ON public.google_drive_audit_log FOR INSERT
  WITH CHECK (public.is_member_of_workspace(workspace_id));

COMMENT ON TABLE public.drive_connections IS 'Workspace-scoped Google Drive OAuth credentials (encrypted tokens)';
COMMENT ON TABLE public.external_assets IS 'First-class external assets linked from providers like Google Drive';
COMMENT ON TABLE public.asset_links IS 'Maps external assets to Trak entities (project, task, block, doc, etc.)';
COMMENT ON TABLE public.project_drive_folders IS 'Canonical Google Drive folder mapping per project';
COMMENT ON TABLE public.google_drive_audit_log IS 'Audit events for Google Drive integration lifecycle and linking actions';
