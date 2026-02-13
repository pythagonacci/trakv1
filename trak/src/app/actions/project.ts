'use server'

import { revalidatePath } from 'next/cache'
import { getServerUser } from '@/lib/auth/get-server-user'
import { safeRevalidatePath } from './workspace'
import type { AuthContext } from '@/lib/auth-context'
import { createTab } from './tab'
import { createBlock } from './block'
import type { BlockType } from './block';

// Type for project status
type ProjectStatus = 'not_started' | 'in_progress' | 'complete'

// Type for project type
type ProjectType = 'project' | 'internal'

// Type for project data
type ProjectData = {
  name: string
  project_type?: ProjectType
  client_id?: string | null
  client_name?: string  // For creating new clients on the fly
  status?: ProjectStatus
  due_date_date?: string | null  // ISO date string
  due_date_text?: string | null
  member_ids?: string[] | 'all'  // Project permissions: 'all' or array of user IDs
}

// Type for project filters
type ProjectFilters = {
  project_type?: ProjectType;
  status?: ProjectStatus;
  client_id?: string;
  search?: string; // NEW: Search by project name or client name
  sort_by?: "created_at" | "updated_at" | "due_date_date" | "name";
  sort_order?: "asc" | "desc";
};

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  due_date_date: string | null;
  due_date_text: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  client: {
    id: string;
    name: string | null;
    company?: string | null;
  } | null;
};

type BlockPreviewPayload = {
  summary: string;
  detailLines?: string[];
  meta?: string;
};

type TabPreviewBlock = {
  id: string;
  type: BlockType;
  column: number | null;
  position: number | null;
  summary: string;
  detailLines?: string[];
  meta?: string;
};

export type ProjectFirstTabPreview = {
  tab_id: string;
  tab_name: string;
  blocks: TabPreviewBlock[];
};

type ProjectWithPreview = ProjectRow & {
  first_tab_preview?: ProjectFirstTabPreview | null;
};

type ProjectQueryOptions = {
  includeFirstTabPreview?: boolean;
};

type PreviewContext = {
  pdfFileNames?: Map<string, string>;
  taskItemsByBlock?: Map<string, Array<{ id: string; title: string; status: string }>>;
};

