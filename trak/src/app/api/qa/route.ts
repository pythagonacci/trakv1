import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { aiDebug } from "@/lib/ai/debug";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", answer: "Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { question } = body as { question?: string };

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing question", answer: "Please provide a question." },
        { status: 400 }
      );
    }

    const openAIKey = process.env.OPENAI_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const providerPref = (process.env.AI_PROVIDER || "").toLowerCase();

    if (!openAIKey && !deepseekKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing API key",
          answer: "OPENAI_API_KEY or DEEPSEEK_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const provider =
      providerPref === "deepseek"
        ? deepseekKey
          ? "deepseek"
          : openAIKey
            ? "openai"
            : "deepseek"
        : providerPref === "openai"
          ? openAIKey
            ? "openai"
            : deepseekKey
              ? "deepseek"
              : "openai"
          : openAIKey
            ? "openai"
            : "deepseek";

    const apiKey = provider === "openai" ? openAIKey : deepseekKey;
    const model =
      provider === "openai"
        ? process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
        : process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
    const apiUrl = provider === "openai" ? OPENAI_API_URL : DEEPSEEK_API_URL;

    aiDebug("api/qa:request", {
      userId: user.id,
      model,
      provider,
      questionLength: question.length,
    });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a helpful assistant. Answer clearly and concisely." },
          { role: "user", content: question },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      aiDebug("api/qa:error", { status: response.status, errorText });
      return NextResponse.json(
        { success: false, error: "OpenAI API error", answer: "Failed to get a response." },
        { status: 502 }
      );
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content?.trim() || "No response.";

    aiDebug("api/qa:response", { answerLength: answer.length });

    return NextResponse.json({ success: true, answer });
  } catch (error) {
    aiDebug("api/qa:exception", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        answer: "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
