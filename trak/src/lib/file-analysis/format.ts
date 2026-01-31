import type { FileAnalysisMessageContent } from "./types";

function formatTableMarkdown(columns: string[], rows: Array<Array<string | number | null>>) {
  const header = `| ${columns.join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${row.map((cell) => (cell == null ? "" : String(cell))).join(" | ")} |`)
    .join("\n");
  return [header, divider, body].filter(Boolean).join("\n");
}

export function formatMessageForBlock(content: FileAnalysisMessageContent): string {
  const parts: string[] = [];

  if (content.text) {
    parts.push(content.text.trim());
  }

  if (content.tables && content.tables.length > 0) {
    content.tables.forEach((table) => {
      const columns =
        (table.columns && table.columns.length > 0)
          ? table.columns
          : (table.headers && table.headers.length > 0)
            ? table.headers
            : [];
      if (table.title) {
        parts.push(`\n## ${table.title}`);
      }
      if (columns.length > 0) {
        parts.push(formatTableMarkdown(columns, table.rows));
      }
    });
  }

  if (content.charts && content.charts.length > 0) {
    content.charts.forEach((chart) => {
      const title = chart.title ? `\n## ${chart.title}` : "\n## Chart";
      parts.push(title);
      const seriesLines = (chart.series || [])
        .map((series) => `- ${series.name}: ${series.data.join(", ")}`)
        .join("\n");
      parts.push(seriesLines || "(Chart data available)");
    });
  }

  if (content.notes) {
    parts.push(`\n${content.notes.trim()}`);
  }

  return parts.filter(Boolean).join("\n\n").trim();
}
