"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Automatically refreshes the client page every 30 seconds to pull in
 * already-revalidated content. Also triggers an immediate refresh when
 * the tab regains focus so viewers see changes as soon as they return.
 */
export default function AutoRefresh({ interval = 30000 }: { interval?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      router.refresh();
    };

    const intervalId = setInterval(refresh, interval);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, interval]);

  return null;
}

