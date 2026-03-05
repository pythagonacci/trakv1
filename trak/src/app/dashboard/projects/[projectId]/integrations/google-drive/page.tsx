import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { getProjectDriveMapping } from "@/app/actions/google-drive";
import ProjectGoogleDriveSettingsClient from "./project-settings-client";

export default async function ProjectGoogleDriveSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/dashboard");

  const access = await requireWorkspaceAccess(workspaceId);
  if ("error" in access) redirect("/login");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, workspace_id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!project) notFound();

  const mappingResult = await getProjectDriveMapping(projectId, workspaceId);
  const mapping = "data" in mappingResult ? (mappingResult.data ?? null) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href={`/dashboard/projects/${projectId}/overview`}
        className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        ← Back to Project
      </Link>

      <h1 className="text-2xl font-semibold">Project Google Drive Settings</h1>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Map a canonical Google Drive folder for this project and keep linked assets organized.
      </p>

      <ProjectGoogleDriveSettingsClient
        workspaceId={workspaceId}
        projectId={projectId}
        projectName={project.name}
        initialMapping={mapping}
      />
    </div>
  );
}
