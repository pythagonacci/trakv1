import { describe, expect, it } from "vitest";
import {
  normalizeCanonicalPriorityValue,
  normalizeCanonicalStatusValue,
} from "@/lib/tables/universal-property";

describe("universal property normalization", () => {
  it("maps template priority aliases to canonical priorities", () => {
    expect(normalizeCanonicalPriorityValue("Must-have")).toBe("urgent");
    expect(normalizeCanonicalPriorityValue("P1")).toBe("high");
  });

  it("maps template status aliases to canonical statuses", () => {
    expect(normalizeCanonicalStatusValue("Under consideration")).toBe("todo");
    expect(normalizeCanonicalStatusValue("Quoting")).toBe("todo");
    expect(normalizeCanonicalStatusValue("In review")).toBe("in_progress");
    expect(normalizeCanonicalStatusValue("Approved")).toBe("done");
    expect(normalizeCanonicalStatusValue("Active")).toBe("in_progress");
  });
});
