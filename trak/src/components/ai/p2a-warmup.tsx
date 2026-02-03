"use client";

import { useEffect } from "react";

const SESSION_KEY = "p2aWarmupDone";

export default function P2AWarmup() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    fetch("/api/ai/warmup", { method: "POST", keepalive: true }).catch(() => {});
  }, []);

  return null;
}
