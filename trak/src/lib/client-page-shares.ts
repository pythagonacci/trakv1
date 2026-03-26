import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { sendClientPageShareEmail } from "@/lib/email";

export interface SharedClientPageLink {
  id: string;
  projectId: string;
  projectName: string;
  publicToken: string;
  publicPath: string;
  sharedByName: string | null;
  sharedByEmail: string;
  sharedWithEmail: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  tabs: Array<{
    id: string;
    name: string;
  }>;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function claimSharedClientPagesForUser(params: {
  userId: string;
  email?: string | null;
}) {
  const normalizedEmail = params.email ? normalizeEmail(params.email) : "";
  if (!normalizedEmail) {
    return;
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("client_page_shares")
    .update({ shared_with_user_id: params.userId })
    .eq("shared_with_email", normalizedEmail);

  if (error) {
    console.error("Failed to claim shared client pages:", error);
  }
}

export async function getSharedClientPagesForUser(params: {
  userId: string;
  email?: string | null;
}): Promise<SharedClientPageLink[]> {
  const normalizedEmail = params.email ? normalizeEmail(params.email) : "";
  const service = await createServiceClient();

  if (normalizedEmail) {
    await claimSharedClientPagesForUser({
      userId: params.userId,
      email: normalizedEmail,
    });
  }

  if (!normalizedEmail) {
    const { data, error } = await service
      .from("client_page_shares")
      .select(
        "id, project_id, public_token, shared_by_name, shared_by_email, shared_with_email, created_at, updated_at"
      )
      .eq("shared_with_user_id", params.userId)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("Failed to load shared client pages:", error);
      return [];
    }

    return hydrateSharedClientPages(data ?? []);
  }

  const [claimedSharesResult, emailSharesResult] = await Promise.all([
    service
      .from("client_page_shares")
      .select(
        "id, project_id, public_token, shared_by_name, shared_by_email, shared_with_email, created_at, updated_at"
      )
      .eq("shared_with_user_id", params.userId)
      .order("updated_at", { ascending: false }),
    service
      .from("client_page_shares")
      .select(
        "id, project_id, public_token, shared_by_name, shared_by_email, shared_with_email, created_at, updated_at"
      )
      .eq("shared_with_email", normalizedEmail)
      .order("updated_at", { ascending: false }),
  ]);

  if (claimedSharesResult.error) {
    console.error(
      "Failed to load claimed shared client pages:",
      claimedSharesResult.error
    );
    return [];
  }

  if (emailSharesResult.error) {
    console.error(
      "Failed to load email-matched shared client pages:",
      emailSharesResult.error
    );
    return [];
  }

  const dedupedShares = Array.from(
    new Map(
      [...(claimedSharesResult.data ?? []), ...(emailSharesResult.data ?? [])].map(
        (share) => [share.id, share]
      )
    ).values()
  ).sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at)
  );

  return hydrateSharedClientPages(dedupedShares);
}

async function hydrateSharedClientPages(
  shares: Array<{
    id: string;
    project_id: string;
    public_token: string;
    shared_by_name: string | null;
    shared_by_email: string;
    shared_with_email: string;
    created_at: string;
    updated_at: string;
  }>
): Promise<SharedClientPageLink[]> {
  if (shares.length === 0) {
    return [];
  }

  const service = await createServiceClient();
  const projectIds = Array.from(new Set(shares.map((share) => share.project_id)));

  const [{ data: projects, error: projectsError }, { data: tabs, error: tabsError }] =
    await Promise.all([
      service
        .from("projects")
        .select("id, name, client_page_enabled, public_token")
        .in("id", projectIds),
      service
        .from("tabs")
        .select("id, project_id, name, client_title, position")
        .in("project_id", projectIds)
        .eq("is_client_visible", true)
        .order("position", { ascending: true }),
    ]);

  if (projectsError) {
    console.error("Failed to load shared client page projects:", projectsError);
  }
  if (tabsError) {
    console.error("Failed to load shared client page tabs:", tabsError);
  }

  const projectsById = new Map(
    (projects ?? []).map((project) => [project.id, project])
  );
  const tabsByProjectId = new Map<string, Array<{ id: string; name: string }>>();

  for (const tab of tabs ?? []) {
    const existingTabs = tabsByProjectId.get(tab.project_id) ?? [];
    existingTabs.push({
      id: tab.id,
      name: tab.client_title || tab.name,
    });
    tabsByProjectId.set(tab.project_id, existingTabs);
  }

  return shares.map((share) => {
    const project = projectsById.get(share.project_id);
    const projectName = project?.name || "Shared project";
    const isActive =
      Boolean(project?.client_page_enabled) &&
      Boolean(project?.public_token) &&
      project?.public_token === share.public_token;

    return {
      id: share.id,
      projectId: share.project_id,
      projectName,
      publicToken: share.public_token,
      publicPath: `/client/${share.public_token}`,
      sharedByName: share.shared_by_name,
      sharedByEmail: share.shared_by_email,
      sharedWithEmail: share.shared_with_email,
      createdAt: share.created_at,
      updatedAt: share.updated_at,
      isActive,
      tabs: tabsByProjectId.get(share.project_id) ?? [],
    };
  });
}

