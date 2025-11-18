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
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "./workspace-context";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex h-screen bg-[var(--surface)] text-[var(--foreground)]">
      <Sidebar currentUser={currentUser} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main
          id="dashboard-content"
          className="flex-1 overflow-y-auto px-3 py-4 md:px-4 lg:px-5 lg:py-5"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  currentUser,
  collapsed,
  setCollapsed,
}: {
  currentUser: User | null;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const { currentWorkspace, workspaces, switchWorkspace, isSwitching } = useWorkspace();
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
        "flex h-screen flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200 ease-out",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5">
        {!collapsed && (
          <span className="text-[11px] font-medium uppercase tracking-[0.38em] text-[var(--tertiary-foreground)]">
            Trak
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3.5 pb-2" ref={workspaceDropdownRef}>
            <button
              onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
              disabled={isSwitching}
              className="flex w-full items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left shadow-sm transition-all duration-150 ease-out hover:shadow-md disabled:opacity-60"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[10px] font-semibold text-[var(--foreground)]">
                {isSwitching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : getInitials(currentWorkspace?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">
                  {currentWorkspace?.name || "No Workspace"}
                </p>
                <p className="truncate text-[11px] uppercase tracking-[0.12em] text-[var(--tertiary-foreground)]">
                  {currentWorkspace?.role || "Unknown"}
                </p>
              </div>
              {workspaces.length > 1 && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-[var(--tertiary-foreground)] transition-transform",
                    workspaceDropdownOpen && "rotate-180"
                  )}
                />
              )}
            </button>

            {workspaceDropdownOpen && workspaces.length > 1 && (
              <div className="mt-2 space-y-1 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-card">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleWorkspaceSwitch(workspace)}
                    disabled={isSwitching}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--foreground)] text-xs">
                      {getInitials(workspace.name)}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-medium text-[var(--foreground)]">{workspace.name}</p>
                      <p className="truncate text-[11px] uppercase tracking-[0.12em] text-[var(--tertiary-foreground)]">
                        {workspace.role}
                      </p>
                    </div>
                    {currentWorkspace?.id === workspace.id && <Check className="h-4 w-4 text-[var(--foreground)]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className={cn("space-y-0.5 px-2.5", collapsed ? "pt-2" : "pt-1.5 pb-2")}
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
            href="/dashboard/clients"
            icon={<Users className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/clients")}
            collapsed={collapsed}
          >
            Clients
          </NavLink>
          <NavLink
            href="/dashboard/payments"
            icon={<CreditCard className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/payments")}
            collapsed={collapsed}
          >
            Payments
          </NavLink>
        </nav>
      </div>

      <div className="border-t border-[var(--border)] px-3.5 py-3" ref={userDropdownRef}>
        {collapsed ? (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            {getUserInitials()}
          </button>
        ) : (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex w-full items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-all duration-150 ease-out hover:shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--foreground)] text-sm font-semibold">
                {getUserInitials()}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-medium">{currentUser?.name || "User"}</p>
                <p className="truncate text-xs text-[var(--tertiary-foreground)]">{currentUser?.email}</p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-[var(--tertiary-foreground)] transition-transform",
                userDropdownOpen && "rotate-180"
              )}
            />
          </button>
        )}

        {userDropdownOpen && (
          <div className="mt-2 space-y-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 shadow-card">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              <LogOut className="h-4 w-4" />
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
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      )}
      title={collapsed ? (children as string) : undefined}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-colors",
          active
            ? "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
        )}
      >
        {icon}
      </span>
      {!collapsed && <span className="truncate">{children}</span>}
    </Link>
  );
}

function Header() {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname?.includes("/projects")) return "Projects";
    if (pathname?.includes("/internal")) return "Internal";
    if (pathname?.includes("/docs")) return "Docs";
    if (pathname?.includes("/clients")) return "Clients";
    if (pathname?.includes("/payments")) return "Payments";
    return "Dashboard";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex w-full items-center justify-between px-3 py-2.5 md:px-4 lg:px-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-[var(--tertiary-foreground)]">
            Overview
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">{getPageTitle()}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="hidden rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] md:inline-flex">
            Quick actions
          </button>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)]">
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </header>
  );
}