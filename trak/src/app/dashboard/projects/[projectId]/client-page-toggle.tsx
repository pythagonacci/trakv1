"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Link2,
  Loader2,
  MessageCircle,
} from "lucide-react";
import {
  disableClientPage,
  enableClientPage,
  toggleTabVisibility,
  updateClientPageSettings,
} from "@/app/actions/client-page";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  dispatchProjectClientTabVisibilityChanged,
  PROJECT_CLIENT_TAB_VISIBILITY_EVENT,
  type ProjectClientTabVisibilityDetail,
} from "@/lib/client-page-events";

interface Tab {
  id: string;
  name: string;
  position: number;
  is_client_visible?: boolean;
  client_title?: string | null;
  children?: Tab[];
}

interface FlatTab {
  id: string;
  name: string;
  position: number;
  is_client_visible?: boolean;
  client_title?: string | null;
  depth: number;
}

interface ClientPageToggleProps {
  projectId: string;
  clientPageEnabled: boolean;
  publicToken: string | null;
  clientCommentsEnabled: boolean;
  clientEditingEnabled?: boolean;
  tabs?: Tab[];
}

function flattenTabs(tabs: Tab[], depth = 0): FlatTab[] {
  return tabs.flatMap((tab) => [
    {
      id: tab.id,
      name: tab.name,
      position: tab.position,
      is_client_visible: tab.is_client_visible,
      client_title: tab.client_title ?? null,
      depth,
    },
    ...flattenTabs(tab.children ?? [], depth + 1),
  ]);
}

