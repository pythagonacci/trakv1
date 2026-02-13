"use client";

import { useState, useMemo, useEffect } from "react";
import { Link2, Copy, Check, BarChart3, MessageCircle, Edit3, Eye, EyeOff } from "lucide-react";
import { enableClientPage, disableClientPage, updateClientPageSettings, toggleTabVisibility } from "@/app/actions/client-page";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

interface Tab {
  id: string;
  name: string;
  position: number;
  is_client_visible?: boolean;
  client_title?: string | null;
}

interface ClientPageToggleProps {
  projectId: string;
  clientPageEnabled: boolean;
  publicToken: string | null;
  clientCommentsEnabled: boolean;
  clientEditingEnabled?: boolean;
  tabs?: Tab[];
}

export default function ClientPageToggle({
  projectId,
  clientPageEnabled,
  publicToken,
  clientCommentsEnabled,
  clientEditingEnabled = false,
  tabs = [],
}: ClientPageToggleProps) {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = useState(clientPageEnabled);
  const [token, setToken] = useState(publicToken);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [allowComments, setAllowComments] = useState(clientCommentsEnabled);
  const [allowEditing, setAllowEditing] = useState(clientEditingEnabled);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [localTabs, setLocalTabs] = useState<Tab[]>(tabs);

  useEffect(() => {
    setAllowComments(clientCommentsEnabled);
  }, [clientCommentsEnabled]);

  useEffect(() => {
    setAllowEditing(clientEditingEnabled);
  }, [clientEditingEnabled]);

  useEffect(() => {
    setLocalTabs(tabs);
  }, [tabs]);

  const clientPageUrl = useMemo(() => {
    if (!token) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/client/${token}`;
  }, [token]);

  const handleToggle = async () => {
    setIsLoading(true);

    if (isEnabled) {
      // Disable
      const result = await disableClientPage(projectId);

      if (result.error) {
        alert(`Error: ${result.error}`);
        setIsLoading(false);
        return;
      }

      setIsEnabled(false);
      setDialogOpen(false);
    } else {
      // Enable
      const result = await enableClientPage(projectId);

      if (result.error) {
        alert(`Error: ${result.error}`);
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setToken(result.data.public_token);
        setIsEnabled(true);
        setDialogOpen(true);
      }
    }

    setIsLoading(false);
    router.refresh();
  };

  const handleCopy = () => {
    if (clientPageUrl) {
      navigator.clipboard.writeText(clientPageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCommentsToggle = async (nextValue: boolean) => {
    if (!token) {
      alert("Generate a public link before enabling comments.");
      return;
    }

    setAllowComments(nextValue);
    setIsUpdatingSettings(true);

    const result = await updateClientPageSettings(projectId, {
      clientCommentsEnabled: nextValue,
    });

    if (result?.error) {
      console.error("Failed to update client comment settings:", result.error);
      alert(`Failed to update comment settings: ${result.error}`);
      setAllowComments((prev) => !nextValue);
    } else {
      router.refresh();
    }

    setIsUpdatingSettings(false);
  };

  const handleEditingToggle = async (nextValue: boolean) => {
    if (!token) {
      alert("Generate a public link before enabling editing.");
      return;
    }

    setAllowEditing(nextValue);
    setIsUpdatingSettings(true);

    const result = await updateClientPageSettings(projectId, {
      clientEditingEnabled: nextValue,
    });

    if (result?.error) {
      console.error("Failed to update client editing settings:", result.error);
      alert(`Failed to update editing settings: ${result.error}`);
      setAllowEditing((prev) => !nextValue);
    } else {
      router.refresh();
    }

    setIsUpdatingSettings(false);
  };

  const handleTabVisibilityToggle = async (tabId: string, currentVisibility: boolean) => {
    const newVisibility = !currentVisibility;
    const result = await toggleTabVisibility(tabId, newVisibility);

    if (result.error) {
      alert(`Error: ${result.error}`);
      return;
    }

    // Update local state
    setLocalTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, is_client_visible: newVisibility } : tab
      )
    );

    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => {
          if (isEnabled) {
            setDialogOpen(true);
          } else {
            handleToggle();
          }
        }}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150",
          isEnabled
            ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
            : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] border border-[var(--border)]",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        <Link2 className="h-4 w-4" />
        <span>{isEnabled ? "Public Link" : "Enable Public Link"}</span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[380px] max-h-[90vh] flex flex-col p-4">
          <DialogHeader className="mb-3">
            <DialogTitle className="text-base">Public Link</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-6">
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Share this link to give access to this project.
              Anyone with the link can view it without logging in.
            </p>

            {/* Shareable Link */}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={clientPageUrl}
                readOnly
                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-black"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md border border-[#3080a6]/30 bg-[#3080a6]/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3080a6]/15 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Preview Link */}
            <a
              href={clientPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-black hover:text-black/80 hover:underline font-medium"
            >
              Open public page in new tab →
            </a>

            {/* Tab Visibility Section */}
            {localTabs.length > 0 && (
              <div className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-2">
                <div className="flex items-center gap-1 text-xs font-medium text-black mb-0.5">
                  <Eye className="h-3.5 w-3.5" />
                  Public Tabs
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] mb-1">
                  Select which tabs are visible to visitors with the public link.
                </p>
                <div className="space-y-0.5 max-h-28 overflow-y-auto">
                  {localTabs.map((tab) => (
                    <div
                      key={tab.id}
                      className="flex items-center justify-between gap-2 py-0.5 px-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-black truncate">
                          {tab.name}
                        </p>
                        {tab.client_title && (
                          <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                            Public title: {tab.client_title}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleTabVisibilityToggle(tab.id, tab.is_client_visible || false)}
                        disabled={isUpdatingSettings}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                          tab.is_client_visible
                            ? "border border-[#3080a6]/30 bg-[#3080a6]/10 text-white hover:bg-[#3080a6]/15"
                            : "bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] border border-[var(--border)]"
                        )}
                      >
                        {tab.is_client_visible ? (
                          <>
                            <Eye className="h-3 w-3" />
                            Public
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3" />
                            Private
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Client comment permissions */}
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-2 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-black">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Allow public comments
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Let visitors leave block-level comments after signing their name. Comments sync back to the dashboard.
                  </p>
                </div>
                <div className="flex items-center pt-0.5 shrink-0">
                  <Switch
                    checked={allowComments}
                    disabled={!token || isUpdatingSettings}
                    onCheckedChange={handleCommentsToggle}
                  />
                </div>
              </div>
              {!token && (
                <p className="text-[10px] text-[var(--warning)]">
                  Enable the public link to generate a URL before turning on comments.
                </p>
              )}
            </div>

            {/* Client editing permissions */}
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-2 flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-black">
                    <Edit3 className="h-3.5 w-3.5" />
                    Allow public editing
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Let visitors edit blocks and make changes to the content. Use with caution.
                  </p>
                </div>
                <div className="flex items-center pt-0.5 shrink-0">
                  <Switch
                    checked={allowEditing}
                    disabled={!token || isUpdatingSettings}
                    onCheckedChange={handleEditingToggle}
                  />
                </div>
              </div>
              {!token && (
                <p className="text-[10px] text-[var(--warning)]">
                  Enable the public link to generate a URL before turning on editing.
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-2">
              <p className="text-xs font-medium text-black mb-1">
                Next steps:
              </p>
              <ol className="list-decimal list-inside text-[11px] text-[var(--muted-foreground)] space-y-0.5">
                <li>Select tabs to make public using the tab selector above</li>
                <li>Share this link with anyone who needs access</li>
                <li>They can view updates in real-time</li>
                <li>If enabled, visitors can leave comments or make edits</li>
              </ol>
            </div>

            {/* Analytics & Settings */}
            <div className="flex items-center justify-between pt-0.5">
              <button
                onClick={() => {
                  // TODO: Open analytics modal
                  alert("Analytics view coming soon!");
                }}
                className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-black transition-colors"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                View Analytics
              </button>

              <button
                onClick={handleToggle}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 font-medium disabled:opacity-50 transition-colors text-xs"
              >
                {isLoading ? "Disabling..." : "Disable Public Link"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

