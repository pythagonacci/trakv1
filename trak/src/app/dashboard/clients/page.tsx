import { redirect } from "next/navigation";
import { getAllClients } from "@/app/actions/client";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { createClient } from "@/lib/supabase/server";
import ClientsTable from "./clients-table";

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

  // Fetch all clients for this workspace
  const clientsResult = await getAllClients(workspaceId);
  const clients = clientsResult.data || [];

  // Get project counts for each client
  const { data: projectCounts } = await supabase
    .from("projects")
    .select("client_id")
    .eq("workspace_id", workspaceId)
    .not("client_id", "is", null);

  // Count projects per client
  const countsMap = (projectCounts || []).reduce((acc, p) => {
    acc[p.client_id] = (acc[p.client_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const clientsWithCounts = clients.map((client) => ({
    ...client,
    projectCount: countsMap[client.id] || 0,
  }));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Clients</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Manage your clients and their projects
          </p>
        </div>

        {/* Clients Table */}
        <ClientsTable clients={clientsWithCounts} workspaceId={workspaceId} />
      </div>
    </div>
  );
}

