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

export function shouldResetClientSideTabNavigation({
  pathname,
  previousPathname,
  tabs,
  isClientSideNav,
  clientTabId,
  pendingClientTabId,
}: {
  pathname: string;
  previousPathname: string;
  tabs: TabInfo[];
  isClientSideNav: boolean;
  clientTabId: string | null;
  pendingClientTabId: string | null;
}) {
  if (pathname === previousPathname) {
    return false;
  }

  const pathnameTabId = findTabIdFromPathname(pathname, tabs);
  if (!pathnameTabId) {
    return true;
  }

  return !(
    pathnameTabId === pendingClientTabId ||
    (isClientSideNav && pathnameTabId === clientTabId)
  );
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
  const projectIdRef = useRef(projectId);
  const pendingClientTabIdRef = useRef<string | null>(null);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

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
    pendingClientTabIdRef.current = tabId;
    setClientTabId(tabId);
    setIsClientSideNav(true);
    window.history.pushState({ trakClientNav: true, tabId }, "", newPath);
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
            pendingClientTabIdRef.current = newTabId;
            setClientTabId(newTabId);
            setIsClientSideNav(true);
            return;
          }
        }
      }

      setIsClientSideNav(false);
      setClientTabId(null);
      pendingClientTabIdRef.current = null;
      router.push(newPath);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // Reset client state when a server navigation occurs. Native pushState updates
  // usePathname() in current Next, so keep client mode when that pathname is the
  // same tab we just pushed.
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    const previousPathname = prevPathnameRef.current;
    if (pathname === previousPathname) {
      return;
    }

    const shouldReset = shouldResetClientSideTabNavigation({
      pathname,
      previousPathname,
      tabs: tabsRef.current,
      isClientSideNav,
      clientTabId,
      pendingClientTabId: pendingClientTabIdRef.current,
    });

    prevPathnameRef.current = pathname;
    if (shouldReset) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keep tab content mode in sync with Next pathname changes.
      setIsClientSideNav(false);
      setClientTabId(null);
    }
    pendingClientTabIdRef.current = null;
  }, [pathname, isClientSideNav, clientTabId]);

  return (
    <TabNavigationContext.Provider value={{ activeTabId, navigateToTab, isClientSideNav, clientTabId }}>
      {children}
    </TabNavigationContext.Provider>
  );
}
