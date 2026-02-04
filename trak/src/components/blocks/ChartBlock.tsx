"use client";

import React, { useMemo } from "react";
import JsxParser from "react-jsx-parser";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  Filler,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import type { Block } from "@/app/actions/block";
import type { ChartBlockContent } from "@/types/chart";
import { cn } from "@/lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  Filler
);

interface ChartBlockProps {
  block: Block;
  className?: string;
}

function normalizeJsx(code: string) {
  let cleaned = code.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "");
    cleaned = cleaned.replace(/```$/, "");
  }

  cleaned = cleaned.replace(/^\s*import .*$/gm, "");
  cleaned = cleaned.replace(/^\s*export default .*$/gm, "");

  const returnMatch = cleaned.match(/return\s*\((([\s\S]*))\)\s*;?/);
  if (returnMatch && returnMatch[1]) {
    cleaned = returnMatch[1].trim();
  }

  return cleaned.trim();
}

export default function ChartBlock({ block, className }: ChartBlockProps) {
  const content = (block.content || {}) as ChartBlockContent;
  const code = typeof content.code === "string" ? content.code : "";
  const isSimulation = Boolean(content.metadata?.isSimulation);

  const jsx = useMemo(() => normalizeJsx(code), [code]);
  const chartComponents: Record<string, React.ComponentType<any>> = {
    Bar: Bar as unknown as React.ComponentType<any>,
    Line: Line as unknown as React.ComponentType<any>,
    Pie: Pie as unknown as React.ComponentType<any>,
    Doughnut: Doughnut as unknown as React.ComponentType<any>,
  };

  if (!jsx) {
    return (
      <div className={cn("text-sm text-[var(--muted-foreground)]", className)}>
        Chart unavailable.
      </div>
    );
  }

  return (
    <div className={cn("relative", isSimulation && "rounded-lg ring-1 ring-[var(--warning)]/25", className)}>
      {isSimulation && (
        <div className="absolute right-2 top-2 z-10 rounded-full border border-[var(--warning)]/30 bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]">
          Simulation
        </div>
      )}
      <JsxParser
        jsx={jsx}
        components={chartComponents as any}
        blacklistedTags={["script", "style", "iframe", "object"]}
        blacklistedAttrs={[
          "onClick",
          "onMouseOver",
          "onMouseEnter",
          "onMouseLeave",
          "onMouseMove",
          "onKeyDown",
          "onKeyUp",
          "onSubmit",
          "dangerouslySetInnerHTML",
        ]}
        renderError={(error) => (
          <div className="text-sm text-[var(--error)]">
            Failed to render chart: {String(error)}
          </div>
        )}
      />
    </div>
  );
}
