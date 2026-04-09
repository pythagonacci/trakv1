import { describe, expect, it } from "vitest";
import { resolveUserDisplayName, resolveUserFirstName } from "./user-display";

describe("resolveUserDisplayName", () => {
  it("prefers the profile name over the email local-part", () => {
    expect(
      resolveUserDisplayName({
        profileName: "Ada Lovelace",
        email: "adalovelace@gmail.com",
      })
    ).toBe("Ada Lovelace");
  });

  it("builds a name from onboarding metadata when the profile is blank", () => {
    expect(
      resolveUserDisplayName({
        userMetadata: { first_name: "Ada", last_name: "Lovelace" },
        email: "adalovelace@gmail.com",
      })
    ).toBe("Ada Lovelace");
  });
});

describe("resolveUserFirstName", () => {
  it("prefers the onboarding first name", () => {
    expect(
      resolveUserFirstName({
        profileName: "Wrong Name",
        userMetadata: { first_name: "Ada", last_name: "Lovelace" },
        email: "adalovelace@gmail.com",
      })
    ).toBe("Ada");
  });

  it("falls back to the first token of the profile name before using the email", () => {
    expect(
      resolveUserFirstName({
        profileName: "Grace Hopper",
        email: "gracehopper@gmail.com",
      })
    ).toBe("Grace");
  });
});
