"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  Users,
  BookOpen,
  FileText,
  ChevronDown,
  Check,
  LogOut,
  Loader2,
  Menu,
  X,
  Home,
  Calendar as CalendarIcon,
  Palette,
  Package,
  Square,
  Sparkles,
  Database,
  User,
  Settings,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { AICommandPalette, useAI } from "@/components/ai";
import { useTheme } from "./theme-context";
import NotificationBell from "@/components/notifications/notification-bell";
import { OPEN_CREATE_PROJECT_EVENT } from "@/lib/projects";
import { useWorkspaceBilling } from "@/hooks/use-workspace-billing";
// DEMO (magic links): remove DemoUploadToastTrigger + related state when recording is done
import Toast from "@/app/dashboard/projects/toast";
import {
  createUnavailableSplashWeather,
  resolveSplashWeather,
  SPLASH_FADE_DURATION_MS,
  SPLASH_HIDE_DELAY_MS,
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
  const [showSplash, setShowSplash] = useState(true);
  const pathname = usePathname();
  const wasProjectView = useRef<boolean | null>(null);
  const isFirstRender = useRef(true);

  const isProjectView =
    pathname?.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects";
  const isWorkflowRoute = pathname?.startsWith("/dashboard/workflow");

  const normalizedPathname = pathname?.replace(/\/$/, "") ?? "";
  const isProjectOverviewTab =
    normalizedPathname.startsWith("/dashboard/projects/") &&
    normalizedPathname !== "/dashboard/projects" &&
    normalizedPathname.endsWith("/overview");

  const [demoUploadToastOpen, setDemoUploadToastOpen] = useState(false);

  useEffect(() => {
    if (!isProjectOverviewTab) {
      setDemoUploadToastOpen(false);
    }
  }, [isProjectOverviewTab]);

  useEffect(() => {
    // After hydration, align with route-driven default once.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setSidebarCollapsed(isProjectView);
      wasProjectView.current = isProjectView;
      return;
    }
    if (wasProjectView.current !== true && isProjectView) {
      setSidebarCollapsed(true);
    }
    wasProjectView.current = isProjectView;
  }, [isProjectView]);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <DashboardHeaderProvider>
      <DashboardConfigModalProvider>
      <div className="flex h-full bg-[var(--surface)] text-[var(--foreground)]">
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
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
      </div>

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
          className="fixed bottom-4 left-4 z-[90] rounded-[2px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)] shadow-sm hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          title="Temporary control for magic-links demo recording"
        >
          Demo: upload toast
        </button>
      ) : null}
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
    if (!isLoading && currentUser?.name) {
      setResolvedName(normalizeName(currentUser.name));
    }
  }, [currentUser, isLoading, resolvedName]);

  useEffect(() => {
    if (resolvedName) return;
    const fallbackTimer = setTimeout(() => {
      setResolvedName(normalizeName(currentUser?.name || "there"));
    }, 700);
    return () => clearTimeout(fallbackTimer);
  }, [currentUser, resolvedName]);

  const name = resolvedName || "there";
  const greeting = `Good Morning, ${name}`;

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

