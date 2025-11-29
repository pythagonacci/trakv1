import { getAllDocs } from "@/app/actions/doc";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import DocsTable from "./docs-table";
import DocsGrid from "./docs-grid";
import DocsFilterBar from "./docs-filter-bar";
import DocsViewToggle from "./docs-view-toggle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DocsPage({ searchParams }: PageProps) {
  const workspaceId = await getCurrentWorkspaceId();

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-neutral-500">No workspace selected</p>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const filters = {
    is_archived: params.is_archived === "true" ? true : params.is_archived === "false" ? false : undefined,
    search: params.search as string | undefined,
    sort_by: (params.sort_by as "created_at" | "updated_at" | "title") || "updated_at",
    sort_order: (params.sort_order as "asc" | "desc") || "desc",
  };

  const view = (params.view as "list" | "grid") || "list";

  const docsResult = await getAllDocs(workspaceId, filters);

  if (docsResult.error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500">{docsResult.error}</p>
        </div>
      </div>
    );
  }

  const docs = docsResult.data || [];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <DocsFilterBar />
        <DocsViewToggle currentView={view} />
      </div>
      
      {view === "grid" ? (
        <DocsGrid docs={docs} workspaceId={workspaceId} />
      ) : (
        <DocsTable
          docs={docs}
          workspaceId={workspaceId}
          currentSort={{
            sort_by: filters.sort_by,
            sort_order: filters.sort_order,
          }}
        />
      )}
    </div>
  );
}

