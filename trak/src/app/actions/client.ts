'use server'

import { revalidatePath } from 'next/cache'
import { getServerUser } from '@/lib/auth/get-server-user'

// Type for client data
type ClientData = {
  name: string
  email?: string
  company?: string
  phone?: string
  address?: string
  website?: string
  notes?: string
}

// 1. CREATE CLIENT
export async function createClient(workspaceId: string, clientData: ClientData) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to create clients' }
  }

  // Create the client
  const { data: client, error: createError } = await supabase
    .from('clients')
    .insert({
      workspace_id: workspaceId,
      ...clientData
    })
    .select()
    .single()

  if (createError) {
    return { error: createError.message }
  }

  revalidatePath('/dashboard')
  return { data: client }
}

// 2. GET ALL CLIENTS (with project count) - OPTIMIZED
export async function getAllClients(workspaceId: string) {
  const authResult = await getServerUser()
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // 🚀 Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return { error: 'You must be a workspace member to view clients' }
  }

  // 🚀 Get only essential client fields for dropdown
  const { data: clients, error: fetchError } = await supabase
    .from('clients')
    .select('id, name, company, created_at')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true }) // Alphabetical for better UX

  if (fetchError) {
    return { error: fetchError.message }
  }

  return { data: clients }
}

// 3. GET SINGLE CLIENT (with all projects and stats)
export async function getSingleClient(clientId: string) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get client with workspace info to check membership
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select(`
      *,
      workspace:workspaces (
        id,
        name
      ),
      projects (
        id,
        name,
        status,
        due_date_date,
        due_date_text,
        created_at
      )
    `)
    .eq('id', clientId)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  // Check if user is a member of the client's workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', client.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to view this client' }
  }

  // Calculate project statistics
  const projects = client.projects || []
  const stats = {
    total_projects: projects.length,
    active_projects: projects.filter((p: any) => p.status === 'in_progress').length,
    completed_projects: projects.filter((p: any) => p.status === 'complete').length,
    not_started_projects: projects.filter((p: any) => p.status === 'not_started').length
  }

  return { 
    data: {
      ...client,
      stats
    }
  }
}

// 4. UPDATE CLIENT
export async function updateClient(clientId: string, updates: Partial<ClientData>) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get client to find workspace_id
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('workspace_id')
    .eq('id', clientId)
    .single()

  if (fetchError) {
    return { error: 'Client not found' }
  }

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', client.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to update clients' }
  }

  // Update the client
  const { data: updatedClient, error: updateError } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)
    .select()
    .single()

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard')
  return { data: updatedClient }
}

// 5. DELETE CLIENT
export async function deleteClient(clientId: string) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get client to find workspace_id
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('workspace_id')
    .eq('id', clientId)
    .single()

  if (fetchError) {
    return { error: 'Client not found' }
  }

  // Check if user is admin or owner of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', client.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'Unauthorized' }
  }

  if (membership.role !== 'admin' && membership.role !== 'owner') {
    return { error: 'Only admins and owners can delete clients' }
  }

  // Check if client has any projects
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('client_id', clientId)

  if (projectError) {
    return { error: projectError.message }
  }

  if (projects && projects.length > 0) {
    return { 
      error: `Cannot delete client with ${projects.length} existing project(s). Please delete or reassign projects first.` 
    }
  }

  // Delete the client
  const { error: deleteError } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  revalidatePath('/dashboard')
  return { data: { success: true, message: 'Client deleted successfully' } }
}

// 6. GET CLIENT PROJECTS
export async function getClientProjects(clientId: string) {
  const authResult = await getServerUser()

  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // First verify the client exists and user has access
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('workspace_id')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    return { error: 'Client not found' }
  }

  // Verify user has access to this workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', client.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'Unauthorized' }
  }

  // Get all projects for this client
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, status, due_date_date, due_date_text, created_at, updated_at')
    .eq('client_id', clientId)
    .eq('workspace_id', client.workspace_id)
    .order('created_at', { ascending: false })

  if (projectsError) {
    return { error: projectsError.message }
  }

  return { data: projects || [] }
}
