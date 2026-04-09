import { describe, expect, it } from "vitest";
import { getDefaultSubtabForEmptyParent } from "@/lib/tabs/default-subtab";

type TestTab = {
  id: string;
  position: number;
  children?: TestTab[];
};

describe("getDefaultSubtabForEmptyParent", () => {
  it("returns the first child by position when the parent has no content", () => {
    const tabs: TestTab[] = [
      {
        id: "parent",
        position: 0,
        children: [
          { id: "child-b", position: 1 },
          { id: "child-a", position: 0 },
        ],
      },
    ];

    const result = getDefaultSubtabForEmptyParent(
      "parent",
      tabs,
      false,
    );

    expect(result?.id).toBe("child-a");
  });

  it("does not redirect when the parent has content", () => {
    const tabs: TestTab[] = [
      {
        id: "parent",
        position: 0,
        children: [{ id: "child-a", position: 0 }],
      },
    ];

    const result = getDefaultSubtabForEmptyParent(
      "parent",
      tabs,
      true,
    );

    expect(result).toBeNull();
  });

  it("does not redirect child tabs or parents without children", () => {
    const tabsWithParent: TestTab[] = [
      {
        id: "parent",
        position: 0,
        children: [{ id: "child-a", position: 0 }],
      },
    ];
    const soloTabs: TestTab[] = [{ id: "solo", position: 0, children: [] }];

    expect(
      getDefaultSubtabForEmptyParent(
        "child-a",
        tabsWithParent,
        false,
      ),
    ).toBeNull();

    expect(
      getDefaultSubtabForEmptyParent(
        "solo",
        soloTabs,
        false,
      ),
    ).toBeNull();
  });
});
