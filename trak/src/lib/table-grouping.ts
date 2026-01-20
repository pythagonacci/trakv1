import { type TableField, type TableRow, type FieldType } from "@/types/table";

export interface GroupedData {
  groupId: string;
  groupLabel: string;
  groupColor?: string;
  rows: TableRow[];
  count: number;
  isCollapsed: boolean;
}

type Option = { id: string; label: string; color?: string };
type Member = { id: string; name?: string | null; email?: string | null };

export function canGroupByField(fieldType: FieldType): boolean {
  return ["select", "multi_select", "status", "priority", "person", "checkbox"].includes(fieldType);
}

export function groupRows(
  rows: TableRow[],
  field: TableField,
  collapsedGroups: string[] = [],
  opts?: {
    members?: Member[];
    showEmptyGroups?: boolean;
    sortOrder?: "asc" | "desc";
  }
): GroupedData[] {
  const allGroups = getAllGroups(field, opts?.members);
  const map = new Map<string, GroupedData>();

  allGroups.forEach((g) => {
    map.set(g.id, {
      groupId: g.id,
      groupLabel: g.label,
      groupColor: g.color,
      rows: [],
      count: 0,
      isCollapsed: collapsedGroups.includes(g.id),
    });
  });

  // Ungrouped bucket
  map.set("__ungrouped__", {
    groupId: "__ungrouped__",
    groupLabel: "Ungrouped",
    rows: [],
    count: 0,
    isCollapsed: collapsedGroups.includes("__ungrouped__"),
  });

  const fieldId = field.id;

  for (const row of rows) {
    const value = row.data?.[fieldId];

    if (field.type === "multi_select") {
      const vals = Array.isArray(value) ? value : [];
      if (!vals.length) {
        map.get("__ungrouped__")?.rows.push(row);
      } else {
        vals.forEach((v) => {
          const g = map.get(String(v));
          (g ?? map.get("__ungrouped__"))?.rows.push(row);
        });
      }
    } else if (field.type === "checkbox") {
      const key = value === true ? "true" : value === false ? "false" : "__ungrouped__";
      const g = map.get(key);
      (g ?? map.get("__ungrouped__"))?.rows.push(row);
    } else {
      const key = value ? String(value) : "__ungrouped__";
      const g = map.get(key);
      (g ?? map.get("__ungrouped__"))?.rows.push(row);
    }
  }

  map.forEach((g) => (g.count = g.rows.length));

  let groups = Array.from(map.values());

  if (opts?.showEmptyGroups === false) {
    groups = groups.filter((g) => g.count > 0 || g.groupId === "__ungrouped__");
  }

  groups.sort((a, b) => {
    if (a.groupId === "__ungrouped__") return 1;
    if (b.groupId === "__ungrouped__") return -1;
    const dir = opts?.sortOrder === "desc" ? -1 : 1;
    return a.groupLabel.localeCompare(b.groupLabel) * dir;
  });

  return groups;
}

function getAllGroups(field: TableField, members?: Member[]): Option[] {
  const { type, config } = field;

  if (type === "select" || type === "multi_select" || type === "status") {
    return Array.isArray((config as any)?.options) ? (config as any).options : [];
  }

  if (type === "priority") {
    return Array.isArray((config as any)?.levels)
      ? (config as any).levels.map((lvl: any) => ({
          id: lvl.id,
          label: lvl.label,
          color: lvl.color,
        }))
      : [];
  }

  if (type === "person" && members) {
    return members.map((m) => ({
      id: m.id,
      label: m.name || m.email || m.id,
    }));
  }

  if (type === "checkbox") {
    return [
      { id: "true", label: "Checked" },
      { id: "false", label: "Unchecked" },
    ];
  }

  return [];
}
