import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getStandaloneTasks } from "@/app/actions/standalone-task";
import TasksList from "./tasks-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TasksPage() {
  const workspaceId = await getCurrentWorkspaceId();

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">No workspace selected</p>
        </div>
      </div>
    );
  }

  // Fetch standalone tasks
  const tasksResult = await getStandaloneTasks(workspaceId);
  const tasks = tasksResult.data || [];

  return <TasksList initialTasks={tasks} workspaceId={workspaceId} />;
}