function formatVisibleTabCount(count: number) {
  return `${count} tab${count === 1 ? "" : "s"} visible to clients`;
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
  const flattenedTabs = useMemo(() => flattenTabs(tabs), [tabs]);
  const [isEnabled, setIsEnabled] = useState(clientPageEnabled);
  const [token, setToken] = useState(publicToken);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [allowComments, setAllowComments] = useState(clientCommentsEnabled);
  const [allowEditing, setAllowEditing] = useState(clientEditingEnabled);
  const [updatingSetting, setUpdatingSetting] = useState<
    "comments" | "editing" | null
  >(null);
  const [localTabs, setLocalTabs] = useState<FlatTab[]>(flattenedTabs);
  const [pendingTabIds, setPendingTabIds] = useState<string[]>([]);

  useEffect(() => {
    setIsEnabled(clientPageEnabled);
  }, [clientPageEnabled]);

  useEffect(() => {
    setToken(publicToken);
  }, [publicToken]);

  useEffect(() => {
    setAllowComments(clientCommentsEnabled);
  }, [clientCommentsEnabled]);

  useEffect(() => {
    setAllowEditing(clientEditingEnabled);
  }, [clientEditingEnabled]);

  useEffect(() => {
    setLocalTabs(flattenedTabs);
  }, [flattenedTabs]);

  useEffect(() => {
    const handleVisibilityChange = (event: Event) => {
      const detail = (
        event as CustomEvent<ProjectClientTabVisibilityDetail>
      ).detail;
      if (!detail || detail.projectId !== projectId) return;

      setLocalTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === detail.tabId
            ? { ...tab, is_client_visible: detail.isClientVisible }
            : tab
        )
      );
    };

    window.addEventListener(
      PROJECT_CLIENT_TAB_VISIBILITY_EVENT,
      handleVisibilityChange as EventListener
    );

    return () => {
      window.removeEventListener(
        PROJECT_CLIENT_TAB_VISIBILITY_EVENT,
        handleVisibilityChange as EventListener
      );
    };
  }, [projectId]);

  const clientPageUrl = useMemo(() => {
    if (!token || typeof window === "undefined") return "";
    return `${window.location.origin}/client/${token}`;
  }, [token]);

  const visibleTabCount = useMemo(
    () =>
      localTabs.reduce(
        (count, tab) => count + (tab.is_client_visible ? 1 : 0),
        0
      ),
    [localTabs]
  );

  const handleToggle = async () => {
    setIsLoading(true);

    if (isEnabled) {
      const result = await disableClientPage(projectId);

      if (result.error) {
        alert(`Error: ${result.error}`);
        setIsLoading(false);
        return;
      }

      setIsEnabled(false);
      setDialogOpen(false);
    } else {
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

  const handleCopy = async () => {
    if (!clientPageUrl) return;

    try {
      await navigator.clipboard.writeText(clientPageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy client page URL:", error);
      alert("Failed to copy the public link.");
    }
  };

  const handleCommentsToggle = async (nextValue: boolean) => {
    if (!token) {
      alert("Generate a public link before enabling comments.");
      return;
    }

    setAllowComments(nextValue);
    setUpdatingSetting("comments");

    const result = await updateClientPageSettings(projectId, {
      clientCommentsEnabled: nextValue,
    });

    if (result?.error) {
      console.error("Failed to update client comment settings:", result.error);
      alert(`Failed to update comment settings: ${result.error}`);
      setAllowComments(!nextValue);
    } else {
      router.refresh();
    }

    setUpdatingSetting(null);
  };

  const handleEditingToggle = async (nextValue: boolean) => {
    if (!token) {
      alert("Generate a public link before enabling editing.");
      return;
    }

    setAllowEditing(nextValue);
    setUpdatingSetting("editing");

    const result = await updateClientPageSettings(projectId, {
      clientEditingEnabled: nextValue,
    });

    if (result?.error) {
      console.error("Failed to update client editing settings:", result.error);
      alert(`Failed to update editing settings: ${result.error}`);
      setAllowEditing(!nextValue);
    } else {
      router.refresh();
    }

    setUpdatingSetting(null);
  };

  const handleTabVisibilityToggle = async (
    tabId: string,
    nextVisibility: boolean
  ) => {
    const currentTab = localTabs.find((tab) => tab.id === tabId);
    if (!currentTab || currentTab.is_client_visible === nextVisibility) return;

    setPendingTabIds((prev) =>
      prev.includes(tabId) ? prev : [...prev, tabId]
    );
    setLocalTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId ? { ...tab, is_client_visible: nextVisibility } : tab
      )
    );
    dispatchProjectClientTabVisibilityChanged({
      projectId,
      tabId,
      isClientVisible: nextVisibility,
    });

    const result = await toggleTabVisibility(tabId, nextVisibility);

    if (result.error) {
      setLocalTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === tabId
            ? { ...tab, is_client_visible: !nextVisibility }
            : tab
        )
      );
      dispatchProjectClientTabVisibilityChanged({
        projectId,
        tabId,
        isClientVisible: !nextVisibility,
      });
      alert(`Error: ${result.error}`);
    } else {
      router.refresh();
    }

    setPendingTabIds((prev) => prev.filter((id) => id !== tabId));
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
          "inline-flex h-7 items-center gap-1 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-[11px] font-medium shadow-sm transition-all duration-150",
          isEnabled
            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
          isLoading && "cursor-not-allowed opacity-50"
        )}
      >
        <Link2 className="h-3 w-3 shrink-0" />
        <span>{isEnabled ? "Client Sharing" : "Enable Public Link"}</span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[80vh] max-w-[500px] flex-col overflow-hidden p-0">
          <DialogHeader className="mb-0 space-y-0 border-b border-[var(--border)] px-4 py-2.5 pr-10">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[19px]">
                Client Sharing
              </DialogTitle>
              <Badge
                variant="secondary"
                className="h-4 rounded-full px-1.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
              >
                Active
              </Badge>
            </div>
            <DialogDescription className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
              Share selected tabs with anyone who has the link.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 px-4 py-2.5">
            <section className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Share Link
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={clientPageUrl}
                  readOnly
                  className="h-7 flex-1 rounded-[10px] border border-[var(--border)] bg-[var(--background)] px-2.5 text-[11px] text-[var(--foreground)] outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="inline-flex h-7 min-w-[64px] items-center justify-center gap-1 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <a
                href={clientPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--foreground)] transition-colors hover:text-[var(--foreground)]/75"
              >
                Open public page
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </section>

            <section className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Visible Tabs
                </p>
                <div
                  className="flex shrink-0 items-center gap-2 text-[10px] font-medium text-[var(--muted-foreground)]"
                  aria-hidden
                >
                  <span>Private</span>
                  <span className="select-none text-[var(--tertiary-foreground)]">
                    ·
                  </span>
                  <span>Public</span>
                </div>
              </div>
              <p className="sr-only">
                For each tab, turn the switch off for private or on for public.
              </p>
              <div className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)]">
                <div className="max-h-[200px] overflow-y-auto">
                  {localTabs.length > 0 ? (
                    localTabs.map((tab) => {
                      const isPending = pendingTabIds.includes(tab.id);
                      return (
                        <div
                          key={tab.id}
                          className="flex min-h-[42px] items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-1 last:border-b-0"
                        >
                          <div
                            className="min-w-0 flex-1"
                            style={{
                              paddingLeft:
                                tab.depth > 0 ? `${tab.depth * 16}px` : undefined,
                            }}
                          >
                            <p className="truncate text-[12px] font-medium text-[var(--foreground)]">
                              {tab.name}
                            </p>
                            {tab.client_title &&
                              tab.client_title !== tab.name && (
                                <p className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
                                  Public title: {tab.client_title}
                                </p>
                              )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isPending && (
                              <Loader2 className="h-3 w-3 animate-spin text-[var(--muted-foreground)]" />
                            )}
                            <Switch
                              checked={Boolean(tab.is_client_visible)}
                              disabled={isPending}
                              onCheckedChange={(checked) =>
                                handleTabVisibilityToggle(tab.id, checked)
                              }
                              className="shrink-0"
                              aria-label={`${tab.name}: ${tab.is_client_visible ? "public to clients" : "private"}`}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-4 text-[12px] text-[var(--muted-foreground)]">
                      No tabs in this project yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--foreground)]">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <Eye className="h-3.5 w-3.5" />
                  </span>
                  <span>{formatVisibleTabCount(visibleTabCount)}</span>
                </div>
                <a
                  href={clientPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  Review public page
                </a>
              </div>
            </section>

            <div className="grid gap-1.5 sm:grid-cols-2">
              <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-1.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--foreground)]">
                      <MessageCircle className="h-2.5 w-2.5 shrink-0" />
                      Allow public comments
                    </div>
                    <p className="text-[9px] leading-3.5 text-[var(--muted-foreground)]">
                      Visitors can leave comments that sync back to the project.
                    </p>
                  </div>
                  <Switch
                    checked={allowComments}
                    disabled={!token || updatingSetting === "comments"}
                    onCheckedChange={handleCommentsToggle}
                    className="shrink-0"
                  />
                </div>
              </div>

              <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-1.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--foreground)]">
                      <Edit3 className="h-2.5 w-2.5 shrink-0" />
                      Allow public editing
                    </div>
                    <p className="text-[9px] leading-3.5 text-[var(--muted-foreground)]">
                      Visitors can edit text, links, section headers, and upload files in file blocks. Other block types stay read-only.
                    </p>
                  </div>
                  <Switch
                    checked={allowEditing}
                    disabled={!token || updatingSetting === "editing"}
                    onCheckedChange={handleEditingToggle}
                    className="shrink-0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2">
            <button
              onClick={() => {
                alert("Analytics view coming soon!");
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              View analytics
            </button>

            <button
              onClick={handleToggle}
              disabled={isLoading}
              className="inline-flex h-7 items-center justify-center rounded-[10px] border border-red-200 bg-red-50 px-2.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Disabling..." : "Disable public link"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
