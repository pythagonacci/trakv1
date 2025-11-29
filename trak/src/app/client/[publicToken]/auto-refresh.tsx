"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  intervalSeconds?: number; // Default 20 seconds
  idleThresholdSeconds?: number; // Wait for user to be idle (default 3 seconds)
}

export default function AutoRefresh({ 
  intervalSeconds = 20,
  idleThresholdSeconds = 3 
}: AutoRefreshProps) {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Track user activity
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Listen for user interactions
    const events = ['scroll', 'mousedown', 'keydown', 'touchstart', 'selectstart'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Track page visibility
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up smart auto-refresh interval
    const interval = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const isIdle = timeSinceActivity > idleThresholdSeconds * 1000;

      // Only refresh if:
      // 1. User is idle (no activity for X seconds)
      // 2. Page is visible (not in background tab)
      if (isIdle && isVisible) {
        console.log(`🔄 Auto-refreshing (user idle for ${Math.round(timeSinceActivity / 1000)}s)`);
        router.refresh();
      } else if (!isVisible) {
        console.log(`⏸️ Skipping refresh (tab not visible)`);
      } else {
        console.log(`⏸️ Skipping refresh (user active ${Math.round(timeSinceActivity / 1000)}s ago)`);
      }
    }, intervalSeconds * 1000);

    // Cleanup
    return () => {
      clearInterval(interval);
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, intervalSeconds, idleThresholdSeconds, isVisible]);

  return null; // This component doesn't render anything
}

