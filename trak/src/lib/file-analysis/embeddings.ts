import { DEFAULT_OPENAI_EMBEDDINGS_MODEL } from "./constants";

interface EmbeddingResponse {
  embedding: number[];
}

export async function getEmbedding(text: string): Promise<EmbeddingResponse> {
  const openAIKey = process.env.OPENAI_API_KEY;

  if (openAIKey) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_OPENAI_EMBEDDINGS_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI embeddings error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const embedding = result?.data?.[0]?.embedding as number[] | undefined;
    if (!embedding) {
      throw new Error("OpenAI embeddings returned no vector");
    }
    return { embedding };
  }

  throw new Error("OpenAI embeddings are required but OPENAI_API_KEY is missing");
}
