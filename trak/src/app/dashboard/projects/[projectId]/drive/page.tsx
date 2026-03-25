import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { getProjectDriveMapping } from "@/app/actions/google-drive";
import {
  buildProjectDrivePath,
  buildProjectGoogleDrivePath,
  buildProjectOverviewPath,
  isCanonicalReadableParam,
} from "@/lib/dashboard-routes";
import { resolveProjectIdFromParam } from "@/lib/dashboard-route-resolvers";
import ProjectDriveClient from "./project-drive-client";

export default async function ProjectDrivePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId: projectIdParam } = await params;
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/dashboard");

  const access = await requireWorkspaceAccess(workspaceId);
  if ("error" in access) redirect("/login");

  const supabase = await createClient();
  const projectId = await resolveProjectIdFromParam(supabase, workspaceId, projectIdParam);
  if (!projectId) notFound();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, workspace_id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!project) notFound();

  if (!isCanonicalReadableParam(projectIdParam, project.name, project.id)) {
    redirect(buildProjectDrivePath(project.id, project.name));
  }

  const mappingResult = await getProjectDriveMapping(projectId, workspaceId);
  const mapping = "data" in mappingResult ? (mappingResult.data ?? null) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={buildProjectOverviewPath(projectId, project.name)}
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back to Project
        </Link>
        <Link
          href={buildProjectGoogleDrivePath(projectId, project.name)}
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          Folder Mapping
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">Drive</h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Browse the mapped project folder and preview linked Drive files in Saria.
      </p>

      <ProjectDriveClient
        workspaceId={workspaceId}
        projectId={projectId}
        projectName={project.name}
        mapping={mapping}
      />
    </div>
  );
}
