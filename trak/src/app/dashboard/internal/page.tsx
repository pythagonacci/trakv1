import { getAllProjects } from "@/app/actions/project";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import InternalTable from "./internal-table";
import InternalFilterBar from "./internal-filter-bar";

// Ensure this page is always dynamic and revalidates on every request
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InternalPage({ searchParams }: PageProps) {
  // Get current workspace ID from cookie
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

  // Await search params and build filters
  const params = await searchParams;
  const filters = {
    project_type: 'internal' as const,
    status: params.status as 'not_started' | 'in_progress' | 'complete' | undefined,
    search: params.search as string | undefined,
    sort_by: (params.sort_by as 'created_at' | 'updated_at' | 'due_date_date' | 'name') || 'created_at',
    sort_order: (params.sort_order as 'asc' | 'desc') || 'desc',
  };

  // Fetch internal spaces with filters
  const projectsResult = await getAllProjects(workspaceId, filters);
  
  if (projectsResult.error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500">{projectsResult.error}</p>
        </div>
      </div>
    );
  }

  // Map data to the expected shape
  type RawProject = {
    id: string;
    name: string;
    status: 'not_started' | 'in_progress' | 'complete';
    due_date_date: string | null;
    due_date_text: string | null;
    created_at: string;
  };

  const mappedSpaces = ((projectsResult.data || []) as RawProject[]).map((space: RawProject) => ({
    id: space.id,
    name: space.name,
    status: space.status,
    created_at: space.created_at,
  }));

  return (
    <div>
      <InternalFilterBar />
      <InternalTable 
        spaces={mappedSpaces} 
        workspaceId={workspaceId}
        currentSort={{
          sort_by: filters.sort_by,
          sort_order: filters.sort_order,
        }}
      />
    </div>
  );
}




