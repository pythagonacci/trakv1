-- Create standalone_tasks table for tasks that are not attached to projects/tabs
CREATE TABLE IF NOT EXISTS standalone_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  priority TEXT DEFAULT 'none' CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
  assignees TEXT[] DEFAULT '{}',
  due_date DATE,
  due_time TIME,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_standalone_tasks_workspace_id ON standalone_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_standalone_tasks_status ON standalone_tasks(status);
CREATE INDEX IF NOT EXISTS idx_standalone_tasks_due_date ON standalone_tasks(due_date);

-- Enable RLS (Row Level Security)
ALTER TABLE standalone_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see tasks from workspaces they belong to
CREATE POLICY "Users can view standalone tasks from their workspaces"
  ON standalone_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = standalone_tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Users can insert tasks in workspaces they belong to
CREATE POLICY "Users can create standalone tasks in their workspaces"
  ON standalone_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = standalone_tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Users can update tasks in workspaces they belong to
CREATE POLICY "Users can update standalone tasks in their workspaces"
  ON standalone_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = standalone_tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Users can delete tasks in workspaces they belong to
CREATE POLICY "Users can delete standalone tasks in their workspaces"
  ON standalone_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = standalone_tasks.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_standalone_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_standalone_tasks_updated_at
  BEFORE UPDATE ON standalone_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_standalone_tasks_updated_at();

