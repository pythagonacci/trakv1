"use client";

import { useEffect, useRef, useState } from "react";

function resolveInitialValue<T>(initialValue: T | (() => T)): T {
  return typeof initialValue === "function"
    ? (initialValue as () => T)()
    : initialValue;
}

function readPersistentValue<T>(key: string, initialValue: T | (() => T)): T {
  const fallback = resolveInitialValue(initialValue);
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T),
) {
  const [state, setState] = useState<T>(() => readPersistentValue(key, initialValue));
  const keyRef = useRef(key);
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setState(readPersistentValue(key, initialValueRef.current));
      return;
    }

    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore quota and privacy-mode failures; the UI state still works in-memory.
    }
  }, [key, state]);

  return [state, setState] as const;
}
