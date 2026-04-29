"use client";

import React, { startTransition, useState, useRef, useEffect } from "react";
import {
  Folder,
  Users,
  FileText,
  ChevronRight,
  Check,
  LogOut,
  Loader2,
  Menu,
  Home,
  Calendar as CalendarIcon,
  Palette,
  Package,
  List,
  Sparkles,
  Database,
  User,
  Settings,
  Plus,
  LayoutDashboard,
  Share2,
  MessageSquare,
  MoreVertical,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "./workspace-context";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import {
  DashboardHeaderProvider,
  useDashboardHeader,
} from "./header-visibility-context";
import { DashboardConfigModalProvider, useDashboardConfigModal } from "./dashboard-config-modal-context";
import GlobalSearch from "./global-search";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AICommandPalette, useAI } from "@/components/ai";
import { useTheme } from "./theme-context";
import NotificationBell from "@/components/notifications/notification-bell";
import { OPEN_CREATE_DOC_EVENT, OPEN_CREATE_PROJECT_EVENT } from "@/lib/navigation-events";
import { useWorkspaceBilling } from "@/hooks/use-workspace-billing";
import { useQuery } from "@tanstack/react-query";
// DEMO (magic links): remove DemoUploadToastTrigger + related state when recording is done
import Toast from "@/app/dashboard/projects/toast";
import {
  buildSplashGreeting,
  createUnavailableSplashWeather,
  markSplashShownForSession,
  resolveSplashWeather,
  SPLASH_FADE_DURATION_MS,
  SPLASH_HIDE_DELAY_MS,
  shouldAutoShowSplashForSession,
} from "./splash-screen";

interface User {
  id: string;
  email: string;
  name: string;
}

