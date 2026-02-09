-- ============================================================================
-- SLACK INTEGRATION MIGRATION
-- ============================================================================
-- This migration creates tables for Slack OAuth, workspace connections,
-- user account linking, slash command audit logs, rate limiting, and idempotency.

-- 1. Slack workspace connections (1:1 with Trak workspace for v1)
CREATE TABLE IF NOT EXISTS slack_workspace_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slack_team_id text NOT NULL UNIQUE,
  slack_team_name text NOT NULL,

  -- OAuth tokens (encrypted)
  bot_access_token_encrypted text NOT NULL,
  encryption_key_id text NOT NULL DEFAULT 'v1',

  -- Scopes and metadata
  scopes text[] NOT NULL DEFAULT '{}',
  bot_user_id text NOT NULL,

  -- Status tracking
  connection_status text NOT NULL DEFAULT 'active'
    CHECK (connection_status IN ('active', 'error', 'disconnected')),
  last_error text,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Only one Slack workspace can be linked to a Trak workspace (v1 constraint)
  CONSTRAINT uq_slack_workspace_per_trak_workspace UNIQUE (workspace_id)
);

CREATE INDEX idx_slack_workspace_connections_workspace_id
  ON slack_workspace_connections(workspace_id);
CREATE INDEX idx_slack_workspace_connections_team_id
  ON slack_workspace_connections(slack_team_id);
CREATE INDEX idx_slack_workspace_connections_status
  ON slack_workspace_connections(connection_status);

-- Trigger for updated_at
CREATE TRIGGER slack_workspace_connections_updated_at
  BEFORE UPDATE ON slack_workspace_connections
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS policies
ALTER TABLE slack_workspace_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace's Slack connection"
  ON slack_workspace_connections FOR SELECT
  USING (is_member_of_workspace(workspace_id));

