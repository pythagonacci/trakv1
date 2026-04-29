export type WorkspaceMemberCandidate = {
  user_id: string;
  name: string | null;
  email: string;
};

function normalizeLookupValue(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getEmailLocalPart(email: string | null | undefined) {
  const normalizedEmail = normalizeLookupValue(email);
  if (!normalizedEmail) return "";
  return normalizedEmail.split("@")[0] ?? "";
}

/**
 * Prefer unambiguous exact matches before falling back to fuzzy matches from
 * searchWorkspaceMembers. This avoids false ambiguity when "Amna" also matches
 * e.g. "Amna Ahmad" or an email containing "amna".
 */
export function narrowWorkspaceMemberMatches(
  input: string,
  candidates: WorkspaceMemberCandidate[]
) {
  const normalizedInput = normalizeLookupValue(input);
  if (!normalizedInput || candidates.length <= 1) return candidates;

  const exactNameMatches = candidates.filter(
    (candidate) => normalizeLookupValue(candidate.name) === normalizedInput
  );
  if (exactNameMatches.length > 0) return exactNameMatches;

  const exactEmailMatches = candidates.filter(
    (candidate) => normalizeLookupValue(candidate.email) === normalizedInput
  );
  if (exactEmailMatches.length > 0) return exactEmailMatches;

  const exactEmailLocalPartMatches = candidates.filter(
    (candidate) => getEmailLocalPart(candidate.email) === normalizedInput
  );
  if (exactEmailLocalPartMatches.length > 0) return exactEmailLocalPartMatches;

  return candidates;
}
