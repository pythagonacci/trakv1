# Database Schema Documentation

This document provides detailed schema information for the requested tables, including columns and relationships.

## Table: task_items

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `task_block_id` (uuid, NOT NULL) - References blocks.id
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `project_id` (uuid, nullable) - References projects.id
- `tab_id` (uuid, nullable) - References tabs.id
- `title` (text, NOT NULL)
- `status` (text, NOT NULL, DEFAULT: 'todo') - CHECK: 'todo', 'in-progress', 'done'
- `priority` (text, nullable, DEFAULT: 'none') - CHECK: 'urgent', 'high', 'medium', 'low', 'none'
- `description` (text, nullable)
- `due_date` (date, nullable)
- `due_time` (time without time zone, nullable)
- `start_date` (date, nullable)
- `hide_icons` (boolean, DEFAULT: false)
- `display_order` (integer, NOT NULL, DEFAULT: 0)
- `recurring_enabled` (boolean, DEFAULT: false)
- `recurring_frequency` (text, nullable) - CHECK: 'daily', 'weekly', 'monthly'
- `recurring_interval` (integer, DEFAULT: 1)
- `created_by` (uuid, nullable) - References auth.users.id
- `updated_by` (uuid, nullable) - References auth.users.id
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `task_block_id` → `blocks.id` (ON DELETE CASCADE)
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
  - `project_id` → `projects.id` (ON DELETE SET NULL)
  - `tab_id` → `tabs.id` (ON DELETE SET NULL)
  - `created_by` → `auth.users.id` (ON DELETE SET NULL)
  - `updated_by` → `auth.users.id` (ON DELETE SET NULL)
- **Referenced By:**
  - `task_assignees.task_id`
  - `task_comments.task_id`
  - `task_references.task_id`
  - `task_subtasks.task_id`
  - `task_tag_links.task_id`

---

## Table: standalone_tasks

**Note:** This table does not exist in the current schema. It appears to have been removed (based on git status showing deleted files related to standalone tasks).

---

## Table: task_assignees

### Columns
- `task_id` (uuid, NOT NULL) - References task_items.id
- `assignee_id` (uuid, NOT NULL) - References auth.users.id
- `assignee_name` (text, NOT NULL)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `task_id` → `task_items.id` (ON DELETE CASCADE)
  - `assignee_id` → `auth.users.id` (ON DELETE SET NULL)

---

## Table: task_tags

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `name` (text, NOT NULL)
- `color` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
- **Referenced By:**
  - `task_tag_links.tag_id`

---

## Table: task_tag_links

### Columns
- `task_id` (uuid, NOT NULL) - References task_items.id
- `tag_id` (uuid, NOT NULL) - References task_tags.id
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `task_id` → `task_items.id` (ON DELETE CASCADE)
  - `tag_id` → `task_tags.id` (ON DELETE CASCADE)

---

## Table: task_references

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `task_id` (uuid, NOT NULL) - References task_items.id
- `reference_type` (text, NOT NULL) - CHECK: 'doc', 'table_row', 'task', 'block', 'tab'
- `reference_id` (uuid, NOT NULL)
- `table_id` (uuid, nullable) - References tables.id
- `created_by` (uuid, nullable) - References auth.users.id
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
  - `task_id` → `task_items.id` (ON DELETE CASCADE)
  - `table_id` → `tables.id` (ON DELETE SET NULL)
  - `created_by` → `auth.users.id` (ON DELETE SET NULL)

---

## Table: projects

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `client_id` (uuid, nullable) - References clients.id
- `name` (text, NOT NULL)
- `status` (proj_status, NOT NULL, DEFAULT: 'not_started')
- `due_date_date` (date, nullable)
- `due_date_text` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `project_type` (text, NOT NULL, DEFAULT: 'project') - CHECK: 'project', 'internal'
- `client_page_enabled` (boolean, DEFAULT: false)
- `public_token` (text, nullable)
- `client_comments_enabled` (boolean, DEFAULT: false)

### Constraints
- CHECK: Either `due_date_date` OR `due_date_text` can be set, but not both (XOR constraint)

### Relationships
- **Foreign Keys:**
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
  - `client_id` → `clients.id` (ON DELETE SET NULL)
- **Referenced By:**
  - `tabs.project_id`
  - `tables.project_id`
  - `task_items.project_id`
  - `files.project_id`
  - `payments.project_id`

---

## Table: clients

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `name` (text, NOT NULL)
- `email` (citext, nullable)
- `company` (text, nullable)
- `phone` (text, nullable)
- `address` (text, nullable)
- `website` (text, nullable)
- `notes` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
- **Referenced By:**
  - `projects.client_id`
  - `payments.client_id`
  - `client_tabs.client_id`

---

## Table: tabs

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `project_id` (uuid, NOT NULL) - References projects.id
- `parent_tab_id` (uuid, nullable) - References tabs.id (self-reference)
- `name` (text, NOT NULL)
- `position` (integer, NOT NULL, DEFAULT: 0)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `is_client_visible` (boolean, DEFAULT: false)
- `client_title` (text, nullable)

