import { describe, expect, it } from "vitest";
import { narrowWorkspaceMemberMatches, type WorkspaceMemberCandidate } from "./assignee-resolution";

function candidate(
  overrides: Partial<WorkspaceMemberCandidate> & Pick<WorkspaceMemberCandidate, "user_id" | "email">
): WorkspaceMemberCandidate {
  return {
    user_id: overrides.user_id,
    email: overrides.email,
    name: overrides.name ?? null,
  };
}

describe("narrowWorkspaceMemberMatches", () => {
  it("prefers a unique exact name match over fuzzy matches", () => {
    const matches = narrowWorkspaceMemberMatches("Amna", [
      candidate({ user_id: "1", name: "Amna", email: "amna@example.com" }),
      candidate({ user_id: "2", name: "Amna Ahmad", email: "amna.ahmad@example.com" }),
      candidate({ user_id: "3", name: "Robert", email: "team-amna-support@example.com" }),
    ]);

    expect(matches).toEqual([
      candidate({ user_id: "1", name: "Amna", email: "amna@example.com" }),
    ]);
  });

  it("prefers an exact email local-part match when names are fuzzy", () => {
    const matches = narrowWorkspaceMemberMatches("amna", [
      candidate({ user_id: "1", name: "Amna Ahmad", email: "amna@example.com" }),
      candidate({ user_id: "2", name: "Robert", email: "project-amna@example.com" }),
    ]);

    expect(matches).toEqual([
      candidate({ user_id: "1", name: "Amna Ahmad", email: "amna@example.com" }),
    ]);
  });

  it("keeps multiple exact name matches ambiguous", () => {
    const matches = narrowWorkspaceMemberMatches("Amna", [
      candidate({ user_id: "1", name: "Amna", email: "amna.one@example.com" }),
      candidate({ user_id: "2", name: "Amna", email: "amna.two@example.com" }),
    ]);

    expect(matches).toHaveLength(2);
  });

  it("falls back to the fuzzy candidate list when no exact match exists", () => {
    const input = [
      candidate({ user_id: "1", name: "Amna Ahmad", email: "amna.ahmad@example.com" }),
      candidate({ user_id: "2", name: "Amna Ali", email: "amna.ali@example.com" }),
    ];

    expect(narrowWorkspaceMemberMatches("Am", input)).toEqual(input);
  });
});
