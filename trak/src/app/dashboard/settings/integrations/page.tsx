import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { listShopifyConnections } from "@/app/actions/shopify-connection";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { IntegrationsClient } from "./integrations-client";

export const metadata = {
  title: "Integrations - TWOD",
  description: "Manage your integrations",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Check authentication
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    redirect("/onboarding");
  }

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
      success={success}
      error={error}
    />
  );
}
