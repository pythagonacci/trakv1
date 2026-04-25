"use client";

import { useTrackOpen } from "@/hooks/use-track-open";

export default function ProjectOpenTracker({ projectId }: { projectId: string }) {
  useTrackOpen("project", projectId);
  return null;
}
