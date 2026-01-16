"use server";

import { createClient } from "@/lib/supabase/server";

// ProseMirror node types for search
interface ProseMirrorNode {
  type?: string;
  text?: string;
  content?: ProseMirrorNode[];
}


// Database result types
interface ProjectSearchResult {
  id: string;
  name: string;
  client: { name: string }[] | null;
}

interface DocSearchResult {
  id: string;
  title: string;
  content?: ProseMirrorNode[];
}

interface TabSearchResult {
  id: string;
  name: string;
  project_id: string;
}

interface BlockSearchResult {
  id: string;
  content: Record<string, unknown>;
  tab: TabSearchResult;
}

interface TextBlockSearchResult {
  id: string;
  tab_id: string;
  content: { text?: string } | null;
}

interface WorkspaceProject {
  id: string;
  name: string;
}

import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getAuthenticatedUser } from "@/lib/auth-utils";

export type SearchResultType = "project" | "task" | "doc" | "text_block" | "tab";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  url: string;
  preview?: string;
  highlightedPreview?: string; // HTML with highlighted search terms
  metadata?: Record<string, any>;
}

/**
 * Comprehensive search across all workspace content
 * Searches in:
 * - Projects (by name)
 * - Tasks (by task text in task blocks)
 * - Docs (by title and content)
 * - Text blocks (by content)
 * - Tabs (by name)
 */
