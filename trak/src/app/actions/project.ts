'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cache } from 'react'
import { createTab } from './tab'

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
}

// Type for project filters
type ProjectFilters = {
  project_type?: ProjectType
  status?: ProjectStatus
  client_id?: string
  search?: string  // NEW: Search by project name or client name
  sort_by?: 'created_at' | 'updated_at' | 'due_date_date' | 'name'
  sort_order?: 'asc' | 'desc'
}

// 1. CREATE PROJECT
export async function createProject(workspaceId: string, projectData: ProjectData) {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
  }

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
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

  revalidatePath('/dashboard')
  return { data: project }
}

// 🚀 Cached auth check - runs once per request
const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
})

// 🚀 Cached workspace membership check - runs once per request
const checkWorkspaceMembership = cache(async (workspaceId: string, userId: string) => {
  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  return membership
})

// 2. GET ALL PROJECTS (with filters and search) - OPTIMIZED
export async function getAllProjects(workspaceId: string, filters?: ProjectFilters) {
  const supabase = await createClient()

  // 🚀 Use cached auth check
  const user = await getAuthenticatedUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // 🚀 Use cached membership check
  const membership = await checkWorkspaceMembership(workspaceId, user.id)
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

  return { data: projects }
}

// 3. GET SINGLE PROJECT (with full details)
export async function getSingleProject(projectId: string) {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
  }

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
export async function updateProject(projectId: string, updates: Partial<ProjectData>) {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
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
    .eq('user_id', user.id)
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

  revalidatePath('/dashboard')
  return { data: updatedProject }
}

// 5. DELETE PROJECT
export async function deleteProject(projectId: string) {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
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
    .eq('user_id', user.id)
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

  revalidatePath('/dashboard')
  return { data: { success: true, message: 'Project deleted successfully' } }
}