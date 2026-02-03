import { SupabaseClient } from "@supabase/supabase-js";
import { IndexingJob } from "./job-queue";
import { logger } from "@/lib/logger";
import { extractFileContent } from "@/lib/file-analysis/extractor";
import { chunkText } from "@/lib/file-analysis/chunking";
import { getEmbedding } from "@/lib/file-analysis/embeddings";
import { DEEPSEEK_API_URL, DEFAULT_DEEPSEEK_MODEL } from "@/lib/file-analysis/constants";
import { clampText } from "@/lib/file-analysis/token";
import crypto from "crypto";

// --- Types ---

interface ResourceContent {
    text: string;
    metadata?: Record<string, any>;
    projectId?: string;
    tabId?: string;
}

// --- Helpers ---

function hashContent(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
}

async function generateSummary(text: string): Promise<string> {
    const context = text.slice(0, 15000);
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return "No summary available.";

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: DEFAULT_DEEPSEEK_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant. Summarize the following document in 1-2 sentences, focusing on its main topic and key entities.",
                    },
                    { role: "user", content: context },
                ],
                max_tokens: 150,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            logger.error(`Summary generation failed: ${err}`);
            return "Summary creation failed.";
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "No summary generated.";
    } catch (e) {
        logger.error("Summary generation error", e);
        return "Summary generation error.";
    }
}

function isFallbackSummary(summary: string) {
    const normalized = summary.trim().toLowerCase();
    return (
        normalized === "no summary available." ||
        normalized === "summary creation failed." ||
        normalized === "summary generation error."
    );
}

// --- Main Indexer ---

export class ResourceIndexer {
    constructor(private supabase: SupabaseClient) { }

