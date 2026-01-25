export function isAIDebugEnabled() {
  return process.env.AI_DEBUG === "1" || process.env.NODE_ENV !== "production";
}

export function aiDebug(...args: unknown[]) {
  if (!isAIDebugEnabled()) return;
  console.log("[AI DEBUG]", ...args);
}
