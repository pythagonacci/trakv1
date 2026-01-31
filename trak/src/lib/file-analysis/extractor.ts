import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import type { ExtractedTable } from "./types";
import { estimateTokens } from "./token";

export type ExtractedContent = {
  text: string;
  tables: ExtractedTable[];
  pageCount?: number;
  rowCount?: number;
  columnCount?: number;
  tokenEstimate: number;
  metadata?: Record<string, unknown>;
};

export function detectFileKind(fileName: string, fileType?: string | null) {
  const lowerName = fileName.toLowerCase();
  const mime = (fileType || "").toLowerCase();

  if (mime.includes("spreadsheet") || mime.includes("excel") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    return "xlsx";
  }
  if (mime === "text/csv" || lowerName.endsWith(".csv")) {
    return "csv";
  }
  if (mime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }
  if (mime.includes("word") || lowerName.endsWith(".docx")) {
    return "docx";
  }
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(lowerName)) {
    return "image";
  }
  if (mime.startsWith("text/") || lowerName.endsWith(".txt")) {
    return "text";
  }
  return "unknown";
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const asString = String(value).trim();
  return asString.length ? asString : null;
}

function tableToText(table: ExtractedTable, maxRows?: number) {
  const rows = maxRows ? table.rows.slice(0, maxRows) : table.rows;
  const headerLine = table.headers.map((h) => (h || "").toString()).join("\t");
  const bodyLines = rows.map((row) => row.map((cell) => (cell == null ? "" : String(cell))).join("\t"));
  return [headerLine, ...bodyLines].join("\n");
}

export async function extractFileContent(params: {
  buffer: Buffer;
  fileName: string;
  fileType?: string | null;
}): Promise<ExtractedContent> {
  const { buffer, fileName, fileType } = params;
  const kind = detectFileKind(fileName, fileType);

  switch (kind) {
    case "csv":
    case "xlsx": {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const tables: ExtractedTable[] = [];
      let totalRows = 0;
      let maxCols = 0;

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[];
        const rows = raw.map((row) => Array.isArray(row) ? row.map(normalizeCell) : [normalizeCell(row)]);
        const headers = (rows.shift() || []).map((cell) => (cell == null ? "" : String(cell)));
        const dataRows = rows as Array<Array<string | number | null>>;

        const rowCount = dataRows.length;
        const columnCount = headers.length;
        totalRows += rowCount;
        maxCols = Math.max(maxCols, columnCount);

        tables.push({
          name: sheetName,
          headers,
          rows: dataRows,
          rowCount,
          columnCount,
        });
      });

      const fullText = tables
        .map((table) => {
          return `Sheet: ${table.name}\n${tableToText(table)}`;
        })
        .join("\n\n");

      return {
        text: fullText,
        tables,
        rowCount: totalRows,
        columnCount: maxCols,
        tokenEstimate: estimateTokens(fullText),
        metadata: { sheetCount: workbook.SheetNames.length },
      };
    }
    case "pdf": {
      const parsed = await pdfParse(Buffer.from(buffer));
      const text = parsed.text || "";
      return {
        text,
        tables: [],
        pageCount: parsed.numpages || undefined,
        tokenEstimate: estimateTokens(text),
      };
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value || "";
      return {
        text,
        tables: [],
        tokenEstimate: estimateTokens(text),
      };
    }
    case "text": {
      const text = buffer.toString("utf-8");
      return {
        text,
        tables: [],
        tokenEstimate: estimateTokens(text),
      };
    }
    case "image": {
      return {
        text: "",
        tables: [],
        tokenEstimate: 0,
        metadata: { extraction: "unsupported", reason: "OCR not available" },
      };
    }
    default:
      throw new Error("Unsupported file type");
  }
}
