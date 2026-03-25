import { redirect } from "next/navigation";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { listShopifyConnections } from "@/app/actions/shopify-connection";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { IntegrationsClient } from "./integrations-client";

export const metadata = {
  title: "Integrations - Saria",
  description: "Manage your integrations",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    redirect("/onboarding");
  }

  // Verify workspace access and get role
  const access = await requireWorkspaceAccess(workspaceId);
  if ("error" in access) {
    redirect("/login");
  }

  const { membership } = access;
  const canManage = membership.role === "owner" || membership.role === "admin";

  // Fetch Shopify connections
  const connectionsResult = await listShopifyConnections(workspaceId);
  const connections = "data" in connectionsResult ? connectionsResult.data : [];

  // Check for success/error messages from OAuth callback
  const resolvedSearchParams = await searchParams;
  const success = resolvedSearchParams.success === "true";
  const error = resolvedSearchParams.error as string | undefined;

  return (
    <IntegrationsClient
      workspaceId={workspaceId}
      initialConnections={connections}
      canManage={canManage}
      success={success}
      error={error}
    />
  );
}
