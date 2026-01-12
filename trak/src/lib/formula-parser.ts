/**
 * Formula Parser & Evaluator
 *
 * Evaluates user formulas with mathjs and a custom function registry.
 * Supports prop("Field Name") references with case-insensitive lookup,
 * plus field-id fallback to survive renames.
 *
 * Key behaviors:
 * - prop() resolves by id first, then by name (case-insensitive)
 * - custom helpers (dateBetween, concat, if, etc.) are injected into scope
 * - errors are converted into user-friendly messages
 * - dependencies are extracted up-front for recomputation triggers
 *
 * Example:
 * evaluateFormula('prop("Hours") * prop("Rate")', rowData, fields)
 */
import { create, all } from "mathjs";
import type { TableField } from "@/types/table";

const math = create(all, {});

type RowData = Record<string, unknown>;

function toDate(value: unknown) {
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Custom function registry injected into mathjs evaluation scope.
// Each helper handles null/undefined defensively to avoid crashes.
const baseFunctions = {
  concat: (...args: unknown[]) => args.map((arg) => String(arg ?? "")).join(""),
  if: (condition: boolean, trueVal: unknown, falseVal: unknown) => (condition ? trueVal : falseVal),
  dateBetween: (start: unknown, end: unknown, unit: string) => {
    const startDate = toDate(start);
    const endDate = toDate(end);
    if (!startDate || !endDate) return null;
    const diffMs = endDate.getTime() - startDate.getTime();
    switch (unit) {
      case "days":
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case "hours":
        return Math.floor(diffMs / (1000 * 60 * 60));
      case "minutes":
        return Math.floor(diffMs / (1000 * 60));
      case "seconds":
        return Math.floor(diffMs / 1000);
      default:
        return diffMs;
    }
  },
  dateAdd: (date: unknown, amount: number, unit: string) => {
    const d = toDate(date);
    if (!d) return null;
    switch (unit) {
      case "days":
        d.setDate(d.getDate() + amount);
        break;
      case "months":
        d.setMonth(d.getMonth() + amount);
        break;
      case "years":
        d.setFullYear(d.getFullYear() + amount);
        break;
      default:
        break;
    }
    return d.toISOString();
  },
  dateSubtract: (date: unknown, amount: number, unit: string) => {
    return baseFunctions.dateAdd(date, -amount, unit);
  },
  formatDate: (date: unknown, _format: string) => {
    const d = toDate(date);
    if (!d) return null;
    return d.toLocaleDateString();
  },
  now: () => new Date(),
  today: () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  },
  empty: (value: unknown) => value === null || value === undefined || value === "",
  filled: (value: unknown) => value !== null && value !== undefined && value !== "",
  upper: (text: unknown) => String(text ?? "").toUpperCase(),
  lower: (text: unknown) => String(text ?? "").toLowerCase(),
  trim: (text: unknown) => String(text ?? "").trim(),
  replace: (text: unknown, search: string, replacement: string) =>
    String(text ?? "").replace(new RegExp(String(search), "g"), String(replacement)),
  length: (text: unknown) => String(text ?? "").length,
  and: (...args: unknown[]) => args.every(Boolean),
  or: (...args: unknown[]) => args.some(Boolean),
  not: (value: unknown) => !value,
};

function buildFieldLookup(fields: TableField[]) {
  const byName = new Map<string, string>();
  const byNameLower = new Map<string, string>();
  const byId = new Map<string, string>();
  const byIdLower = new Map<string, string>();

  fields.forEach((field) => {
    byName.set(field.name, field.id);
    byNameLower.set(field.name.toLowerCase(), field.id);
    byId.set(field.id, field.id);
    byIdLower.set(field.id.toLowerCase(), field.id);
  });

  return { byName, byNameLower, byId, byIdLower };
}

export type FormulaEvalResult = { value: unknown; error?: string };

function formatFormulaError(error: unknown) {
  if (!error) return "Invalid formula";
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("FIELD_NOT_FOUND:")) {
    return `Field not found: ${message.replace("FIELD_NOT_FOUND:", "").trim()}`;
  }
  if (message.toLowerCase().includes("syntax")) {
    return "Invalid formula syntax";
  }
  if (message.toLowerCase().includes("division by zero")) {
    return "Division by zero";
  }
  if (message.toLowerCase().includes("unexpected type") || message.toLowerCase().includes("type error")) {
    return "Type mismatch in formula";
  }
  if (message.toLowerCase().includes("undefined symbol")) {
    const symbol = message.split(":").pop()?.trim();
    return symbol ? `Unknown symbol: ${symbol}` : "Unknown symbol in formula";
  }
  return "Unable to evaluate formula";
}

export function evaluateFormula(formula: string, rowData: RowData, fields: TableField[]): FormulaEvalResult {
  if (!formula) return { value: null };
  const { byName, byNameLower, byId, byIdLower } = buildFieldLookup(fields);

  const scope = {
    ...baseFunctions,
    prop: (fieldName: string) => {
      if (!fieldName) return null;
      // Allow direct field-id lookup (for renamed fields), then case-insensitive name lookup.
      const direct = rowData[fieldName];
      if (direct !== undefined) return direct;
      const resolved =
        byId.get(fieldName) ??
        byIdLower.get(fieldName.toLowerCase()) ??
        byName.get(fieldName) ??
        byNameLower.get(fieldName.toLowerCase()) ??
        fieldName;
      const value = rowData[resolved];
      if (value === undefined) {
        throw new Error(`FIELD_NOT_FOUND:${fieldName}`);
      }
      return value;
    },
  };

  try {
    const value = math.evaluate(formula, scope);
    if (typeof value === "number" && !Number.isFinite(value)) {
      return { value: null, error: "Division by zero" };
    }
    return { value };
  } catch (error) {
    console.error("Formula evaluation error:", error);
    return { value: null, error: formatFormulaError(error) };
  }
}

export function extractDependencies(formula: string, fields: TableField[]) {
  const dependencies = new Set<string>();
  if (!formula) return [];

  const { byName, byNameLower, byId, byIdLower } = buildFieldLookup(fields);
  const regex = /prop\((['"])(.*?)\1\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(formula)) !== null) {
    const name = match[2];
    const id =
      byId.get(name) ??
      byIdLower.get(name.toLowerCase()) ??
      byName.get(name) ??
      byNameLower.get(name.toLowerCase());
    if (id) dependencies.add(id);
  }

  return Array.from(dependencies);
}
