"use client";

import { useMemo, useState } from "react";
import ClientPageContent from "@/app/client/[publicToken]/client-page-content";
import type { Block } from "@/app/actions/block";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "workouts", label: "Programming" },
  { id: "nutrition", label: "Nutrition" },
  { id: "checkins", label: "Check-ins" },
  { id: "habits", label: "Habits" },
  { id: "library", label: "Content Library" },
] as const;

const MOCK_DATE = "2024-05-01T00:00:00.000Z";

const createBaseBlock = (
  id: string,
  tabId: string,
  type: Block["type"],
  position: number,
  column = 0,
  content: Record<string, any> = {}
): Block => ({
  id,
  tab_id: tabId,
  parent_block_id: null,
  type,
  content,
  position,
  column,
  is_template: false,
  template_name: null,
  original_block_id: null,
  created_at: MOCK_DATE,
  updated_at: MOCK_DATE,
});

const createTextBlock = (
  id: string,
  tabId: string,
  text: string,
  position: number,
  column = 0
) =>
  createBaseBlock(id, tabId, "text", position, column, {
    text,
  });

const createTableBlock = (
  id: string,
  tabId: string,
  title: string,
  headers: string[],
  rows: string[][],
  position: number,
  column = 0
) =>
  createBaseBlock(id, tabId, "table", position, column, {
    title,
    rows: rows.length + 1,
    cols: headers.length,
    cells: [headers, ...rows],
    columns: headers.map((header) => ({ type: "text", name: header })),
  });

const OVERVIEW_BLOCKS = (tabId: string): Block[] => [
  createTextBlock(
    "overview-focus",
    tabId,
    `## Week 4 focus
• Tempo front squats + 10 min Zone 2 finisher on lower days
• Travel tag triggers hotel template + grocery list auto-send
• Two late nights = bedtime routine + breath audio`,
    0,
    0
  ),
  createTextBlock(
    "overview-metrics",
    tabId,
    `## Metrics snapshot
• Weight change: **-5.8 lb** (goal: -12 lb)
• Training compliance: **92%** (23 / 25 sessions)
• Macro accuracy: **87%** (average 2 deviations)
• Recovery score: **78** (HRV trending +6 ms)`,
    0,
    1
  ),
  createTextBlock(
    "overview-guardrails",
    tabId,
    `## Automations keeping him honest
• Travel calendar events swap workouts + send adjusted macros
• If macros unlogged by 8pm → SMS nudge with pre-tracked meal
• Late-night Slack detected → trigger bedtime cue + breath reset`,
    1,
    0
  ),
];

const WORKOUT_BLOCKS = (tabId: string): Block[] => [
  createTableBlock(
    "workouts-weekly-split",
    tabId,
    "Weekly split",
    ["Day", "Focus", "Status"],
    [
      ["Mon", "Lower strength + finisher", "Logged"],
      ["Tue", "Upper push/pull", "Logged"],
      ["Wed", "Zone 2 + mobility", "Scheduled"],
      ["Thu", "Lower power", "Upcoming"],
      ["Fri", "Full body conditioning", "Upcoming"],
      ["Sat", "Outdoor steps + yoga", "Restorative"],
      ["Sun", "Reset + prep", "Rest"],
    ],
    0,
    0
  ),
  createTextBlock(
    "workouts-conditioning",
    tabId,
    `## Conditioning anchors
• 45 min Zone 2 bike @ 130–140 bpm (Wednesday)
• EMOM 20 min row / burpees / sit-ups (Thursday)
• 10k steps + yoga flow (Saturday)`,
    1,
    0
  ),
];

const NUTRITION_BLOCKS = (tabId: string): Block[] => [
  createTextBlock(
    "nutrition-targets",
    tabId,
    `## Macro targets
**Training days** → 2200 cals · 190P / 200C / 60F
**Rest days** → 2050 cals · 190P / 150C / 70F

Fiber 28g · Sodium &lt; 2300mg · Water 120oz · Creatine 5g · Fish oil 2g`,
    0,
    0
  ),
  createTableBlock(
    "nutrition-log",
    tabId,
    "Weekly macro log",
    ["Day", "Calories", "Protein", "Carbs", "Fat", "Accuracy"],
    [
      ["Mon", "2150", "190g", "195g", "65g", "92%"],
      ["Tue", "2085", "185g", "178g", "68g", "89%"],
      ["Wed", "2280", "170g", "250g", "60g", "78%"],
      ["Thu", "2110", "190g", "182g", "64g", "91%"],
    ],
    1,
    0
  ),
];

const CHECKIN_BLOCKS = (tabId: string): Block[] => [
  createTextBlock(
    "checkin-may-06",
    tabId,
    `## May 6 · 188.2 lb · Readiness 82
Travel bloat gone; carbs timed around AM lifts.

### Focus
• Add 10 min Zone 2 finisher post lower days
• Keep sodium moderate on Fridays
• Sauna + breath reset Sunday night`,
    0,
    0
  ),
  createTextBlock(
    "checkin-apr-29",
    tabId,
    `## Apr 29 · 190.0 lb · Readiness 75
Sleep wobbled from product launch week.

### Focus
• Protein snack before late calls
• 10:30pm shutdown + hot shower cue
• Breath audio auto-scheduled if Slack after 11pm`,
    1,
    0
  ),
];

const HABIT_BLOCKS = (tabId: string): Block[] => [
  createTableBlock(
    "habits-table",
    tabId,
    "Habit tracking",
    ["Habit", "Streak", "Status"],
    [
      ["Log macros before 8pm", "12 days", "On track"],
      ["8k steps minimum", "8 days", "Needs attention"],
      ["10:30pm lights out", "5 days", "Tightening"],
      ["Morning sunlight", "10 days", "On track"],
    ],
    0,
    0
  ),
  createTextBlock(
    "habits-automation",
    tabId,
    `## Automations
Two missed bedtimes ⇒ auto-send sleep hygiene checklist + breath audio invite.
Travel tag = swap to hotel workouts, send grocery list, adjust macros.`,
    1,
    0
  ),
];

const LIBRARY_BLOCKS = (tabId: string): Block[] => [
  createTableBlock(
    "library-table",
    tabId,
    "Content library",
    ["Asset", "Type", "Usage"],
    [
      ["Lower back priming flow", "Video (6 min)", "Auto linked before heavy lower days"],
      ["High-protein travel guide", "PDF", "Shared before offsites"],
      ["Breath reset audio", "Audio (4 min)", "Triggered after late calls"],
      ["Hotel gym template", "Doc", "Assigned when travel tag on"],
    ],
    0,
    0
  ),
];

const TAB_BLOCK_MAP: Record<(typeof TABS)[number]["id"], Block[]> = {
  overview: OVERVIEW_BLOCKS("fitness-overview-tab"),
  workouts: WORKOUT_BLOCKS("fitness-workouts-tab"),
  nutrition: NUTRITION_BLOCKS("fitness-nutrition-tab"),
  checkins: CHECKIN_BLOCKS("fitness-checkins-tab"),
  habits: HABIT_BLOCKS("fitness-habits-tab"),
  library: LIBRARY_BLOCKS("fitness-library-tab"),
};

export default function TabContent() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const blocks = useMemo(() => TAB_BLOCK_MAP[activeTab], [activeTab]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border)]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-[var(--foreground)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <ClientPageContent blocks={blocks} publicToken="mock-fitness" allowComments={false} />
    </div>
  );
}
