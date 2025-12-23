"use server";

// Table refactor baseline (Sept 2024):
// - Client table-block currently performs lightweight validation only for ColumnType; this module adds reusable validators for the new Supabase-backed schema.
// - DB triggers already perform structural checks; these helpers are intended for server actions before writes and can be reused by future UI hooks.

import type { FieldType, TableField } from "@/types/table";

export function validateFieldType(type: string): type is FieldType {
  return [
    "text",
    "long_text",
    "number",
    "select",
    "multi_select",
    "date",
    "checkbox",
    "url",
    "email",
    "phone",
    "person",
    "files",
    "created_time",
    "last_edited_time",
    "created_by",
    "last_edited_by",
    "formula",
    "relation",
    "rollup",
    "status",
    "priority",
  ].includes(type);
}

export function validateRowDataAgainstFields(data: Record<string, unknown>, fields: TableField[]): { valid: boolean; message?: string } {
  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  for (const [key, value] of Object.entries(data || {})) {
    const field = fieldMap.get(key);
    if (!field) {
      return { valid: false, message: `Unknown field id ${key}` };
    }

    switch (field.type) {
      case "number":
        if (value !== null && value !== undefined && Number.isNaN(Number(value))) {
          return { valid: false, message: `Field ${field.name} expects a number` };
        }
        break;
      case "checkbox":
        if (value !== null && value !== undefined && typeof value !== "boolean") {
          return { valid: false, message: `Field ${field.name} expects a boolean` };
        }
        break;
      case "multi_select":
      case "files":
      case "relation":
        if (value !== null && value !== undefined && !Array.isArray(value)) {
          return { valid: false, message: `Field ${field.name} expects an array` };
        }
        break;
      default:
        break;
    }
  }

  return { valid: true };
}
