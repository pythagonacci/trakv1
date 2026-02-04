"use server";

import fs from "fs/promises";
import path from "path";
import { aiDebug } from "./debug";
import { CHART_GENERATION_SYSTEM_PROMPT } from "./chart-prompt";
import type { ChartType } from "@/types/chart";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

export interface ChartGenerationInput {
  prompt: string;
  chartType?: ChartType;
  title?: string | null;
  dataContext?: Record<string, unknown> | null;
  isSimulation?: boolean;
  originalChartCode?: string | null;
  simulationDescription?: string | null;
}

export interface ChartGenerationResult {
  code: string;
}

function resolveProvider() {
  const openAIKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const providerPref = (process.env.AI_PROVIDER || "").toLowerCase();

  if (!openAIKey && !deepseekKey) {
    return { error: "Missing OPENAI_API_KEY or DEEPSEEK_API_KEY" } as const;
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

  return { provider, apiKey: apiKey as string, model, apiUrl } as const;
}

function sanitizeChartCode(raw: string) {
  let cleaned = raw.trim();

  // Strip markdown fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "");
    cleaned = cleaned.replace(/```$/, "");
  }

  return cleaned.trim();
}

function safeStringify(value: unknown, maxLength = 24000) {
  try {
    const json = JSON.stringify(value, null, 2);
    if (json.length <= maxLength) return json;
    return json.slice(0, maxLength) + "\n... (truncated)";
  } catch {
    return "[unserializable]";
  }
}

async function loadStylingGuidelines() {
  const guidelinesPath = path.join(process.cwd(), "src", "lib", "chart-styling-guidelines.md");
  try {
    return await fs.readFile(guidelinesPath, "utf-8");
  } catch (error) {
    aiDebug("chart-generator:guidelines-missing", error);
    return "";
  }
}

export async function generateChartCode(input: ChartGenerationInput): Promise<ChartGenerationResult> {
  const providerInfo = resolveProvider();
  if ("error" in providerInfo) {
    throw new Error(providerInfo.error);
  }

  const guidelines = await loadStylingGuidelines();
  const systemPrompt = `${CHART_GENERATION_SYSTEM_PROMPT}\n\n# Trak Chart Styling Guidelines\n${guidelines}`;

  const userPrompt = [
    `User request: ${input.prompt}`,
    input.title ? `Requested title: ${input.title}` : "",
    input.chartType ? `Requested chartType: ${input.chartType}` : "Requested chartType: auto",
    input.isSimulation ? "Simulation: true" : "Simulation: false",
    input.simulationDescription ? `Simulation instructions: ${input.simulationDescription}` : "",
    input.originalChartCode ? `Original chart JSX:\n${input.originalChartCode}` : "",
    input.dataContext ? `Data context (JSON):\n${safeStringify(input.dataContext)}` : "",
  ].filter(Boolean).join("\n\n");

  aiDebug("chart-generator:request", {
    provider: providerInfo.provider,
    model: providerInfo.model,
    chartType: input.chartType,
    hasDataContext: Boolean(input.dataContext),
    isSimulation: Boolean(input.isSimulation),
  });

  const response = await fetch(providerInfo.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerInfo.apiKey}`,
    },
    body: JSON.stringify({
      model: providerInfo.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1400,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    aiDebug("chart-generator:error", { status: response.status, errorText });
    throw new Error("Chart generation failed");
  }

  const result = await response.json();
  const raw = result.choices?.[0]?.message?.content ?? "";
  const code = sanitizeChartCode(String(raw));

  if (!code) {
    throw new Error("Chart generation returned empty code");
  }

  return { code };
}
