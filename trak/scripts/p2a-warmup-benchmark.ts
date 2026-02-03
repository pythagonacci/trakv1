import { getToolsByGroups, toOpenAIFormat, type ToolGroup } from "../src/lib/ai/tool-definitions";

type WarmupResult = {
  groups: ToolGroup[];
  toolCount: number;
  jsonChars: number;
  cached: boolean;
  ms: number;
};

const WARM_GROUPS: ToolGroup[][] = [
  ["core"],
  ["core", "task"],
  ["core", "table"],
  ["core", "block"],
  ["core", "doc"],
  ["core", "project"],
];

function formatMs(ms: number) {
  return `${ms.toFixed(3)}ms`;
}

function warmOnce(cache: Map<string, { jsonChars: number }>, groups: ToolGroup[]): WarmupResult {
  const start = process.hrtime.bigint();
  const tools = getToolsByGroups(groups);
  const toolCacheKey = tools.map((tool) => tool.name).join("|");
  const existing = cache.get(toolCacheKey);

  if (existing) {
    const end = process.hrtime.bigint();
    return {
      groups,
      toolCount: tools.length,
      jsonChars: existing.jsonChars,
      cached: true,
      ms: Number(end - start) / 1e6,
    };
  }

  const formatted = toOpenAIFormat(tools);
  const jsonChars = JSON.stringify(formatted).length;
  cache.set(toolCacheKey, { jsonChars });
  const end = process.hrtime.bigint();
  return {
    groups,
    toolCount: tools.length,
    jsonChars,
    cached: false,
    ms: Number(end - start) / 1e6,
  };
}

function summarize(label: string, results: WarmupResult[]) {
  const totalMs = results.reduce((sum, r) => sum + r.ms, 0);
  const totalTools = results.reduce((sum, r) => sum + r.toolCount, 0);
  const totalChars = results.reduce((sum, r) => sum + r.jsonChars, 0);
  console.log(`\n${label}`);
  console.log(`Total time: ${formatMs(totalMs)}`);
  console.log(`Total tools: ${totalTools}`);
  console.log(`Total JSON chars: ${totalChars}`);
}

function run() {
  const cache = new Map<string, { jsonChars: number }>();

  const coldResults: WarmupResult[] = [];
  for (const groups of WARM_GROUPS) {
    coldResults.push(warmOnce(cache, groups));
  }

  const warmResults: WarmupResult[] = [];
  for (const groups of WARM_GROUPS) {
    warmResults.push(warmOnce(cache, groups));
  }

  summarize("Cold pass (no cache)", coldResults);
  summarize("Warm pass (cache hit)", warmResults);

  console.log("\nPer group set:");
  for (let i = 0; i < WARM_GROUPS.length; i += 1) {
    const groups = WARM_GROUPS[i];
    const cold = coldResults[i];
    const warm = warmResults[i];
    console.log(
      `${groups.join("+")}: cold ${formatMs(cold.ms)} → warm ${formatMs(warm.ms)} | tools=${cold.toolCount} json=${cold.jsonChars}`
    );
  }
}

run();
