import { SupabaseClient } from "@supabase/supabase-js";
import { getEmbedding } from "@/lib/file-analysis/embeddings";
import { logger } from "@/lib/logger";
import { DEEPSEEK_API_URL, DEFAULT_DEEPSEEK_MODEL, RETRIEVAL_TOP_K } from "@/lib/file-analysis/constants";

export interface SearchResult {
    parentId: string;
    sourceId: string;
    sourceType: string;
    summary: string;
    chunks: {
        content: string;
        score: number;
    }[];
    score: number; // Parent score
}

// Parent Gating Threshold - heuristic
const MIN_PARENT_SCORE = 0.15;
const MIN_CHUNK_SCORE = 0.15;
const MAX_PARENT_COUNT = 10;

export class UnstructuredSearch {
    constructor(private supabase: SupabaseClient) { }

    async searchWorkspace(workspaceId: string, query: string): Promise<SearchResult[]> {
        // 1. Generate Query Embedding
        const { embedding: queryVector } = await getEmbedding(query);
        const normalizedQuery = normalizeEmbedding(queryVector);

        // 2. Parent Gating: Find most relevant "Containers" first
        // We use RPC or direct select if pgvector installed. 
        // Assuming standard pgvector `ws_unstructured_parents_search` function doesn't exist yet, 
        // I will write a raw query using `rpc` if migration created valid function, 
        // or use Supabase's vector similarity via client.

        // For V1, I didn't create an RPC function in the migration plan. 
        // I should probably have done that for performance. 
        // BUT I can do a client-side vector sort if the # of parents is small, 
        // or strictly I should rely on an RPC. 
        // Let's assume for this Agent task I can rely on a dedicated RPC function I'll implicitly add 
        // OR just use client side sorting if dataset small? No, dangerous.

        // I will update the migration to include an RPC function in the next step or just embed the logic here if I can.
        // Actually, Supabase JS client `match_documents` pattern is standard.
        // I will use a custom RPC call `match_indexing_parents` which I'll define in the migration correction step if possible.
        // Wait, I already wrote the migration file and didn't include RPC. 
        // I should create a new file or just use raw query if able. 
        // Let's write a `match_unstructured_parents` RPC in a separate "fix" migration if needed, 
        // or just assume I can add it now.

        // Actually, I'll use a raw query check first.
        // But since I can't easily execute raw SQL from here without RPC...
        // I'll stick to a simpler approach: 
        // If I can't use RPC, I have to download vectors? No that's bad.
        // I will create a `rpc` function in a new migration file now to support this.
        // It's "Additive changes only".

        // Let's assume I will call `rpc('match_unstructured_parents', { query_embedding, match_threshold, match_count })`.

        let { data: parents, error: parentError } = await this.supabase.rpc('match_unstructured_parents', {
            match_embedding: queryVector,
            match_threshold: MIN_PARENT_SCORE,
            match_count: MAX_PARENT_COUNT,
            filter_workspace_id: workspaceId
        });

        if (parentError) {
            console.error('[Search] RPC match_unstructured_parents failed:', parentError);
            logger.error('Parent match error', parentError);
            parents = null;
        }

        if (!parents || parents.length === 0) {
            // Retry with a looser threshold before falling back
            const retry = await this.supabase.rpc('match_unstructured_parents', {
                match_embedding: queryVector,
                match_threshold: 0,
                match_count: MAX_PARENT_COUNT,
                filter_workspace_id: workspaceId
            });
            if (retry.error) {
                console.error('[Search] RPC match_unstructured_parents retry failed:', retry.error);
                logger.error('Parent match retry error', retry.error);
            } else {
                parents = retry.data;
            }
        }

        if (!parents || parents.length === 0) {
            // Fallback to client-side scoring (handles RPC issues or low-quality summaries)
            parents = await this.matchParentsClientSide(workspaceId, normalizedQuery, MAX_PARENT_COUNT);
        }

        if (!parents || parents.length === 0) {
            console.log('[Search] No relevant parents found after fallback');
            return [];
        }

        console.log(`[Search] Found ${parents.length} relevant parents:`, parents.map((p: any) => ({ id: p.id, score: p.similarity })));
        const relevantParentIds = parents.map((p: any) => p.id);

        // 3. Chunk Retrieval for these parents
        // Fetch chunks for these parents.
        // Optional: Also vector search chunks? 
        // Or just simple text match/fetch since we trust the parent context?
        // Hybrid: Vector search chunks WITHIN these parents.

        // We need another RPC for chunks? Or just select * and sort JS side (chunks per parent is small ~20-50).
        // Let's fetch all chunks for these parents and sort JS side for simplicity over 10 parents.

        const { data: chunks, error: chunkError } = await this.supabase
            .from("unstructured_chunks")
            .select("parent_id, content, embedding")
            .in("parent_id", relevantParentIds);

        if (chunkError || !chunks) return [];

        // 4. Rerank Chunks (Cosine Similarity against Query)
        const results: Record<string, SearchResult> = {};

        // Initialize results map
        console.log(`[Search] Chunk scoring started for ${chunks.length} total chunks...`);
        parents.forEach((p: any) => {
            results[p.id] = {
                parentId: p.id,
                sourceId: p.source_id,
                sourceType: p.source_type,
                summary: p.summary,
                score: p.similarity, // from RPC
                chunks: []
            };
        });

        // Score chunks
        const allScores: number[] = [];
        const chunkBuckets = new Map<string, Array<{ content: string; score: number }>>();
        chunks.forEach(chunk => {
            const embedding = parseEmbedding(chunk.embedding);
            if (!embedding) return;
            const chunkScore = cosineSimilarity(normalizedQuery, normalizeEmbedding(embedding));
            allScores.push(chunkScore);
            const bucket = chunkBuckets.get(chunk.parent_id) ?? [];
            bucket.push({ content: chunk.content, score: chunkScore });
            chunkBuckets.set(chunk.parent_id, bucket);
        });

        chunkBuckets.forEach((bucket, parentId) => {
            const sorted = bucket.sort((a, b) => b.score - a.score);
            const filtered = sorted.filter(chunk => chunk.score >= MIN_CHUNK_SCORE).slice(0, RETRIEVAL_TOP_K);
            const finalChunks = filtered.length > 0 ? filtered : sorted.slice(0, Math.min(3, sorted.length));
            if (finalChunks.length > 0) {
                console.log(`  [Search] Chunk matched parent ${parentId.slice(0, 8)} with score ${finalChunks[0].score.toFixed(3)}`);
                results[parentId].chunks.push(...finalChunks);
            }
        });

        if (allScores.length > 0) {
            const max = Math.max(...allScores);
            const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
            console.log(`[Search] Chunk Statistics: Count=${allScores.length}, MaxScore=${max.toFixed(4)}, AvgScore=${avg.toFixed(4)}`);
        }

        const finalResults = Object.values(results)
            .filter(r => r.chunks.length > 0)
            .sort((a, b) => b.score - a.score);

        console.log(`[Search] Final results after chunk filtering: ${finalResults.length}`);
        return finalResults;
    }