export async function createClientPageShare(params: {
  projectId: string;
  recipientEmail: string;
  sharerUserId: string;
}) {
  const normalizedEmail = normalizeEmail(params.recipientEmail);
  if (!isValidEmail(normalizedEmail)) {
    return { error: "Enter a valid recipient email." };
  }

  const service = await createServiceClient();

  const { data: project, error: projectError } = await service
    .from("projects")
    .select("id, name, workspace_id, client_page_enabled, public_token")
    .eq("id", params.projectId)
    .maybeSingle();

  if (projectError || !project) {
    return { error: "Project not found." };
  }

  const { data: membership } = await service
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", params.sharerUserId)
    .maybeSingle();

  if (!membership) {
    return { error: "You do not have access to share this project." };
  }

  if (!project.client_page_enabled || !project.public_token) {
    return { error: "Enable the public link before sharing it." };
  }

  const { data: visibleTabs, error: visibleTabsError } = await service
    .from("tabs")
    .select("id, name, client_title, position")
    .eq("project_id", project.id)
    .eq("is_client_visible", true)
    .order("position", { ascending: true });

  if (visibleTabsError) {
    return { error: "Failed to load visible tabs for this share." };
  }

  if (!visibleTabs || visibleTabs.length === 0) {
    return { error: "Make at least one tab visible before sharing this public link." };
  }

  const [{ data: sharerProfile }, { data: recipientProfile }] = await Promise.all([
    service
      .from("profiles")
      .select("name, email")
      .eq("id", params.sharerUserId)
      .maybeSingle(),
    service
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle(),
  ]);

  const sharerEmail = normalizeEmail(
    sharerProfile?.email || "shared@saria.app"
  );

  const { error: shareError } = await service.from("client_page_shares").upsert(
    {
      project_id: project.id,
      public_token: project.public_token,
      shared_by_user_id: params.sharerUserId,
      shared_by_name: sharerProfile?.name ?? null,
      shared_by_email: sharerEmail,
      shared_with_email: normalizedEmail,
      shared_with_user_id: recipientProfile?.id ?? null,
    },
    {
      onConflict: "project_id,shared_with_email",
    }
  );

  if (shareError) {
    console.error("Failed to save client page share:", shareError);
    return { error: "Failed to save this share." };
  }

  const publicUrl = `${getAppBaseUrl()}/client/${project.public_token}`;
  const tabNames = visibleTabs.map((tab) => tab.client_title || tab.name);
  const sendResult = await sendClientPageShareEmail({
    to: normalizedEmail,
    publicUrl,
    projectName: project.name,
    sharerName: sharerProfile?.name ?? null,
    sharerEmail,
    tabNames,
  });

  return {
    data: {
      email: normalizedEmail,
      emailSent: sendResult.ok,
      existingAccount: Boolean(recipientProfile?.id),
      warning:
        !sendResult.ok && sendResult.error
          ? `Share saved, but the email could not be sent: ${sendResult.error}`
          : null,
    },
  };
}
