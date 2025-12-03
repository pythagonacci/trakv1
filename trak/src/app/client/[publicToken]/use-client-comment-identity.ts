"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface ClientCommentIdentity {
  id: string;
  name: string | null;
}

function generateVisitorId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `client-${Math.random().toString(36).slice(2)}${Date.now()}`;
}

export function useClientCommentIdentity(publicToken: string, enabled = true) {
  const storageKey = useMemo(
    () => `trak-client-comment-identity-${publicToken}`,
    [publicToken]
  );
  const [identity, setIdentity] = useState<ClientCommentIdentity | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ClientCommentIdentity;
        if (parsed?.id) {
          setIdentity({
            id: parsed.id,
            name: parsed.name ?? null,
          });
          return;
        }
      } catch {
        // ignore corrupted state
      }
    }

    const fallback = {
      id: generateVisitorId(),
      name: null,
    };
    if (enabled) {
      window.localStorage.setItem(storageKey, JSON.stringify(fallback));
    }
    setIdentity(fallback);
  }, [enabled, storageKey]);

  const updateName = useCallback(
    (name: string) => {
      if (!enabled) return;
      setIdentity((prev) => {
        const base = prev ?? { id: generateVisitorId(), name: null };
        const cleaned = name.trim();
        const updated = {
          ...base,
          name: cleaned || null,
        };
        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, JSON.stringify(updated));
        }
        return updated;
      });
    },
    [enabled, storageKey]
  );

  return {
    identity: enabled ? identity : null,
    setIdentityName: enabled ? updateName : () => {},
  };
}

