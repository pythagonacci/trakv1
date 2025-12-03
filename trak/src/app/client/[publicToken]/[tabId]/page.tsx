import { notFound } from "next/navigation";
import { getProjectByPublicToken } from "@/app/actions/client-page";
import { getTabBlocks } from "@/app/actions/block";
import ClientPageHeader from "../client-page-header";
import ClientPageTabBar from "../client-page-tab-bar";
import ClientPageContent from "../client-page-content";
import ClientPageBanner from "../client-page-banner";
import ClientPageTracker from "../client-page-tracker";
import AutoRefresh from "../auto-refresh";

// Public page - no auth required
export const dynamic = "force-dynamic";

export default async function ClientTabPage({
  params,
}: {
  params: Promise<{ publicToken: string; tabId: string }>;
}) {
  const { publicToken, tabId } = await params;

  // Get project and tabs by public token (no auth)
  const result = await getProjectByPublicToken(publicToken);

  if (result.error || !result.data) {
    notFound();
  }

  const { project, tabs } = result.data;

  // Verify the tab exists and is visible
  const currentTab = tabs.find((t) => t.id === tabId);
  if (!currentTab) {
    notFound();
  }

  // Fetch blocks for this tab
  const blocksResult = await getTabBlocks(tabId);
  const blocks = blocksResult.data || [];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Client-side analytics tracker */}
      <ClientPageTracker publicToken={publicToken} tabId={tabId} />

      {/* Auto-refresh every 30 seconds */}
      <AutoRefresh />

      {/* "My Trak" Banner (placeholder CTA) */}
      <ClientPageBanner />

      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
        {/* Project Header */}
        <div className="pt-6 pb-4">
          <ClientPageHeader project={project} />
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <ClientPageTabBar 
            tabs={tabs} 
            publicToken={publicToken}
            activeTabId={tabId}
          />
        </div>

        {/* Tab Content (Read-only) */}
        <div className="pb-8">
          <ClientPageContent
            blocks={blocks}
            publicToken={publicToken}
            allowComments={project.client_comments_enabled ?? false}
          />
        </div>
      </div>
    </div>
  );
}

