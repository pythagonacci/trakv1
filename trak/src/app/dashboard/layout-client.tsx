"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  Users,
  BookOpen,
  FileText,
  ChevronDown,
  Plus,
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
import GlobalSearch from "./global-search";
import { useTheme } from "./theme-context";
import { useUser } from "@/hooks/use-user";
import { useAI } from "@/components/ai";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const pathname = usePathname();
  const wasProjectView = useRef<boolean | null>(null);

  const isProjectView =
    pathname?.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects";

  useEffect(() => {
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
      <div className="flex h-full bg-[var(--surface)] text-[var(--foreground)]">
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={toggleSidebar} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <LayoutMain>{children}</LayoutMain>
        </div>
      </div>
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
    }, 85);

    return () => clearInterval(interval);
  }, [greeting, resolvedName]);

  useEffect(() => {
    let cancelled = false;

    const resolveWeather = async () => {
      try {
        const latitude = 40.7831;
        const longitude = -73.9712;
        const weatherRes = await fetch(
          `/api/weather?lat=${latitude}&lon=${longitude}`
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

        const summary = describeWeather(code, wind);

        if (!cancelled) {
          setWeather({
            tempF: temp,
            location: "Manhattan, NY",
            summary,
            resolved: true,
          });
        }
      } catch {
        if (!cancelled) {
          setWeather({
            tempF: null,
            location: "Manhattan, NY",
            summary: "Weather unavailable",
            resolved: true,
          });
        }
      }
    };

    resolveWeather();
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
      }, 450);
    }, 3200);

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
        <div
          className="text-3xl md:text-4xl font-semibold tracking-tight font-playfair"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
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
    <div className={cn("px-2 pb-2", collapsed ? "pt-2" : "")}>
      <button
        onClick={openCommandPalette}
        className={cn(
          "flex items-center gap-2 rounded-md border transition-all duration-150",
          "border-[#3080a6]/30 bg-[#3080a6]/10",
          "hover:bg-[#3890b6]/90 hover:border-[#3890b6]/50",
          "text-white",
          collapsed
            ? "h-9 w-9 justify-center"
            : "w-full px-3 py-2"
        )}
        title="File Analysis (⌘K)"
      >
        <Sparkles className="h-4 w-4" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-sm font-medium text-white">File Analysis</span>
            <kbd className="text-[10px] font-mono bg-[#3080a6]/10 text-white px-1.5 py-0.5 rounded">
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
  const { theme, setTheme } = useTheme();
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
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
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
        setWorkspaceDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleWorkspaceSwitch = async (workspace: Workspace) => {
    await switchWorkspace(workspace);
    setWorkspaceDropdownOpen(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside
      className={cn(
        // SARAJEVO SIDEBAR: Matte, structural, no glass effects
        "flex h-full flex-col border-r border-[#3080a6]/30 bg-[#3080a6]/65 backdrop-blur-sm transition-all duration-200 ease-out flex-shrink-0 relative z-50 font-semibold",
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/90">
            TWOD
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCollapsed();
          }}
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#3080a6]/30 bg-[#3080a6]/10 text-white transition-colors duration-150 hover:bg-[#3890b6]/90 z-50 relative"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-3" ref={workspaceDropdownRef}>
            <button
              onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
              disabled={isSwitching}
              className="flex w-full items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--river-indigo)]/15 border border-[var(--river-indigo)]/20 text-[10px] font-semibold text-[var(--river-indigo)]">
                {isSwitching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : getInitials(currentWorkspace?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                  {currentWorkspace?.name || "No Workspace"}
                </p>
                <p className="truncate text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                  {currentWorkspace?.role || "Unknown"}
                </p>
              </div>
              {workspaces.length > 1 && (
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform duration-200",
                    workspaceDropdownOpen && "rotate-180"
                  )}
                />
              )}
            </button>

            {workspaceDropdownOpen && workspaces.length > 1 && (
              <div className="mt-2 space-y-1 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleWorkspaceSwitch(workspace)}
                    disabled={isSwitching}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--river-indigo)]/15 border border-[var(--river-indigo)]/20 text-[var(--river-indigo)] text-xs font-semibold">
                      {getInitials(workspace.name)}
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
          </div>
        )}

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
          <NavLink
            href="/dashboard/workspace/everything"
            icon={<Database className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/workspace/everything")}
            collapsed={collapsed}
          >
            Everything
          </NavLink>
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

      {/* Theme Toggle - Arts Palette accent */}
        <div className="border-t border-[#3080a6]/30 px-3 py-2">
        {collapsed ? (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : theme === "dark" ? "brutalist" : "default")}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#3080a6]/30 bg-[#3080a6]/10 text-white transition-colors duration-150 hover:bg-[#3890b6]/90"
            title={`Theme: ${theme === "brutalist" ? "Brutalist" : theme === "dark" ? "Dark" : "Sarajevo"}`}
          >
            <Palette className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : theme === "dark" ? "brutalist" : "default")}
              className="flex w-full items-center gap-2.5 rounded-md border border-[#3080a6]/30 bg-[#3080a6]/10 px-3 py-2 text-sm text-white transition-colors duration-150 hover:bg-[#3890b6]/90"
          >
            <Palette className="h-3.5 w-3.5" />
            <span className="text-xs font-medium text-white">Theme: {theme === "brutalist" ? "Brutalist" : theme === "dark" ? "Dark" : "Sarajevo"}</span>
          </button>
        )}
      </div>

      <div className="border-t border-[#3080a6]/30 px-3 py-3" ref={userDropdownRef}>
        {collapsed ? (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#3080a6]/30 bg-[#3080a6]/10 text-white text-xs font-semibold transition-colors duration-150 hover:bg-[#3890b6]/90"
          >
            {getUserInitials()}
          </button>
        ) : (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex w-full items-center justify-between rounded-md border border-[#3080a6]/30 bg-[#3080a6]/10 px-3 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#3890b6]/90"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#3080a6]/15 border border-[#3080a6]/30 text-white text-xs font-semibold">
                {getUserInitials()}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-white">{currentUser?.name || "User"}</p>
                <p className="truncate text-xs text-white/70">{currentUser?.email}</p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-white/70 transition-transform duration-150",
                userDropdownOpen && "rotate-180"
              )}
            />
          </button>
        )}

        {userDropdownOpen && (
          <div className="mt-2 space-y-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            {/* View Profile Link */}
            <Link
              href="/profile"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
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
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
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
        // SARAJEVO NAV with ARTS PALETTE colors
        "group flex w-full items-center rounded-md text-base font-medium transition-colors duration-150",
        collapsed ? "justify-center px-2 py-1.5" : "gap-3 px-3 py-1.5",
        active
          ? "bg-black/15 text-white border-l-2 border-white/30"
          : "bg-black/5 text-white hover:bg-black/20 hover:text-white"
      )}
      title={collapsed ? (children as string) : undefined}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
          active
            ? "bg-[#3080a6]/15 text-white"
            : "text-white/70 group-hover:text-white"
        )}
      >
        {icon}
      </span>
      {!collapsed && <span className="truncate font-medium">{children}</span>}
    </Link>
  );
}