    private async matchParentsClientSide(workspaceId: string, normalizedQuery: number[], limit: number) {
        const { data: parentRows, error } = await this.supabase
            .from("unstructured_parents")
            .select("id, source_type, source_id, summary, summary_embedding")
            .eq("workspace_id", workspaceId);

        if (error || !parentRows) {
            if (error) {
                console.error("[Search] Client-side parent fetch failed:", error);
                logger.error("Parent fallback fetch error", error);
            }
            return [];
        }

        const scored = parentRows
            .map((parent: any) => {
                const embedding = parseEmbedding(parent.summary_embedding);
                if (!embedding) return null;
                return {
                    id: parent.id,
                    source_type: parent.source_type,
                    source_id: parent.source_id,
                    summary: parent.summary,
                    similarity: cosineSimilarity(normalizedQuery, normalizeEmbedding(embedding))
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => b.similarity - a.similarity)
            .slice(0, limit);

        return scored;
    }

    async answerQuery(workspaceId: string, query: string) {
        // 1. Search
        const searchResults = await this.searchWorkspace(workspaceId, query);

        if (searchResults.length === 0) {
            return { answer: "I couldn't find any relevant information in your workspace.", sources: [] };
        }

        // 2. Format Context & Pre-fetch Titles
        // We fetch titles first so we can give them to the LLM (better citations than UUIDs)
        const enrichedSources = await this.formatSourcesForFrontend(searchResults);

        const contextDocs = enrichedSources.map((s, i) => {
            // Find original chunks (the formatted source flattened them, but we need text)
            const originalReq = searchResults[i];

            // Take top 3 chunks per parent
            const topChunks = originalReq.chunks.sort((a, b) => b.score - a.score).slice(0, 3);
            const chunkText = topChunks.map(c => c.content).join("\n...\n");

            return `[${i + 1}] Source: ${s.source_id} (Score: ${s.similarity.toFixed(2)})\n${chunkText}`;
        }).join("\n\n---\n\n");

        // 3. Synthesize (DeepSeek)
        const systemPrompt = `You are a workspace assistant. Answer the user's question based ONLY on the following context. 
    The context provides sources labeled [1], [2], etc.
    
    1. Answer the question clearly using Markdown.
    2. Cite your sources using their numbers, e.g., "Feature X is ready [1]".
    3. If the answer isn't in the context, say "I don't have enough information."
    4. AT THE VERY END, output a single line starting with "SOURCES:" listing the numbers of sources you actually used to answer.
       Example:
       ... answer text ...
       
       SOURCES: [1], [3]`;

        // Call DeepSeek
        const rawAnswer = await this.callLLM(systemPrompt, query, contextDocs);

        // 4. Parse SOURCES output
        let answer = rawAnswer;
        let usedIndices: number[] = [];

        const sourcesMatch = rawAnswer.match(/SOURCES:\s*(\[[0-9]+\](?:,\s*\[[0-9]+\])*)/i);
        if (sourcesMatch) {
            // Extract indices
            const indicesText = sourcesMatch[1];
            const matches = indicesText.match(/\[([0-9]+)\]/g);
            if (matches) {
                usedIndices = matches.map(m => parseInt(m.replace(/[\[\]]/g, ''), 10));
            }

            // Remove the SOURCES line from the final answer text
            answer = rawAnswer.replace(sourcesMatch[0], '').trim();
        } else {
            // Fallback
            if (answer.toLowerCase().includes("don't have enough information")) {
                usedIndices = [];
            } else {
                // Assume top 3 relevant if not specified
                usedIndices = [1, 2, 3];
            }
        }

        // Filter sources
        const finalSources = enrichedSources.filter((_, i) => usedIndices.includes(i + 1));

        return {
            answer,
            sources: finalSources.length > 0 ? finalSources : []
        };
    }

    /** Get file metadata (name, type) for file/pdf/image blocks so titles show type to workflow AI */
    private async getBlockFileMetadata(
        blocks: { id: string; type?: string; content?: Record<string, unknown> | null }[]
    ): Promise<Map<string, { file_name: string; file_type: string }[]>> {
        const fileBlockIds: string[] = [];
        const pdfImageFileIds: string[] = [];
        blocks.forEach((b) => {
            if (b.type === "file") fileBlockIds.push(b.id);
            else if ((b.type === "pdf" || b.type === "image") && b.content?.fileId)
                pdfImageFileIds.push(b.content.fileId as string);
        });
        const out = new Map<string, { file_name: string; file_type: string }[]>();

        if (fileBlockIds.length > 0) {
            const { data: attachments } = await this.supabase
                .from("file_attachments")
                .select("block_id, file_id")
                .in("block_id", fileBlockIds);
            const fileIds = [...new Set((attachments ?? []).map((a) => a.file_id).filter(Boolean))];
            if (fileIds.length > 0) {
                const { data: files } = await this.supabase
                    .from("files")
                    .select("id, file_name, file_type")
                    .in("id", fileIds);
                const fileMap = new Map((files ?? []).map((f) => [f.id, { file_name: f.file_name ?? "file", file_type: f.file_type ?? "" }]));
                const blockToFiles = new Map<string, { file_name: string; file_type: string }[]>();
                (attachments ?? []).forEach((a) => {
                    const meta = fileMap.get(a.file_id);
                    if (meta) {
                        const list = blockToFiles.get(a.block_id) ?? [];
                        list.push(meta);
                        blockToFiles.set(a.block_id, list);
                    }
                });
                blockToFiles.forEach((list, blockId) => out.set(blockId, list));
            }
        }

        if (pdfImageFileIds.length > 0) {
            const { data: files } = await this.supabase
                .from("files")
                .select("id, file_name, file_type")
                .in("id", pdfImageFileIds);
            const fileMap = new Map((files ?? []).map((f) => [f.id, [{ file_name: f.file_name ?? "file", file_type: f.file_type ?? "" }]]));
            blocks.forEach((b) => {
                if ((b.type === "pdf" || b.type === "image") && b.content?.fileId) {
                    const list = fileMap.get(b.content.fileId as string);
                    if (list) out.set(b.id, list);
                }
            });
        }
        return out;
    }

    private async formatSourcesForFrontend(results: SearchResult[]) {
        // Collect IDs to fetch titles
        const fileIds: string[] = [];
        const tableIds: string[] = [];
        const blockIds: string[] = [];
        const docIds: string[] = [];

        results.forEach(r => {
            if (r.sourceType === 'file') fileIds.push(r.sourceId);
            else if (r.sourceType === 'table') tableIds.push(r.sourceId);
            else if (r.sourceType === 'block') blockIds.push(r.sourceId);
            else if (r.sourceType === 'doc') docIds.push(r.sourceId);
        });

        const titles = new Map<string, string>();

        // Fetch Files
        if (fileIds.length > 0) {
            const { data } = await this.supabase.from("files").select("id, file_name").in("id", fileIds);
            data?.forEach(f => titles.set(f.id, f.file_name));
        }
        // Fetch Docs
        if (docIds.length > 0) {
            const { data } = await this.supabase.from("docs").select("id, title").in("id", docIds);
            data?.forEach(d => titles.set(d.id, d.title));
        }
        // Fetch Tables
        if (tableIds.length > 0) {
            const { data } = await this.supabase.from("tables").select("id, title").in("id", tableIds);
            data?.forEach(t => titles.set(t.id, t.title));
        }
        // Fetch Blocks (derive a display title or fall back to block type); enrich file/pdf/image with file type for workflow AI
        if (blockIds.length > 0) {
            const { data: blocks } = await this.supabase.from("blocks").select("id, type, content").in("id", blockIds);
            const fileMetaByBlockId = await this.getBlockFileMetadata(blocks ?? []);
            blocks?.forEach((b: { id: string; type?: string; content?: Record<string, unknown> | null }) =>
                titles.set(b.id, getBlockDisplayTitle(b, fileMetaByBlockId.get(b.id)))
            );
        }

        return results.map(r => {
            const topChunk = r.chunks.sort((a, b) => b.score - a.score)[0];
            const title = titles.get(r.sourceId) || `${r.sourceType} (${r.sourceId.slice(0, 8)})`;
            const rawChunk = topChunk?.content || r.summary;
            const chunkContent = r.sourceType === "block" ? formatBlockChunkPreview(rawChunk) : rawChunk;
            return {
                source_id: title, // Frontend displays this as name
                chunk_content: chunkContent,
                similarity: r.score
            };
        });
    }

    private async callLLM(system: string, query: string, context: string): Promise<string> {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) return "LLM not configured.";

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
                        { role: "system", content: system },
                        { role: "user", content: `Context:\n${context}\n\nQuestion: ${query}` },
                    ],
                    max_tokens: 500
                })
            });

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "No response.";
        } catch (e) {
            logger.error("LLM Answer failed", e);
            return "Failed to generate answer.";
        }
    }
}

