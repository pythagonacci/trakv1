"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  Users,
  CreditCard,
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
  Square,
  CheckSquare,
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
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: User | null;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <DashboardHeaderProvider>
      <div className="flex h-screen bg-[var(--surface)] text-[var(--foreground)]">
        <Sidebar currentUser={currentUser} collapsed={sidebarCollapsed} setCollapsed={toggleSidebar} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <LayoutMain>{children}</LayoutMain>
        </div>
      </div>
    </DashboardHeaderProvider>
  );
}

function Sidebar({
  currentUser,
  collapsed,
  setCollapsed,
}: {
  currentUser: User | null;
  collapsed: boolean;
  setCollapsed: () => void;
}) {
  const pathname = usePathname();
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
        // ATELIER STONE SIDEBAR: Matte, structural, no glass effects
        "flex h-screen flex-col border-r border-[var(--border)] bg-[var(--background)] transition-all duration-200 ease-out flex-shrink-0 relative z-50",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className={cn(
        "flex items-center py-3",
        collapsed ? "justify-center px-2" : "justify-between px-4"
      )}>
        {!collapsed && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[var(--foreground)]/60">
            Trak
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCollapsed();
          }}
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] z-50 relative"
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
              className="flex w-full items-center gap-2.5 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-[var(--primary)]/10 border border-[var(--border)] text-[10px] font-semibold text-[var(--foreground)]">
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
              <div className="mt-2 space-y-1 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleWorkspaceSwitch(workspace)}
                    disabled={isSwitching}
                    className="flex w-full items-center gap-2.5 rounded-[2px] px-3 py-2 text-[13px] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-[2px] bg-[var(--primary)]/10 border border-[var(--border)] text-[var(--foreground)] text-xs font-semibold">
                      {getInitials(workspace.name)}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-[var(--foreground)]">{workspace.name}</p>
                      <p className="truncate text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                        {workspace.role}
                      </p>
                    </div>
                    {currentWorkspace?.id === workspace.id && <Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
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

        <nav className={cn("space-y-1 px-2", collapsed ? "pt-2" : "pt-2 pb-2")}
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
            href="/dashboard/tasks"
            icon={<CheckSquare className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/tasks")}
            collapsed={collapsed}
          >
            Tasks
          </NavLink>
          <NavLink
            href="/dashboard/payments"
            icon={<CreditCard className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/payments")}
            collapsed={collapsed}
            prefetch={false}
          >
            Payments
          </NavLink>
        </nav>
      </div>

      {/* Theme Toggle */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        {collapsed ? (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : theme === "dark" ? "brutalist" : "default")}
            className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title={`Theme: ${theme === "brutalist" ? "Brutalist" : theme === "dark" ? "Dark" : "Atelier Stone"}`}
          >
            <Palette className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : theme === "dark" ? "brutalist" : "default")}
            className="flex w-full items-center gap-2.5 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            <Palette className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Theme: {theme === "brutalist" ? "Brutalist" : theme === "dark" ? "Dark" : "Atelier Stone"}</span>
          </button>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-3 py-3" ref={userDropdownRef}>
        {collapsed ? (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[var(--border)] bg-[var(--primary)]/10 text-[var(--foreground)] text-xs font-semibold transition-colors duration-150 hover:bg-[var(--surface-hover)]"
          >
            {getUserInitials()}
          </button>
        ) : (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex w-full items-center justify-between rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-[var(--primary)]/10 border border-[var(--border)] text-[var(--foreground)] text-xs font-semibold">
                {getUserInitials()}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold">{currentUser?.name || "User"}</p>
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
          <div className="mt-2 space-y-1 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-[2px] px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
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
        // ATELIER STONE NAV: Flat, structural, no shadows
        "group flex w-full items-center rounded-[2px] text-sm font-medium transition-colors duration-150",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] border-l-2 border-[var(--primary)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      )}
      title={collapsed ? (children as string) : undefined}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-[2px] transition-colors duration-150",
          active
            ? "bg-[var(--primary)]/10 text-[var(--primary)]"
            : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
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

  const getPageTitle = () => {
    if (pathname?.includes("/projects")) return "Projects";
    if (pathname?.includes("/internal")) return "Internal";
    if (pathname?.includes("/docs")) return "Docs";
    if (pathname?.includes("/clients")) return "Clients";
    if (pathname?.includes("/payments")) return "Payments";
    return "Dashboard";
  };

  // Don't show header on docs pages
  if (pathname?.includes("/docs")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]">
      <div className="flex w-full items-center justify-between px-4 py-3 md:px-5 lg:px-6">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--tertiary-foreground)]">
            Overview
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] font-[var(--font-serif)]">{getPageTitle()}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] md:inline-flex">
            Quick actions
          </button>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-[2px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function LayoutMain({ children }: { children: React.ReactNode }) {
  const { headerHidden } = useDashboardHeader();

  return (
    <main
      id="dashboard-content"
      className={cn(
        "flex-1 overflow-y-auto px-3 md:px-4 lg:px-5",
        headerHidden ? "py-0" : "py-4 lg:py-5"
      )}
    >
      {children}
    </main>
  );
}
