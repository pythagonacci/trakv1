"use client";

import { usePathname } from "next/navigation";
import { matchesReadableEntity } from "@/lib/dashboard-routes";
import ProjectHeader from "./project-header";

/**
 * Wraps ProjectHeader and injects tabId when the URL is .../projects/[projectId]/tabs/[tabId].
 * The project layout doesn't have tabId in params (it's in a child segment), so we read it from the pathname.
 */
export default function ProjectHeaderWrapper({
  project,
  tabs,
  workspaceId,
}: {
  project: React.ComponentProps<typeof ProjectHeader>["project"];
  tabs: React.ComponentProps<typeof ProjectHeader>["tabs"];
  workspaceId: string | undefined;
}) {
  const pathname = usePathname();
  const resolveTabIdFromPath = (tabParam: string): string | undefined => {
    const stack = [...(tabs ?? [])];
    while (stack.length > 0) {
      const current = stack.shift();
      if (!current) continue;
      if (matchesReadableEntity(tabParam, current.name, current.id)) {
        return current.id;
      }
      if (current.children && current.children.length > 0) {
        stack.push(...current.children);
      }
    }
    return undefined;
  };

  const tabId = (() => {
    const match = pathname?.match(/^\/dashboard\/projects\/[^/]+\/tabs\/([^/]+)/);
    return match ? resolveTabIdFromPath(match[1]) : undefined;
  })();

  return (
    <ProjectHeader
      project={project}
      tabs={tabs ?? []}
      workspaceId={workspaceId}
      tabId={tabId}
    />
  );
}
