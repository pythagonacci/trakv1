import type { FieldType, SelectFieldOption, TableField } from "@/types/table";

export type ParsedTableData = {
  delimiter: string;
  rows: string[][];
  headers: string[];
  hasHeader: boolean;
};

const DELIMITERS = ["\t", ",", "|"] as const;

const isNonEmpty = (value: string | null | undefined) => Boolean(value && value.trim().length > 0);

const countDelimitersOutsideQuotes = (line: string, delimiter: string) => {
  let inQuotes = false;
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) count += 1;
  }
  return count;
};

const detectDelimiter = (text: string) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;

  let best: { delimiter: string; score: number } | null = null;
  DELIMITERS.forEach((delimiter) => {
    const counts = lines.map((line) => countDelimitersOutsideQuotes(line, delimiter));
    const max = Math.max(...counts);
    const avg = counts.reduce((sum, val) => sum + val, 0) / counts.length;
    const score = max + avg;
    if (max === 0) return;
    if (!best || score > best.score) {
      best = { delimiter, score };
    }
  });
  return best?.delimiter ?? null;
};

const parseDelimitedText = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  const pushCell = () => {
    currentRow.push(currentCell);
    currentCell = "";
  };

  const pushRow = () => {
    rows.push(currentRow);
    currentRow = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        currentCell += "\"";
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      pushCell();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      pushCell();
      pushRow();
      continue;
    }

    currentCell += char;
  }

  pushCell();
  pushRow();

  return rows;
};

const normalizeRows = (rows: string[][], delimiter: string) => {
  const trimmed = rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  const normalized = delimiter === "|"
    ? trimmed.map((row) => {
        if (row[0] === "" && row[row.length - 1] === "") {
          return row.slice(1, -1).map((cell) => cell.trim());
        }
        return row;
      })
    : trimmed;

  const maxLength = normalized.reduce((max, row) => Math.max(max, row.length), 0);
  return normalized.map((row) => {
    if (row.length < maxLength) {
      return [...row, ...Array.from({ length: maxLength - row.length }, () => "")];
    }
    return row;
  });
};

const looksLikeHeaderCell = (value: string) => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  return true;
};

const detectHeaderRow = (rows: string[][]) => {
  if (rows.length < 2) return false;
  const [first, second] = rows;
  if (!first || !second) return false;

  const headerLike = first.filter((cell) => looksLikeHeaderCell(cell)).length;
  const secondNumeric = second.filter((cell) => isNumeric(cell) || isDateFormat(cell) || isBoolean(cell)).length;
  const uniqueFirst = new Set(first.map((cell) => cell.trim().toLowerCase())).size;

  const hasMostlyHeaders = headerLike >= Math.ceil(first.length * 0.6);
  const secondHasData = secondNumeric >= Math.ceil(second.length * 0.4);
  const uniqueEnough = uniqueFirst >= Math.ceil(first.length * 0.8);

  return hasMostlyHeaders && (secondHasData || uniqueEnough);
};

export const parsePastedTable = (text: string): ParsedTableData | null => {
  if (!text || text.trim().length === 0) return null;
  const delimiter = detectDelimiter(text);
  if (!delimiter) return null;

  const rows = normalizeRows(parseDelimitedText(text, delimiter), delimiter);
  if (rows.length < 1) return null;
  if (rows.length === 1 && rows[0].length < 2) return null;

  const hasHeader = detectHeaderRow(rows);
  const headers = hasHeader
    ? rows[0].map((cell, idx) => cell.trim() || `Column ${idx + 1}`)
    : rows[0].map((_, idx) => `Column ${idx + 1}`);

  return { delimiter, rows: hasHeader ? rows.slice(1) : rows, headers, hasHeader };
};

export const isStructuredData = (text: string) => Boolean(parsePastedTable(text));

export const normalizeHeaderName = (name: string) => name.trim().replace(/\s+/g, " ");

export const isDateFormat = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed)) return true;
  if (/^[a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(trimmed)) return true;
  const parsed = Date.parse(trimmed);
  return !Number.isNaN(parsed);
};

export const isNumeric = (value: string) => {
  const cleaned = value.trim().replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!cleaned) return false;
  return !Number.isNaN(Number(cleaned));
};

export const isURL = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return Boolean(new URL(url));
  } catch {
    return false;
  }
};

export const isEmail = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

export const isBoolean = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return ["true", "false", "yes", "no", "1", "0", "checked", "unchecked", "x"].includes(normalized);
};

export const inferFieldType = (values: string[]) => {
  const samples = values.map((v) => v.trim()).filter(isNonEmpty);
  if (samples.length === 0) return "text";

  const hasMultiTokens = samples.some((val) => /[,;]\s*\S+/.test(val));
  if (samples.every((val) => isBoolean(val))) return "checkbox";
  if (samples.every((val) => isDateFormat(val))) return "date";
  if (samples.every((val) => isNumeric(val))) return "number";
  if (samples.every((val) => isURL(val))) return "url";
  if (samples.every((val) => isEmail(val))) return "email";

  const unique = new Set(samples.map((v) => v.toLowerCase()));
  if (unique.size < samples.length * 0.2 && unique.size < 50) {
    return hasMultiTokens ? "multi_select" : "select";
  }

  const avgLength = samples.reduce((sum, v) => sum + v.length, 0) / samples.length;
  return avgLength > 100 ? "long_text" : "text";
};

export const buildSelectOptions = (values: string[]) => {
  const uniqueValues = Array.from(
    new Set(
      values
        .map((val) => val.trim())
        .filter(isNonEmpty)
        .map((val) => val)
    )
  );
  return uniqueValues.map((label, index) => ({
    id: `opt_${Date.now()}_${index}`,
    label,
    color: "#3b82f6",
  })) as SelectFieldOption[];
};

const parseDateValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const numericMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numericMatch) {
    const part1 = Number(numericMatch[1]);
    const part2 = Number(numericMatch[2]);
    const year = Number(numericMatch[3].length === 2 ? `20${numericMatch[3]}` : numericMatch[3]);
    const isDayFirst = part1 > 12;
    const month = isDayFirst ? part2 : part1;
    const day = isDayFirst ? part1 : part2;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseBooleanValue = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "1", "checked", "x"].includes(normalized)) return true;
  if (["false", "no", "0", "unchecked"].includes(normalized)) return false;
  return null;
};

export const transformValue = (raw: string, field: TableField) => {
  const value = raw.trim();
  if (!value) return null;

  switch (field.type) {
    case "date":
      return parseDateValue(value);
    case "number": {
      const cleaned = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
      if (!cleaned) return null;
      const parsed = Number(cleaned);
      return Number.isNaN(parsed) ? null : parsed;
    }
    case "checkbox":
      return parseBooleanValue(value);
    case "url":
    case "email":
    case "phone":
    case "text":
    case "long_text":
      return value;
    default:
      return value;
  }
};

export const findOptionByLabel = (options: SelectFieldOption[], label: string) => {
  const normalized = label.trim().toLowerCase();
  return options.find((opt) => opt.label.trim().toLowerCase() === normalized);
};
