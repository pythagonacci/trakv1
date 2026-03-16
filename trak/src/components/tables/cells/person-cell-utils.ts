import { formatUserDisplay } from "@/lib/field-utils";

export type WorkspaceMember = { id: string; name?: string; email?: string };

type ParsedPersonEntry = {
  id: string | null;
  label: string | null;
};

export type PersonDisplayEntry = {
  key: string;
  id: string | null;
  displayName: string;
  email?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseSinglePersonEntry(value: unknown): ParsedPersonEntry | null {
  if (Array.isArray(value)) return null;

  const stringValue = normalizeText(value);
  if (stringValue) {
    return { id: stringValue, label: looksLikeUuid(stringValue) ? null : stringValue };
  }

  if (!isRecord(value)) return null;

  const id =
    normalizeText(value.id) ??
    normalizeText(value.userId) ??
    normalizeText(value.value);
  const label =
    normalizeText(value.name) ??
    normalizeText(value.label) ??
    normalizeText(value.email) ??
    (id && !looksLikeUuid(id) ? id : null);

  if (!id && !label) return null;
  return { id: id ?? null, label: label ?? null };
}

function parsePersonEntries(value: unknown): ParsedPersonEntry[] {
  if (Array.isArray(value)) {
    const seen = new Set<string>();
    const entries: ParsedPersonEntry[] = [];
    value.forEach((item) => {
      const entry = parseSinglePersonEntry(item);
      if (!entry) return;
      const key = `${entry.id ?? ""}::${entry.label ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push(entry);
    });
    return entries;
  }

  const entry = parseSinglePersonEntry(value);
  return entry ? [entry] : [];
}

export function parsePersonSelectionIds(value: unknown): string[] {
  const ids = parsePersonEntries(value)
    .map((entry) => entry.id)
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

export function resolvePersonDisplayEntries(
  value: unknown,
  workspaceMembers: WorkspaceMember[] = []
): PersonDisplayEntry[] {
  const entries = parsePersonEntries(value);
  const membersById = new Map(workspaceMembers.map((member) => [member.id, member]));

  return entries.map((entry, index) => {
    const matchedMember = entry.id ? membersById.get(entry.id) : undefined;
    if (matchedMember) {
      return {
        key: matchedMember.id,
        id: matchedMember.id,
        displayName: formatUserDisplay(matchedMember),
        email: matchedMember.email,
      };
    }

    if (entry.label) {
      return {
        key: `${entry.id ?? "label"}:${entry.label}:${index}`,
        id: entry.id,
        displayName: entry.label,
      };
    }

    if (entry.id) {
      return {
        key: `${entry.id}:${index}`,
        id: entry.id,
        displayName: workspaceMembers.length === 0 ? "Loading..." : "Person",
      };
    }

    return {
      key: `person:${index}`,
      id: null,
      displayName: "Person",
    };
  });
}

export function haveSamePersonIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}
