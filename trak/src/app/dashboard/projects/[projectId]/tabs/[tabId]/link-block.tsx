"use client";

import { Link2 } from "lucide-react";
import { type Block } from "@/app/actions/block";

interface LinkBlockProps {
  block: Block;
}

export default function LinkBlock({ block }: LinkBlockProps) {
  const content = (block.content || {}) as {
    title?: string;
    url?: string;
    description?: string;
  };

  const title = content.title || "Untitled Link";
  const url = content.url || "#";
  const description = content.description;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="p-5 flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors rounded-lg"
    >
      <div className="w-10 h-10 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
        <Link2 className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
          {title}
        </div>
        {description && (
          <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
            {description}
          </div>
        )}
        <div className="text-xs text-neutral-500 dark:text-neutral-500 font-mono truncate">
          {url}
        </div>
      </div>
    </a>
  );
}