function formatBlockChunkPreview(raw: string): string {
    const trimmed = raw?.trim();
    if (!trimmed) return raw;
    const normalized = trimmed.replace(/\\n/g, "\n");
    const looksJson =
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"));
    if (!looksJson) return normalized;

    try {
        const data = JSON.parse(trimmed);
        if (typeof data === "string") return data;
        if (data && typeof data.text === "string" && data.text.trim()) return data.text;
        if (data && Array.isArray(data.tasks)) {
            const lines = data.tasks
                .map((task: any) => {
                    if (!task || typeof task !== "object") return null;
                    const text = typeof task.text === "string" ? task.text.trim() : "";
                    if (!text) return null;
                    const metaParts: string[] = [];
                    if (task.status) metaParts.push(String(task.status));
                    if (task.dueDate) metaParts.push(`due ${task.dueDate}`);
                    if (task.priority) metaParts.push(String(task.priority));
                    const meta = metaParts.length ? ` (${metaParts.join(", ")})` : "";
                    return `- ${text}${meta}`;
                })
                .filter(Boolean)
                .slice(0, 12);
            if (lines.length > 0) return lines.join("\n");
        }
        if (data && typeof data.content === "string" && data.content.trim()) return data.content;
    } catch {
        return normalized;
    }

    return normalized;
}

