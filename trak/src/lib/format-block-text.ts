"use client";

/**
 * Converts stored text block markdown-ish content into styled HTML.
 * Mirrors the formatting logic used in the editable text block so
 * read-only contexts can keep the same appearance.
 */
import DOMPurify from "isomorphic-dompurify";

type FormatPreset = "default" | "compact";

export function formatBlockText(
  text: string,
  options: { preset?: FormatPreset } = {}
): string {
  if (!text || text.trim() === "") {
    return '<span class="text-[var(--tertiary-foreground)] italic">Click to add text…</span>';
  }

  const preset: FormatPreset = options.preset ?? "default";
  const lineGap = preset === "compact" ? "mb-1" : "mb-1.5";
  const textSize = preset === "compact" ? "text-[11px]" : "text-sm";
  const heading1Size = preset === "compact" ? "text-sm" : "text-xl";
  const heading2Size = preset === "compact" ? "text-sm" : "text-lg";
  const heading3Size = preset === "compact" ? "text-[11px]" : "text-base";

  const normalizeUnmatchedBold = (input: string) => {
    let result = input;
    let boldTokens = (result.match(/\*\*/g) || []).length;

    // If there's an unmatched ** token, drop the last occurrence so it doesn't render literally
    if (boldTokens % 2 !== 0) {
      const lastIndex = result.lastIndexOf("**");
      if (lastIndex !== -1) {
        result = result.slice(0, lastIndex) + result.slice(lastIndex + 2);
      }
    }

    return result;
  };

  const normalizedText = text.replace(/\\n/g, "\n");
  const lines = normalizedText.split("\n");
  const formattedLines = lines.map((rawLine) => {
    const line = normalizeUnmatchedBold(rawLine);
    if (!line.trim()) return "<br/>";

    let formatted = line;
    // Handle HTML underline tags - preserve them as-is (they'll be rendered properly)
    if (/<u>.*?<\/u>/.test(formatted)) {
      formatted = formatted.replace(/<u>(.*?)<\/u>/g, '<u class="underline text-[var(--foreground)]">$1</u>');
    }
    // Process markdown formatting before HTML replacements to avoid conflicts
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[var(--foreground)]">$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic text-[var(--foreground)]/90">$1</em>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--foreground)]">$1</code>');

    if (/^### /.test(formatted)) {
      return `<h3 class="${heading3Size} font-medium text-[var(--foreground)] mb-2">${formatted.replace(/^### /, "")}</h3>`;
    }
    if (/^## /.test(formatted)) {
      return `<h2 class="${heading2Size} font-semibold text-[var(--foreground)] mb-2">${formatted.replace(/^## /, "")}</h2>`;
    }
    if (/^# /.test(formatted)) {
      return `<h1 class="${heading1Size} font-semibold text-[var(--foreground)] mb-3">${formatted.replace(/^# /, "")}</h1>`;
    }

    // Specific list item styles
    if (/^• /.test(formatted)) {
      return `<div class="flex items-start gap-2 ${lineGap}"><span class="text-[var(--muted-foreground)]">•</span><span class="${textSize} text-[var(--foreground)]">${formatted.replace(/^• /, "")}</span></div>`;
    }
    if (/^→ /.test(formatted)) {
      return `<div class="flex items-start gap-2 ${lineGap} text-[var(--info)]"><span>→</span><span class="${textSize} text-[var(--foreground)]">${formatted.replace(/^→ /, "")}</span></div>`;
    }
    if (/✅ /.test(formatted)) {
      return `<div class="flex items-start gap-2 ${lineGap} text-[var(--success)]"><span>✅</span><span class="${textSize} text-[var(--foreground)]">${formatted.replace(/✅ /, "")}</span></div>`;
    }
    if (/⚠️ /.test(formatted)) {
      return `<div class="flex items-start gap-2 ${lineGap} text-[var(--warning)]"><span>⚠️</span><span class="${textSize} text-[var(--foreground)]">${formatted.replace(/⚠️ /, "")}</span></div>`;
    }
    if (/💬 /.test(formatted)) {
      return `<div class="flex items-start gap-2 ${lineGap} text-[var(--muted-foreground)]"><span>💬</span><span class="${textSize} text-[var(--foreground)]">${formatted.replace(/💬 /, "")}</span></div>`;
    }
    if (/🔄 /.test(formatted)) {
      return `<div class="flex items-start gap-2 ${lineGap} text-[var(--info)]"><span>🔄</span><span class="${textSize} text-[var(--foreground)]">${formatted.replace(/🔄 /, "")}</span></div>`;
    }
    if (/⭐/.test(formatted)) {
      return `<div class="${lineGap} ${textSize} text-[var(--foreground)]">${formatted}</div>`;
    }

    return `<p class="${lineGap} ${textSize} leading-relaxed text-[var(--foreground)]">${formatted}</p>`;
  });

  const html = formattedLines.join("");

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["strong", "em", "code", "u", "h1", "h2", "h3", "p", "div", "span", "br"],
    ALLOWED_ATTR: ["class"],
    KEEP_CONTENT: true,
  });
}
