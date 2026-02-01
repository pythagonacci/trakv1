import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PASS = process.env.PASS || "baseline";
const AI_BEARER_TOKEN = process.env.AI_BEARER_TOKEN || "";
const AI_COOKIE = process.env.AI_COOKIE || "";
const TIMING_LOG = process.env.TIMING_LOG || "";
const OUTPUT_TIMING_LOG = process.env.OUTPUT_TIMING_LOG || "bench-timing.log";
const RAW_LOG = process.env.BENCH_RAW_LOG || "bench-raw.log";
const DELAY_MS = Number(process.env.DELAY_MS || 0);
const METRICS_OUT = process.env.METRICS_OUT || "";

const route = `${BASE_URL.replace(/\/$/, "")}/api/ai`;

const commands = [
  "show my tasks",
  "list projects",
  "search tables named roadmap",
  "find tasks assigned to Amna",
  "show timeline events for this project",
  "create a table of Q1 tasks by priority and populate 10 rows",
  "move all high-priority tasks to done",
  "create a task board from tasks assigned to Amna",
  "update table rows where Status=Blocked to In Progress",
  "create a project, add a tab, and add a table",
];

const headers = {
  "Content-Type": "application/json",
};
if (AI_BEARER_TOKEN) {
  headers.Authorization = `Bearer ${AI_BEARER_TOKEN}`;
}
if (AI_COOKIE) {
  headers.Cookie = AI_COOKIE;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)];
}

function average(values) {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function parseTimingLine(line) {
  const metrics = {};
  const regex = /([a-zA-Z0-9_]+)\s*:\s*([0-9]+)/g;
  let match;
  while ((match = regex.exec(line))) {
    const key = match[1];
    const val = Number(match[2]);
    if (Number.isFinite(val)) {
      metrics[key] = val;
    }
  }
  return metrics;
}

function collectMetrics(lines) {
  const totals = [];
  const llm1 = [];
  const llm2 = [];
  const tools = [];
  const promptChars = [];
  const toolsJsonChars = [];
  const toolResultChars = [];

  for (const line of lines) {
    const m = parseTimingLine(line);
    if (Number.isFinite(m.t_total_ms)) totals.push(m.t_total_ms);
    if (Number.isFinite(m.t_llm1_ms)) llm1.push(m.t_llm1_ms);
    if (Number.isFinite(m.t_llm2_ms)) llm2.push(m.t_llm2_ms);
    if (Number.isFinite(m.t_tools_total_ms)) tools.push(m.t_tools_total_ms);
    if (Number.isFinite(m.system_prompt_chars)) promptChars.push(m.system_prompt_chars);
    if (Number.isFinite(m.tools_json_chars)) toolsJsonChars.push(m.tools_json_chars);
    if (Number.isFinite(m.tool_result_chars_total)) toolResultChars.push(m.tool_result_chars_total);
  }

  return {
    count: lines.length,
    p50_total: percentile(totals, 0.5),
    p95_total: percentile(totals, 0.95),
    p50_llm1: percentile(llm1, 0.5),
    p95_llm1: percentile(llm1, 0.95),
    p50_tools: percentile(tools, 0.5),
    p95_tools: percentile(tools, 0.95),
    p50_llm2: percentile(llm2, 0.5),
    p95_llm2: percentile(llm2, 0.95),
    avg_system_prompt_chars: average(promptChars),
    avg_tools_json_chars: average(toolsJsonChars),
    avg_tool_result_chars_total: average(toolResultChars),
  };
}

function formatMetric(value) {
  if (value === null || value === undefined) return "n/a";
  return Math.round(value);
}

function writeTimingLines(lines) {
  if (!lines.length) return;
  if (TIMING_LOG && path.resolve(TIMING_LOG) === path.resolve(OUTPUT_TIMING_LOG)) {
    return;
  }
  fs.appendFileSync(OUTPUT_TIMING_LOG, lines.join("\n") + "\n");
}

async function run() {
  const timingOffset = TIMING_LOG && fs.existsSync(TIMING_LOG)
    ? fs.statSync(TIMING_LOG).size
    : 0;

  for (const command of commands) {
    const body = JSON.stringify({ command, conversationHistory: [] });
    const start = Date.now();
    let status = 0;
    let ok = false;
    let text = "";
    try {
      const response = await fetch(route, {
        method: "POST",
        headers,
        body,
      });
      status = response.status;
      ok = response.ok;
      text = await response.text();
    } catch (error) {
      text = String(error);
    }

    const record = {
      ts: new Date().toISOString(),
      pass: PASS,
      command,
      status,
      ok,
      duration_ms: Date.now() - start,
      response: text,
    };
    fs.appendFileSync(RAW_LOG, JSON.stringify(record) + "\n");

    if (DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  let timingLines = [];
  if (TIMING_LOG && fs.existsSync(TIMING_LOG)) {
    const content = fs.readFileSync(TIMING_LOG, "utf8");
    const chunk = content.slice(timingOffset);
    timingLines = chunk
      .split(/\r?\n/)
      .filter((line) => line.includes("[AI TIMING]"));
    writeTimingLines(timingLines);
  }

  const metrics = collectMetrics(timingLines);
  console.log(`Pass: ${PASS}`);
  console.log(`Timing lines: ${metrics.count}`);
  console.log(
    [
      "metric,p50,p95",
      `t_total_ms,${formatMetric(metrics.p50_total)},${formatMetric(metrics.p95_total)}`,
      `t_llm1_ms,${formatMetric(metrics.p50_llm1)},${formatMetric(metrics.p95_llm1)}`,
      `t_tools_total_ms,${formatMetric(metrics.p50_tools)},${formatMetric(metrics.p95_tools)}`,
      `t_llm2_ms,${formatMetric(metrics.p50_llm2)},${formatMetric(metrics.p95_llm2)}`,
    ].join("\n")
  );
  console.log(
    [
      "avg_system_prompt_chars",
      "avg_tools_json_chars",
      "avg_tool_result_chars_total",
    ]
      .map((key) => `${key}=${formatMetric(metrics[key])}`)
      .join(" ")
  );

  if (METRICS_OUT) {
    fs.writeFileSync(METRICS_OUT, JSON.stringify({ pass: PASS, ...metrics }, null, 2));
  }
}

run().catch((error) => {
  console.error("bench-ai failed:", error);
  process.exit(1);
});
