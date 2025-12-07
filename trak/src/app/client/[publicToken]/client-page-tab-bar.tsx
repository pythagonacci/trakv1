"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ClientPageTab } from "@/app/actions/client-page";

interface ClientPageTabBarProps {
  tabs: ClientPageTab[];
  publicToken: string;
  activeTabId: string;
}

export default function ClientPageTabBar({ tabs, publicToken, activeTabId }: ClientPageTabBarProps) {
  const router = useRouter();

  const handleTabClick = (tabId: string) => {
    router.push(`/client/${publicToken}/${tabId}`);
  };

  return (
    <div className="border-b border-[var(--border)] bg-transparent backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 px-2 py-0.5 sm:px-2.5">
        <div className="flex items-start gap-3 overflow-x-auto flex-1">
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            const displayName = tab.client_title || tab.name;

            return (
              <div key={tab.id} className="group relative flex items-center">
                <button
                  onClick={() => handleTabClick(tab.id)}
                  className={cn(
                    "relative whitespace-nowrap px-3 py-3 text-sm transition-colors",
                    isActive
                      ? "text-[var(--foreground)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  )}
                >
                  <span className="truncate max-w-xs">{displayName}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

