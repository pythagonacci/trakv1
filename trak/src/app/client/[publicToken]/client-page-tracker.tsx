"use client";

import { useEffect } from "react";
import { trackClientPageView } from "@/app/actions/client-page";

interface ClientPageTrackerProps {
  publicToken: string;
  tabId: string | null;
}

export default function ClientPageTracker({ publicToken, tabId }: ClientPageTrackerProps) {
  useEffect(() => {
    // Generate or get session ID
    let sessionId = sessionStorage.getItem("trak_client_session");
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("trak_client_session", sessionId);
    }

    // Track page view
    trackClientPageView({
      publicToken,
      tabId,
      userAgent: navigator.userAgent,
      sessionId,
      referrer: document.referrer || null,
    });

    // Track page duration on unmount
    const startTime = Date.now();
    return () => {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      // Could send duration update here if needed
    };
  }, [publicToken, tabId]);

  return null; // This is an invisible analytics tracker
}

