'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Type for project status
type ProjectStatus = 'not_started' | 'in_progress' | 'complete'

// Type for project data
type ProjectData = {
  name: string
  client_id?: string | null
  status?: ProjectStatus
  due_date_date?: string | null  // ISO date string
  due_date_text?: string | null
}

// Type for project filters
type ProjectFilters = {
  status?: ProjectStatus
  client_id?: string
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

  // If client_id is provided, verify it belongs to the same workspace
  if (projectData.client_id) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('id', projectData.client_id)
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
      client_id: projectData.client_id || null,
      status: projectData.status || 'not_started',
      due_date_date: projectData.due_date_date || null,
      due_date_text: projectData.due_date_text || null
    })
    .select()
    .single()

  if (createError) {
    return { error: createError.message }
  }

  revalidatePath('/dashboard')
  return { data: project }
}

// 2. GET ALL PROJECTS (with filters)
export async function getAllProjects(workspaceId: string, filters?: ProjectFilters) {
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
    return { error: 'You must be a workspace member to view projects' }
  }

  // Build query
  let query = supabase
    .from('projects')
    .select(`
      *,
      client:clients (
        id,
        name,
        company
      )
    `)
    .eq('workspace_id', workspaceId)

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.client_id) {
    query = query.eq('client_id', filters.client_id)
  }

  // Apply sorting
  const sortBy = filters?.sort_by || 'created_at'
  const sortOrder = filters?.sort_order || 'desc'
  
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

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