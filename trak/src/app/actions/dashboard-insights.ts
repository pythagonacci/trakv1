"use server";

import { generateCompletion, type ExecutionContext } from "@/lib/ai/executor";
import { getServerUser } from "@/lib/auth/get-server-user";
import { revalidatePath } from "next/cache";
import {
  searchTasks,
  searchTimelineEvents,
  searchProjects,
} from "@/app/actions/ai-search";

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardInsight {
  summary: string;
  priorities: string[];
  actionItems: string[];
  blockers: string[];
  generatedAt: string;
}

interface InsightRecord {
  id: string;
  workspace_id: string;
  generated_at: string;
  content: DashboardInsight;
  metadata?: {
    taskCount?: number;
    overdueCount?: number;
    dueToday?: number;
    toolsUsed?: string[];
  };
  created_at: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CACHE_TTL_HOURS = 6;
const RATE_LIMIT_PER_HOUR = 10;

// ============================================================================
// FIXED DATA GATHERING (same tools every time — no LLM tool-calling, saves tokens)
// ============================================================================

/** Compact shape for LLM summarization; derived from search results. */
export interface DashboardOverviewData {
  currentDate: string;
  overdueEvents: Array<{ title: string; projectName: string; endDate: string; assignee?: string }>;
  dueTodayEvents: Array<{ title: string; projectName: string; endDate: string; assignee?: string }>;
  dueThisWeekEvents: Array<{ title: string; projectName: string; endDate: string; assignee?: string }>;
  tasksDueThisWeek: Array<{ title: string; projectName: string; tabName: string; dueDate?: string; assignee?: string }>;
  blockedTasks: Array<{ title: string; projectName: string; tabName: string; assignee?: string }>;
  highPriorityTasks: Array<{ title: string; projectName: string; tabName: string; priority: string; dueDate?: string; assignee?: string }>;
  activeProjects: Array<{ name: string; status: string }>;
}

/**
 * Run the same fixed set of searches every time. No LLM tool-calling — saves tokens and ensures consistent data.
 */
async function gatherDashboardOverviewData(
  currentDate: string
): Promise<DashboardOverviewData> {
  // Overdue = end_date before today (use lte: yesterday)
  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // This week = tomorrow through today + 7 days (inclusive)
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const endOfWeek = new Date(currentDate);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const endOfWeekStr = endOfWeek.toISOString().split("T")[0];

  const [
    overdueRes,
    dueTodayRes,
    dueThisWeekRes,
    tasksDueThisWeekRes,
    blockedRes,
    highPriorityRes,
    projectsRes,
  ] = await Promise.all([
    searchTimelineEvents({
      endDate: { lte: yesterdayStr },
      limit: 25,
    }),
    searchTimelineEvents({
      endDate: { eq: currentDate },
      limit: 25,
    }),
    searchTimelineEvents({
      endDate: { gte: tomorrowStr, lte: endOfWeekStr },
      limit: 25,
    }),
    searchTasks({
      dueDate: { gte: currentDate, lte: endOfWeekStr },
      status: ["todo", "in_progress", "blocked"],
      limit: 25,
    }),
    searchTasks({
      status: "blocked",
      limit: 15,
    }),
    searchTasks({
      priority: ["high", "urgent"],
      status: ["todo", "in_progress", "blocked"],
      limit: 20,
    }),
    searchProjects({ limit: 15 }),
  ]);

  const taskAssignee = (t: { assignees?: Array<{ name?: string }> }) =>
    t.assignees?.[0]?.name ?? undefined;
  const taskPriority = (t: { priorities?: Array<{ value?: string }> }) =>
    t.priorities?.[0]?.value ?? "high";

  return {
    currentDate,
    overdueEvents: (overdueRes.data ?? []).slice(0, 25).map((e) => ({
      title: e.title ?? "",
      projectName: e.project_name ?? "Unknown",
      endDate: e.end_date ?? "",
      assignee: e.assignee_name ?? undefined,
    })),
    dueTodayEvents: (dueTodayRes.data ?? []).slice(0, 25).map((e) => ({
      title: e.title ?? "",
      projectName: e.project_name ?? "Unknown",
      endDate: e.end_date ?? "",
      assignee: e.assignee_name ?? undefined,
    })),
    dueThisWeekEvents: (dueThisWeekRes.data ?? []).slice(0, 25).map((e) => ({
      title: e.title ?? "",
      projectName: e.project_name ?? "Unknown",
      endDate: e.end_date ?? "",
      assignee: e.assignee_name ?? undefined,
    })),
    tasksDueThisWeek: (tasksDueThisWeekRes.data ?? []).slice(0, 25).map((t) => ({
      title: t.title ?? "",
      projectName: t.project_name ?? "Unknown",
      tabName: t.tab_name ?? "Unknown",
      dueDate: t.due_date ?? undefined,
      assignee: taskAssignee(t),
    })),
    blockedTasks: (blockedRes.data ?? []).slice(0, 15).map((t) => ({
      title: t.title ?? "",
      projectName: t.project_name ?? "Unknown",
      tabName: t.tab_name ?? "Unknown",
      assignee: taskAssignee(t),
    })),
    highPriorityTasks: (highPriorityRes.data ?? []).slice(0, 20).map((t) => ({
      title: t.title ?? "",
      projectName: t.project_name ?? "Unknown",
      tabName: t.tab_name ?? "Unknown",
      priority: taskPriority(t),
      dueDate: t.due_date ?? undefined,
      assignee: taskAssignee(t),
    })),
    activeProjects: (projectsRes.data ?? []).slice(0, 15).map((p) => ({
      name: p.name ?? "",
      status: p.status ?? "",
    })),
  };
}

/** Build the summarization prompt (single LLM call, no tools). */
function getSummarizationPrompt(data: DashboardOverviewData): { system: string; user: string } {
  const system = `You are a workspace overview summarizer. You receive pre-gathered data and output valid JSON only (no markdown, no extra text).`;
  const user = `Today's date: ${data.currentDate}

Data gathered for the workspace:

Overdue timeline events (end_date before today):
${JSON.stringify(data.overdueEvents)}

Due today (timeline events):
${JSON.stringify(data.dueTodayEvents)}

Due this week (timeline events, tomorrow through next 7 days):
${JSON.stringify(data.dueThisWeekEvents)}

Tasks due this week (today through next 7 days):
${JSON.stringify(data.tasksDueThisWeek)}

Blocked tasks:
${JSON.stringify(data.blockedTasks)}

High/urgent priority tasks (not done):
${JSON.stringify(data.highPriorityTasks)}

Active projects:
${JSON.stringify(data.activeProjects)}

From this data only, produce a concise dashboard overview. Prioritize: overdue > due today > due this week > blocked > high priority. Use SPECIFIC names and titles from the data. If a list is empty, say so in the summary and use empty arrays where appropriate.

Output valid JSON only:
{"summary":"2-3 sentences","priorities":["item1","item2"],"actionItems":["action1","action2"],"blockers":["blocker1"]}`;

  return { system, user };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isStale(generatedAt: string): boolean {
  const generated = new Date(generatedAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - generated.getTime()) / (1000 * 60 * 60);
  return hoursDiff > CACHE_TTL_HOURS;
}

function parseAIResponse(response: string): Omit<DashboardInsight, "generatedAt"> {
  // Try to extract JSON from response (in case AI adds markdown or extra text)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : response;

  const parsed = JSON.parse(jsonStr);

  return {
    summary: parsed.summary || "No insights available",
    priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
  };
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Fetch cached dashboard insights from database
 */
export async function getDashboardInsights(
  workspaceId: string
): Promise<{ data: DashboardInsight | null; error?: string }> {
  try {
    const authResult = await getServerUser();
    if (!authResult) {
      return { data: null, error: "Not authenticated" };
    }

    const { supabase } = authResult;

    const { data, error } = await supabase
      .from("dashboard_ai_insights")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();

    if (error) {
      // No cached insights found is not an error
      if (error.code === "PGRST116") {
        return { data: null };
      }
      console.error("Error fetching dashboard insights:", error);
      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: null };
    }

    const record = data as unknown as InsightRecord;

    return {
      data: {
        ...record.content,
        generatedAt: record.generated_at,
      },
    };
  } catch (error) {
    console.error("Error in getDashboardInsights:", error);
    return { data: null, error: String(error) };
  }
}

/**
 * Generate new dashboard insights using AI
 */
export async function generateDashboardInsights(
  context: ExecutionContext,
  options?: { forceRefresh?: boolean }
): Promise<{ data: DashboardInsight | null; error?: string }> {
  try {
    const authResult = await getServerUser();
    if (!authResult) {
      return { data: null, error: "Not authenticated" };
    }

    const { supabase } = authResult;

    // Check if we have recent cached insights and forceRefresh is not set
    if (!options?.forceRefresh) {
      const cached = await getDashboardInsights(context.workspaceId);
      if (cached.data && !isStale(cached.data.generatedAt)) {
        return cached;
      }
    }

    const currentDate = new Date().toISOString().split("T")[0];

    // 1. Fixed data gathering — same searches every time, no LLM tool-calling (saves tokens)
    const overviewData = await gatherDashboardOverviewData(currentDate);
    const { system, user } = getSummarizationPrompt(overviewData);

    // 2. Single LLM call to summarize (no tools)
    const completion = await generateCompletion(
      [{ role: "system", content: system }, { role: "user", content: user }],
      { maxTokens: 1024 }
    );

    if (completion.error || !completion.content) {
      return {
        data: null,
        error: completion.error ?? "AI summarization failed",
      };
    }

    let insights: Omit<DashboardInsight, "generatedAt">;
    try {
      insights = parseAIResponse(completion.content);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Raw response:", completion.content);
      return {
        data: null,
        error: "Failed to parse AI response",
      };
    }

    const metadata = {
      toolsUsed: ["searchTimelineEvents", "searchTasks", "searchProjects"],
    };

    // Store in database (upsert)
    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("dashboard_ai_insights")
      .upsert(
        {
          workspace_id: context.workspaceId,
          generated_at: now,
          content: insights,
          metadata,
        },
        {
          onConflict: "workspace_id",
        }
      );

    if (upsertError) {
      console.error("Error storing insights:", upsertError);
      // Still return insights even if caching fails
    }

    return {
      data: {
        ...insights,
        generatedAt: now,
      },
    };
  } catch (error) {
    console.error("Error in generateDashboardInsights:", error);
    return { data: null, error: String(error) };
  }
}

/**
 * Refresh dashboard insights (force regenerate)
 * Called from client component when user clicks "Regenerate"
 */
export async function refreshDashboardInsights(
  workspaceId: string,
  userId: string,
  userName?: string
): Promise<{ data: DashboardInsight | null; error?: string }> {
  try {
    const authResult = await getServerUser();
    if (!authResult) {
      return { data: null, error: "Not authenticated" };
    }

    // TODO: Add rate limiting check here
    // For now, we'll skip rate limiting to simplify implementation

    const context: ExecutionContext = {
      workspaceId,
      userId,
      userName: userName || "User",
    };

    const result = await generateDashboardInsights(context, {
      forceRefresh: true,
    });

    // Revalidate dashboard page to show updated insights
    revalidatePath("/dashboard");

    return result;
  } catch (error) {
    console.error("Error in refreshDashboardInsights:", error);
    return { data: null, error: String(error) };
  }
}
