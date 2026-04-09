import { describe, expect, it } from "vitest";
import {
  buildProjectTaskRollupConfig,
  buildProjectTaskRollupMirrorSeeds,
  isProjectTaskRollupBlockContent,
} from "@/lib/tasks/project-rollup";

describe("project task rollup helpers", () => {
  it("detects rollup-enabled task block content", () => {
    expect(isProjectTaskRollupBlockContent({ projectRollup: buildProjectTaskRollupConfig() })).toBe(true);
    expect(isProjectTaskRollupBlockContent({ title: "Plain list" })).toBe(false);
  });

  it("builds live task mirrors for rollup blocks", () => {
    const result = buildProjectTaskRollupMirrorSeeds({
      sourceTasks: [
        {
          id: "task-1",
          task_block_id: "block-source",
          workspace_id: "ws-1",
          project_id: "project-1",
          tab_id: "tab-source",
          title: "Write launch email",
          description: "Draft and review",
          due_date: "2026-04-10",
          due_time: null,
          due_time_end: null,
          start_date: "2026-04-08",
          hide_icons: false,
          display_order: 0,
          recurring_enabled: false,
          recurring_frequency: null,
          recurring_interval: 1,
          assignee_id: "user-1",
          source_task_id: null,
          source_entity_type: null,
          source_entity_id: null,
          source_sync_mode: null,
          priorities: [{ field_name: "Priority", value: "high" }],
          statuses: [{ field_name: "Status", value: "todo" }],
          assignees: [{ field_name: "Assignee", value: ["user-1"] }],
          due_dates: [{ field_name: "Due Date", value: { start: "2026-04-08", end: "2026-04-10" } }],
        },
      ],
      rollupBlocks: [
        {
          id: "block-rollup",
          tab_id: "tab-rollup",
          workspace_id: "ws-1",
          project_id: "project-1",
        },
      ],
      actorUserId: "user-2",
      taskTagLinks: [{ task_id: "task-1", tag_id: "tag-1" }],
      entityProperties: [
        {
          entity_id: "task-1",
          entity_type: "task",
          field_name: "Priority",
          field_type: "priority",
          value: "high",
          workspace_id: "ws-1",
        },
      ],
      taskAssignees: [{ task_id: "task-1", assignee_id: "user-1", assignee_name: "Amna" }],
    });

    expect(result.taskItems).toHaveLength(1);
    expect(result.taskItems[0]).toMatchObject({
      task_block_id: "block-rollup",
      tab_id: "tab-rollup",
      source_task_id: "task-1",
      source_entity_type: "task",
      source_entity_id: "task-1",
      source_sync_mode: "live",
      title: "Write launch email",
    });
    expect(result.taskTagLinks).toHaveLength(1);
    expect(result.entityProperties).toHaveLength(1);
    expect(result.taskAssignees).toHaveLength(1);
    expect(result.taskTagLinks[0]?.tag_id).toBe("tag-1");
    expect(result.entityProperties[0]?.field_name).toBe("Priority");
    expect(result.taskAssignees[0]?.assignee_name).toBe("Amna");
  });
});
