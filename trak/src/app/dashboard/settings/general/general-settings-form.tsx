"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface GeneralSettingsFormProps {
  workspaceId: string;
  workspaceName: string;
  canManage: boolean;
}

export default function GeneralSettingsForm({
  workspaceId,
  workspaceName,
  canManage,
}: GeneralSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(workspaceName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = name.trim() !== workspaceName;

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timeout = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }

    if (!isDirty) {
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("workspaces")
        .update({
          name: name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);

      if (updateError) {
        setError("Failed to update workspace name");
        setIsSubmitting(false);
        return;
      }

      // Success
      setSuccess(true);
      setIsSubmitting(false);
      router.refresh();
    } catch (err) {
      setError("Failed to update workspace. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">General Settings</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Manage your workspace name and settings
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>Workspace settings updated successfully</p>
          </div>
        )}

        {/* Workspace Name Card */}
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="workspace-name" className="block text-sm font-medium">
              Workspace Name
            </label>
            <input
              id="workspace-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
              disabled={!canManage || isSubmitting}
              className="w-full px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {!canManage && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Only owners and admins can edit workspace settings
              </p>
            )}
          </div>
        </div>

        {/* Save Button */}
        {canManage && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </form>

      {/* Future Settings Placeholder */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-6">
        <h3 className="text-sm font-medium mb-2">Additional Settings</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          More workspace settings coming soon
        </p>
      </div>
    </div>
  );
}
