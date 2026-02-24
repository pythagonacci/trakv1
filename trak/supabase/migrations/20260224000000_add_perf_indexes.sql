-- Hot path indexes for task block loading
-- NOTE: Using non-concurrent to be compatible with transaction-wrapped migrations.
-- For production, consider running these manually as CONCURRENTLY during off-hours.
CREATE INDEX IF NOT EXISTS idx_task_items_block_order
  ON task_items(task_block_id, display_order);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_order
  ON task_subtasks(task_id, display_order);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_created
  ON task_comments(task_id, created_at);

CREATE INDEX IF NOT EXISTS idx_task_tag_links_task
  ON task_tag_links(task_id);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task
  ON task_assignees(task_id);

-- Hot path indexes for table loading
CREATE INDEX IF NOT EXISTS idx_table_rows_table_order
  ON table_rows(table_id, "order");

CREATE INDEX IF NOT EXISTS idx_table_fields_table_order
  ON table_fields(table_id, "order");