function Header() {
  const pathname = usePathname();
  const { headerHidden } = useDashboardHeader();

  if (headerHidden) {
    return null;
  }

  const isDocsPage = pathname?.includes("/docs");
  const isProjectWorkspaceView =
    pathname?.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects";
  const isProjectsPage = pathname === "/dashboard/projects";
  const isHomePage = pathname === "/dashboard";
  const isClientsPage = pathname?.startsWith("/dashboard/clients");
  const isInternalPage = pathname?.startsWith("/dashboard/internal");
  const isCalendarPage = pathname?.startsWith("/dashboard/calendar");
  const isWorkflowPage = pathname?.startsWith("/dashboard/workflow");

  if (isDocsPage || isProjectWorkspaceView || isProjectsPage || isHomePage || isClientsPage || isInternalPage || isCalendarPage || isWorkflowPage) {
    return null;
  }

  const getPageTitle = () => {
    if (pathname?.includes("/projects")) return "Projects";
    if (pathname?.includes("/internal")) return "Internal";
    if (pathname?.includes("/docs")) return "Docs";
    if (pathname?.includes("/clients")) return "Clients";
    if (pathname?.includes("/payments")) return "Payments";
    return "Dashboard";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]">
      <div className="flex w-full items-center justify-between px-4 py-3 md:px-5 lg:px-6">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--tertiary-foreground)]">
            Overview
          </span>
          <h1 
            className="text-xl font-semibold tracking-normal text-[var(--foreground)] font-playfair"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            {getPageTitle()}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] md:inline-flex">
            Quick actions
          </button>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function LayoutMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { headerHidden } = useDashboardHeader();
  const isWorkflowPage = pathname?.startsWith("/dashboard/workflow");
  const isWorkflowCanvas = pathname?.match(/^\/dashboard\/workflow\/[^/]+$/);

  return (
    <main
      id="dashboard-content"
      className={cn(
        "flex-1 min-h-0 px-3 md:px-4 lg:px-5",
        isWorkflowCanvas ? "overflow-hidden py-0" : "overflow-y-auto",
        headerHidden || isWorkflowPage ? "py-0" : "py-4 lg:py-5"
      )}
    >
      {children}
    </main>
  );
}
