export function estimateTokens(text: string) {
  if (!text) return 0;
  // Rough heuristic: ~4 chars per token for English-like text
  return Math.ceil(text.length / 4);
}

export function clampText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n...";
}