    async processJob(job: IndexingJob) {
        logger.info(`Processing job ${job.id} for ${job.resource_type}:${job.resource_id}`);
        console.log(`[Indexer] Starting job ${job.id.slice(0, 8)} (${job.resource_type}:${job.resource_id.slice(0, 8)})`);

        try {
            // 1. Fetch Content
            const content = await this.fetchResourceContent(job.resource_type, job.resource_id);
            if (!content || !content.text.trim()) {
                console.log(`[Indexer] No content/empty for ${job.resource_type}:${job.resource_id.slice(0, 8)}`);
                logger.warn(`No content found for ${job.resource_type}:${job.resource_id}`);
                return;
            }

            // 2. Hash & Change Detection
            const currentHash = hashContent(content.text);
            const { data: existingParent } = await this.supabase
                .from("unstructured_parents")
                .select("id, content_hash")
                .eq("source_type", job.resource_type)
                .eq("source_id", job.resource_id)
                .maybeSingle();

            if (existingParent && existingParent.content_hash === currentHash) {
                console.log(`[Indexer] Content unchanged for ${job.resource_type}:${job.resource_id.slice(0, 8)}. Skipping.`);
                await this.supabase.from("unstructured_parents").update({ last_indexed_at: new Date().toISOString() }).eq("id", existingParent.id);
                return;
            }

            // 3. Generate Metadata (Summary + Embeddings)
            console.log(`[Indexer] Generating summary for ${job.resource_type}:${job.resource_id.slice(0, 8)}...`);
            const rawSummary = await generateSummary(content.text);
            const summary = isFallbackSummary(rawSummary)
                ? clampText(content.text, 800)
                : rawSummary;
            const { embedding: summaryEmbedding } = await getEmbedding(summary);
            console.log(`[Indexer] Generated parent summary embedding (dim: ${summaryEmbedding.length})`);

            // 4. Upsert Parent
            let parentId = existingParent?.id;
            if (parentId) {
                await this.supabase.from("unstructured_parents").update({
                    summary,
                    summary_embedding: summaryEmbedding,
                    content_hash: currentHash,
                    last_indexed_at: new Date().toISOString(),
                    workspace_id: job.workspace_id,
                    project_id: content.projectId,
                    tab_id: content.tabId,
                }).eq("id", parentId);
                await this.supabase.from("unstructured_chunks").delete().eq("parent_id", parentId);
            } else {
                const { data: newParent, error } = await this.supabase.from("unstructured_parents").insert({
                    workspace_id: job.workspace_id,
                    project_id: content.projectId,
                    tab_id: content.tabId,
                    source_type: job.resource_type,
                    source_id: job.resource_id,
                    summary,
                    summary_embedding: summaryEmbedding,
                    content_hash: currentHash,
                }).select("id").single();
                if (error) throw error;
                parentId = newParent.id;
            }

            // 5. Chunking & Chunk Embeddings
            const chunks = chunkText(content.text, { targetTokens: 1000, overlapTokens: 100 });
            console.log(`[Indexer] Resource split into ${chunks.length} chunks. Generating embeddings...`);

            const chunkPayloads: Array<{
                parent_id: string;
                chunk_index: number;
                content: string;
                embedding: number[];
            }> = [];
            const BATCH_SIZE = 5;

            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                const batch = chunks.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (chunk, batchIdx) => {
                    const globalIdx = i + batchIdx;
                    const { embedding } = await getEmbedding(chunk.content);
                    chunkPayloads.push({
                        parent_id: parentId,
                        chunk_index: globalIdx,
                        content: chunk.content,
                        embedding
                    });
                }));
                console.log(`  [Indexer] Progress: ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks done.`);
            }

            // 6. Insert Chunks
            if (chunkPayloads.length > 0) {
                const { error: chunkError } = await this.supabase.from("unstructured_chunks").insert(chunkPayloads);
                if (chunkError) throw chunkError;
            }

            console.log(`[Indexer] Finished job ${job.id.slice(0, 8)}. Created ${chunkPayloads.length} chunks.`);
            logger.info(`Successfully indexed ${job.resource_type}:${job.resource_id} with ${chunkPayloads.length} chunks.`);

        } catch (err) {
            logger.error(`Indexing failed for job ${job.id}`, err);
            throw err;
        }
    }

    private async fetchResourceContent(type: string, id: string): Promise<ResourceContent | null> {
        if (type === 'file') {
            const { data: file } = await this.supabase.from("files").select("*").eq("id", id).single();
            if (!file) return null;

            const { data: storageData, error: storageError } = await this.supabase.storage
                .from("files")
                .download(file.storage_path);

            if (storageError || !storageData) {
                logger.error("Failed to download file for indexing", storageError);
                return null;
            }

            const buffer = Buffer.from(await storageData.arrayBuffer());
            const extracted = await extractFileContent({
                buffer,
                fileName: file.file_name,
                fileType: file.file_type
            });

            return {
                text: extracted.text || "",
                projectId: file.project_id,
            };
        }
        else if (type === 'block') {
            const { data: block } = await this.supabase.from("blocks").select("*").eq("id", id).single();
            if (!block) return null;

            let text = "";
            if (typeof block.content === 'string') text = block.content;
            else if (block.content && typeof block.content === 'object') {
                text = extractTextFromProseMirror(block.content) || JSON.stringify(block.content);
            }

            return {
                text,
                tabId: block.tab_id
            };
        }
        else if (type === 'doc') {
            const { data: doc } = await this.supabase
                .from("docs")
                .select("id, title, content")
                .eq("id", id)
                .single();
            if (!doc) return null;

            const contentText = extractTextFromProseMirror(doc.content) || "";
            const titleText = doc.title ? `Title: ${doc.title}\n\n` : "";
            return {
                text: `${titleText}${contentText}`.trim()
            };
        }
        else if (type === 'table') {
            return this.fetchTableContent(id);
        }

        return null;
    }

    private async fetchTableContent(tableId: string): Promise<ResourceContent | null> {
        // 1. Fetch Table Metadata
        const { data: table } = await this.supabase
            .from("tables")
            .select("id, title, description, project_id, workspace_id")
            .eq("id", tableId)
            .single();

        if (!table) return null;

        // 2. Fetch Fields (ordered)
        const { data: fields } = await this.supabase
            .from("table_fields")
            .select("id, name, type, config")
            .eq("table_id", tableId)
            .order("order");

        if (!fields || fields.length === 0) {
            // Index just the metadata if no fields (or maybe just return null? Better to index metadata)
            return {
                text: `Table: ${table.title}\nDescription: ${table.description || ""}`,
                projectId: table.project_id
            };
        }

        // 3. Fetch Rows
        const { data: rows } = await this.supabase
            .from("table_rows")
            .select("id, data")
            .eq("table_id", tableId)
            .order("order"); // or order index

        if (!rows || rows.length === 0) {
            return {
                text: `Table: ${table.title}\nDescription: ${table.description || ""}\n(No rows)`,
                projectId: table.project_id
            };
        }

        // 4. Format Content
        let text = `Table: ${table.title}\n`;
        if (table.description) text += `Description: ${table.description}\n`;
        text += `\n`;

        // Efficiently map field IDs to names
        const fieldMap = new Map(fields.map(f => [f.id, f.name]));

        // Helper to format values
        const formatValue = (val: any): string => {
            if (val === null || val === undefined) return "";
            if (typeof val === "string") return val;
            if (typeof val === "number" || typeof val === "boolean") return String(val);
            if (Array.isArray(val)) {
                return val.map(v => {
                    if (typeof v === 'object' && v && 'name' in v) return v.name;
                    return String(v);
                }).join(", ");
            }
            if (typeof val === "object") {
                if ('name' in val) return val.name;
                if ('label' in val) return val.label; // for some selects
                return JSON.stringify(val);
            }
            return String(val);
        };

        rows.forEach((row, index) => {
            text += `Row ${index + 1}:\n`;
            fields.forEach(field => {
                const rawValue = row.data[field.id];
                const formatted = formatValue(rawValue);
                if (formatted) {
                    text += `- ${field.name}: ${formatted}\n`;
                }
            });
            text += `\n`;
        });

        return {
            text,
            projectId: table.project_id
        };
    }
}

function extractTextFromProseMirror(node: any): string {
    if (!node) return "";
    if (node.type === "text" && node.text) return node.text;
    if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractTextFromProseMirror).join("\n");
    }
    return "";
}
