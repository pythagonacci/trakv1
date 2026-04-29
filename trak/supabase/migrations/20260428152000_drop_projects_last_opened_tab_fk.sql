-- Keep the projects.last_opened_tab_id column for sidebar recents,
-- but drop the foreign key to tabs. The FK creates a second projects<->tabs
-- relationship, which makes existing PostgREST embeds ambiguous across task,
-- card, timeline, and block queries that rely on the canonical tabs.project_id
-- relationship.

alter table projects
  drop constraint if exists projects_last_opened_tab_id_fkey;
