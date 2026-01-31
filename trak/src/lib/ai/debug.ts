export function isAIDebugEnabled() {
  return process.env.AI_DEBUG === "1" || process.env.NODE_ENV !== "production";
}

export function aiDebug(...args: unknown[]) {
  if (!isAIDebugEnabled()) return;
  console.log("[AI DEBUG]", ...args);
}

export function isAITimingEnabled() {
  return process.env.AI_TIMING === "1";
}

export function aiTiming(payload: Record<string, unknown>) {
  if (!isAITimingEnabled()) return;
  console.log(`[AI TIMING] ${JSON.stringify(payload)}`);
}
