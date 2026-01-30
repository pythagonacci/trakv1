import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { extractFileContent } from "./extractor";
import { chunkText, chunkTableRows } from "./chunking";
import { estimateTokens, clampText } from "./token";
import {
  MAX_INLINE_FILE_BYTES,
  MAX_INLINE_PAGES,
  MAX_INLINE_ROWS,
  MAX_INLINE_TOKENS,
  RETRIEVAL_TOP_K,
} from "./constants";
import { getEmbedding } from "./embeddings";
import type { FileArtifact, FileChunk } from "./types";

export interface FileRecord {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  storage_path: string;
  workspace_id: string;
  project_id: string;
}

export function shouldUseRag(params: {
  fileSize: number;
  tokenEstimate: number;
  rowCount?: number | null;
  pageCount?: number | null;
}) {
  const { fileSize, tokenEstimate, rowCount, pageCount } = params;
  if (fileSize > MAX_INLINE_FILE_BYTES) return true;
  if (tokenEstimate > MAX_INLINE_TOKENS) return true;
  if ((rowCount ?? 0) > MAX_INLINE_ROWS) return true;
  if ((pageCount ?? 0) > MAX_INLINE_PAGES) return true;
  return false;
}

function normalizeEmbedding(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (!magnitude) return vector;
  return vector.map((v) => v / magnitude);
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

async function downloadFileBuffer(supabase: SupabaseClient, storagePath: string) {
  const { data, error } = await supabase.storage
    .from("files")
    .download(storagePath);
  if (error || !data) {
    throw new Error(error?.message || "Failed to download file");
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function ensureFileArtifact(
  supabase: SupabaseClient,
  file: FileRecord
): Promise<FileArtifact> {
  const { data: existing } = await supabase
    .from("file_analysis_artifacts")
    .select("*")
    .eq("file_id", file.id)
    .maybeSingle();

  if (existing && existing.status === "ready") {
    return existing as FileArtifact;
  }

  if (existing && existing.status === "processing") {
    return existing as FileArtifact;
  }

  let artifactId = existing?.id as string | undefined;
  if (!artifactId) {
    const { data: created, error: createError } = await supabase
      .from("file_analysis_artifacts")
      .insert({
        file_id: file.id,
        status: "processing",
      })
      .select("*")
      .single();
    if (createError || !created) {
      throw new Error("Failed to create file analysis artifact");
    }
    artifactId = created.id;
  } else {
    await supabase
      .from("file_analysis_artifacts")
      .update({ status: "processing", error: null })
      .eq("id", artifactId);
  }

  try {
    const buffer = await downloadFileBuffer(supabase, file.storage_path);
    const extracted = await extractFileContent({
      buffer,
      fileName: file.file_name,
      fileType: file.file_type,
    });

    const tokenEstimate = extracted.tokenEstimate;
    const useRag = shouldUseRag({
      fileSize: file.file_size,
      tokenEstimate,
      rowCount: extracted.rowCount,
      pageCount: extracted.pageCount,
    });

    const truncatedText = useRag
      ? clampText(extracted.text || "", 200_000)
      : extracted.text || "";

    const tablesPreview = extracted.tables?.map((table) => {
      if (!useRag) return table;
      return {
        ...table,
        rows: table.rows.slice(0, Math.min(table.rows.length, 200)),
      };
    });

    const { data: updated, error: updateError } = await supabase
      .from("file_analysis_artifacts")
      .update({
        status: "ready",
        extracted_text: truncatedText,
        extracted_tables: tablesPreview,
        page_count: extracted.pageCount || null,
        row_count: extracted.rowCount || null,
        column_count: extracted.columnCount || null,
        token_estimate: tokenEstimate,
        metadata: extracted.metadata || null,
        error: null,
      })
      .eq("id", artifactId)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new Error("Failed to update file analysis artifact");
    }

    return updated as FileArtifact;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process file";
    await supabase
      .from("file_analysis_artifacts")
      .update({ status: "error", error: message })
      .eq("id", artifactId);
    throw err;
  }
}

export async function ensureFileChunks(
  supabase: SupabaseClient,
  file: FileRecord,
  artifact: FileArtifact
) {
  const { data: existing } = await supabase
    .from("file_analysis_chunks")
    .select("id")
    .eq("artifact_id", artifact.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return;
  }

  const chunks: { content: string; tokenCount: number }[] = [];
  const text = artifact.extracted_text || "";
  if (text.trim()) {
    chunks.push(...chunkText(text));
  }

  const tables = (artifact.extracted_tables || []) as any[];
  tables.forEach((table) => {
    if (!table?.rows || !table?.headers) return;
    chunks.push(...chunkTableRows(table.headers, table.rows, 200));
  });

  if (chunks.length === 0) {
    return;
  }

  const normalized = chunks.map((chunk) => ({
    content: chunk.content,
    tokenCount: chunk.tokenCount || estimateTokens(chunk.content),
  }));

  const embeddings: number[][] = [];
  for (const chunk of normalized) {
    const embeddingResult = await getEmbedding(chunk.content.slice(0, 4000));
    embeddings.push(embeddingResult.embedding);
  }

  const payload = normalized.map((chunk, index) => ({
    artifact_id: artifact.id,
    file_id: file.id,
    chunk_index: index,
    content: chunk.content,
    token_count: chunk.tokenCount,
    embedding: embeddings[index],
  }));

  const { error } = await supabase.from("file_analysis_chunks").insert(payload);
  if (error) {
    logger.error("ensureFileChunks insert error:", error);
  }
}

export async function retrieveRelevantChunks(
  supabase: SupabaseClient,
  fileIds: string[],
  query: string
): Promise<FileChunk[]> {
  if (fileIds.length === 0) return [];

  const { data: chunks, error } = await supabase
    .from("file_analysis_chunks")
    .select("*")
    .in("file_id", fileIds);

  if (error || !chunks || chunks.length === 0) {
    return [];
  }

  const { embedding: queryEmbedding } = await getEmbedding(query.slice(0, 4000));
  const normalizedQuery = normalizeEmbedding(queryEmbedding);

  const scored = (chunks as FileChunk[])
    .map((chunk) => {
      const vector = Array.isArray(chunk.embedding) ? chunk.embedding : [];
      const normalized = normalizeEmbedding(vector as number[]);
      return {
        chunk,
        score: cosineSimilarity(normalizedQuery, normalized),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, RETRIEVAL_TOP_K)
    .map((item) => item.chunk);

  return scored;
}