### Relationships
- **Foreign Keys:**
  - `project_id` → `projects.id` (ON DELETE CASCADE)
  - `parent_tab_id` → `tabs.id` (ON DELETE CASCADE) - Self-reference for nested tabs
- **Referenced By:**
  - `blocks.tab_id`
  - `task_items.tab_id`
  - `tab_shares.tab_id`
  - `client_page_views.tab_id`

---

## Table: blocks

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `tab_id` (uuid, NOT NULL) - References tabs.id
- `parent_block_id` (uuid, nullable) - References blocks.id (self-reference)
- `type` (block_type, NOT NULL)
- `content` (jsonb, NOT NULL, DEFAULT: '{}')
- `position` (integer, NOT NULL, DEFAULT: 0)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `column` (integer, NOT NULL, DEFAULT: 0) - CHECK: 0-2 (for up to 3 columns)
- `is_template` (boolean, DEFAULT: false)
- `template_name` (text, nullable)
- `original_block_id` (uuid, nullable) - References blocks.id

### Relationships
- **Foreign Keys:**
  - `tab_id` → `tabs.id` (ON DELETE CASCADE)
  - `parent_block_id` → `blocks.id` (ON DELETE CASCADE) - Self-reference for nested blocks
  - `original_block_id` → `blocks.id` (ON DELETE CASCADE) - For block references
- **Referenced By:**
  - `task_items.task_block_id`
  - `timeline_events.timeline_block_id`
  - `timeline_dependencies.timeline_block_id`
  - `file_attachments.block_id`
  - `block_highlights.block_id`

---

## Table: tables

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `project_id` (uuid, nullable) - References projects.id
- `title` (text, NOT NULL, DEFAULT: 'Untitled Table')
- `description` (text, nullable)
- `icon` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `created_by` (uuid, nullable) - References auth.users.id

### Relationships
- **Foreign Keys:**
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
  - `project_id` → `projects.id` (ON DELETE CASCADE)
  - `created_by` → `auth.users.id`
- **Referenced By:**
  - `table_fields.table_id`
  - `table_rows.table_id`
  - `table_views.table_id`
  - `table_relations.from_table_id`
  - `table_relations.to_table_id`
  - `task_references.table_id`
  - `timeline_references.table_id`

---

## Table: table_rows

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `table_id` (uuid, NOT NULL) - References tables.id
- `data` (jsonb, NOT NULL, DEFAULT: '{}')
- `order` (numeric, NOT NULL)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `created_by` (uuid, nullable) - References auth.users.id
- `updated_by` (uuid, nullable) - References auth.users.id

### Relationships
- **Foreign Keys:**
  - `table_id` → `tables.id` (ON DELETE CASCADE)
  - `created_by` → `auth.users.id`
  - `updated_by` → `auth.users.id`
- **Referenced By:**
  - `table_comments.row_id`
  - `table_relations.from_row_id`
  - `table_relations.to_row_id`

---

## Table: table_fields

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `table_id` (uuid, NOT NULL) - References tables.id
- `name` (text, NOT NULL, DEFAULT: 'Untitled Field')
- `type` (text, NOT NULL) - CHECK: 'text', 'long_text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url', 'email', 'phone', 'person', 'files', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by', 'formula', 'relation', 'rollup', 'status', 'priority'
- `config` (jsonb, NOT NULL, DEFAULT: '{}')
- `order` (integer, NOT NULL)
- `is_primary` (boolean, DEFAULT: false)
- `width` (integer, nullable)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `table_id` → `tables.id` (ON DELETE CASCADE)
- **Referenced By:**
  - `table_relations.from_field_id`

---

## Table: docs

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `title` (text, NOT NULL, DEFAULT: 'Untitled Document')
- `content` (jsonb, NOT NULL, DEFAULT: '{"type": "doc", "content": [{"type": "paragraph"}]}') - ProseMirror JSON from Tiptap editor
- `created_by` (uuid, NOT NULL) - References auth.users.id
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `last_edited_by` (uuid, nullable) - References auth.users.id
- `is_archived` (boolean, DEFAULT: false)

### Relationships
- **Foreign Keys:**
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
  - `created_by` → `auth.users.id` (ON DELETE CASCADE)
  - `last_edited_by` → `auth.users.id` (ON DELETE SET NULL)

---

## Table: timeline_events

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `timeline_block_id` (uuid, NOT NULL) - References blocks.id
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `title` (text, NOT NULL)
- `start_date` (timestamp with time zone, NOT NULL)
- `end_date` (timestamp with time zone, NOT NULL)
- `status` (text, DEFAULT: 'planned') - CHECK: 'planned', 'in-progress', 'blocked', 'done'
- `assignee_id` (uuid, nullable) - References auth.users.id
- `progress` (integer, DEFAULT: 0) - CHECK: 0-100
- `notes` (text, nullable)
- `color` (text, DEFAULT: 'bg-blue-500/50')
- `is_milestone` (boolean, DEFAULT: false)
- `baseline_start` (timestamp with time zone, nullable)
- `baseline_end` (timestamp with time zone, nullable)
- `display_order` (integer, NOT NULL, DEFAULT: 0)
- `created_by` (uuid, nullable) - References auth.users.id
- `updated_by` (uuid, nullable) - References auth.users.id
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Constraints
- CHECK: `start_date <= end_date`

