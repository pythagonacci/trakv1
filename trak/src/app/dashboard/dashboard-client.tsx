"use client";

import { useDashboardData } from "@/lib/hooks/use-dashboard-queries";
import DashboardOverview from "./dashboard-overview";
import DashboardLoading from "./loading";
import DashboardConfigModal from "./dashboard-config-modal";

export default function DashboardClient({
    workspaceId,
}: {
    workspaceId: string;
}) {
    const { data, isLoading, error } = useDashboardData(workspaceId);

    if (isLoading) {
        return <DashboardLoading />;
    }

    if (error || !data) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                        {error instanceof Error ? error.message : "An unknown error occurred"}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <DashboardOverview {...data} />
            <DashboardConfigModal workspaceId={workspaceId} />
        </>
    );
}
