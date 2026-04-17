import { describe, expect, it } from "vitest";
import { shouldPreserveTextBlockEditModeOnBlur } from "./text-block-blur";

describe("shouldPreserveTextBlockEditModeOnBlur", () => {
  it("preserves editing when the browser tab is hidden", () => {
    expect(
      shouldPreserveTextBlockEditModeOnBlur({
        visibilityState: "hidden",
        hasFocus: () => false,
      }),
    ).toBe(true);
  });

  it("preserves editing when the document lost focus externally", () => {
    expect(
      shouldPreserveTextBlockEditModeOnBlur({
        visibilityState: "visible",
        hasFocus: () => false,
      }),
    ).toBe(true);
  });

  it("allows normal blur handling for in-page focus changes", () => {
    expect(
      shouldPreserveTextBlockEditModeOnBlur({
        visibilityState: "visible",
        hasFocus: () => true,
      }),
    ).toBe(false);
  });
});
