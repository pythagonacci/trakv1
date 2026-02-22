'use server'

import { getServerUser } from '@/lib/auth/get-server-user'
import { safeRevalidatePath } from './workspace'
import type { AuthContext } from '@/lib/auth-context'

export type ActionResult<T> = { data: T } | { error: string }

export interface DocFolder {
  id: string
  workspace_id: string
  name: string
  position: number
  created_at: string
  updated_at: string
}

export async function createDocFolder(
  workspaceId: string,
  name: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<DocFolder>> {
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
    return { error: 'You must be a workspace member to create folders' }
  }

  const { data: maxFolder } = await supabase
    .from('doc_folders')
    .select('position')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const newPosition = maxFolder ? maxFolder.position + 1 : 0

  const { data: folder, error: createError } = await supabase
    .from('doc_folders')
    .insert({
      workspace_id: workspaceId,
      name: name.trim(),
      position: newPosition,
    })
    .select()
    .single()

  if (createError) return { error: createError.message }

  await safeRevalidatePath('/dashboard/docs')
  return { data: folder }
}

export async function getAllDocFolders(workspaceId: string): Promise<ActionResult<DocFolder[]>> {
  const authResult = await getServerUser()
  if (!authResult) return { error: 'Unauthorized' }
  const { supabase, user } = authResult

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return { error: 'You must be a workspace member to view folders' }

  const { data: folders, error } = await supabase
    .from('doc_folders')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })

  if (error) return { error: error.message }
  return { data: folders || [] }
}

export async function deleteDocFolder(
  folderId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
  }

  const { data: folder, error: folderError } = await supabase
    .from('doc_folders')
    .select('workspace_id')
    .eq('id', folderId)
    .single()

  if (folderError || !folder) return { error: 'Folder not found' }

  let uid: string
  if (opts?.authContext) uid = opts.authContext.userId
  else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    uid = authResult.user.id
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', folder.workspace_id)
    .eq('user_id', uid)
    .maybeSingle()

  if (!membership) return { error: 'You must be a workspace member to delete folders' }

  const { error: deleteError } = await supabase
    .from('doc_folders')
    .delete()
    .eq('id', folderId)

  if (deleteError) return { error: deleteError.message }

  await safeRevalidatePath('/dashboard/docs')
  return { data: null }
}

export async function moveDocToFolder(
  docId: string,
  folderId: string | null,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
  }

  const { data: doc, error: docError } = await supabase
    .from('docs')
    .select('workspace_id')
    .eq('id', docId)
    .single()

  if (docError || !doc) return { error: 'Document not found' }

  if (folderId) {
    const { data: folder, error: folderError } = await supabase
      .from('doc_folders')
      .select('workspace_id')
      .eq('id', folderId)
      .single()

    if (folderError || !folder || folder.workspace_id !== doc.workspace_id) {
      return { error: 'Folder not found' }
    }
  }

  let uid: string
  if (opts?.authContext) uid = opts.authContext.userId
  else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    uid = authResult.user.id
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', doc.workspace_id)
    .eq('user_id', uid)
    .maybeSingle()

  if (!membership) return { error: 'You must be a workspace member to move documents' }

  const { error: updateError } = await supabase
    .from('docs')
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
    .eq('id', docId)

  if (updateError) return { error: updateError.message }

  await safeRevalidatePath('/dashboard/docs')
  return { data: null }
}
