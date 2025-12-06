import { notFound, redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getSingleClient, getClientProjects } from "@/app/actions/client";
import { getClientTabs } from "@/app/actions/client-tab";
import ClientHeader from "./client-header";
import ClientTabs from "./client-tabs";
import ClientProjects from "./client-projects";
import ClientPayments from "./client-payments";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { clientId } = await params;
  const { tab = "projects" } = await searchParams;

  const workspaceId = await getCurrentWorkspaceId();

  if (!workspaceId) {
    redirect("/dashboard");
  }

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }

  // Get client details
  const clientResult = await getSingleClient(clientId);
  if (clientResult.error || !clientResult.data) {
    notFound();
  }

  const client = clientResult.data;

  // Verify client belongs to current workspace
  if (client.workspace_id !== workspaceId) {
    notFound();
  }

  // Get client's projects and tabs
  const [projectsResult, tabsResult] = await Promise.all([
    getClientProjects(clientId),
    getClientTabs(clientId),
  ]);

  const projects = projectsResult.data || [];
  const tabs = tabsResult.data || [];

  const renderTabContent = () => {
    switch (tab) {
      case "projects":
        return <ClientProjects projects={projects} clientId={clientId} />;
      case "payments":
        return <ClientPayments clientId={clientId} clientName={client.name} />;
      default:
        // Handle dynamic tabs
        const dynamicTab = tabs.find(t => t.id === tab);
        if (dynamicTab) {
          return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-[var(--surface)] p-3">
                <div className="h-8 w-8 rounded-full bg-[var(--velvet-purple)]/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-[var(--velvet-purple)]">
                    {dynamicTab.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                {dynamicTab.name}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
                This custom tab is ready for content. Add blocks to organize information about this client.
              </p>
            </div>
          );
        }
        return <ClientProjects projects={projects} clientId={clientId} />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Client Header */}
        <ClientHeader client={client} />

        {/* Client Tabs */}
        <ClientTabs
          clientId={clientId}
          tabs={tabs}
          activeTabId={tab}
        />

        {/* Tab Content */}
        <div className="mt-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}