CREATE POLICY "Admins can insert Slack connections for their workspace"
  ON slack_workspace_connections FOR INSERT
  WITH CHECK (
    is_member_of_workspace(workspace_id) AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = slack_workspace_connections.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update their workspace's Slack connection"
  ON slack_workspace_connections FOR UPDATE
  USING (
    is_member_of_workspace(workspace_id) AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = slack_workspace_connections.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete their workspace's Slack connection"
  ON slack_workspace_connections FOR DELETE
  USING (
    is_member_of_workspace(workspace_id) AND
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = slack_workspace_connections.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- 2. Slack user account linking (many-to-many: Slack users <-> Trak users)
CREATE TABLE IF NOT EXISTS slack_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_connection_id uuid NOT NULL
    REFERENCES slack_workspace_connections(id) ON DELETE CASCADE,
  slack_user_id text NOT NULL,
  trak_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Linked status
  linked_at timestamptz DEFAULT now() NOT NULL,
  link_status text NOT NULL DEFAULT 'active'
    CHECK (link_status IN ('active', 'revoked')),

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- One Slack user can only link to one Trak user per Slack workspace
  CONSTRAINT uq_slack_user_link_per_team UNIQUE (slack_connection_id, slack_user_id)
);

CREATE INDEX idx_slack_user_links_connection_id
  ON slack_user_links(slack_connection_id);
CREATE INDEX idx_slack_user_links_slack_user_id
  ON slack_user_links(slack_user_id);
CREATE INDEX idx_slack_user_links_trak_user_id
  ON slack_user_links(trak_user_id);
CREATE INDEX idx_slack_user_links_status
  ON slack_user_links(link_status);

-- Trigger for updated_at
CREATE TRIGGER slack_user_links_updated_at
  BEFORE UPDATE ON slack_user_links
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS policies
ALTER TABLE slack_user_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Slack links"
  ON slack_user_links FOR SELECT
  USING (trak_user_id = auth.uid());

CREATE POLICY "Users can insert their own Slack links"
  ON slack_user_links FOR INSERT
  WITH CHECK (trak_user_id = auth.uid());

CREATE POLICY "Users can update their own Slack links"
  ON slack_user_links FOR UPDATE
  USING (trak_user_id = auth.uid());

CREATE POLICY "Users can delete their own Slack links"
  ON slack_user_links FOR DELETE
  USING (trak_user_id = auth.uid());

-- 3. Slash command audit log (compliance + debugging)
CREATE TABLE IF NOT EXISTS slack_command_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_connection_id uuid NOT NULL
    REFERENCES slack_workspace_connections(id) ON DELETE CASCADE,
  slack_user_id text NOT NULL,
  trak_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Command details
  command_text text NOT NULL,
  channel_id text NOT NULL,
  channel_name text,

  -- Request metadata
  request_id text, -- Slack's unique request ID for idempotency
  ip_address inet,
  user_agent text,

  -- Response tracking
  response_status text NOT NULL DEFAULT 'pending'
    CHECK (response_status IN ('pending', 'success', 'error', 'unauthorized', 'rate_limited')),
  response_summary text,
  error_message text,

  -- Execution metrics
  execution_time_ms integer,
  tools_used text[], -- Array of tool names called

  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_slack_command_audit_log_connection_id
  ON slack_command_audit_log(slack_connection_id);
CREATE INDEX idx_slack_command_audit_log_slack_user_id
  ON slack_command_audit_log(slack_user_id);
CREATE INDEX idx_slack_command_audit_log_trak_user_id
  ON slack_command_audit_log(trak_user_id);
CREATE INDEX idx_slack_command_audit_log_created_at
  ON slack_command_audit_log(created_at DESC);
CREATE INDEX idx_slack_command_audit_log_request_id
  ON slack_command_audit_log(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_slack_command_audit_log_status
  ON slack_command_audit_log(response_status);

-- RLS policies (admins only can view audit logs)
ALTER TABLE slack_command_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs for their workspace"
  ON slack_command_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM slack_workspace_connections swc
      INNER JOIN workspace_members wm
        ON wm.workspace_id = swc.workspace_id
      WHERE swc.id = slack_command_audit_log.slack_connection_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Service role can insert (API routes will use service client for logging)
CREATE POLICY "Service can insert audit logs"
  ON slack_command_audit_log FOR INSERT
  WITH CHECK (true); -- No RLS for inserts from service role

-- 4. Rate limiting table (per-user, per-team sliding window)
CREATE TABLE IF NOT EXISTS slack_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL UNIQUE, -- "team:TEAM_ID:user:USER_ID" or "team:TEAM_ID"

  -- Sliding window counters
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),

  -- Metadata
  last_request_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_slack_rate_limits_identifier
  ON slack_rate_limits(identifier);
CREATE INDEX idx_slack_rate_limits_window_start
  ON slack_rate_limits(window_start);

-- Trigger for updated_at
CREATE TRIGGER slack_rate_limits_updated_at
  BEFORE UPDATE ON slack_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- No RLS needed (managed by service role only)

-- 5. Idempotency tracking (prevent duplicate slash command processing)
CREATE TABLE IF NOT EXISTS slack_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE, -- Format: "team:TEAM_ID:request:REQUEST_ID"

  -- Response cache
  response_payload jsonb NOT NULL,

  -- TTL (expire after 24 hours)
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_slack_idempotency_keys_key
  ON slack_idempotency_keys(idempotency_key);
CREATE INDEX idx_slack_idempotency_keys_expires_at
  ON slack_idempotency_keys(expires_at);

-- No RLS needed (managed by service role only)

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Cleanup function for expired idempotency keys (run hourly via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_slack_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM slack_idempotency_keys WHERE expires_at < now();
END;
$$;

-- Helper function to get workspace ID from Slack team ID
CREATE OR REPLACE FUNCTION get_workspace_id_from_slack_team(team_id text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT workspace_id
  FROM slack_workspace_connections
  WHERE slack_team_id = team_id
    AND connection_status = 'active'
  LIMIT 1;
$$;

-- Helper function to check if Slack user is linked (returns Trak user ID if linked)
CREATE OR REPLACE FUNCTION is_slack_user_linked(team_id text, slack_user_id text)
RETURNS uuid
LANGUAGE sql
STABLE
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

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE slack_workspace_connections IS 'Stores Slack workspace OAuth connections with encrypted bot tokens';
COMMENT ON TABLE slack_user_links IS 'Maps Slack users to Trak users for account linking';
COMMENT ON TABLE slack_command_audit_log IS 'Audit log for all Slack slash commands';
COMMENT ON TABLE slack_rate_limits IS 'Rate limiting state for Slack commands (sliding window)';
COMMENT ON TABLE slack_idempotency_keys IS 'Idempotency cache for Slack command deduplication (24hr TTL)';
