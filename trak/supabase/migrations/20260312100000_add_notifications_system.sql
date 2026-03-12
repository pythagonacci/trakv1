CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('mention', 'task_assignment', 'client_comment', 'comment_reply', 'file_upload', 'task_status_change', 'due_date_change')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'client', 'system')),
  source_type text NOT NULL,
  source_id text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  tab_id uuid REFERENCES public.tabs(id) ON DELETE SET NULL,
  block_id uuid REFERENCES public.blocks(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.task_items(id) ON DELETE SET NULL,
  file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  comment_id text,
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_events_workspace_dedupe_key_key UNIQUE (workspace_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_recipients_event_recipient_key UNIQUE (event_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentions_enabled boolean NOT NULL DEFAULT true,
  task_assignments_enabled boolean NOT NULL DEFAULT true,
  client_comments_enabled boolean NOT NULL DEFAULT true,
  comment_replies_enabled boolean NOT NULL DEFAULT true,
  file_uploads_enabled boolean NOT NULL DEFAULT true,
  task_status_changes_enabled boolean NOT NULL DEFAULT true,
  due_date_changes_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_workspace_created_at
  ON public.notification_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_recipient_created_at
  ON public.notification_recipients(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_unread
  ON public.notification_recipients(recipient_id, workspace_id, read_at);

DROP TRIGGER IF EXISTS notification_preferences_set_updated_at ON public.notification_preferences;

CREATE TRIGGER notification_preferences_set_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notification events visible to recipients"
ON public.notification_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.notification_recipients nr
    WHERE nr.event_id = notification_events.id
      AND nr.recipient_id = auth.uid()
  )
);

CREATE POLICY "Notification recipients visible to recipient"
ON public.notification_recipients
FOR SELECT
USING (
  recipient_id = auth.uid()
  AND public.is_member_of_workspace(workspace_id)
);

CREATE POLICY "Notification recipients updatable by recipient"
ON public.notification_recipients
FOR UPDATE
USING (
  recipient_id = auth.uid()
  AND public.is_member_of_workspace(workspace_id)
)
WITH CHECK (
  recipient_id = auth.uid()
  AND public.is_member_of_workspace(workspace_id)
);

CREATE POLICY "Notification preferences visible to user"
ON public.notification_preferences
FOR SELECT
USING (
  user_id = auth.uid()
  AND public.is_member_of_workspace(workspace_id)
);

CREATE POLICY "Notification preferences insertable by user"
ON public.notification_preferences
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND public.is_member_of_workspace(workspace_id)
);

CREATE POLICY "Notification preferences updatable by user"
ON public.notification_preferences
FOR UPDATE
USING (
  user_id = auth.uid()
  AND public.is_member_of_workspace(workspace_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND public.is_member_of_workspace(workspace_id)
);
