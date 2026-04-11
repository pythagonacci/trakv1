import type { SortCondition, TableField, TableRow } from "@/types/table";

type SortableField = Pick<TableField, "id" | "type" | "config">;

function isEmptySortValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function isNumericSortField(field: SortableField | undefined) {
  if (!field) return false;
  if (field.type === "number") return true;
  if (field.type !== "formula") return false;
  const config = field.config as { return_type?: unknown; resultType?: unknown } | null | undefined;
  return config?.return_type === "number" || config?.resultType === "number";
}

function toFiniteNumber(value: unknown) {
  if (isEmptySortValue(value)) return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getRowOrder(row: TableRow) {
  const parsed = typeof row.order === "number" ? row.order : Number.parseFloat(String(row.order ?? ""));
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function compareRawValues(aValue: unknown, bValue: unknown) {
  if (typeof aValue === "string" || typeof bValue === "string") {
    return String(aValue).localeCompare(String(bValue), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  if (typeof aValue === "number" && typeof bValue === "number") {
    return aValue - bValue;
  }

  if (typeof aValue === "boolean" && typeof bValue === "boolean") {
    return Number(aValue) - Number(bValue);
  }

  const aText = JSON.stringify(aValue) ?? String(aValue);
  const bText = JSON.stringify(bValue) ?? String(bValue);
  if (aText < bText) return -1;
  if (aText > bText) return 1;
  return 0;
}

export function shouldSortRowsInMemory(
  sorts: SortCondition[],
  fields: SortableField[]
) {
  if (!sorts || sorts.length === 0) return false;
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  return sorts.some((sort) => isNumericSortField(fieldById.get(sort.fieldId)));
}

export function applyTableRowSorts(
  rows: TableRow[],
  sorts: SortCondition[],
  fields: SortableField[] = []
) {
  if (!sorts || sorts.length === 0) return rows;

  const fieldById = new Map(fields.map((field) => [field.id, field]));

  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const sort of sorts) {
        const aValue = (a.row.data || {})[sort.fieldId];
        const bValue = (b.row.data || {})[sort.fieldId];
        const aEmpty = isEmptySortValue(aValue);
        const bEmpty = isEmptySortValue(bValue);

        if (aEmpty && bEmpty) continue;
        if (aEmpty) return 1;
        if (bEmpty) return -1;

        const field = fieldById.get(sort.fieldId);
        const direction = sort.direction === "asc" ? 1 : -1;
        let comparison = 0;

        if (isNumericSortField(field)) {
          const aNumber = toFiniteNumber(aValue);
          const bNumber = toFiniteNumber(bValue);

          if (aNumber === null && bNumber === null) continue;
          if (aNumber === null) return 1;
          if (bNumber === null) return -1;
          comparison = aNumber - bNumber;
        } else {
          comparison = compareRawValues(aValue, bValue);
        }

        if (comparison !== 0) return comparison * direction;
      }

      const orderDiff = getRowOrder(a.row) - getRowOrder(b.row);
      return orderDiff === 0 ? a.index - b.index : orderDiff;
    })
    .map(({ row }) => row);
}
