import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildSplashGreeting,
  createUnavailableSplashWeather,
  markSplashShownForSession,
  resetSplashSessionStateForTests,
  resolveSplashWeather,
  shouldAutoShowSplashForSession,
} from "./splash-screen";

describe("resolveSplashWeather", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetSplashSessionStateForTests();
  });

  it("falls back when geolocation never resolves", async () => {
    vi.useFakeTimers();

    const promise = resolveSplashWeather({
      geolocation: {
        getCurrentPosition: vi.fn(),
      },
      loadWeather: vi.fn(),
      mapGeolocationError: () => "Location unavailable",
    });

    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toEqual(
      createUnavailableSplashWeather("Weather unavailable")
    );
  });

  it("only auto-shows once per browser session", () => {
    const cookieDocument = {
      cookie: "",
    };

    expect(shouldAutoShowSplashForSession(cookieDocument)).toBe(true);
    expect(cookieDocument.cookie).toContain("trak-dashboard-splash-seen=pending");

    expect(shouldAutoShowSplashForSession(cookieDocument)).toBe(false);

    markSplashShownForSession(cookieDocument);

    expect(shouldAutoShowSplashForSession(cookieDocument)).toBe(false);
    expect(cookieDocument.cookie).toContain("trak-dashboard-splash-seen=1");
  });

  it("skips auto-show when the session was already marked seen", () => {
    const cookieDocument = {
      cookie: "trak-dashboard-splash-seen=1",
    };

    expect(shouldAutoShowSplashForSession(cookieDocument)).toBe(false);
  });

  it("builds a morning, afternoon, or evening greeting from the current time", () => {
    expect(buildSplashGreeting("Amna", new Date("2026-04-09T08:00:00"))).toBe("Good morning, Amna");
    expect(buildSplashGreeting("Amna", new Date("2026-04-09T14:00:00"))).toBe("Good afternoon, Amna");
    expect(buildSplashGreeting("Amna", new Date("2026-04-09T20:00:00"))).toBe("Good evening, Amna");
  });
});
