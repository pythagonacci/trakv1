'use server'

import { revalidatePath } from 'next/cache'
import { getServerUser } from '@/lib/auth/get-server-user'
import { safeRevalidatePath } from './workspace'
import type { AuthContext } from '@/lib/auth-context'

export type ActionResult<T> = { data: T } | { error: string }

export interface ProjectFolder {
  id: string
  workspace_id: string
  name: string
  position: number
  created_at: string
  updated_at: string
}

// 1. CREATE FOLDER
export async function createFolder(
  workspaceId: string,
  name: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<ProjectFolder>> {
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
    return { error: 'You must be a workspace member to create folders' }
  }

  // Get the max position to add new folder at the end
  const { data: maxFolder } = await supabase
    .from('project_folders')
    .select('position')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const newPosition = maxFolder ? maxFolder.position + 1 : 0

  // Create the folder
  const { data: folder, error: createError } = await supabase
    .from('project_folders')
    .insert({
      workspace_id: workspaceId,
      name: name.trim(),
      position: newPosition,
    })
    .select()
    .single()

  if (createError) {
    return { error: createError.message }
  }

  await safeRevalidatePath('/dashboard/projects')
  return { data: folder }
}

// 2. GET ALL FOLDERS
export async function getAllFolders(workspaceId: string): Promise<ActionResult<ProjectFolder[]>> {
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
    return { error: 'You must be a workspace member to view folders' }
  }

  // Get folders ordered by position
  const { data: folders, error: fetchError } = await supabase
    .from('project_folders')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })

  if (fetchError) {
    return { error: fetchError.message }
  }

  return { data: folders || [] }
}

// 3. UPDATE FOLDER
export async function updateFolder(
  folderId: string,
  updates: { name?: string; position?: number },
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<ProjectFolder>> {
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

  // Get folder to check workspace access
  const { data: folder, error: folderError } = await supabase
    .from('project_folders')
    .select('workspace_id')
    .eq('id', folderId)
    .single()

  if (folderError || !folder) {
    return { error: 'Folder not found' }
  }

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', folder.workspace_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return { error: 'You must be a workspace member to update folders' }
  }

  // Update the folder
  const updateData: { name?: string; position?: number; updated_at?: string } = {}
  if (updates.name !== undefined) updateData.name = updates.name.trim()
  if (updates.position !== undefined) updateData.position = updates.position
  updateData.updated_at = new Date().toISOString()

  const { data: updatedFolder, error: updateError } = await supabase
    .from('project_folders')
    .update(updateData)
    .eq('id', folderId)
    .select()
    .single()

  if (updateError) {
    return { error: updateError.message }
  }

  await safeRevalidatePath('/dashboard/projects')
  return { data: updatedFolder }
}

// 4. DELETE FOLDER
export async function deleteFolder(
  folderId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
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

  // Get folder to check workspace access
  const { data: folder, error: folderError } = await supabase
    .from('project_folders')
    .select('workspace_id')
    .eq('id', folderId)
    .single()

  if (folderError || !folder) {
    return { error: 'Folder not found' }
  }

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', folder.workspace_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return { error: 'You must be a workspace member to delete folders' }
  }

  // Delete the folder (projects will have folder_id set to NULL due to ON DELETE SET NULL)
  const { error: deleteError } = await supabase
    .from('project_folders')
    .delete()
    .eq('id', folderId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  await safeRevalidatePath('/dashboard/projects')
  return { data: null }
}

// 5. MOVE PROJECT TO FOLDER
export async function moveProjectToFolder(
  projectId: string,
  folderId: string | null,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
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

  // Get project to check workspace access
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return { error: 'Project not found' }
  }

  // If folderId is provided, verify it exists and belongs to the same workspace
  if (folderId) {
    const { data: folder, error: folderError } = await supabase
      .from('project_folders')
      .select('workspace_id')
      .eq('id', folderId)
      .single()

    if (folderError || !folder) {
      return { error: 'Folder not found' }
    }

    if (folder.workspace_id !== project.workspace_id) {
      return { error: 'Folder does not belong to the same workspace' }
    }
  }

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return { error: 'You must be a workspace member to move projects' }
  }

  // Update project folder_id
  const { error: updateError } = await supabase
    .from('projects')
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
    .eq('id', projectId)

  if (updateError) {
    return { error: updateError.message }
  }

  await safeRevalidatePath('/dashboard/projects')
  return { data: null }
}
