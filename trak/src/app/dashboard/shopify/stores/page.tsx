import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { listShopifyConnections } from "@/app/actions/shopify-connection";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { ShopifyStoresClient } from "./stores-client";

export const metadata = {
  title: "Stores - TWOD",
  description: "Connect your Shopify stores to import products",
};

export default async function ShopifyStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/onboarding");

  const connectionsResult = await listShopifyConnections(workspaceId);
  const connections = "data" in connectionsResult ? connectionsResult.data : [];

  const resolvedSearchParams = await searchParams;
  const success = resolvedSearchParams.success === "true";
  const error = resolvedSearchParams.error as string | undefined;

  return (
    <ShopifyStoresClient
      workspaceId={workspaceId}
      initialConnections={connections}
      success={success}
      error={error}
    />
  );
}
