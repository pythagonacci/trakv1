import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { createClient } from "@/lib/supabase/server";
import ClientsTable from "./clients-table";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get workspace from cookie
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    redirect("/dashboard");
  }

  // Fetch all clients with project counts in a single optimized query
  const { data: clientsWithCounts, error: clientsError } = await supabase
    .from("clients")
    .select(`
      id,
      name,
      company,
      created_at,
      projects:projects(count)
    `)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (clientsError) {
    logger.error("Error fetching clients:", clientsError);
  }

  // Transform the data to include projectCount
  const clients = (clientsWithCounts || []).map((client: any) => ({
    id: client.id,
    name: client.name,
    company: client.company,
    created_at: client.created_at,
    projectCount: client.projects?.[0]?.count || 0,
  }));

  return (
    <div>
      <ClientsTable clients={clients} workspaceId={workspaceId} />
    </div>
  );
}