function truncatePreviewText(input?: string | null, maxLength: number = 80) {
  if (!input) return "";
  const clean = input.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1)}…`;
}

function getTitle(input?: unknown) {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
}

function extractPlainTextLines(text: string | undefined, maxLines = 3) {
  if (!text) return [];
  const normalized = text
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#+\s/g, "")
    .replace(/[-+] /g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return normalized.slice(0, maxLines);
}

function summarizeBlockPreview(
  block: { type: BlockType; content?: Record<string, any> | null },
  context: PreviewContext = {}
): BlockPreviewPayload {
  const content = (block.content ?? {}) as Record<string, any>;

  switch (block.type) {
    case "text": {
      const lines = extractPlainTextLines(content.text, 3);
      return {
        summary: lines[0] || "Empty text block",
        detailLines: lines.slice(1),
      };
    }
    case "task": {
      const taskItems = context.taskItemsByBlock?.get((block as any).id) || [];
      const tasks = taskItems.length > 0 ? taskItems : (Array.isArray(content.tasks) ? content.tasks : []);
      const completed = tasks.filter(
        (task: any) => task.completed || task.done || task.status === "done"
      ).length;
      const title = getTitle(content.title);
      const detailLines: string[] = [];
      if (tasks.length) {
        detailLines.push(`${completed}/${tasks.length} tasks done`);
      } else {
        detailLines.push("No tasks yet");
      }
      detailLines.push(
        ...tasks.slice(0, 3).map((task: any) => {
          const label = task.title || task.text || "Untitled task";
          const icon = task.completed || task.done || task.status === "done" ? "✓" : "•";
          return `${icon} ${label}`;
        })
      );

      return {
        summary: title || (tasks.length ? "Task list" : "Tasks"),
        detailLines,
      };
    }
    case "link":
      return {
        summary: truncatePreviewText(content.title || content.url, 80) || "Link",
        detailLines: content.description ? [truncatePreviewText(content.description, 90)] : undefined,
        meta: content.url ? truncatePreviewText(content.url, 90) : undefined,
      };
    case "divider":
      return { summary: "Divider" };
    case "table": {
      const title = getTitle(content.title);
      const rows =
        typeof content.rows === "number"
          ? content.rows
          : Array.isArray(content.cells)
          ? content.cells.length
          : undefined;
      const cols =
        typeof content.cols === "number"
          ? content.cols
          : Array.isArray(content.cells) && Array.isArray(content.cells[0])
          ? content.cells[0].length
          : undefined;
      const firstRow =
        Array.isArray(content.cells) && Array.isArray(content.cells[0])
          ? content.cells[0].slice(0, 3).map((cell: string) => truncatePreviewText(cell, 30))
          : null;
      return {
        summary: title || (rows && cols ? `${rows}×${cols} table` : "Table"),
        detailLines: [
          ...(rows && cols ? [`${rows} rows · ${cols} columns`] : []),
          ...(firstRow ? [`Row 1: ${firstRow.join(" | ")}`] : []),
        ],
      };
    }
    case "chart": {
      const title = getTitle(content.title);
      const chartType = typeof content.chartType === "string" ? content.chartType : "chart";
      const detailLines: string[] = [];
      if (content.metadata?.isSimulation) detailLines.push("Simulation");
      return {
        summary: title || `${chartType} chart`,
        detailLines: detailLines.length ? detailLines : undefined,
      };
    }
    case "timeline": {
      const events = Array.isArray(content.events) ? content.events.length : 0;
      const title = getTitle(content.title);
      const eventLines =
        events && Array.isArray(content.events)
          ? content.events.slice(0, 3).map((event: any) => truncatePreviewText(event.title || event.name || "Untitled event"))
          : [];
      return {
        summary: title || "Timeline",
        detailLines: [
          events ? `${events} scheduled` : "No events yet",
          ...eventLines,
        ].filter(Boolean) as string[],
      };
    }
    case "file": {
      const files = Array.isArray(content.files) ? content.files.length : 0;
      const detailLines = content.files
        ? content.files.slice(0, 3).map((file: any) => file.name || file.fileName || "Attachment")
        : undefined;
      return {
        summary: files ? `${files} file${files === 1 ? "" : "s"}` : "File block",
        detailLines,
      };
    }
    case "video":
      return {
        summary: content.caption || "Video",
        meta: content.url || content.provider || undefined,
      };
    case "image":
      return {
        summary: content.caption || "Image",
        meta: content.alt || undefined,
      };
    case "gallery": {
      const items = Array.isArray(content.items) ? content.items : [];
      const withImages = items.filter((item: any) => item?.fileId).length;
      const layout = typeof content.layout === "string" ? content.layout : undefined;
      const detailLines = items.length
        ? [`${withImages}/${items.length} images`]
        : ["No images yet"];
      return {
        summary: layout ? `Gallery ${layout}` : "Gallery",
        detailLines,
      };
    }
    case "embed":
      return {
        summary: truncatePreviewText(content.title || content.url, 70) || "Embed",
        meta: content.url || undefined,
      };
    case "pdf": {
      const fileId = typeof content.fileId === "string" ? content.fileId : undefined;
      const fileName = fileId ? context.pdfFileNames?.get(fileId) : undefined;
      const summary = truncatePreviewText(content.title || fileName || content.fileName, 90) || "PDF";
      return {
        summary,
        meta: fileName && summary !== fileName ? fileName : undefined,
      };
    }
    case "section":
      return {
        summary: content.title || "Section",
        detailLines: content.description ? [truncatePreviewText(content.description, 80)] : undefined,
      };
    case "doc_reference":
      return {
        summary: content.docTitle || content.title || "Linked document",
        detailLines: content.description ? [truncatePreviewText(content.description, 80)] : undefined,
      };
    default:
      return { summary: String(block.type).replace(/_/g, " ") };
  }
}

// 1. CREATE PROJECT
export async function createProject(workspaceId: string, projectData: ProjectData, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  let userId: string
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
    userId = opts.authContext.userId
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
    userId = authResult.user.id
  }

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to create projects' }
  }

  let finalClientId = projectData.client_id;

  // If client_name is provided (new client), create it first
  if (projectData.client_name && !projectData.client_id) {
    const { data: newClient, error: clientCreateError } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId,
        name: projectData.client_name.trim(),
      })
      .select('id')
      .single();

    if (clientCreateError) {
      return { error: `Failed to create client: ${clientCreateError.message}` };
    }

    finalClientId = newClient.id;
  }
  // If client_id is provided, verify it belongs to the same workspace
  else if (finalClientId) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('id', finalClientId)
      .single()

    if (clientError) {
      return { error: 'Client not found' }
    }

    if (client.workspace_id !== workspaceId) {
      return { error: 'Client does not belong to this workspace' }
    }
  }

  // Create the project
  const { data: project, error: createError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: projectData.name,
      project_type: projectData.project_type || 'project',
      client_id: finalClientId || null,
      status: projectData.status || 'not_started',
      due_date_date: projectData.due_date_date || null,
      due_date_text: projectData.due_date_text || null
    })
    .select('*, client:clients(name)')
    .single()

  if (createError) {
    return { error: createError.message }
  }

  // Automatically create a default tab named "Untitled"
  const tabResult = await createTab({
    projectId: project.id,
    name: "Untitled",
  });

  if (tabResult.error) {
    // Log error but don't fail project creation if tab creation fails
    console.error("Failed to create default tab:", tabResult.error);
  }

  // Handle project permissions
  if (projectData.member_ids && projectData.member_ids !== 'all') {
    // Auto-include the project creator if not already included
    const memberIdsToAssign = new Set(projectData.member_ids);
    memberIdsToAssign.add(userId);
    const memberIdsArray = Array.from(memberIdsToAssign);

    // Validate that all member_ids are workspace members
    const { data: validMembers } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .in('user_id', memberIdsArray);

    const validUserIds = validMembers?.map(m => m.user_id) || [];

    if (validUserIds.length > 0) {
      // Insert project members
      const projectMembersToInsert = validUserIds.map(uid => ({
        project_id: project.id,
        user_id: uid,
        added_by: userId
      }));

      const { error: membersError } = await supabase
        .from('project_members')
        .insert(projectMembersToInsert);

      if (membersError) {
        console.error('Failed to add project members:', membersError);
        // Don't fail project creation, just log the error
      }
    }
  }
  // If member_ids === 'all' or undefined, don't insert any rows (= accessible to all)

  await safeRevalidatePath('/dashboard')
  return { data: project }
}

/**
 * Create a project from a Shopify product. The project name is the product title,
 * and the first tab (non-overview) gets a shopify_product block rendering that product.
 */
export async function createProjectFromProduct(
  workspaceId: string,
  productId: string,
  opts?: { authContext?: AuthContext }
) {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  let userId: string
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
    userId = opts.authContext.userId
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
    userId = authResult.user.id
  }

  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to create projects' }
  }

  const { data: product, error: productError } = await supabase
    .from('trak_products')
    .select('id, title')
    .eq('id', productId)
    .single()

  if (productError || !product) {
    return { error: 'Product not found' }
  }

  const projectName = (product.title && String(product.title).trim()) || 'Untitled Project'
  const createResult = await createProject(
    workspaceId,
    {
      name: projectName,
      status: 'not_started',
    },
    { authContext: { supabase, userId } }
  )

  if (createResult.error) {
    return { error: createResult.error }
  }

  const project = createResult.data as { id: string }

  const { data: firstTab, error: tabError } = await supabase
    .from('tabs')
    .select('id')
    .eq('project_id', project.id)
    .is('parent_tab_id', null)
    .order('position', { ascending: true })
    .limit(1)
    .single()

  if (tabError || !firstTab) {
    return { data: { projectId: project.id, tabId: null } }
  }

  const blockResult = await createBlock({
    tabId: firstTab.id,
    type: 'shopify_product',
    content: { product_id: productId },
    authContext: { supabase, userId },
  })

  if (blockResult.error) {
    console.error('Failed to add product block to tab:', blockResult.error)
  }

  return { data: { projectId: project.id, tabId: firstTab.id } }
}

/**
 * Get or create a default "Files" internal space for standalone file uploads
 */
export async function getOrCreateFilesSpace(workspaceId: string) {
  const authResult = await getServerUser();

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' };
  }
  const { supabase, user } = authResult;

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError || !membership) {
    return { error: 'You must be a workspace member' };
  }

  // Try to find existing "Files" space
  const { data: existingSpace, error: findError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('project_type', 'internal')
    .eq('name', 'Files')
    .maybeSingle();

  if (findError) {
    console.error('Error finding Files space:', findError);
    // Continue to create new space
  }

  if (existingSpace) {
    return { data: existingSpace };
  }

  // Create "Files" space if it doesn't exist
  const { data: newSpace, error: createError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: 'Files',
      project_type: 'internal',
      status: 'in_progress',
    })
    .select('id, name')
    .single();

  if (createError) {
    console.error('Error creating Files space:', createError);
    return { error: createError.message };
  }

  // Create a default tab for the Files space
  const { error: tabError } = await supabase
    .from('tabs')
    .insert({
      project_id: newSpace.id,
      name: 'All Files',
      position: 0,
    });

  if (tabError) {
    console.error('Failed to create default tab for Files space:', tabError);
    // Still return the space even if tab creation fails
  }

  await safeRevalidatePath('/dashboard/internal');
  return { data: newSpace };
}

// 2. GET ALL PROJECTS (with filters and search) - OPTIMIZED
export async function getAllProjects(
  workspaceId: string,
  filters?: ProjectFilters,
  options?: ProjectQueryOptions
) {
  const authResult = await getServerUser()
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return { error: 'You must be a workspace member to view projects' }
  }

  // 🚀 Build optimized query - select only needed fields
  let query = supabase
    .from('projects')
    .select(`
      id,
      name,
      status,
      due_date_date,
      due_date_text,
      client_id,
      folder_id,
      created_at,
      updated_at,
      client:clients (
        id,
        name,
        company
      )
    `)
    .eq('workspace_id', workspaceId)

  // Apply project type filter (defaults to 'project' if not specified)
  if (filters?.project_type !== undefined) {
    query = query.eq('project_type', filters.project_type)
  } else {
    query = query.eq('project_type', 'project')
  }

  // Apply status filter
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  // Apply client filter
  if (filters?.client_id) {
    query = query.eq('client_id', filters.client_id)
  }

  // 🚀 Optimized search - use OR clause in database, not post-fetch filtering
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,client.name.ilike.%${filters.search}%,client.company.ilike.%${filters.search}%`)
  }

  // Apply sorting
  const sortBy = filters?.sort_by || 'created_at'
  const sortOrder = filters?.sort_order || 'desc'
  
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })
  
  // 🚀 Limit results for faster loading (add pagination later if needed)
  query = query.limit(100)

  const { data: projects, error: fetchError } = await query

  if (fetchError) {
    return { error: fetchError.message }
  }

  const normalizedProjects: ProjectRow[] = (projects || []).map((project: any) => {
    const rawClient = Array.isArray(project.client) ? project.client[0] : project.client;
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      due_date_date: project.due_date_date,
      due_date_text: project.due_date_text,
      client_id: project.client_id,
      created_at: project.created_at,
      updated_at: project.updated_at,
      client: rawClient
        ? {
            id: rawClient.id,
            name: rawClient.name ?? null,
            company: rawClient.company ?? null,
          }
        : null,
    };
  });

  let enrichedProjects = normalizedProjects

  if (options?.includeFirstTabPreview && enrichedProjects.length > 0) {
    try {
      const projectIds = enrichedProjects.map((project) => project.id)
      const { data: tabs, error: tabsError } = await supabase
        .from('tabs')
        .select('id, project_id, name, position, parent_tab_id')
        .in('project_id', projectIds)
        .is('parent_tab_id', null)
        .order('project_id', { ascending: true })
        .order('position', { ascending: true })

      if (tabsError) {
        console.error('Failed to fetch tabs for previews:', tabsError)
      } else {
        const firstTabByProject = new Map<string, { id: string; name: string }>()
        tabs?.forEach((tab) => {
          if (!firstTabByProject.has(tab.project_id)) {
            firstTabByProject.set(tab.project_id, { id: tab.id, name: tab.name })
          }
        })

        const tabIds = Array.from(firstTabByProject.values()).map((tab) => tab.id)
        const previewBlocksByTab = new Map<string, TabPreviewBlock[]>()

        if (tabIds.length > 0) {
          // Note: Fetches full content JSONB - could be optimized by only selecting specific keys
          // but summarizeBlockPreview() needs the full content object structure
          const { data: blocks, error: blocksError } = await supabase
            .from('blocks')
            .select('id, tab_id, type, content, column, position, parent_block_id')
            .in('tab_id', tabIds)
            .is('parent_block_id', null)
            .lte('position', 3)
            .order('column', { ascending: true })
            .order('position', { ascending: true })

          if (blocksError) {
            console.error('Failed to fetch block previews:', blocksError)
          } else if (blocks && blocks.length > 0) {
            const pdfFileIds = Array.from(
              new Set(
                blocks
                  .filter((block) => block.type === 'pdf')
                  .map((block) => {
                    const content = (block.content ?? {}) as Record<string, any>;
                    const fileId = content?.fileId;
                    return typeof fileId === 'string' ? fileId : null;
                  })
                  .filter((value): value is string => Boolean(value))
              )
            )

            const pdfFileNames = new Map<string, string>()
            if (pdfFileIds.length > 0) {
              const { data: pdfFiles, error: pdfError } = await supabase
                .from('files')
                .select('id, file_name')
                .in('id', pdfFileIds)

              if (pdfError) {
                console.error('Failed to fetch pdf filenames for previews:', pdfError)
              } else {
                pdfFiles?.forEach((file) => {
                  if (file?.id && file?.file_name) {
                    pdfFileNames.set(file.id, file.file_name)
                  }
                })
              }
            }

            const taskBlockIds = blocks
              .filter((block) => block.type === 'task')
              .map((block) => block.id)
            const taskItemsByBlock = new Map<string, Array<{ id: string; title: string; status: string }>>()

            if (taskBlockIds.length > 0) {
              const { data: taskItems, error: taskError } = await supabase
                .from('task_items')
                .select('id, title, status, task_block_id, display_order')
                .in('task_block_id', taskBlockIds)
                .order('display_order', { ascending: true })

              if (taskError) {
                console.error('Failed to fetch task previews:', taskError)
              } else {
                taskItems?.forEach((task) => {
                  const list = taskItemsByBlock.get(task.task_block_id) || []
                  list.push({ id: task.id, title: task.title, status: task.status })
                  taskItemsByBlock.set(task.task_block_id, list)
                })
              }
            }

            blocks.forEach((block) => {
              const preview = summarizeBlockPreview(block as any, { pdfFileNames, taskItemsByBlock })
              const previewEntry: TabPreviewBlock = {
                id: block.id,
                type: block.type as BlockType,
                column: block.column,
                position: block.position,
                summary: preview.summary || block.type,
                detailLines: preview.detailLines,
                meta: preview.meta,
              }

              const existing = previewBlocksByTab.get(block.tab_id) || []
              if (existing.length < 6) {
                existing.push(previewEntry)
                previewBlocksByTab.set(block.tab_id, existing)
              }
            })
          }
        }

        enrichedProjects = enrichedProjects.map((project) => {
          const firstTab = firstTabByProject.get(project.id)
          if (!firstTab) {
            return { ...project, first_tab_preview: null }
          }

          return {
            ...project,
            first_tab_preview: {
              tab_id: firstTab.id,
              tab_name: firstTab.name,
              blocks: previewBlocksByTab.get(firstTab.id) || [],
            },
          }
        })
      }
    } catch (error) {
      console.error('Failed to build project previews:', error)
    }
  }

  return { data: enrichedProjects as ProjectWithPreview[] }
}

