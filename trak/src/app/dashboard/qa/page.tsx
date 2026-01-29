import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import QAClient from "./qa-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function QAPage() {
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

  return <QAClient />;
}
