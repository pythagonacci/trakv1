import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  searchParams: Promise<{
    team_id?: string;
    slack_user_id?: string;
  }>;
}

/**
 * Account linking page for Slack users
 * GET /dashboard/settings/integrations/slack/link?team_id=<team_id>&slack_user_id=<slack_user_id>
 */
export default async function SlackLinkPage({ searchParams }: PageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // 1. Check if user is authenticated
  const user = await getAuthenticatedUser();
  if (!user) {
    // Redirect to login with return URL
    const returnUrl = `/dashboard/settings/integrations/slack/link?team_id=${params.team_id}&slack_user_id=${params.slack_user_id}`;
    redirect(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  }

  // 2. Validate query parameters
  const teamId = params.team_id;
  const slackUserId = params.slack_user_id;

  if (!teamId || !slackUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Invalid Link
            </h1>
            <p className="text-gray-600 mb-6">
              Missing required parameters. Please use the link provided in Slack.
            </p>
            <a
              href="/dashboard/settings/integrations"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Integrations
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 3. Check if Slack team is connected
  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("slack_workspace_connections")
    .select("id, workspace_id, slack_team_name")
    .eq("slack_team_id", teamId)
    .eq("connection_status", "active")
    .single();

  if (!connection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Workspace Not Connected
            </h1>
            <p className="text-gray-600 mb-6">
              This Slack workspace is not connected to Trak. Please ask your workspace admin to connect it first.
            </p>
            <a
              href="/dashboard/settings/integrations"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Integrations
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 4. Check if user already linked
  const { data: existingLink } = await supabase
    .from("slack_user_links")
    .select("id, link_status")
    .eq("slack_connection_id", connection.id)
    .eq("slack_user_id", slackUserId)
    .eq("trak_user_id", user.id)
    .single();

  if (existingLink?.link_status === "active") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Already Linked
            </h1>
            <p className="text-gray-600 mb-6">
              Your Slack account is already linked to Trak. You can now use <code className="bg-gray-100 px-2 py-1 rounded">/trak</code> commands in Slack.
            </p>
            <a
              href="/dashboard/settings/integrations"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              View Integrations
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 5. Create or reactivate link
  const { error: linkError } = await supabase
    .from("slack_user_links")
    .upsert(
      {
        slack_connection_id: connection.id,
        slack_user_id: slackUserId,
        trak_user_id: user.id,
        link_status: "active",
        linked_at: new Date().toISOString(),
      },
      {
        onConflict: "slack_connection_id,slack_user_id",
      }
    );

  if (linkError) {
    console.error("Error linking Slack account:", linkError);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Linking Failed
            </h1>
            <p className="text-gray-600 mb-6">
              An error occurred while linking your Slack account. Please try again.
            </p>
            <a
              href="/dashboard/settings/integrations"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Integrations
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 6. Success!
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="text-green-500 text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Account Linked Successfully!
          </h1>
          <p className="text-gray-600 mb-6">
            Your Slack account has been linked to Trak. You can now use <code className="bg-gray-100 px-2 py-1 rounded">/trak</code> commands in {connection.slack_team_name}.
          </p>
          <div className="space-y-3">
            <a
              href="/dashboard/settings/integrations"
              className="block w-full bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              View Integrations
            </a>
            <p className="text-sm text-gray-500">
              Try it out: Type <code className="bg-gray-100 px-2 py-1 rounded">/trak search tasks</code> in Slack!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