export async function searchWorkspaceContent(query: string, limit: number = 20): Promise<{
  data: SearchResult[] | null;
  error: string | null;
}> {
  if (!query || query.trim().length < 2) {
    return { data: [], error: null };
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return { data: null, error: "No workspace selected" };
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return { data: null, error: "Unauthorized" };
  }

  const supabase = await createClient();
  const trimmedQuery = query.trim();
  const searchTerm = `%${trimmedQuery}%`;
  const queryLower = trimmedQuery.toLowerCase();

  try {
    const results: SearchResult[] = [];
    
    // Helper function to extract text from ProseMirror (optimized with early exit)
    const extractProseMirrorText = (node: ProseMirrorNode, maxLength: number = 5000): string => {
      if (!node) return "";
      if (typeof node === "string") return node;
      if (node.type === "text" && node.text) return node.text;
      if (node.text) return node.text;
      
      let text = "";
      if (node.content && Array.isArray(node.content)) {
        for (const child of node.content) {
          text += extractProseMirrorText(child, maxLength - text.length);
          if (text.length >= maxLength) break; // Early exit
        }
      }
      return text;
    };

    // 1. Search Projects
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, client:clients(name)")
      .eq("workspace_id", workspaceId)
      .ilike("name", searchTerm)
      .limit(limit);

    if (!projectsError && projects) {
      projects.forEach((project: ProjectSearchResult) => {
        const client = Array.isArray(project.client) ? project.client[0] : project.client;
        results.push({
          id: project.id,
          type: "project",
          title: project.name,
          subtitle: client?.name ? `Client: ${client.name}` : undefined,
          url: `/dashboard/projects/${project.id}`,
        });
      });
    }

    // 2. Search Docs - optimize by filtering by title first, then checking content
    // First, get docs that match title (database-level filtering is faster)
    const { data: titleMatchingDocs, error: titleError } = await supabase
      .from("docs")
      .select("id, title, content")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false)
      .ilike("title", searchTerm)
      .limit(limit);
    
    // Process title matches immediately
    if (!titleError && titleMatchingDocs) {
      titleMatchingDocs.forEach((doc: DocSearchResult) => {
        results.push({
          id: doc.id,
          type: "doc",
          title: doc.title,
          url: `/dashboard/docs/${doc.id}`,
          preview: doc.title,
        });
      });
    }
    
    // Now search content for docs that don't match title (limit to avoid processing too many)
    const { data: allDocs, error: docsError } = await supabase
      .from("docs")
      .select("id, title, content")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false)
      .limit(100); // Reduced from 500 - only check first 100 for content matches

    if (!docsError && allDocs) {
      // Filter out docs we already added from title search
      const titleMatchIds = new Set(titleMatchingDocs?.map((d: DocSearchResult) => d.id) || []);
      const docsToCheck = allDocs.filter((d: DocSearchResult) => !titleMatchIds.has(d.id));
      
      // Process in batches and stop early if we have enough results
      for (const doc of docsToCheck) {
        if (results.length >= limit) break; // Early exit if we have enough results
        // Extract text from ProseMirror (with limit to avoid processing huge docs)
        const fullText = extractProseMirrorText(doc.content || {}, 2000); // Limit extraction
        const contentMatches = fullText.toLowerCase().includes(queryLower);
        
        // Only process if content matches (title matches already handled)
        if (contentMatches) {
          // Find the matching snippet for preview with highlighting
          let preview = "";
          let highlightedPreview = "";
          let matchedSnippet = "";
          
          if (contentMatches && fullText) {
            const textLower = fullText.toLowerCase();
            const matchIndex = textLower.indexOf(queryLower);
            
            if (matchIndex !== -1) {
              // Find the start of the sentence containing the match
              // Go backwards to find sentence start (period, exclamation, question mark)
              let sentenceStart = matchIndex;
              for (let i = matchIndex - 1; i >= 0; i--) {
                const char = fullText[i];
                const nextChar = i + 1 < fullText.length ? fullText[i + 1] : '';
                // Found sentence boundary
                if ((char === '.' || char === '!' || char === '?') && 
                    (nextChar === ' ' || nextChar === '\n' || nextChar === '' || /[A-Z\u00C0-\u017F]/.test(nextChar))) {
                  sentenceStart = i + 1;
                  break;
                }
                // Stop searching after going back 200 chars to avoid going too far
                if (matchIndex - i > 200) {
                  sentenceStart = Math.max(0, matchIndex - 100);
                  break;
                }
              }
              
              // If we're at the start, use that
              if (sentenceStart === matchIndex) {
                sentenceStart = Math.max(0, matchIndex - 50);
              }
              
              // Find the end of the sentence
              let sentenceEnd = matchIndex + query.length;
              for (let i = matchIndex + query.length; i < fullText.length; i++) {
                const char = fullText[i];
                const nextChar = i + 1 < fullText.length ? fullText[i + 1] : '';
                // Found sentence boundary
                if ((char === '.' || char === '!' || char === '?') && 
                    (nextChar === ' ' || nextChar === '\n' || nextChar === '' || i === fullText.length - 1)) {
                  sentenceEnd = i + 1;
                  break;
                }
                // Stop if we've gone too far (limit to 200 chars after match)
                if (i - (matchIndex + query.length) > 200) {
                  sentenceEnd = Math.min(fullText.length, matchIndex + query.length + 150);
                  break;
                }
              }
              
              // Ensure we always include the match
              if (sentenceEnd < matchIndex + query.length) {
                sentenceEnd = Math.min(fullText.length, matchIndex + query.length + 100);
              }
              
              // Get the sentence containing the match - ensure it includes the search term
              // Make absolutely sure we include the match by using matchIndex directly
              let snippet = fullText.substring(sentenceStart, sentenceEnd);
              
              // CRITICAL: Verify the search term is actually in this snippet
              if (!snippet.toLowerCase().includes(queryLower)) {
                // If the search term isn't in the snippet, use matchIndex directly
                const safeStart = Math.max(0, matchIndex - 50);
                const safeEnd = Math.min(fullText.length, matchIndex + query.trim().length + 150);
                snippet = fullText.substring(safeStart, safeEnd);
              }
              
              // Clean up extra whitespace but preserve the search term
              let cleanSnippet = snippet.replace(/\s+/g, " ").trim();
              
              // Final verification: if search term STILL not there, use direct substring from match
              if (!cleanSnippet.toLowerCase().includes(queryLower)) {
                const directStart = Math.max(0, matchIndex - 50);
                const directEnd = Math.min(fullText.length, matchIndex + query.trim().length + 100);
                cleanSnippet = fullText.substring(directStart, directEnd).replace(/\s+/g, " ").trim();
              }
              
              // Absolute last check - if still missing, something is wrong, use minimal context
              if (!cleanSnippet.toLowerCase().includes(queryLower)) {
                // This should never happen, but just in case
                cleanSnippet = fullText.substring(Math.max(0, matchIndex - 20), Math.min(fullText.length, matchIndex + query.trim().length + 80));
                cleanSnippet = cleanSnippet.replace(/\s+/g, " ").trim();
              }
              
              // Highlight the search term - ensure we're highlighting the actual term
              const highlightTerm = (text: string, term: string): string => {
                const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedTerm})`, 'gi');
                // Use a very visible highlight with yellow background
                return text.replace(regex, '<mark style="background-color: #FEF08A !important; color: #1f1f1f !important; padding: 1px 3px !important; border-radius: 3px !important; font-weight: 600 !important; display: inline !important;">$1</mark>');
              };
              
              // Highlight the search term - make absolutely sure it works
              let highlighted = highlightTerm(cleanSnippet, query.trim());
              
              // Verify highlighting worked by checking for mark tags
              if (!highlighted.includes('<mark')) {
                // Fallback highlighting if regex didn't work
                const term = query.trim();
                highlighted = cleanSnippet.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 
                  (match) => `<mark style="background-color: #FEF08A !important; color: #1f1f1f !important; padding: 1px 3px !important; border-radius: 3px !important; font-weight: 600 !important; display: inline !important;">${match}</mark>`);
              }
              
              matchedSnippet = cleanSnippet;
              highlightedPreview = highlighted;
            }
          }
          
          // If no content match but title matches, show beginning of doc
          if (!matchedSnippet) {
            preview = fullText.substring(0, 150).replace(/\s+/g, " ");
            if (preview && preview.length > 150) {
              preview = preview.substring(0, 150) + "...";
            }
          } else {
            preview = matchedSnippet;
          }

          results.push({
            id: doc.id,
            type: "doc",
            title: doc.title,
            subtitle: contentMatches && matchedSnippet ? undefined : undefined, // Don't show subtitle if we have highlighted preview
            url: `/dashboard/docs/${doc.id}`,
            preview: preview,
            highlightedPreview: contentMatches && highlightedPreview ? highlightedPreview : undefined,
          });
        }
      }
    }

    // 3. Get projects in workspace (limit to reasonable number)
    const { data: workspaceProjects, error: projectsError2 } = await supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .limit(200); // Reduced limit

    if (projectsError2 || !workspaceProjects) {
      // Continue even if this fails
    } else {
      const projectIds = workspaceProjects.map((p: WorkspaceProject) => p.id);
      const projectMap = new Map(workspaceProjects.map((p: WorkspaceProject) => [p.id, p.name]));

      // Get tabs for these projects (limit to reduce processing)
      const { data: tabs, error: tabsError } = await supabase
        .from("tabs")
        .select("id, name, project_id")
        .in("project_id", projectIds)
        .limit(300); // Reduced limit

      if (!tabsError && tabs) {
        const tabIds = tabs.map((t: TabSearchResult) => t.id);
        const tabMap = new Map(tabs.map((t: TabSearchResult) => [t.id, { name: t.name, projectId: t.project_id }]));

        // Search task items (only if we have tabs)
        if (tabIds.length > 0) {
          const { data: taskItems, error: taskItemsError } = await supabase
            .from("task_items")
            .select("id, title, task_block_id, tab_id, project_id")
            .eq("workspace_id", workspaceId)
            .in("tab_id", tabIds)
            .ilike("title", searchTerm)
            .limit(limit);

          if (!taskItemsError && taskItems) {
            taskItems.forEach((task: any) => {
              const tabInfo = task.tab_id ? tabMap.get(task.tab_id) : undefined;
              const projectId = task.project_id || tabInfo?.projectId;
              const projectName = projectId ? projectMap.get(projectId) : null;

              results.push({
                id: task.id,
                type: "task",
                title: task.title,
                subtitle: projectName && tabInfo
                  ? `${projectName} → ${tabInfo.name}`
                  : undefined,
                url: `/dashboard/projects/${projectId || ""}/tabs/${task.tab_id || ""}?task=${task.task_block_id}-${task.id}`,
                preview: task.title.substring(0, 100),
                metadata: {
                  blockId: task.task_block_id,
                  taskId: task.id,
                  projectId: projectId,
                  tabId: task.tab_id,
                },
              });
            });
          }
        }

        // Search text blocks (reduced limit)
        if (tabIds.length > 0) {
          const { data: textBlocks, error: textBlocksError } = await supabase
            .from("blocks")
            .select("id, tab_id, content")
            .eq("type", "text")
            .in("tab_id", tabIds)
            .limit(limit); // Reduced from limit * 2

          const typedTextBlocks = (textBlocks ?? []) as TextBlockSearchResult[];
          if (!textBlocksError && typedTextBlocks.length > 0) {
            typedTextBlocks.forEach((block) => {
              const text = block.content?.text || "";
              if (text.toLowerCase().includes(queryLower)) {
                const tabInfo = tabMap.get(block.tab_id);
                const projectName = tabInfo?.projectId ? projectMap.get(tabInfo.projectId) : null;

                // Extract preview, removing markdown formatting
                const preview = text.replace(/\*\*|\*|`|#|__/g, "").substring(0, 100);

                results.push({
                  id: block.id,
                  type: "text_block",
                  title: preview || "Text block",
                  subtitle: projectName && tabInfo
                    ? `${projectName} → ${tabInfo.name}`
                    : undefined,
                  url: `/dashboard/projects/${tabInfo?.projectId || ""}/tabs/${block.tab_id || ""}`,
                  preview: preview,
                  metadata: {
                    blockId: block.id,
                    projectId: tabInfo?.projectId,
                    tabId: block.tab_id,
                  },
                });
              }
            });
          }
        }

        // Search tabs by name
        tabs.forEach((tab: TabSearchResult) => {
          if (tab.name && tab.name.toLowerCase().includes(queryLower)) {
            const projectName = projectMap.get(tab.project_id);
            results.push({
              id: tab.id,
              type: "tab",
              title: tab.name,
              subtitle: projectName ? `In ${projectName}` : undefined,
              url: `/dashboard/projects/${tab.project_id}/tabs/${tab.id}`,
              metadata: {
                projectId: tab.project_id,
              },
            });
          }
        });
      }
    }

    // Sort results by relevance (exact matches first, then partial)
    results.sort((a, b) => {
      const aTitleLower = a.title.toLowerCase();
      const bTitleLower = b.title.toLowerCase();

      // Exact match at start gets highest priority
      if (aTitleLower.startsWith(queryLower) && !bTitleLower.startsWith(queryLower)) return -1;
      if (!aTitleLower.startsWith(queryLower) && bTitleLower.startsWith(queryLower)) return 1;

      // Then by length (shorter matches might be more relevant)
      return aTitleLower.length - bTitleLower.length;
    });

    // Limit results
    return { data: results.slice(0, limit), error: null };
  } catch (error: unknown) {
    console.error("Search error:", error);
    return { data: null, error: error instanceof Error ? error.message : "Search failed" };
  }
}
