"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Folder, 
  Users, 
  CreditCard, 
  ChevronDown,
  Plus,
  Check,
  LogOut,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "./workspace-context";
import { logout } from "@/app/actions/auth";

interface User {
  id: string;
  email: string;
  name: string;
}

export default function DashboardLayoutClient({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: User | null;
}) {
  return (
    <div className="flex h-screen bg-neutral-100 p-4">
      {/* Sidebar */}
      <Sidebar currentUser={currentUser} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 ml-4">
        {/* Header */}
        <Header />
        
        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6 bg-white/50 backdrop-blur-md border border-neutral-200/20 rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.25)]">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ currentUser }: { currentUser: User | null }) {
  const pathname = usePathname();
  const { currentWorkspace, workspaces, switchWorkspace, isSwitching } = useWorkspace();
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Get workspace initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get user initials
  const getUserInitials = () => {
    if (!currentUser) return 'U';
    return currentUser.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Close dropdown when clicking outside
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

  const handleWorkspaceSwitch = async (workspace: any) => {
    await switchWorkspace(workspace);
    setWorkspaceDropdownOpen(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="w-64 border border-neutral-200/20 bg-neutral-50/50 backdrop-blur-md flex flex-col rounded-2xl overflow-hidden shadow-[0_4px_40px_rgba(0,0,0,0.25)]">
      {/* Workspace Switcher */}
      <div className="p-4 border-b border-neutral-200/20" ref={workspaceDropdownRef}>
        <button 
          onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
          disabled={isSwitching}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-neutral-100 rounded-xl transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-200 flex items-center justify-center shrink-0">
              {isSwitching ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-700" />
              ) : (
                <span className="text-sm font-semibold text-neutral-700">
                  {currentWorkspace ? getInitials(currentWorkspace.name) : 'W'}
                </span>
              )}
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium text-neutral-900 truncate">
                {currentWorkspace?.name || 'No Workspace'}
              </span>
              <span className="text-xs text-neutral-500 capitalize">
                {currentWorkspace?.role || 'N/A'}
              </span>
            </div>
          </div>
          {workspaces.length > 1 && (
            <ChevronDown className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${workspaceDropdownOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {/* Workspace Dropdown Menu */}
        {workspaceDropdownOpen && workspaces.length > 1 && (
          <div className="mt-2 bg-white border border-neutral-200/40 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
            <div className="py-1">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceSwitch(workspace)}
                  disabled={isSwitching}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-neutral-600">
                        {getInitials(workspace.name)}
                      </span>
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-sm text-neutral-900 truncate">
                        {workspace.name}
                      </span>
                      <span className="text-xs text-neutral-500 capitalize">
                        {workspace.role}
                      </span>
                    </div>
                  </div>
                  {currentWorkspace?.id === workspace.id && (
                    <Check className="w-4 h-4 text-neutral-900 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1">
        <NavLink 
          href="/dashboard/projects" 
          icon={<Folder className="w-4 h-4" />}
          active={pathname?.startsWith('/dashboard/projects')}
        >
          Projects
        </NavLink>
        <NavLink 
          href="/dashboard/clients" 
          icon={<Users className="w-4 h-4" />}
          active={pathname?.startsWith('/dashboard/clients')}
        >
          Clients
        </NavLink>
        <NavLink 
          href="/dashboard/payments" 
          icon={<CreditCard className="w-4 h-4" />}
          active={pathname?.startsWith('/dashboard/payments')}
        >
          Payments
        </NavLink>
      </nav>

      {/* User Menu at Bottom */}
      <div className="p-3 border-t border-neutral-200/20" ref={userDropdownRef}>
        <button 
          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-neutral-100 rounded-xl transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center shrink-0">
              <span className="text-xs font-medium text-neutral-700">
                {getUserInitials()}
              </span>
            </div>
            <span className="text-sm text-neutral-900 truncate">
              {currentUser?.name || 'User'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* User Dropdown Menu */}
        {userDropdownOpen && (
          <div className="mt-2 bg-white border border-neutral-200/40 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
            <div className="py-1">
              {/* User Info */}
              <div className="px-3 py-2 border-b border-neutral-200/40">
                <div className="text-sm font-medium text-neutral-900 truncate">
                  {currentUser?.name}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  {currentUser?.email}
                </div>
              </div>

              {/* Menu Items */}
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
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
  active
}: { 
  href: string; 
  icon: React.ReactNode; 
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl transition-colors ${
        active 
          ? "bg-neutral-100 text-neutral-900 font-medium" 
          : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function Header() {
  const pathname = usePathname();
  
  // Get page title from pathname
  const getPageTitle = () => {
    if (pathname?.includes('/projects')) return 'Projects';
    if (pathname?.includes('/clients')) return 'Clients';
    if (pathname?.includes('/payments')) return 'Payments';
    return 'Dashboard';
  };

  return (
    <header className="h-14 border border-neutral-200/20 bg-white/50 backdrop-blur-md flex items-center justify-between px-6 rounded-2xl mb-4 shadow-[0_4px_40px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-medium text-neutral-900">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <button className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}