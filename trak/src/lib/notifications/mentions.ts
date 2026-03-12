export interface MentionableMember {
  id: string;
  name: string | null;
  email: string | null;
}

const MARKDOWN_MEMBER_MENTION = /\[[^\]]+\]\(#member-([0-9a-fA-F-]{36})\)/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getMemberVariants(member: MentionableMember): string[] {
  const variants = new Set<string>();
  if (member.name) variants.add(member.name.trim());
  if (member.email) {
    variants.add(member.email.trim());
    const local = member.email.split("@")[0]?.trim();
    if (local) variants.add(local);
  }
  return Array.from(variants).filter((value) => value.length > 0);
}

export function extractMarkdownMentionUserIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(MARKDOWN_MEMBER_MENTION)) {
    if (match[1]) ids.add(match[1]);
  }
  return Array.from(ids);
}

export function extractPlainTextMentionUserIds(text: string, members: MentionableMember[]): string[] {
  const ids = new Set<string>();
  const sortedMembers = members
    .map((member) => ({
      member,
      variants: getMemberVariants(member)
        .map((variant) => ({ raw: variant, normalized: normalizeToken(variant) }))
        .sort((a, b) => b.normalized.length - a.normalized.length),
    }))
    .filter((entry) => entry.variants.length > 0);

  for (const entry of sortedMembers) {
    for (const variant of entry.variants) {
      const pattern = new RegExp(`(^|\\s)@${escapeRegExp(variant.raw)}(?=$|[\\s.,:;!?)])`, "i");
      if (pattern.test(text)) {
        ids.add(entry.member.id);
        break;
      }
    }
  }

  return Array.from(ids);
}

export function extractLeadingReplyTargetUserId(input: {
  text: string;
  members: MentionableMember[];
  allowMarkdown: boolean;
}): string | null {
  const trimmed = input.text.trimStart();
  if (!trimmed.startsWith("@") && !(input.allowMarkdown && trimmed.startsWith("["))) {
    return null;
  }

  if (input.allowMarkdown) {
    const markdownMatch = trimmed.match(/^\[[^\]]+\]\(#member-([0-9a-fA-F-]{36})\)(?=\s|$)/);
    if (markdownMatch?.[1]) return markdownMatch[1];
  }

  const members = input.members
    .map((member) => ({ member, variants: getMemberVariants(member) }))
    .filter((entry) => entry.variants.length > 0)
    .sort((a, b) => {
      const aLen = Math.max(...a.variants.map((variant) => variant.length));
      const bLen = Math.max(...b.variants.map((variant) => variant.length));
      return bLen - aLen;
    });

  for (const entry of members) {
    for (const variant of entry.variants) {
      const pattern = new RegExp(`^@${escapeRegExp(variant)}(?=$|[\\s.,:;!?)])`, "i");
      if (pattern.test(trimmed)) return entry.member.id;
    }
  }

  return null;
}
