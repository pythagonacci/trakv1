"use client";

import { useTrackOpen } from "@/hooks/use-track-open";

export default function DocOpenTracker({ docId }: { docId: string }) {
  useTrackOpen("doc", docId);
  return null;
}
