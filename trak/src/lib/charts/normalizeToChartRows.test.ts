import { describe, it, expect } from "vitest";
import { normalizeToChartRows } from "./normalizeToChartRows";
import { buildChartData } from "./transform";
import { applySpecFallbacks, type ChartSpec } from "./chartSpec";

function makeSpec(overrides: Partial<ChartSpec>): ChartSpec {
  const base: ChartSpec = {
    version: 1,
    chartType: "pie",
    orientation: "horizontal",
    breakdown: { field: "status" },
    measure: { type: "count" },
    normalizeTo: "focus",
    pieComposition: "breakdownOnly",
    restLabel: "Rest",
    includeOtherBucket: false,
    otherLabel: "Other",
    sort: "value_desc",
  };
  return applySpecFallbacks({ ...base, ...overrides });
}

describe("normalizeToChartRows", () => {
  describe("tasks", () => {
    it("produces ChartRow[] with id, Task Title, status, priority, assignee, tags", () => {
      const raw = [
        {
          id: "t1",
          title: "Fix bug",
          statuses: [{ field_name: "Status", value: "in_progress" }],
          priorities: [{ field_name: "Priority", value: "high" }],
          assignees: [{ id: "u1", name: "Alice" }],
          tags: [{ id: "tag1", name: "frontend", color: "#ccc" }],
          due_date: "2025-03-01",
        },
        {
          id: "t2",
          title: "Ship feature",
          statuses: [{ field_name: "Status", value: "done" }],
          priorities: [],
          assignees: [],
          tags: [],
        },
      ];
      const rows = normalizeToChartRows("tasks", raw);
      expect(rows).toHaveLength(2);

      expect(rows[0]).toMatchObject({
        id: "t1",
        "Task Title": "Fix bug",
        status: "in_progress",
        priority: "high",
        assignee: "Alice",
        tags: ["frontend"],
      });
      expect(rows[0!]["Due Date"]).toBe("2025-03-01");

      expect(rows[1]).toMatchObject({
        id: "t2",
        "Task Title": "Ship feature",
        status: "done",
      });
      expect(rows[1!].priority).toBeUndefined();
      expect(rows[1!].assignee).toBeUndefined();
      expect(rows[1!].tags).toBeUndefined();
    });

    it("output works with buildChartData (status breakdown)", () => {
      const raw = [
        { id: "a", title: "A", statuses: [{ value: "todo" }], priorities: [], assignees: [], tags: [] },
        { id: "b", title: "B", statuses: [{ value: "todo" }], priorities: [], assignees: [], tags: [] },
        { id: "c", title: "C", statuses: [{ value: "done" }], priorities: [], assignees: [], tags: [] },
      ];
      const rows = normalizeToChartRows("tasks", raw);
      const chartData = buildChartData({
        focusRows: rows,
        spec: makeSpec({ breakdown: { field: "status" } }),
      });
      expect(chartData.type).toBe("categorical");
      if (chartData.type !== "categorical") return;
      const byLabel = Object.fromEntries(chartData.data.map((d) => [d.label, d.value]));
      expect(byLabel["todo"]).toBe(2);
      expect(byLabel["done"]).toBe(1);
    });
  });

  describe("timeline_events", () => {
    it("produces ChartRow[] with id, Task Title, status, assignee", () => {
      const raw = [
        {
          id: "e1",
          title: "Kickoff",
          statuses: [{ value: "planned" }],
          priorities: [],
          assignee_name: "Bob",
          assignee_id: "u2",
          start_date: "2025-02-01",
          end_date: "2025-02-02",
          progress: 0,
        },
      ];
      const rows = normalizeToChartRows("timeline_events", raw);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: "e1",
        "Task Title": "Kickoff",
        assignee: "Bob",
        "Start Date": "2025-02-01",
        "End Date": "2025-02-02",
      });
      expect(rows[0!].progress).toBe(0);
    });
  });

  describe("subtasks", () => {
    it("produces ChartRow[] with subtask metadata and derived status", () => {
      const raw = [
        {
          id: "st1",
          title: "Write docs",
          completed: false,
          task_id: "task-1",
          task_title: "Launch checklist",
        },
        {
          id: "st2",
          title: "Review copy",
          status: "done",
          completed: false,
          priority: "high",
          due_date: "2025-04-02T10:00:00.000Z",
          task_id: "task-1",
          task_title: "Launch checklist",
        },
      ];

      const rows = normalizeToChartRows("subtasks", raw);
      expect(rows).toHaveLength(2);

      expect(rows[0]).toMatchObject({
        id: "st1",
        "Task Title": "Write docs",
        type: "subtask",
        status: "todo",
        parentTaskId: "task-1",
        parentTaskTitle: "Launch checklist",
      });

      expect(rows[1]).toMatchObject({
        id: "st2",
        "Task Title": "Review copy",
        type: "subtask",
        status: "done",
        priority: "high",
        parentTaskId: "task-1",
        parentTaskTitle: "Launch checklist",
      });
      expect(rows[1!]["Due Date"]).toBe("2025-04-02");
    });

    it("preserves non-binary statuses so charts can show new buckets on refresh", () => {
      const raw = [
        { id: "st1", title: "Write docs", status: "blocked", completed: false, task_id: "task-1", task_title: "Launch checklist" },
        { id: "st2", title: "Review copy", status: "in_progress", completed: false, task_id: "task-1", task_title: "Launch checklist" },
        { id: "st3", title: "Ship", completed: true, task_id: "task-1", task_title: "Launch checklist" },
      ];

      const rows = normalizeToChartRows("subtasks", raw);
      const chartData = buildChartData({
        focusRows: rows,
        spec: makeSpec({ breakdown: { field: "status" } }),
      });

      expect(chartData.type).toBe("categorical");
      if (chartData.type !== "categorical") return;

      const byLabel = Object.fromEntries(chartData.data.map((d) => [d.label, d.value]));
      expect(byLabel["blocked"]).toBe(1);
      expect(byLabel["in_progress"]).toBe(1);
      expect(byLabel["done"]).toBe(1);
    });
  });

  describe("table_rows", () => {
    it("produces ChartRow[] with id, Task Title from data, status, assignee, tags", () => {
      const raw = [
        {
          id: "r1",
          data: { Title: "Row one", status: "Active", custom: 42 },
          assignees: [{ id: "u1", name: "Alice" }],
          tags: [{ id: "t1", name: "urgent" }],
          status: "Active",
          priority: "high",
          due_date: "2025-04-01",
        },
      ];
      const rows = normalizeToChartRows("table_rows", raw);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: "r1",
        "Task Title": "Row one",
        status: "active", // normalizeStatus("Active") -> lowercase
        priority: "high",
        assignee: "Alice",
        tags: ["urgent"],
      });
      expect(rows[0!]["Due Date"]).toBe("2025-04-01");
      expect(rows[0!].Title).toBe("Row one");
      expect(rows[0!].custom).toBe(42);
    });

    it("falls back to id when no title in data", () => {
      const raw = [{ id: "r2", data: { count: 10 }, status: null, priority: null }];
      const rows = normalizeToChartRows("table_rows", raw);
      expect(rows[0!]["Task Title"]).toBe("r2");
    });
  });

  describe("buildChartData compatibility", () => {
    it("normalized task rows work with buildChartData (count by status)", () => {
      const raw = [
        { id: "1", title: "T1", statuses: [{ value: "todo" }], priorities: [], assignees: [], tags: [] },
        { id: "2", title: "T2", statuses: [{ value: "todo" }], priorities: [], assignees: [], tags: [] },
        { id: "3", title: "T3", statuses: [{ value: "in_progress" }], priorities: [], assignees: [], tags: [] },
      ];
      const rows = normalizeToChartRows("tasks", raw);
      const result = buildChartData({
        focusRows: rows,
        spec: makeSpec({ chartType: "pie", breakdown: { field: "status" } }),
      });
      expect(result.type).toBe("categorical");
      if (result.type !== "categorical") return;
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      const total = result.data.reduce((s, d) => s + d.value, 0);
      expect(total).toBe(3);
    });
  });
});
