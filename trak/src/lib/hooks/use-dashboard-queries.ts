import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/app/actions/dashboard-actions";

export const dashboardKeys = {
    all: () => ["dashboard"] as const,
    workspace: (workspaceId: string) => [...dashboardKeys.all(), workspaceId] as const,
};

export function useDashboardData(workspaceId: string | undefined) {
    return useQuery({
        queryKey: workspaceId ? dashboardKeys.workspace(workspaceId) : dashboardKeys.all(),
        queryFn: async () => {
            if (!workspaceId) throw new Error("Workspace ID is required");
            const result = await getDashboardData(workspaceId);
            if ("error" in result) throw new Error(result.error);
            return result.data;
        },
        enabled: !!workspaceId,
    });
}
