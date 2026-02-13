import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getSlackConnection, getCurrentUserSlackLink } from "@/app/actions/slack-connection";
import SlackClient from "./slack-client";

/**
 * Slack integration settings page
 * /dashboard/settings/integrations/slack
 */
export default async function SlackIntegrationPage() {
  // Check authentication
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  // Get current workspace
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    redirect("/dashboard");
  }

  // Get Slack connection
  const connectionResult = await getSlackConnection(workspaceId);
  const connection = connectionResult.data;

  // Get user's link status
  const linkResult = await getCurrentUserSlackLink(workspaceId);
  const userLink = linkResult.data;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6"
      >
        ← Back to Settings
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Slack Integration</h1>
        <p className="text-gray-600">
          Connect your workspace to Slack and use AI-powered commands with <code className="bg-gray-100 px-2 py-1 rounded">/trak</code>
        </p>
      </div>

      <SlackClient
        workspaceId={workspaceId}
        connection={connection}
        userLink={userLink}
      />
    </div>
  );
}
