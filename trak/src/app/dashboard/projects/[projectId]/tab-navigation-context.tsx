"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { buildProjectTabPath, matchesReadableEntity } from "@/lib/dashboard-routes";

interface TabInfo {
  id: string;
  name: string;
  is_workflow_page?: boolean;
  children?: TabInfo[];
}

interface TabNavigationContextValue {
  activeTabId: string | null;
  navigateToTab: (tabId: string, tabName: string) => void;
  isClientSideNav: boolean;
  clientTabId: string | null;
}

const TabNavigationContext = createContext<TabNavigationContextValue | null>(null);

export function useTabNavigation() {
  return useContext(TabNavigationContext);
}

function findTabIdFromPathname(pathname: string, tabs: TabInfo[]): string | null {
  const tabParam = pathname.split("/tabs/")[1]?.split("/")[0];
  if (!tabParam) return null;

  const stack = [...tabs];
  while (stack.length > 0) {
    const current = stack.shift()!;
    if (matchesReadableEntity(tabParam, current.name, current.id)) {
      return current.id;
    }
    if (current.children) stack.push(...current.children);
  }
  return null;
}

function findTabById(tabs: TabInfo[], tabId: string): TabInfo | null {
  for (const tab of tabs) {
    if (tab.id === tabId) return tab;
    if (tab.children) {
      const found = findTabById(tab.children, tabId);
      if (found) return found;
    }
  }
  return null;
}

interface TabNavigationProviderProps {
  projectId: string;
  projectName: string;
  tabs: TabInfo[];
  serverTabId: string | null;
  children: React.ReactNode;
}

export function TabNavigationProvider({
  projectId,
  projectName,
  tabs,
  serverTabId,
  children,
}: TabNavigationProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [clientTabId, setClientTabId] = useState<string | null>(null);
  const [isClientSideNav, setIsClientSideNav] = useState(false);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // Derive active tab: client-side nav takes priority, then server-derived from URL
  const serverDerivedTabId = serverTabId ?? findTabIdFromPathname(pathname, tabs);
  const activeTabId = isClientSideNav && clientTabId ? clientTabId : serverDerivedTabId;

  const navigateToTab = useCallback((tabId: string, tabName: string) => {
    const tab = findTabById(tabsRef.current, tabId);
    if (tab?.is_workflow_page) {
      router.push(buildProjectTabPath(projectIdRef.current, tabId, projectName, tabName));
      return;
    }

    const newPath = buildProjectTabPath(projectIdRef.current, tabId, projectName, tabName);
    window.history.pushState({ trakClientNav: true, tabId }, "", newPath);
    setClientTabId(tabId);
    setIsClientSideNav(true);
  }, [projectName, router]);

  useEffect(() => {
    const handlePopState = () => {
      const newPath = window.location.pathname;
      const isTabPath = newPath.includes("/tabs/");

      if (isTabPath) {
        const newTabId = findTabIdFromPathname(newPath, tabsRef.current);
        if (newTabId) {
          const tab = findTabById(tabsRef.current, newTabId);
          if (!tab?.is_workflow_page) {
            setClientTabId(newTabId);
            setIsClientSideNav(true);
            return;
          }
        }
      }

      setIsClientSideNav(false);
      setClientTabId(null);
      router.push(newPath);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // Reset client state when a server navigation occurs (Next.js pathname change).
  // Note: pathname from usePathname() only changes on real Next.js navigations,
  // not on our pushState calls, so this correctly resets on refresh/overview/etc.
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      setIsClientSideNav(false);
      setClientTabId(null);
    }
  }, [pathname]);

  return (
    <TabNavigationContext.Provider value={{ activeTabId, navigateToTab, isClientSideNav, clientTabId }}>
      {children}
    </TabNavigationContext.Provider>
  );
}
