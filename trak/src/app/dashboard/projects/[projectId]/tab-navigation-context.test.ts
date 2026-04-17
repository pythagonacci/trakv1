import { describe, expect, it } from "vitest";
import { shouldResetClientSideTabNavigation } from "./tab-navigation-context";

const tabs = [
  {
    id: "aaaaaaaa-0000-0000-0000-000000000000",
    name: "Alpha",
  },
  {
    id: "bbbbbbbb-0000-0000-0000-000000000000",
    name: "Beta",
    children: [
      {
        id: "cccccccc-0000-0000-0000-000000000000",
        name: "Beta Child",
      },
    ],
  },
];

describe("shouldResetClientSideTabNavigation", () => {
  it("keeps client tab mode for the pending pushState tab", () => {
    expect(
      shouldResetClientSideTabNavigation({
        pathname: "/dashboard/projects/project~11111111/tabs/alpha~aaaaaaaa",
        previousPathname: "/dashboard/projects/project~11111111/tabs/beta~bbbbbbbb",
        tabs,
        isClientSideNav: false,
        clientTabId: null,
        pendingClientTabId: "aaaaaaaa-0000-0000-0000-000000000000",
      }),
    ).toBe(false);
  });

  it("keeps client tab mode when usePathname catches up to the active client tab", () => {
    expect(
      shouldResetClientSideTabNavigation({
        pathname: "/dashboard/projects/project~11111111/tabs/beta-child~cccccccc",
        previousPathname: "/dashboard/projects/project~11111111/tabs/beta~bbbbbbbb",
        tabs,
        isClientSideNav: true,
        clientTabId: "cccccccc-0000-0000-0000-000000000000",
        pendingClientTabId: null,
      }),
    ).toBe(false);
  });

  it("resets client tab mode for non-tab navigation", () => {
    expect(
      shouldResetClientSideTabNavigation({
        pathname: "/dashboard/projects/project~11111111/overview",
        previousPathname: "/dashboard/projects/project~11111111/tabs/alpha~aaaaaaaa",
        tabs,
        isClientSideNav: true,
        clientTabId: "aaaaaaaa-0000-0000-0000-000000000000",
        pendingClientTabId: null,
      }),
    ).toBe(true);
  });

  it("resets client tab mode when a different tab route is loaded by the app router", () => {
    expect(
      shouldResetClientSideTabNavigation({
        pathname: "/dashboard/projects/project~11111111/tabs/beta~bbbbbbbb",
        previousPathname: "/dashboard/projects/project~11111111/tabs/alpha~aaaaaaaa",
        tabs,
        isClientSideNav: true,
        clientTabId: "aaaaaaaa-0000-0000-0000-000000000000",
        pendingClientTabId: null,
      }),
    ).toBe(true);
  });
});
