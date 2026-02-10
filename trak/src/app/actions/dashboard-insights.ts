"use server";

import { executeAICommand, type ExecutionContext } from "@/lib/ai/executor";
import { getServerUser } from "@/lib/auth/get-server-user";
import { revalidatePath } from "next/cache";

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
// AI PROMPT TEMPLATE
// ============================================================================

function getDashboardInsightsPrompt(currentDate: string): string {
  return `You are generating a daily workspace overview for a project management dashboard.

Current date: ${currentDate}

CRITICAL REQUIREMENT: You MUST use the search tools to gather REAL data from the workspace. DO NOT generate generic or hypothetical insights. Only report what you actually find in the workspace data.

REQUIRED STEPS - Follow this process:
1. FIRST: Call searchTimelineEvents with end_date filter to find overdue items (end_date < ${currentDate})
2. THEN: Call searchTimelineEvents with end_date filter to find items due today (end_date = ${currentDate})
3. THEN: Call searchTasks with status filters to find blocked tasks (status = "blocked")
4. THEN: Call searchTasks with priority filters to find high/urgent priority items
5. THEN: Call searchProjects to check active project statuses
6. OPTIONALLY: Call searchTableRows if you need to check data in tables

After gathering data, provide a concise overview with these sections:

1. **Summary** (2-3 sentences): Based on ACTUAL data you found, describe workspace status
2. **Top Priorities** (3-5 bullet points): SPECIFIC items from search results that need attention TODAY
3. **Action Items** (3-5 specific tasks): REAL tasks/events from search results with actual assignee names
4. **Blockers & Risks** (0-3 items): ACTUAL blocked items or overdue tasks from search results

Guidelines:
- Use SPECIFIC names, titles, and details from the search results
- If you find 0 overdue items, say "No overdue items"
- If you find 0 blocked tasks, say "No blockers identified" or leave blockers array empty
- Prioritize: overdue > due today > high priority > medium priority
- Include assignee names from the actual data (e.g., "John needs to complete X")
- DO NOT make up project names, task names, or generic suggestions
- If workspace is truly empty, say so clearly

CRITICAL: Format your response as valid JSON only, with no markdown or extra text:
{
  "summary": "string (2-3 sentences based on ACTUAL search results)",
  "priorities": ["specific item from search results", "another specific item", "..."],
  "actionItems": ["specific task with assignee from results", "another specific action", "..."],
  "blockers": ["specific blocker from search results", "..."] or []
}`;
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

    // Generate current date for prompt
    const currentDate = new Date().toISOString().split("T")[0];
    const prompt = getDashboardInsightsPrompt(currentDate);

    // Execute AI command with specialized prompt
    const result = await executeAICommand(
      prompt,
      context,
      [], // Empty conversation history for fresh insights
      {
        readOnly: true,
        forcedToolGroups: ["core", "task", "project", "timeline", "table", "workspace"],
        disableOptimisticEarlyExit: false,
      }
    );

    if (!result.success || !result.response) {
      return {
        data: null,
        error: result.error || "AI generation failed",
      };
    }

    // Validate that AI actually used search tools (not just hallucinating)
    const toolsCalled = result.toolCallsMade.map((t) => t.tool);
    const hasSearchTools = toolsCalled.some((tool) =>
      tool.startsWith("search") || tool === "unstructuredSearchWorkspace"
    );

    if (!hasSearchTools) {
      console.error("AI did not use any search tools. Tools called:", toolsCalled);
      return {
        data: null,
        error: "AI failed to search workspace data",
      };
    }

    // Parse AI response
    let insights: Omit<DashboardInsight, "generatedAt">;
    try {
      insights = parseAIResponse(result.response);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Raw response:", result.response);
      return {
        data: null,
        error: "Failed to parse AI response",
      };
    }

    // Extract metadata from tool calls
    const metadata = {
      toolsUsed: result.toolCallsMade.map((t) => t.tool),
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
