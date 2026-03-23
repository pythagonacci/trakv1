import { describe, expect, it } from "vitest";
import {
  buildProjectPath,
  buildProjectTabPath,
  decodeReadableEntityParam,
  getShortReadableId,
  isCanonicalReadableParam,
  matchesReadableEntity,
} from "./dashboard-routes";

describe("dashboard-routes", () => {
  const projectId = "5ce28da4-caaa-4d77-986d-3206db1e6743";
  const tabId = "9f0477ee-c99d-49bd-90cb-4258351308a0";

  it("builds readable project and tab paths with short stable ids", () => {
    expect(buildProjectPath(projectId, "Limited Ed Snowboard Launch")).toBe(
      "/dashboard/projects/limited-ed-snowboard-launch~5ce28da4"
    );

    expect(buildProjectTabPath(projectId, tabId, "Limited Ed Snowboard Launch", "Campaign Shoot")).toBe(
      "/dashboard/projects/limited-ed-snowboard-launch~5ce28da4/tabs/campaign-shoot~9f0477ee"
    );
  });

  it("decodes embedded short ids from readable params", () => {
    expect(decodeReadableEntityParam("campaign-shoot~9f0477ee")).toEqual({
      slug: "campaign-shoot",
      shortId: "9f0477ee",
    });

    expect(decodeReadableEntityParam("campaign-shoot--9f0477ee")).toEqual({
      slug: "campaign-shoot",
      shortId: "9f0477ee",
    });

    expect(decodeReadableEntityParam("campaign-shoot")).toEqual({
      slug: "campaign-shoot",
      shortId: null,
    });
  });

  it("matches legacy slug-only params and id-backed params", () => {
    expect(matchesReadableEntity("campaign-shoot", "Campaign Shoot", tabId)).toBe(true);
    expect(matchesReadableEntity("campaign-shoot~9f0477ee", "Campaign Shoot", tabId)).toBe(true);
    expect(matchesReadableEntity("campaign-shoot--9f0477ee", "Campaign Shoot", tabId)).toBe(true);
    expect(matchesReadableEntity(`campaign-shoot--${tabId}`, "Campaign Shoot", tabId)).toBe(true);
  });

  it("does not confuse duplicate names when the short id points at another tab", () => {
    expect(
      matchesReadableEntity("campaign-shoot~11111111", "Campaign Shoot", tabId)
    ).toBe(false);
  });

  it("treats matching ids as authoritative even if the slug is stale after a rename", () => {
    expect(matchesReadableEntity("old-tab-name~9f0477ee", "Campaign Shoot", tabId)).toBe(true);
  });

  it("requires the short-id suffix for canonical params when an id is available", () => {
    expect(isCanonicalReadableParam("campaign-shoot~9f0477ee", "Campaign Shoot", tabId)).toBe(true);
    expect(isCanonicalReadableParam("campaign-shoot", "Campaign Shoot", tabId)).toBe(false);
  });

  it("derives an eight-character compact id token", () => {
    expect(getShortReadableId(tabId)).toBe("9f0477ee");
  });
});
