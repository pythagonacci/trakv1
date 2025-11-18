"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ClientPageTab } from "@/app/actions/client-page";

interface ClientPageTabBarProps {
  tabs: ClientPageTab[];
  publicToken: string;
  activeTabId: string;
}

export default function ClientPageTabBar({ tabs, publicToken, activeTabId }: ClientPageTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleTabClick = (tabId: string) => {
    router.push(`/client/${publicToken}/${tabId}`);
  };

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-1 overflow-x-auto px-2">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          const displayName = tab.client_title || tab.name;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "text-[var(--foreground)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