function formatFileTypeLabel(fileType: string): string {
    if (!fileType) return "file";
    const mime = fileType.toLowerCase();
    if (mime === "application/pdf") return "PDF";
    if (mime.includes("spreadsheet") || mime.includes("excel")) return "spreadsheet";
    if (mime === "text/csv") return "CSV";
    if (mime.includes("word") || mime.includes("document")) return "document";
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("text/")) return "text";
    return mime;
}

function getBlockDisplayTitle(
    block: { type?: string; content?: Record<string, unknown> | null },
    fileMeta?: { file_name: string; file_type: string }[]
): string {
    const type = typeof block.type === "string" ? block.type : "block";
    const content = block.content ?? {};

    const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

    switch (type) {
        case "text": {
            return "Text block";
        }
        case "task": {
            const title = asString((content as any).title);
            return title || "Task block";
        }
        case "table": {
            const title = asString((content as any).title);
            return title || "Table block";
        }
        case "timeline":
            return "Timeline block";
        case "image": {
            if (fileMeta?.length) {
                const f = fileMeta[0];
                return `${f.file_name} (${formatFileTypeLabel(f.file_type)})`;
            }
            const alt = asString((content as any).alt) || asString((content as any).filename);
            return alt || "Image block";
        }
        case "file": {
            if (fileMeta?.length) {
                const parts = fileMeta.map((f) => `${f.file_name} (${formatFileTypeLabel(f.file_type)})`);
                return parts.join(", ") || "File block";
            }
            const filename = asString((content as any).filename);
            return filename || "File block";
        }
        case "video": {
            const title = asString((content as any).title);
            return title || "Video block";
        }
        case "embed": {
            const title = asString((content as any).title);
            return title || "Embed block";
        }
        case "link": {
            const title = asString((content as any).title) || asString((content as any).url);
            return title || "Link block";
        }
        case "divider":
            return "Divider block";
        case "section": {
            const title = asString((content as any).title);
            return title || "Section block";
        }
        case "doc_reference": {
            const title = asString((content as any).title);
            return title || "Doc reference block";
        }
        case "pdf": {
            if (fileMeta?.length) {
                const f = fileMeta[0];
                return `${f.file_name} (${formatFileTypeLabel(f.file_type)})`;
            }
            const filename = asString((content as any).filename);
            return filename || "PDF block";
        }
        default:
            return `${type} block`;
    }
}

// Helper (copied from service.ts to avoid circular deps if needed, or import)
function cosineSimilarity(a: number[], b: number[]) {
    if (!a.length || a.length !== b.length) return 0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

function normalizeEmbedding(vector: number[]) {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (!magnitude) return vector;
    return vector.map((v) => v / magnitude);
}

function parseEmbedding(value: unknown): number[] | null {
    if (!value) return null;
    if (Array.isArray(value)) return value as number[];
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const normalized = trimmed.replace(/^\[|\]$/g, "");
        if (!normalized) return [];
        return normalized.split(",").map((entry) => Number(entry.trim())).filter((n) => Number.isFinite(n));
    }
    return null;
}
