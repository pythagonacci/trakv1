"use client";

import { useCallback, useMemo, useState } from "react";

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

function readStoredIdentity(
  storageKey: string,
  enabled: boolean
): ClientCommentIdentity | null {
  if (!enabled || typeof window === "undefined") return null;

  const saved =
    window.sessionStorage.getItem(storageKey) ??
    window.localStorage.getItem(storageKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as ClientCommentIdentity;
      if (parsed?.id) {
        return {
          id: parsed.id,
          name: parsed.name ?? null,
        };
      }
    } catch {
      // ignore corrupted state
    }
  }

  const fallback = {
    id: generateVisitorId(),
    name: null,
  };
  window.sessionStorage.setItem(storageKey, JSON.stringify(fallback));
  return fallback;
}

export function useClientCommentIdentity(publicToken: string, enabled = true) {
  const storageKey = useMemo(
    () => `trak-client-comment-identity-${publicToken}`,
    [publicToken]
  );
  const [identity, setIdentity] = useState<ClientCommentIdentity | null>(() =>
    readStoredIdentity(storageKey, enabled)
  );

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
          window.sessionStorage.setItem(storageKey, JSON.stringify(updated));
          window.localStorage.removeItem(storageKey);
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
