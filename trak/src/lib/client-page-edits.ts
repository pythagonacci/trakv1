import type { BlockType } from "@/app/actions/block";

export const CLIENT_EDITABLE_BLOCK_TYPES = [
  "text",
  "link",
  "section_header",
] as const satisfies BlockType[];

export type ClientEditableBlockType = (typeof CLIENT_EDITABLE_BLOCK_TYPES)[number];

export function isClientEditableBlockType(
  value: string
): value is ClientEditableBlockType {
  return (CLIENT_EDITABLE_BLOCK_TYPES as readonly string[]).includes(value);
}

function excerpt(value: string, max = 140) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export function buildClientEditSummary(
  blockType: ClientEditableBlockType,
  content: Record<string, unknown>
) {
  switch (blockType) {
    case "text": {
      const text = typeof content.text === "string" ? excerpt(content.text) : "";
      return text || "Updated a text block";
    }
    case "link": {
      const title = typeof content.title === "string" ? content.title.trim() : "";
      const url = typeof content.url === "string" ? content.url.trim() : "";
      if (title && url) return `Updated link: ${title}`;
      if (title) return `Updated link: ${title}`;
      if (url) return `Updated link: ${excerpt(url, 100)}`;
      return "Updated a link block";
    }
    case "section_header": {
      const title = typeof content.title === "string" ? content.title.trim() : "";
      return title ? `Updated section: ${title}` : "Updated a section header";
    }
    default:
      return "Updated project content";
  }
}
