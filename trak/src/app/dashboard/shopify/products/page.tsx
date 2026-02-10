import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { ShopifyProductsClient } from "./products-client";

export const metadata = {
  title: "Shopify Products - TWOD",
  description: "Manage your imported Shopify products",
};

export default async function ShopifyProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Check authentication
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  // Get workspace from context
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

  // Type assertion needed because Supabase join returns workspace as unknown type
  const workspace = workspaces.workspace as unknown as { id: string };
  const workspaceId = workspace.id;

  // Get connection_id from query params (optional filter)
  const connectionId = searchParams.connection_id as string | undefined;

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
