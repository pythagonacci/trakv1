import { notFound } from "next/navigation";
import { getProjectByPublicToken } from "@/app/actions/client-page";
import { getTabBlocks } from "@/app/actions/block";
import ClientPageHeader from "./client-page-header";
import ClientPageTabBar from "./client-page-tab-bar";
import ClientPageContent from "./client-page-content";
import ClientPageTracker from "./client-page-tracker";
import AutoRefresh from "./auto-refresh";

// Public page - no auth required
export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;

  // Get project and tabs by public token (no auth)
  const result = await getProjectByPublicToken(publicToken);

  if (result.error || !result.data) {
    console.error('Client page error:', result.error);
    notFound();
  }

  const { project, tabs } = result.data;
  
  // If no visible tabs, show message
  if (tabs.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            No Content Available
          </h1>
          <p className="text-[var(--muted-foreground)]">
            This project has no public tabs to display.
          </p>
        </div>
      </div>
    );
  }

  // Get the first tab as default
  const firstTab = tabs[0];

  // Fetch blocks for first tab
  const blocksResult = await getTabBlocks(firstTab.id);
  const blocks = blocksResult.data || [];

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
        {/* Project Header - Minimal, elegant */}
        <div className="pt-4 pb-2">
          <ClientPageHeader project={project} tabId={firstTab.id} />
        </div>

        {/* Tab Navigation - Sticky */}
        <div className="sticky top-0 z-40 bg-transparent backdrop-blur-sm">
          <ClientPageTabBar
            tabs={tabs}
            publicToken={publicToken}
            activeTabId={firstTab.id}
          />
        </div>

        {/* Canvas Content */}
        <div className="py-3 md:py-4 lg:py-5">
          <ClientPageContent
            blocks={blocks}
            publicToken={publicToken}
            allowComments={project.client_comments_enabled ?? false}
          />
        </div>
      </div>

      {/* Hidden analytics tracker - doesn't affect layout */}
      <ClientPageTracker publicToken={publicToken} tabId={firstTab.id} />
      <AutoRefresh />
    </div>
  );
}