### Relationships
- **Foreign Keys:**
  - `timeline_block_id` → `blocks.id` (ON DELETE CASCADE)
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
  - `assignee_id` → `auth.users.id` (ON DELETE SET NULL)
  - `created_by` → `auth.users.id` (ON DELETE SET NULL)
  - `updated_by` → `auth.users.id` (ON DELETE SET NULL)
- **Referenced By:**
  - `timeline_references.event_id`
  - `timeline_dependencies.from_id`
  - `timeline_dependencies.to_id`

---

## Table: timeline_references

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `event_id` (uuid, NOT NULL) - References timeline_events.id
- `reference_type` (text, NOT NULL) - CHECK: 'doc', 'table_row', 'task', 'block'
- `reference_id` (uuid, NOT NULL)
- `table_id` (uuid, nullable) - References tables.id
- `created_by` (uuid, nullable) - References auth.users.id
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
  - `event_id` → `timeline_events.id` (ON DELETE CASCADE)
  - `table_id` → `tables.id` (ON DELETE SET NULL)
  - `created_by` → `auth.users.id` (ON DELETE SET NULL)

---

## Table: files

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `workspace_id` (uuid, NOT NULL) - References workspaces.id
- `uploaded_by` (uuid, NOT NULL) - References auth.users.id
- `file_name` (text, NOT NULL)
- `file_size` (bigint, NOT NULL)
- `file_type` (text, nullable)
- `bucket` (text, NOT NULL, DEFAULT: 'files')
- `storage_path` (text, NOT NULL)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `project_id` (uuid, NOT NULL) - References projects.id

### Relationships
- **Foreign Keys:**
  - `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
  - `uploaded_by` → `auth.users.id` (ON DELETE SET NULL)
  - `project_id` → `projects.id` (ON DELETE CASCADE)
- **Referenced By:**
  - `file_attachments.file_id`

---

## Table: file_attachments

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `file_id` (uuid, NOT NULL) - References files.id
- `block_id` (uuid, NOT NULL) - References blocks.id
- `display_mode` (file_display_mode, NOT NULL, DEFAULT: 'inline')
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `file_id` → `files.id` (ON DELETE CASCADE)
  - `block_id` → `blocks.id` (ON DELETE CASCADE)

---

## Table: comments

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `target_type` (target_type, NOT NULL)
- `target_id` (uuid, NOT NULL)
- `user_id` (uuid, NOT NULL) - References auth.users.id
- `text` (text, NOT NULL)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `deleted_at` (timestamp with time zone, nullable)

### Relationships
- **Foreign Keys:**
  - `user_id` → `auth.users.id` (ON DELETE SET NULL)

---

## Table: task_comments

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `task_id` (uuid, NOT NULL) - References task_items.id
- `author_id` (uuid, nullable) - References auth.users.id
- `text` (text, NOT NULL)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `task_id` → `task_items.id` (ON DELETE CASCADE)
  - `author_id` → `auth.users.id` (ON DELETE SET NULL)

---

## Table: table_comments

### Columns
- `id` (uuid, PRIMARY KEY) - Default: gen_random_uuid()
- `row_id` (uuid, NOT NULL) - References table_rows.id
- `user_id` (uuid, NOT NULL) - References auth.users.id
- `content` (text, NOT NULL)
- `parent_id` (uuid, nullable) - References table_comments.id (self-reference for threaded comments)
- `resolved` (boolean, DEFAULT: false)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT: now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT: now())

### Relationships
- **Foreign Keys:**
  - `row_id` → `table_rows.id` (ON DELETE CASCADE)
  - `user_id` → `auth.users.id`
  - `parent_id` → `table_comments.id` (ON DELETE CASCADE) - Self-reference for threaded comments

---

## Summary of Key Relationships

### Workspace Hierarchy
- `workspaces` → `projects`, `clients`, `tables`, `docs`, `task_items`, `task_tags`, `timeline_events`, `files`
- `projects` → `tabs`, `tables`, `task_items`, `files`
- `tabs` → `blocks`
- `blocks` → `task_items` (via task_block_id), `timeline_events` (via timeline_block_id)

### Task Relationships
- `task_items` → `task_assignees`, `task_comments`, `task_references`, `task_subtasks`, `task_tag_links`
- `task_tags` → `task_tag_links` (many-to-many with task_items)

### Table Relationships
- `tables` → `table_fields`, `table_rows`, `table_views`
- `table_rows` → `table_comments`, `table_relations`
- `table_fields` → `table_relations`

### Reference System
- `task_references` links tasks to: docs, table_rows, tasks, blocks, tabs
- `timeline_references` links timeline events to: docs, table_rows, tasks, blocks

### File System
- `files` → `file_attachments` → `blocks`

### Comment System
- `comments` - Generic comments (polymorphic via target_type/target_id)
- `task_comments` - Task-specific comments
- `table_comments` - Table row comments (supports threading via parent_id)
