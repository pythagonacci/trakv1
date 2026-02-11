import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { ShopifyProductsClient } from "./products-client";

export const metadata = {
  title: "Shopify Products - TWOD",
  description: "Manage your imported Shopify products",
};

export default async function ShopifyProductsPage({
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

  const supabase = await createClient();

  // Get connection_id from query params (optional filter)
  const resolvedSearchParams = await searchParams;
  const connectionId = resolvedSearchParams.connection_id as string | undefined;

  // Fetch products from database
  let query = supabase
    .from("trak_products")
    .select(
      `
      *,
      shopify_connections!inner(id, shop_domain, shop_name),
      trak_product_variants(count)
    `
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  // Filter by connection if specified
  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data: products, error } = await query;

  if (error) {
    console.error("Error fetching products:", error);
  }

  // Get all connections for filter dropdown
  const { data: connections } = await supabase
    .from("shopify_connections")
    .select("id, shop_domain, shop_name")
    .eq("workspace_id", workspaceId)
    .eq("sync_status", "active")
    .order("shop_name");

  return (
    <ShopifyProductsClient
      initialProducts={products || []}
      connections={connections || []}
      selectedConnectionId={connectionId}
    />
  );
}
