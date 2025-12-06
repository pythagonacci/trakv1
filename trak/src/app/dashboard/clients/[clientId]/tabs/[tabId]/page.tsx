import { notFound, redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getSingleClient } from "@/app/actions/client";
import { getClientTabContent } from "@/app/actions/client-tab";
import ClientHeader from "../../client-header";
import ClientTabs from "../../client-tabs";
import { getClientTabs } from "@/app/actions/client-tab";
import ClientTabContent from "./client-tab-content";

export const dynamic = "force-dynamic";

export default async function ClientTabPage({
  params,
}: {
  params: Promise<{ clientId: string; tabId: string }>;
}) {
  const { clientId, tabId } = await params;

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

  // Get tab content and all tabs
  const [tabContentResult, tabsResult] = await Promise.all([
    getClientTabContent(tabId),
    getClientTabs(clientId),
  ]);

  if (tabContentResult.error || !tabContentResult.data) {
    notFound();
  }

  const { tab, blocks } = tabContentResult.data;
  const tabs = tabsResult.data || [];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Client Header */}
        <ClientHeader client={client} />

        {/* Client Tabs */}
        <ClientTabs
          clientId={clientId}
          tabs={tabs}
          activeTabId={tabId}
        />

        {/* Tab Content */}
        <div className="mt-6">
          <ClientTabContent
            tab={tab}
            blocks={blocks}
            clientId={clientId}
          />
        </div>
      </div>
    </div>
  );
}