interface Workspace {
  id: string;
  name: string;
  role: string;
}

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { suppressInlineSidebar } = useAI();
  // Keep SSR and first client render identical to avoid hydration mismatch.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const pathname = usePathname();
  const wasProjectView = useRef<boolean | null>(null);
  const isFirstRender = useRef(true);
  const isProjectTemplatesPage = pathname === "/dashboard/projects/templates";

  const isProjectView =
    pathname?.startsWith("/dashboard/projects/") &&
    pathname !== "/dashboard/projects" &&
    !isProjectTemplatesPage;
  const isWorkflowRoute = pathname?.startsWith("/dashboard/workflow");

  const normalizedPathname = pathname?.replace(/\/$/, "") ?? "";
  const isProjectOverviewTab =
    normalizedPathname.startsWith("/dashboard/projects/") &&
    normalizedPathname !== "/dashboard/projects" &&
    normalizedPathname.endsWith("/overview");

  const [demoUploadToastOpen, setDemoUploadToastOpen] = useState(false);

  useEffect(() => {
    if (!isProjectOverviewTab) {
      startTransition(() => {
        setDemoUploadToastOpen(false);
      });
    }
  }, [isProjectOverviewTab]);

  useEffect(() => {
    // After hydration, align with route-driven default once.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      startTransition(() => {
        setSidebarCollapsed(isProjectView);
      });
      wasProjectView.current = isProjectView;
      return;
    }
    if (wasProjectView.current !== true && isProjectView) {
      startTransition(() => {
        setSidebarCollapsed(true);
      });
    }
    wasProjectView.current = isProjectView;
  }, [isProjectView]);

  useEffect(() => {
    if (shouldAutoShowSplashForSession(document)) {
      startTransition(() => {
        setShowSplash(true);
      });
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <DashboardHeaderProvider>
      <DashboardConfigModalProvider>
      <div className="flex h-full bg-[var(--surface)] text-[var(--foreground)]">
        {showSplash && (
          <SplashScreen
            onFinish={() => {
              markSplashShownForSession(document);
              setShowSplash(false);
            }}
          />
        )}
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={toggleSidebar} />

        {isWorkflowRoute || suppressInlineSidebar ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <LayoutMain>{children}</LayoutMain>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Header />
              <LayoutMain>{children}</LayoutMain>
            </div>
            <AICommandPalette />
          </div>
        )}

        {isProjectOverviewTab && demoUploadToastOpen && (
          <Toast
            message='Edward just uploaded "Final_Campaign_Shots.JPEG" in the Campaign Shoot tab.'
            type="success"
            duration={6000}
            onClose={() => setDemoUploadToastOpen(false)}
            action={{ label: "View Upload", href: "#" }}
          />
        )}
        {isProjectOverviewTab ? (
          <button
            type="button"
            onClick={() => {
              setDemoUploadToastOpen(false);
              requestAnimationFrame(() => setDemoUploadToastOpen(true));
            }}
            className="pointer-events-auto fixed bottom-2 left-2 z-[90] inline-flex h-auto w-max max-w-none shrink-0 whitespace-nowrap rounded-[2px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-1 py-px text-[8px] font-medium uppercase leading-none tracking-tight text-[var(--muted-foreground)] shadow-sm hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title="Temporary control for magic-links demo recording"
          >
            Demo: upload toast
          </button>
        ) : null}
      </div>
      </DashboardConfigModalProvider>
    </DashboardHeaderProvider>
  );
}

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const { data: currentUser, isLoading } = useUser();
  const [typedText, setTypedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [weather, setWeather] = useState<{
    tempF: number | null;
    location: string | null;
    summary: string | null;
    resolved: boolean;
  }>({
    tempF: null,
    location: null,
    summary: null,
    resolved: false,
  });

  useEffect(() => {
    if (resolvedName) return;
    if (!isLoading && currentUser?.firstName) {
      setResolvedName(normalizeName(currentUser.firstName));
    }
  }, [currentUser?.firstName, isLoading, resolvedName]);

  useEffect(() => {
    if (resolvedName) return;
    const fallbackTimer = setTimeout(() => {
      setResolvedName(normalizeName(currentUser?.firstName || "there"));
    }, 700);
    return () => clearTimeout(fallbackTimer);
  }, [currentUser?.firstName, resolvedName]);

  const name = resolvedName || "there";
  const greeting = buildSplashGreeting(name);

  useEffect(() => {
    if (!resolvedName) return;
    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setTypedText(greeting.slice(0, index));
      if (index >= greeting.length) {
        clearInterval(interval);
        setTypingDone(true);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [greeting, resolvedName]);

  useEffect(() => {
    let cancelled = false;
    void resolveSplashWeather({
      geolocation: navigator.geolocation,
      loadWeather: async ({ latitude, longitude }) => {
        try {
          const weatherRes = await fetch(
            `/api/weather?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`
          );
          if (!weatherRes.ok) {
            throw new Error("Weather lookup failed");
          }
          const weatherJson = await weatherRes.json();

          const temp = typeof weatherJson?.tempF === "number"
            ? Math.round(weatherJson.tempF)
            : null;
          const wind = typeof weatherJson?.windMph === "number"
            ? weatherJson.windMph
            : null;
          const code = typeof weatherJson?.code === "number"
            ? weatherJson.code
            : null;

          return {
            tempF: temp,
            location:
              typeof weatherJson?.location === "string" && weatherJson.location.trim().length > 0
                ? weatherJson.location
                : "Location unavailable",
            summary: describeWeather(code, wind),
          };
        } catch {
          return createUnavailableSplashWeather("Weather unavailable");
        }
      },
      mapGeolocationError: geolocationErrorSummary,
    }).then((nextWeather) => {
      if (cancelled) return;
      setWeather({
        ...nextWeather,
        resolved: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!typingDone || !weather.resolved) return;

    let finalizeTimer: ReturnType<typeof setTimeout> | null = null;
    const hideTimer = setTimeout(() => {
      setIsHiding(true);
      finalizeTimer = setTimeout(() => {
        onFinish();
      }, SPLASH_FADE_DURATION_MS);
    }, SPLASH_HIDE_DELAY_MS);

    return () => {
      clearTimeout(hideTimer);
      if (finalizeTimer) clearTimeout(finalizeTimer);
    };
  }, [typingDone, weather.resolved, onFinish]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center bg-[var(--background)] text-[var(--foreground)]",
        "transition-opacity duration-300",
        isHiding ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div className="text-3xl md:text-4xl font-semibold tracking-tight">
          {typedText}
          {!typingDone && <span className="inline-block w-[0.6ch] animate-pulse">|</span>}
        </div>
        <div className="text-sm md:text-base text-[var(--muted-foreground)]">
          | {weather.tempF ?? "--"}°F | {weather.location || "Locating..."} | {weather.summary || "Fetching weather..."} |
        </div>
      </div>
    </div>
  );
}

function geolocationErrorSummary(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access denied";
    case error.POSITION_UNAVAILABLE:
      return "Position unavailable";
    case error.TIMEOUT:
      return "Location lookup timed out";
    default:
      return "Location unavailable";
  }
}

function describeWeather(code: number | null, windMph: number | null) {
  const base = weatherCodeSummary(code);
  if (windMph == null) return base;
  if (windMph < 6) return `${base} with calm air`;
  if (windMph < 12) return `${base} with light breeze`;
  if (windMph < 20) return `${base} with steady breeze`;
  return `${base} with gusty winds`;
}

function weatherCodeSummary(code: number | null) {
  switch (code) {
    case 0:
      return "Clear skies";
    case 1:
    case 2:
      return "Mostly sunny";
    case 3:
      return "Overcast";
    case 45:
    case 48:
      return "Foggy";
    case 51:
    case 53:
    case 55:
      return "Light drizzle";
    case 56:
    case 57:
      return "Freezing drizzle";
    case 61:
    case 63:
      return "Light rain";
    case 65:
      return "Heavy rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
    case 73:
      return "Light snow";
    case 75:
      return "Heavy snow";
    case 77:
      return "Snow grains";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
      return "Thunderstorms";
    case 96:
    case 99:
      return "Thunderstorms with hail";
    default:
      return "Mixed conditions";
  }
}

function normalizeName(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "There";
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function sidebarPlanLabel(planKey: string | undefined) {
  switch (planKey) {
    case "business":
      return "Business plan";
    case "standard":
      return "Standard plan";
    default:
      return "Free plan";
  }
}

function projectAccentColor(projectId: string) {
  const palette = ["#E8855A", "#2A537A", "#5B8FA8", "#7B68A6", "#4A7C59"];
  let h = 0;
  for (let i = 0; i < projectId.length; i += 1) {
    h = (h * 31 + projectId.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(h) % palette.length];
}

function SidebarDivider() {
  return <div className="mx-2 my-1 h-px shrink-0 bg-[var(--sidebar-border,var(--border))]" aria-hidden />;
}

function AICommandButton({ collapsed }: { collapsed: boolean }) {
  const { openCommandPalette } = useAI();

  return (
    <div className={cn("px-2 pb-2", collapsed && "flex justify-center pt-1")}>
      <button
        onClick={openCommandPalette}
        className={cn(
          "flex items-center transition-all duration-150",
          "bg-[#2A537A] text-white hover:bg-[#1f4265]",
          collapsed
            ? "h-8 w-8 shrink-0 justify-center rounded-md"
            : "mx-0 w-[calc(100%-16px)] max-w-none justify-between gap-2 rounded-[7px] px-2.5 py-1.5"
        )}
        title="Ask AI (⌘K)"
      >
        <span className={cn("flex shrink-0 items-center justify-center text-white", collapsed ? "" : "gap-1.5")}>
          <Sparkles className={collapsed ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
          {!collapsed && (
            <span className="text-left text-[13px] font-medium tracking-tight" style={{ fontFamily: "var(--font-sidebar), var(--font-sans), sans-serif" }}>
              Ask AI
            </span>
          )}
        </span>
        {!collapsed && (
          <kbd
            className="rounded px-1 py-0.5 text-[10px] font-medium text-white/80"
            style={{
              fontFamily: "var(--font-sidebar), var(--font-sans), sans-serif",
              background: "rgba(255,255,255,0.18)",
            }}
          >
            ⌘K
          </kbd>
        )}
      </button>
    </div>
  );
}

function Sidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: currentUser } = useUser();
  const { currentWorkspace, workspaces, switchWorkspace, isSwitching } = useWorkspace();
  const { data: billingSummary } = useWorkspaceBilling(currentWorkspace?.id);
  const { theme, setTheme } = useTheme();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const { data: sidebarData } = useQuery({
    queryKey: ["sidebar-sections", currentWorkspace?.id],
    enabled: Boolean(currentWorkspace?.id),
    queryFn: async () => {
      const res = await fetch(`/api/sidebar?workspaceId=${encodeURIComponent(currentWorkspace!.id)}`);
      if (!res.ok) throw new Error("Failed to load sidebar");
      const json = await res.json();
      return json.data as {
        pinnedProjectsWithMeta: Array<{
          id: string;
          name: string;
          last_opened_at: string | null;
          last_opened_tab_name?: string | null;
          relative_last_opened: string;
        }>;
        recentProjects: Array<{
          id: string;
          name: string;
          last_opened_at: string | null;
          last_opened_tab_name?: string | null;
          relative_last_opened: string;
        }>;
        recentDocs: Array<{ id: string; title: string; last_opened_at: string | null; relative_last_opened: string }>;
        openTaskCountByProjectId: Record<string, number>;
      };
    },
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "W";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserInitials = () => {
    if (!currentUser || !currentUser.name) return "U";
    return currentUser.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleWorkspaceSwitch = async (workspace: Workspace) => {
    await switchWorkspace(workspace);
    setUserDropdownOpen(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleCreateDoc = () => {
    window.dispatchEvent(new CustomEvent(OPEN_CREATE_DOC_EVENT));
    if (!pathname?.startsWith("/dashboard/docs")) {
      router.push("/dashboard/docs");
    }
  };

  const pinned = sidebarData?.pinnedProjectsWithMeta ?? [];
  const recent = sidebarData?.recentProjects ?? [];
  const recentDocs = sidebarData?.recentDocs ?? [];

  return (
    <aside
      className={cn(
        "relative z-50 flex h-full shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 ease-out",
        "border-[var(--sidebar-border,var(--border))] bg-[var(--sidebar-bg)]",
        "font-[family-name:var(--font-sidebar),var(--font-sans),ui-sans-serif,system-ui,sans-serif]",
        collapsed ? "w-16" : "w-[224px]"
      )}
    >
      {collapsed ? (
        <div className="flex shrink-0 justify-center py-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCollapsed();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-[#888] hover:bg-[var(--sidebar-item-hover,#f0ede6)]"
            aria-label="Expand sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-between px-3 pb-2 pt-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-[#2A537A] text-[10px] font-semibold text-white">
              {(currentWorkspace?.name ?? "W").trim().charAt(0).toUpperCase() || "W"}
            </div>
            <span className="truncate text-[13px] font-medium text-[#1a1a1a]">
              {currentWorkspace?.name ?? "Workspace"}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-[#888] hover:bg-[var(--sidebar-item-hover,#f0ede6)]"
                aria-label="Workspace menu"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  setCollapsed();
                }}
              >
                Collapse sidebar
              </DropdownMenuItem>
              {workspaces.length > 0 && <DropdownMenuSeparator />}
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  disabled={isSwitching}
                  onClick={() => void handleWorkspaceSwitch(workspace)}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--primary)]/20 bg-[var(--primary)]/10 text-[10px] font-semibold text-[var(--primary)]">
                      {isSwitching && currentWorkspace?.id === workspace.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        getInitials(workspace.name)
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                    {currentWorkspace?.id === workspace.id ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" /> : null}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {!collapsed && (
        <div className="px-2 pb-2">
          <GlobalSearch variant="sidebar" />
        </div>
      )}

      <AICommandButton collapsed={collapsed} />

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-2 [scrollbar-width:thin]">
        <nav className={cn("space-y-px", collapsed && "pt-1")}>
          <NavLink
            href="/dashboard"
            icon={<Home className="h-3.5 w-3.5" strokeWidth={1.3} />}
            active={pathname === "/dashboard"}
            collapsed={collapsed}
          >
            Home
          </NavLink>

          {!collapsed && <SidebarDivider />}

          {collapsed && (
            <NavLink
              href="/dashboard/projects"
              icon={<Folder className="h-3.5 w-3.5" strokeWidth={1.3} />}
              active={pathname?.startsWith("/dashboard/projects")}
              collapsed={collapsed}
            >
              Projects
            </NavLink>
          )}
          {!collapsed && (
            <ExpandableSection
              icon={<Folder className="h-3.5 w-3.5 shrink-0" strokeWidth={1.3} />}
              label="Projects"
              open={projectsOpen}
              onToggle={() => setProjectsOpen((prev) => !prev)}
              onAdd={() => window.dispatchEvent(new CustomEvent(OPEN_CREATE_PROJECT_EVENT))}
              active={pathname?.startsWith("/dashboard/projects")}
            >
              {pinned.length > 0 ? (
                <>
                  <div className="px-2 pb-0.5 pl-[30px] pt-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[#aaa]">
                    Pinned
                  </div>
                  {pinned.map((project) => (
                    <SidebarProjectRow
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      label={project.name}
                      dotColor={projectAccentColor(project.id)}
                      right={
                        (sidebarData?.openTaskCountByProjectId?.[project.id] ?? 0) > 0 ? (
                          <span className="rounded-[10px] bg-[var(--sidebar-badge-bg,#e8f0f8)] px-1.5 py-px text-[10px] font-medium text-[var(--sidebar-badge-text,#2a537a)]">
                            {sidebarData?.openTaskCountByProjectId?.[project.id]}
                          </span>
                        ) : null
                      }
                      active={pathname?.includes(`/dashboard/projects/${project.id}`)}
                    />
                  ))}
                </>
              ) : null}
              {recent.length > 0 ? (
                <>
                  <div className="px-2 pb-0.5 pl-[30px] pt-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[#aaa]">
                    Recent
                  </div>
                  {recent.map((project) => (
                    <SidebarProjectRow
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      label={project.name}
                      subtitle={project.last_opened_tab_name ?? undefined}
                      dotColor="#9E9E9E"
                      right={
                        project.relative_last_opened ? (
                          <span className="shrink-0 text-[11px] text-[#aaa]">{project.relative_last_opened}</span>
                        ) : null
                      }
                      active={pathname?.includes(`/dashboard/projects/${project.id}`)}
                    />
                  ))}
                </>
              ) : null}
              <Link
                href="/dashboard/projects"
                className="block py-1 pl-[30px] pr-2 pb-2 text-[11px] text-[#aaa] hover:text-[#2A537A]"
              >
                View all projects →
              </Link>
            </ExpandableSection>
          )}

          {billingSummary?.entitlements.allowEverythingPage && (
            <NavLink
              href="/dashboard/workspace/everything"
              icon={<Database className="h-3.5 w-3.5" strokeWidth={1.3} />}
              active={pathname?.startsWith("/dashboard/workspace/everything")}
              collapsed={collapsed}
            >
              Everything
            </NavLink>
          )}
          <NavLink
            href="/dashboard/workflow"
            icon={<List className="h-3.5 w-3.5" strokeWidth={1.3} />}
            active={pathname?.startsWith("/dashboard/workflow")}
            collapsed={collapsed}
          >
            Workflow
          </NavLink>
          <NavLink
            href="/dashboard/clients"
            icon={<Users className="h-3.5 w-3.5" strokeWidth={1.3} />}
            active={pathname?.startsWith("/dashboard/clients")}
            collapsed={collapsed}
          >
            Clients
          </NavLink>

          {!collapsed && <SidebarDivider />}

          {collapsed && (
            <NavLink
              href="/dashboard/docs"
              icon={<FileText className="h-3.5 w-3.5" strokeWidth={1.3} />}
              active={pathname?.startsWith("/dashboard/docs")}
              collapsed={collapsed}
            >
              Docs
            </NavLink>
          )}
          {!collapsed && (
            <ExpandableSection
              icon={<FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.3} />}
              label="Docs"
              open={docsOpen}
              onToggle={() => setDocsOpen((prev) => !prev)}
              onAdd={handleCreateDoc}
              active={pathname?.startsWith("/dashboard/docs")}
            >
              {recentDocs.length > 0 ? (
                <>
                  <div className="px-2 pb-0.5 pl-[30px] pt-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[#aaa]">
                    Recent
                  </div>
                  {recentDocs.map((doc) => (
                    <SidebarDocRow
                      key={doc.id}
                      href={`/dashboard/docs/${doc.id}`}
                      label={doc.title || "Untitled Document"}
                      time={doc.relative_last_opened}
                      active={pathname?.includes(`/dashboard/docs/${doc.id}`)}
                    />
                  ))}
                </>
              ) : null}
              <Link href="/dashboard/docs" className="block py-1 pl-[30px] pr-2 pb-2 text-[11px] text-[#aaa] hover:text-[#2A537A]">
                View all docs →
              </Link>
            </ExpandableSection>
          )}

          {collapsed && (
            <NavLink
              href="/dashboard/internal"
              icon={<MessageSquare className="h-3.5 w-3.5" strokeWidth={1.3} />}
              active={pathname?.startsWith("/dashboard/internal")}
              collapsed={collapsed}
            >
              Internal
            </NavLink>
          )}
          {!collapsed && (
            <ExpandableSection
              icon={<MessageSquare className="h-3.5 w-3.5 shrink-0" strokeWidth={1.3} />}
              label="Internal"
              open={internalOpen}
              onToggle={() => setInternalOpen((prev) => !prev)}
              active={pathname?.startsWith("/dashboard/internal")}
            >
              <SidebarInternalRow href="/dashboard/internal" label="Company Wiki" active={pathname === "/dashboard/internal"} />
              <SidebarInternalRow href="/dashboard/internal" label="Playbooks" active={false} />
              <SidebarInternalRow href="/dashboard/internal" label="Resources" active={false} />
            </ExpandableSection>
          )}

          {!collapsed && <SidebarDivider />}

          <NavLink
            href="/dashboard/shared"
            icon={<Share2 className="h-3.5 w-3.5" strokeWidth={1.3} />}
            active={pathname?.startsWith("/dashboard/shared")}
            collapsed={collapsed}
          >
            Shared with me
          </NavLink>
          <NavLink
            href="/dashboard/calendar"
            icon={<CalendarIcon className="h-3.5 w-3.5" strokeWidth={1.3} />}
            active={pathname?.startsWith("/dashboard/calendar")}
            collapsed={collapsed}
          >
            Calendar
          </NavLink>
          <NavLink
            href="/dashboard/shopify/products"
            icon={<Package className="h-3.5 w-3.5" strokeWidth={1.3} />}
            active={pathname?.startsWith("/dashboard/shopify/products")}
            collapsed={collapsed}
          >
            Products
          </NavLink>

          {!collapsed && <SidebarDivider />}

          <NavLink
            href="/dashboard/settings"
            icon={<Settings className="h-3.5 w-3.5" strokeWidth={1.3} />}
            active={pathname?.startsWith("/dashboard/settings")}
            collapsed={collapsed}
          >
            Settings
          </NavLink>
        </nav>
      </div>

      <div className="shrink-0 border-t border-[var(--sidebar-border,var(--border))] p-2" ref={userDropdownRef}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setTheme(theme === "default" ? "dark" : "default")}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-[#888] hover:bg-[var(--sidebar-item-hover,#f0ede6)]"
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              <Palette className="h-4 w-4" />
            </button>
            <DropdownMenu open={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A537A] text-[10px] font-semibold text-white"
                  aria-label="Account menu"
                >
                  {getUserInitials()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "default" ? "dark" : "default")}
                  className="gap-2"
                >
                  <Palette className="h-3.5 w-3.5" />
                  {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {workspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    disabled={isSwitching}
                    onClick={() => void handleWorkspaceSwitch(workspace)}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--primary)]">{getInitials(workspace.name)}</span>
                      <span className="truncate">{workspace.name}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
                {workspaces.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem asChild>
                  <Link href="/profile" onClick={() => setUserDropdownOpen(false)} className="flex cursor-pointer items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleLogout()} className="gap-2">
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1 py-1">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2A537A] text-[10px] font-semibold text-white">
              {getUserInitials()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[#1a1a1a]">{currentUser?.name || "User"}</p>
              <p className="truncate text-[10px] text-[#aaa]">{sidebarPlanLabel(billingSummary?.entitlements.planKey)}</p>
            </div>
            <DropdownMenu open={userDropdownOpen} onOpenChange={setUserDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#888] hover:bg-[var(--sidebar-item-hover,#f0ede6)]"
                  aria-label="Account menu"
                >
                  <MoreVertical className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "default" ? "dark" : "default")}
                  className="gap-2"
                >
                  <Palette className="h-3.5 w-3.5" />
                  {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {workspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    disabled={isSwitching}
                    onClick={() => void handleWorkspaceSwitch(workspace)}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--primary)]">{getInitials(workspace.name)}</span>
                      <span className="truncate">{workspace.name}</span>
                      {currentWorkspace?.id === workspace.id ? <Check className="ml-auto h-3.5 w-3.5 text-[var(--success)]" /> : null}
                    </span>
                  </DropdownMenuItem>
                ))}
                {workspaces.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem asChild>
                  <Link href="/profile" onClick={() => setUserDropdownOpen(false)} className="flex cursor-pointer items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleLogout()} className="gap-2">
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  children,
  active,
  collapsed,
  prefetch,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  collapsed?: boolean;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md py-1.5 text-[13px] font-medium transition-colors duration-150",
        collapsed ? "justify-center px-2" : "px-2",
        active
          ? "bg-[var(--sidebar-item-hover,#f0ede6)] font-medium text-[#1a1a1a]"
          : "text-[#666] hover:bg-[var(--sidebar-item-hover,#f0ede6)] hover:text-[#1a1a1a]"
      )}
      title={collapsed ? (children as string) : undefined}
    >
      <span className={cn("flex shrink-0 items-center justify-center text-current", active ? "text-[#1a1a1a]" : "text-[#666]")}>
        {icon}
      </span>
      {!collapsed && <span className="min-w-0 flex-1 truncate">{children}</span>}
    </Link>
  );
}

function ExpandableSection({
  icon,
  label,
  open,
  onToggle,
  onAdd,
  active,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="group/section py-0.5">
      <div
        className={cn(
          "flex w-full items-center rounded-md transition-colors",
          active ? "text-[#1a1a1a]" : "text-[#666] hover:bg-[var(--sidebar-item-hover,#f0ede6)] hover:text-[#1a1a1a]"
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[13px] font-medium"
        >
          <span className="shrink-0 text-current">{icon}</span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </button>
        {onAdd ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="mr-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[15px] leading-none text-[#aaa] opacity-0 transition-opacity hover:bg-[#E8E3DB] hover:text-[#555] group-hover/section:opacity-100"
            aria-label={`New ${label.toLowerCase().replace(/s$/, "")}`}
          >
            +
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="mr-1 inline-flex shrink-0 items-center justify-center p-0.5 text-[#888]/70 hover:text-[#666]"
          aria-expanded={open}
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform duration-150", open && "rotate-90")} strokeWidth={1.3} />
        </button>
      </div>
      {open ? <div className="space-y-px">{children}</div> : null}
    </div>
  );
}

function SidebarProjectRow({
  href,
  label,
  subtitle,
  dotColor,
  right,
  active,
}: {
  href: string;
  label: string;
  subtitle?: string;
  dotColor: string;
  right?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-start gap-2 rounded-md py-1 pl-[30px] pr-2 text-left text-[12px] transition-colors",
        active ? "bg-[var(--sidebar-item-hover,#f0ede6)] text-[#1a1a1a]" : "text-[#666] hover:bg-[var(--sidebar-item-hover,#f0ede6)] hover:text-[#1a1a1a]"
      )}
    >
      <span className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ backgroundColor: dotColor }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {subtitle ? <span className="block truncate text-[11px] text-[#9b948a]">{subtitle}</span> : null}
      </span>
      {right}
    </Link>
  );
}

function SidebarDocRow({
  href,
  label,
  time,
  active,
}: {
  href: string;
  label: string;
  time?: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md py-1 pl-[30px] pr-2 text-left text-[12px] transition-colors",
        active ? "bg-[var(--sidebar-item-hover,#f0ede6)] text-[#1a1a1a]" : "text-[#666] hover:bg-[var(--sidebar-item-hover,#f0ede6)] hover:text-[#1a1a1a]"
      )}
    >
      <FileText className="h-2.5 w-2.5 shrink-0 opacity-40" strokeWidth={1.2} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {time ? <span className="shrink-0 text-[11px] text-[#aaa]">{time}</span> : null}
    </Link>
  );
}

function SidebarInternalRow({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md py-1 pl-[30px] pr-2 text-left text-[12px] transition-colors",
        active ? "bg-[var(--sidebar-item-hover,#f0ede6)] text-[#1a1a1a]" : "text-[#666] hover:bg-[var(--sidebar-item-hover,#f0ede6)] hover:text-[#1a1a1a]"
      )}
    >
      <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-current opacity-40" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatHeaderDate(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  return `${weekday}, ${month} ${day}${getOrdinalSuffix(day)}`;
}

function normalizeUserName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function Header() {
  const pathname = usePathname();
  const { data: currentUser, isLoading } = useUser();
  const { headerHidden } = useDashboardHeader();
  const configModal = useDashboardConfigModal();
  const { currentWorkspace } = useWorkspace();
  const { data: billingSummary } = useWorkspaceBilling(currentWorkspace?.id);
  const isWorkflowPage = pathname?.startsWith("/dashboard/workflow");
  const isCalendarPage = pathname?.startsWith("/dashboard/calendar");
  const isDashboardHome = pathname === "/dashboard";
  const isProjectsPage = pathname === "/dashboard/projects";
  const isProjectOrClientDetail =
    (pathname?.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects") ||
    (pathname?.startsWith("/dashboard/clients/") && pathname !== "/dashboard/clients");
  const hideBar = headerHidden || isWorkflowPage || isCalendarPage || isProjectOrClientDetail;

  if (hideBar) return null;

  const rawName = isLoading ? "…" : (currentUser?.firstName || currentUser?.name || "User");
  const displayName = rawName === "…" ? rawName : normalizeUserName(rawName);
  const displayDate = formatHeaderDate(new Date());

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 md:px-6">
      <p className="text-[13px] text-[var(--foreground)]">
        <span className="font-medium">{displayName}</span>
        <span className="mx-2 text-[var(--faint-foreground)]">|</span>
        <span className="font-light text-[var(--tertiary-foreground)]">{displayDate}</span>
      </p>
      <div className="flex items-center gap-2">
        <NotificationBell workspaceId={currentWorkspace?.id} />
        {isDashboardHome && configModal && billingSummary?.entitlements.allowDashboardConfiguration && (
          <Button
            size="sm"
            variant="outline"
            className="border-[var(--border)] text-[var(--header-bar-text)] hover:bg-[var(--surface-hover)]"
            onClick={() => configModal.open()}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Configure dashboard
          </Button>
        )}
        {isProjectsPage ? (
          <Button
            size="sm"
            className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CREATE_PROJECT_EVENT))}
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        ) : (
          <Link href="/dashboard/projects">
            <Button
              size="sm"
              className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              New project
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

function LayoutMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { headerHidden } = useDashboardHeader();
  const isWorkflowPage = pathname?.startsWith("/dashboard/workflow");
  const isWorkflowCanvas = pathname?.match(/^\/dashboard\/workflow\/[^/]+$/);
  const isCalendarPage = pathname?.startsWith("/dashboard/calendar");
  const isProjectTemplatesPage = pathname === "/dashboard/projects/templates";
  const isProjectOrClientDetail =
    ((pathname?.startsWith("/dashboard/projects/") &&
      pathname !== "/dashboard/projects" &&
      !isProjectTemplatesPage)) ||
    (pathname?.startsWith("/dashboard/clients/") && pathname !== "/dashboard/clients");
  const isFullBleedPage =
    pathname?.startsWith("/dashboard/settings") ||
    pathname?.startsWith("/dashboard/workspace/everything") ||
    pathname?.startsWith("/dashboard/shopify/products") ||
    isProjectOrClientDetail;

  return (
    <main
      id="dashboard-content"
      className={cn(
        "flex-1 min-h-0 bg-[var(--background)]",
        isProjectOrClientDetail && "flex flex-col",
        isFullBleedPage ? "px-0" : "px-3 md:px-4 lg:px-5",
        isWorkflowCanvas || isCalendarPage ? "overflow-hidden py-0" : "overflow-y-auto",
        headerHidden || isWorkflowPage || isCalendarPage || isProjectOrClientDetail ? "py-0" : "py-5 lg:py-6"
      )}
    >
      {isProjectOrClientDetail ? (
        <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
      ) : (
        children
      )}
    </main>
  );
}
