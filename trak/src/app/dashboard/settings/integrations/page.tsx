import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { listShopifyConnections } from "@/app/actions/shopify-connection";
import { IntegrationsClient } from "./integrations-client";

export const metadata = {
  title: "Integrations - Trak",
  description: "Manage your integrations",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Check authentication
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  // Get workspace from context (assume first workspace for now)
  const supabase = await createClient();
  const { data: workspaces } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!workspaces?.workspace) {
    redirect("/onboarding");
  }

  const workspaceId = workspaces.workspace.id;

  // Fetch Shopify connections
  const connectionsResult = await listShopifyConnections(workspaceId);
  const connections = "data" in connectionsResult ? connectionsResult.data : [];

  // Check for success/error messages from OAuth callback
  const success = searchParams.success === "true";
  const error = searchParams.error as string | undefined;

  return (
    <IntegrationsClient
      workspaceId={workspaceId}
      initialConnections={connections}
      success={success}
      error={error}
    />
  );
}
