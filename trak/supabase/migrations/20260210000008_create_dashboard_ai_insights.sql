-- Create table for caching AI-generated dashboard insights
-- This enables fast page loads by storing pre-generated AI analysis

CREATE TABLE dashboard_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  content jsonb NOT NULL, -- { summary, priorities, actionItems, blockers }
  metadata jsonb, -- { taskCount, overdueCount, dueToday, toolsUsed }
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id) -- Only store latest insight per workspace
);

-- Indexes for efficient querying
CREATE INDEX idx_dashboard_ai_insights_workspace ON dashboard_ai_insights(workspace_id);
CREATE INDEX idx_dashboard_ai_insights_generated_at ON dashboard_ai_insights(generated_at DESC);

-- Add RLS policies
ALTER TABLE dashboard_ai_insights ENABLE ROW LEVEL SECURITY;

-- Users can only see insights for their workspace
CREATE POLICY "Users can view dashboard insights for their workspace"
  ON dashboard_ai_insights
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert/update insights for their workspace
CREATE POLICY "Users can manage dashboard insights for their workspace"
  ON dashboard_ai_insights
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
