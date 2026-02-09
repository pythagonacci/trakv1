"use client";

import { useState } from "react";
import type { SlackConnection, SlackUserLink } from "@/app/actions/slack-connection";

interface SlackClientProps {
  workspaceId: string;
  connection?: SlackConnection;
  userLink?: SlackUserLink;
}

export default function SlackClient({ workspaceId, connection, userLink }: SlackClientProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleInstall = () => {
    window.location.href = `/api/slack/install?workspace_id=${workspaceId}`;
  };

  const handleDisconnect = async () => {
    if (!connection) return;

    if (!confirm("Are you sure you want to disconnect Slack? All user account links will be revoked.")) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const response = await fetch("/api/slack/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_id: connection.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }

      window.location.reload();
    } catch (error) {
      console.error("Error disconnecting:", error);
      alert("Failed to disconnect Slack. Please try again.");
      setIsDisconnecting(false);
    }
  };

  // Not connected
  if (!connection || connection.connection_status !== "active") {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Connect Slack
            </h3>
            <p className="text-gray-600 mb-4">
              Install the Trak app to your Slack workspace and use AI-powered commands directly in Slack.
            </p>
            <button
              onClick={handleInstall}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Install Slack App
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Connected
  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Connected to Slack
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Workspace: {connection.slack_team_name}
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Active
          </span>
        </div>

        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Connected:</span>
              <span className="ml-2 text-gray-900">
                {new Date(connection.created_at).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Scopes:</span>
              <span className="ml-2 text-gray-900">
                {connection.scopes.join(", ")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect Slack"}
          </button>
        </div>
      </div>

      {/* Account Linking Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Your Account Link
        </h3>

        {userLink ? (
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-900 font-medium">
                Your Slack account is linked
              </p>
              <p className="text-sm text-gray-500">
                Linked on {new Date(userLink.linked_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-900 font-medium">
                Your Slack account is not linked
              </p>
              <p className="text-sm text-gray-500">
                You need to link your account to use <code className="bg-gray-100 px-1 rounded">/trak</code> commands
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          Using Trak in Slack
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>Use the <code className="bg-blue-100 px-2 py-1 rounded font-mono">/trak</code> command in any Slack channel:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><code className="bg-blue-100 px-1 rounded font-mono">/trak search tasks</code> - Find tasks</li>
            <li><code className="bg-blue-100 px-1 rounded font-mono">/trak create task Review Q1 report</code> - Create a new task</li>
            <li><code className="bg-blue-100 px-1 rounded font-mono">/trak show projects for client Acme</code> - List projects</li>
          </ul>
          <p className="mt-3 text-blue-700">
            💡 All responses are ephemeral (only visible to you)
          </p>
        </div>
      </div>
    </div>
  );
}