function AICommandButton({ collapsed }: { collapsed: boolean }) {
  const { openCommandPalette } = useAI();

  return (
    <div className={cn("px-2 pt-2 pb-2", collapsed && "flex justify-center")}>
      <button
        onClick={openCommandPalette}
        className={cn(
          "flex items-center rounded-[var(--radius-md)] transition-all duration-150",
          "bg-[var(--primary)] text-[var(--primary-foreground)]",
          "hover:bg-[var(--primary-hover)]",
          collapsed
            ? "h-7 w-7 justify-center shrink-0"
            : "w-full gap-3 px-3 py-1.5"
        )}
        title="Ask AI (⌘K)"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--primary-foreground)]">
          <Sparkles className="h-4 w-4" />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-sm font-medium text-[var(--primary-foreground)]">Ask AI</span>
            <kbd className="rounded-[var(--radius-sm)] bg-[var(--primary-foreground)]/15 px-1.5 py-0.5 text-[10px] font-mono text-[var(--primary-foreground)]">
              ⌘K
            </kbd>
          </>
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
  const { data: currentUser } = useUser();
  const { currentWorkspace, workspaces, switchWorkspace, isSwitching } = useWorkspace();
  const { data: billingSummary } = useWorkspaceBilling(currentWorkspace?.id);
  const { theme, setTheme } = useTheme();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <aside
      className={cn(
        "relative z-50 flex h-full flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-all duration-200 ease-out",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex items-center py-3",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[var(--foreground)]">
            Saria
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCollapsed();
          }}
          type="button"
          className="relative z-50 inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-3">
            <GlobalSearch />
          </div>
        )}

        {/* AI Command Button */}
        <AICommandButton collapsed={collapsed} />

        <nav className={cn("space-y-0.5 px-2", collapsed ? "pt-2" : "pt-2 pb-2")}
        >
          <NavLink
            href="/dashboard"
            icon={<Home className="h-4 w-4" />}
            active={pathname === "/dashboard"}
            collapsed={collapsed}
          >
            Home
          </NavLink>
          <NavLink
            href="/dashboard/projects"
            icon={<Folder className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/projects")}
            collapsed={collapsed}
          >
            Projects
          </NavLink>
          {billingSummary?.entitlements.allowEverythingPage && (
            <NavLink
              href="/dashboard/workspace/everything"
              icon={<Database className="h-4 w-4" />}
              active={pathname?.startsWith("/dashboard/workspace/everything")}
              collapsed={collapsed}
            >
              Everything
            </NavLink>
          )}
          <NavLink
            href="/dashboard/workflow"
            icon={<Square className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/workflow")}
            collapsed={collapsed}
          >
            Workflow
          </NavLink>
          <NavLink
            href="/dashboard/clients"
            icon={<Users className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/clients")}
            collapsed={collapsed}
          >
            Clients
          </NavLink>
          <NavLink
            href="/dashboard/internal"
            icon={<BookOpen className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/internal")}
            collapsed={collapsed}
          >
            Internal
          </NavLink>
          <NavLink
            href="/dashboard/docs"
            icon={<FileText className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/docs")}
            collapsed={collapsed}
          >
            Docs
          </NavLink>
          <NavLink
            href="/dashboard/calendar"
            icon={<CalendarIcon className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/calendar")}
            collapsed={collapsed}
          >
            Calendar
          </NavLink>
          <NavLink
            href="/dashboard/shopify/products"
            icon={<Package className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/shopify/products")}
            collapsed={collapsed}
          >
            Products
          </NavLink>
          <NavLink
            href="/dashboard/settings"
            icon={<Settings className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/settings")}
            collapsed={collapsed}
          >
            Settings
          </NavLink>
        </nav>
      </div>

      {/* Theme toggle – Sarajevo light / dark */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        {collapsed ? (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : "default")}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <Palette className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : "default")}
            className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Palette className="h-3.5 w-3.5" />
            <span className="text-xs font-medium text-[var(--foreground)]">
              Theme: {theme === "dark" ? "Dark" : "Light"}
            </span>
          </button>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-3 py-3" ref={userDropdownRef}>
        {collapsed ? (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-xs font-semibold transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            {getUserInitials()}
          </button>
        ) : (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-xs font-semibold">
                {getUserInitials()}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{currentUser?.name || "User"}</p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">{currentUser?.email}</p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform duration-150",
                userDropdownOpen && "rotate-180"
              )}
            />
          </button>
        )}

        {userDropdownOpen && (
          <div className="mt-2 space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            {/* Workspace switcher */}
            {workspaces.length > 0 && (
              <div className="space-y-1">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleWorkspaceSwitch(workspace)}
                    disabled={isSwitching}
                    className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] bg-[var(--river-indigo)]/15 border border-[var(--river-indigo)]/20 text-[var(--river-indigo)] text-xs font-semibold">
                      {isSwitching && currentWorkspace?.id === workspace.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        getInitials(workspace.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-[var(--foreground)]">{workspace.name}</p>
                      <p className="truncate text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                        {workspace.role}
                      </p>
                    </div>
                    {currentWorkspace?.id === workspace.id && <Check className="h-3.5 w-3.5 text-[var(--dome-teal)]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* View All Workspaces */}
            <Link
              href="/profile"
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              onClick={() => setUserDropdownOpen(false)}
            >
              <User className="h-3.5 w-3.5" />
              View All Workspaces
            </Link>

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
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
        "group flex w-full items-center rounded-[var(--radius-md)] border-l-[2.5px] border-l-transparent text-base transition-colors duration-150",
        collapsed ? "justify-center px-2 py-1.5" : "gap-3 px-3 py-1.5",
        active
          ? "border-l-[var(--primary)] bg-[var(--surface)] font-medium text-[var(--foreground)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
      )}
      title={collapsed ? (children as string) : undefined}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] transition-colors duration-150",
          active
            ? "text-[var(--nav-icon-active)]"
            : "text-[var(--nav-icon)] group-hover:text-[var(--nav-icon-active)]"
        )}
      >
        {icon}
      </span>
      {!collapsed && <span className="truncate font-medium">{children}</span>}
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

  const rawName = isLoading ? "…" : (currentUser?.name || "User");
  const displayName = rawName === "…" ? rawName : normalizeUserName(rawName);
  const displayDate = formatHeaderDate(new Date());

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--header-bar-bg)] px-2 py-2 md:px-3 lg:px-4">
      <p className="text-sm text-[var(--header-bar-text)]">
        <span className="font-medium">{displayName}</span>
        <span className="mx-2 opacity-70">|</span>
        <span className="opacity-90">{displayDate}</span>
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
  const isProjectOrClientDetail =
    (pathname?.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects") ||
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
        "flex-1 min-h-0 bg-[var(--surface)]",
        isProjectOrClientDetail && "flex flex-col",
        isFullBleedPage ? "px-0" : "px-2 md:px-3 lg:px-4",
        isWorkflowCanvas || isCalendarPage ? "overflow-hidden py-0" : "overflow-y-auto",
        headerHidden || isWorkflowPage || isCalendarPage || isProjectOrClientDetail ? "py-0" : "py-4 lg:py-5"
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