// 3. GET SINGLE PROJECT (with full details)
export async function getSingleProject(projectId: string) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get project with workspace and client info
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select(`
      *,
      workspace:workspaces (
        id,
        name
      ),
      client:clients (
        id,
        name,
        company,
        email
      )
    `)
    .eq('id', projectId)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  // Check if user is a member of the project's workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to view this project' }
  }

  return { data: project }
}

// 4. UPDATE PROJECT
export async function updateProject(projectId: string, updates: Partial<ProjectData>, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  let userId: string
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
    userId = opts.authContext.userId
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
    userId = authResult.user.id
  }

  // Get project to find workspace_id
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('workspace_id, client_id')
    .eq('id', projectId)
    .single()

  if (fetchError) {
    return { error: 'Project not found' }
  }

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to update projects' }
  }

  // If updating client_id, verify it belongs to the same workspace
  if (updates.client_id !== undefined && updates.client_id !== null) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('id', updates.client_id)
      .single()

    if (clientError) {
      return { error: 'Client not found' }
    }

    if (client.workspace_id !== project.workspace_id) {
      return { error: 'Client does not belong to this workspace' }
    }
  }

  // Update the project (including updated_at)
  const { data: updatedProject, error: updateError } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single()

  if (updateError) {
    return { error: updateError.message }
  }

  await safeRevalidatePath('/dashboard')
  return { data: updatedProject }
}

// 5. DELETE PROJECT
export async function deleteProject(projectId: string, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  let userId: string
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
    userId = opts.authContext.userId
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
    userId = authResult.user.id
  }

  // Get project to find workspace_id
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .single()

  if (fetchError) {
    return { error: 'Project not found' }
  }

  // Check if user is admin or owner of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'Unauthorized' }
  }

  if (membership.role !== 'admin' && membership.role !== 'owner') {
    return { error: 'Only admins and owners can delete projects' }
  }

  // TODO: In future tasks, check for dependencies (tasks, files, etc.)
  // For now, we'll just delete the project

  // Delete the project
  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  await safeRevalidatePath('/dashboard')
  return { data: { success: true, message: 'Project deleted successfully' } }
}
