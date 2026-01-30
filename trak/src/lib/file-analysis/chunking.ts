import { CHUNK_TOKEN_OVERLAP, CHUNK_TOKEN_TARGET } from "./constants";
import { estimateTokens } from "./token";

export interface TextChunk {
  content: string;
  tokenCount: number;
}

export function chunkText(
  text: string,
  options: { targetTokens?: number; overlapTokens?: number } = {}
): TextChunk[] {
  const targetTokens = options.targetTokens ?? CHUNK_TOKEN_TARGET;
  const overlapTokens = options.overlapTokens ?? CHUNK_TOKEN_OVERLAP;
  if (!text.trim()) return [];

  const paragraphs = text.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  const chunks: TextChunk[] = [];

  let current: string[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (!current.length) return;
    const content = current.join("\n\n").trim();
    if (!content) return;
    chunks.push({ content, tokenCount: estimateTokens(content) });
    current = [];
    currentTokens = 0;
  };

  for (const paragraph of paragraphs) {
    const tokens = estimateTokens(paragraph);
    if (tokens > targetTokens) {
      // Split long paragraph into smaller slices
      const maxChars = targetTokens * 4;
      const overlapChars = overlapTokens * 4;
      let start = 0;
      while (start < paragraph.length) {
        const slice = paragraph.slice(start, start + maxChars).trim();
        if (slice) {
          chunks.push({ content: slice, tokenCount: estimateTokens(slice) });
        }
        start += Math.max(1, maxChars - overlapChars);
      }
      continue;
    }

    if (currentTokens + tokens > targetTokens && current.length) {
      flush();
    }

    current.push(paragraph);
    currentTokens += tokens;
  }

  flush();

  // Add overlap for context
  if (overlapTokens > 0 && chunks.length > 1) {
    const overlapped: TextChunk[] = [];
    const overlapChars = overlapTokens * 4;
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        overlapped.push(chunks[i]);
        continue;
      }
      const prev = chunks[i - 1].content;
      const overlap = prev.slice(Math.max(0, prev.length - overlapChars));
      const combined = `${overlap}\n\n${chunks[i].content}`.trim();
      overlapped.push({ content: combined, tokenCount: estimateTokens(combined) });
    }
    return overlapped;
  }

  return chunks;
}

export function chunkTableRows(
  headers: string[],
  rows: Array<Array<string | number | null>>,
  maxRowsPerChunk = 200
): TextChunk[] {
  if (!rows.length) return [];
  const chunks: TextChunk[] = [];
  for (let i = 0; i < rows.length; i += maxRowsPerChunk) {
    const slice = rows.slice(i, i + maxRowsPerChunk);
    const contentRows = [headers, ...slice]
      .map((row) => row.map((cell) => (cell == null ? "" : String(cell))).join("\t"))
      .join("\n");
    chunks.push({ content: contentRows, tokenCount: estimateTokens(contentRows) });
  }
  return chunks;
}
