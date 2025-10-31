"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  name: string;
  position: number;
}

interface TabBarProps {
  tabs: Tab[];
  projectId: string;
}

export default function TabBar({ tabs, projectId }: TabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine active tab from URL
  const activeTabId = pathname.split("/tabs/")[1]?.split("/")[0];

  const handleTabClick = (tabId: string) => {
    router.push(`/dashboard/projects/${projectId}/tabs/${tabId}`);
    setMobileMenuOpen(false);
  };

  const handleAddTab = () => {
    // TODO: Open create tab dialog
    console.log("Add tab to project:", projectId);
  };

  return (
    <>
      {/* Desktop: Horizontal Tabs */}
      <div className="hidden md:block border-b border-neutral-200 dark:border-neutral-800 px-6">
        <div className="flex items-center gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "py-4 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                activeTabId === tab.id
                  ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                  : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {tab.name}
            </button>
          ))}

          {/* Add Tab Button */}
          <button
            onClick={handleAddTab}
            className="py-4 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1 whitespace-nowrap transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Tab
          </button>
        </div>
      </div>

      {/* Mobile: Dropdown */}
      <div className="block md:hidden border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between text-sm font-medium text-neutral-900 dark:text-white"
        >
          <span>
            {tabs.find((t) => t.id === activeTabId)?.name || "Select a tab"}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              mobileMenuOpen && "rotate-180"
            )}
          />
        </button>

        {mobileMenuOpen && (
          <div className="mt-2 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm transition-colors",
                  activeTabId === tab.id
                    ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750"
                )}
              >
                {tab.name}
              </button>
            ))}
            <button
              onClick={handleAddTab}
              className="w-full px-4 py-2 text-left text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-750 flex items-center gap-2 border-t border-neutral-200 dark:border-neutral-700 mt-1 pt-3"
            >
              <Plus className="w-4 h-4" />
              Add Tab
            </button>
          </div>
        )}
      </div>
    </>
  );
}