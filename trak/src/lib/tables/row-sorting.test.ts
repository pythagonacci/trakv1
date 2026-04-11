import { describe, expect, it } from "vitest";
import { applyTableRowSorts, shouldSortRowsInMemory } from "./row-sorting";
import type { SortCondition, TableField, TableRow } from "@/types/table";

function row(id: string, value: unknown, order: number): TableRow {
  return {
    id,
    table_id: "table-1",
    source_entity_type: null,
    source_entity_id: null,
    source_sync_mode: null as unknown as TableRow["source_sync_mode"],
    data: { score: value },
    order: String(order),
    created_at: "",
    updated_at: "",
    created_by: null,
    updated_by: null,
    edited: false,
  };
}

const scoreField = {
  id: "score",
  type: "number",
  config: {},
} as TableField;

describe("applyTableRowSorts", () => {
  it("sorts number fields numerically in ascending order", () => {
    const sorts: SortCondition[] = [{ fieldId: "score", direction: "asc" }];

    const sorted = applyTableRowSorts(
      [row("two", "2", 1), row("ten", "10", 2), row("one", 1, 3)],
      sorts,
      [scoreField]
    );

    expect(sorted.map((item) => item.id)).toEqual(["one", "two", "ten"]);
  });

  it("sorts number fields numerically in descending order and keeps blanks last", () => {
    const sorts: SortCondition[] = [{ fieldId: "score", direction: "desc" }];

    const sorted = applyTableRowSorts(
      [row("two", 2, 1), row("blank", null, 2), row("ten", 10, 3)],
      sorts,
      [scoreField]
    );

    expect(sorted.map((item) => item.id)).toEqual(["ten", "two", "blank"]);
  });
});

describe("shouldSortRowsInMemory", () => {
  it("only opts into in-memory sorting for numeric sort fields", () => {
    expect(shouldSortRowsInMemory([{ fieldId: "score", direction: "asc" }], [scoreField])).toBe(true);
    expect(
      shouldSortRowsInMemory(
        [{ fieldId: "title", direction: "asc" }],
        [{ id: "title", type: "text", config: {} } as TableField]
      )
    ).toBe(false);
  });
});
