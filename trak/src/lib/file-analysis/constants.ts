export const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
export const DEEPSEEK_EMBEDDINGS_URL = "https://api.deepseek.com/v1/embeddings";

export const DEFAULT_DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v3.2";
export const DEFAULT_DEEPSEEK_EMBEDDINGS_MODEL = process.env.DEEPSEEK_EMBEDDINGS_MODEL || "deepseek-embedding";

export const DEFAULT_OPENAI_EMBEDDINGS_MODEL = process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small";
export const OPENAI_EMBEDDING_DIM = 1536;

// Heuristic thresholds for small vs RAG
export const MAX_INLINE_TOKENS = 8000;
export const MAX_INLINE_ROWS = 2000;
export const MAX_INLINE_PAGES = 20;
export const MAX_INLINE_FILE_BYTES = 2 * 1024 * 1024; // 2MB

export const MAX_TABLE_PREVIEW_ROWS = 200;

export const CHUNK_TOKEN_TARGET = 800;
export const CHUNK_TOKEN_OVERLAP = 120;
export const RETRIEVAL_TOP_K = 6;

export const MAX_HISTORY_MESSAGES = 8;
