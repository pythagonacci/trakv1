"use client";

/**
 * Converts stored text block markdown-ish content into styled HTML.
 * Mirrors the formatting logic used in the editable text block so
 * read-only contexts can keep the same appearance.
 */
export function formatBlockText(text: string): string {
  if (!text || text.trim() === "") {
    return '<span class="text-[var(--tertiary-foreground)] italic">Click to add text…</span>';
  }

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

  const lines = text.split("\n");
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
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="rounded-sm bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--foreground)]">$1</code>');

    if (/^### /.test(formatted)) {
      return `<h3 class="text-base font-medium text-[var(--foreground)] mb-2">${formatted.replace(/^### /, "")}</h3>`;
    }
    if (/^## /.test(formatted)) {
      return `<h2 class="text-lg font-semibold text-[var(--foreground)] mb-2">${formatted.replace(/^## /, "")}</h2>`;
    }
    if (/^# /.test(formatted)) {
      return `<h1 class="text-xl font-semibold text-[var(--foreground)] mb-3">${formatted.replace(/^# /, "")}</h1>`;
    }

    // Specific list item styles
    if (/^• /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5"><span class="text-[var(--muted-foreground)]">•</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/^• /, "")}</span></div>`;
    }
    if (/^→ /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--info)]"><span>→</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/^→ /, "")}</span></div>`;
    }
    if (/✅ /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--success)]"><span>✅</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/✅ /, "")}</span></div>`;
    }
    if (/⚠️ /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--warning)]"><span>⚠️</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/⚠️ /, "")}</span></div>`;
    }
    if (/💬 /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--muted-foreground)]"><span>💬</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/💬 /, "")}</span></div>`;
    }
    if (/🔄 /.test(formatted)) {
      return `<div class="flex items-start gap-2 mb-1.5 text-[var(--info)]"><span>🔄</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/🔄 /, "")}</span></div>`;
    }
    if (/⭐/.test(formatted)) {
      return `<div class="mb-1.5 text-sm text-[var(--foreground)]">${formatted}</div>`;
    }

    return `<p class="mb-1.5 text-sm leading-relaxed text-[var(--foreground)]">${formatted}</p>`;
  });

  return formattedLines.join("");
}

