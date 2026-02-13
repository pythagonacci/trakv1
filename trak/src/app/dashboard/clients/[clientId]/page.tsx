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
      case "details":
        return (
          <div className="space-y-6">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Client Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Name</label>
                  <p className="mt-1 text-sm text-[var(--foreground)]">{client.name}</p>
                </div>
                {client.company && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Company</label>
                    <p className="mt-1 text-sm text-[var(--foreground)]">{client.company}</p>
                  </div>
                )}
                {client.email && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Email</label>
                    <p className="mt-1 text-sm text-[var(--foreground)]">{client.email}</p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Phone</label>
                    <p className="mt-1 text-sm text-[var(--foreground)]">{client.phone}</p>
                  </div>
                )}
                {client.address && (
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Address</label>
                    <p className="mt-1 text-sm text-[var(--foreground)]">{client.address}</p>
                  </div>
                )}
                {client.website && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Website</label>
                    <p className="mt-1 text-sm text-[var(--foreground)]">{client.website}</p>
                  </div>
                )}
              </div>
            </div>
            {client.notes && (
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Notes</h2>
                <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>
        );
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