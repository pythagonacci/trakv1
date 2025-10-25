'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
//create workspace action 
export async function createWorkspace(name: string) {
  const supabase = await createClient()
  
  // 1. Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Unauthorized' }
  }
  
  // 2. Check if user already has a workspace (validation)
  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  
  if (existingMember) {
    return { error: 'User already has a workspace' }
  }
  
  // 3. Create workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ 
      name, 
      owner_id: user.id 
    })
    .select()
    .single()
  
  if (workspaceError) {
    return { error: workspaceError.message }
  }
  
  // 4. Add creator as owner in workspace_members
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner'
    })
  
  if (memberError) {
    // Rollback workspace creation if member insert fails
    await supabase.from('workspaces').delete().eq('id', workspace.id)
    return { error: 'Failed to create workspace member' }
  }
  
  // 5. Revalidate any cached paths
  revalidatePath('/dashboard')
  
  return { data: workspace }
}
//get user workspaces action
export async function getUserWorkspaces() {
    const supabase = await createClient()
    
    // 1. Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { error: 'Unauthorized' }
    }
    
    // 2. Query all workspaces user is member of with role information
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspaces (
          id,
          name,
          owner_id,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
    
    if (error) {
      return { error: error.message }
    }
    
    // 3. Transform data to include role with workspace
    const workspaces = memberships.map(membership => ({
      ...membership.workspaces,
      role: membership.role
    }))
    
    return { data: workspaces }
}

  //invite member server action. this invites different people to the workspace.
  //the inviter must have admin/owner permissions 
  //if the inviter alread exists within the Trak system, they will be added when they login. If they do not exist within the Trak system, they will be added when they sign up through a magic link.

export async function inviteMember(workspaceId: string, email: string, role: 'admin' | 'teammate') {
    const supabase = await createClient()
    
    // 1. Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { error: 'Unauthorized' }
    }
    
    // 2. Validate inviter has admin/owner permissions
    const { data: inviterMembership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
    
    if (!inviterMembership || (inviterMembership.role !== 'owner' && inviterMembership.role !== 'admin')) {
      return { error: 'Insufficient permissions. Only owners and admins can invite members.' }
    }
    
    // 3. Check if invitee email exists in profiles
    const { data: inviteeProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    
    if (profileError || !inviteeProfile) {
      return { error: 'User with this email does not exist. They must sign up first.' }
    }
    
    // 4. Check if user is already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', inviteeProfile.id)
      .maybeSingle()
    
    if (existingMember) {
      return { error: 'User is already a member of this workspace.' }
    }
    
    // 5. Create workspace_member record
    const { data: newMember, error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: inviteeProfile.id,
        role: role
      })
      .select(`
        id,
        role,
        created_at,
        user_id
      `)
      .single()
    
    if (memberError) {
      return { error: memberError.message }
    }
    
    // 6. TODO: Send invitation email (placeholder)
    // await sendInvitationEmail(email, workspaceName)
    
    revalidatePath('/dashboard')
    
    return { data: newMember }
}

  //Update member role server action. This updates the role of a member in a workspace. The updater must either be the owner or have admin permissions. This code updates the member's role and prevents demoting the last owner. 

export async function updateMemberRole(workspaceId: string, memberId: string, newRole: 'owner' | 'admin' | 'teammate') {
    const supabase = await createClient()
    
    // 1. Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { error: 'Unauthorized' }
    }
    
    // 2. Validate requester is owner/admin
    const { data: requesterMembership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
    
    if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
      return { error: 'Insufficient permissions. Only owners and admins can update member roles.' }
    }
    
    // 3. Get the member being updated
    const { data: targetMember } = await supabase
      .from('workspace_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (!targetMember) {
      return { error: 'Member not found in this workspace.' }
    }
    
    // 4. If demoting from owner, check if they're the last owner
    if (targetMember.role === 'owner' && newRole !== 'owner') {
      const { data: ownerCount } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner')

      // Fix: ownerCount here is an array, so check its length
      if (ownerCount && ownerCount.length <= 1) {
        return { error: 'Cannot demote the last owner. Promote another member to owner first.' }
      }
    }
    // 5. Update member's role
    const { data: updatedMember, error: updateError } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .select(`
        id,
        role,
        user_id
      `)
      .single()
    
    if (updateError) {
      return { error: updateError.message }
    }
    
    revalidatePath('/dashboard')
    
    return { data: updatedMember }
}
//remove member server action. the requester must be owner or admin, and the last owner cannot be removed.

export async function removeMember(workspaceId: string, memberId: string) {
    const supabase = await createClient()
    
    // 1. Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { error: 'Unauthorized' }
    }
    
    // 2. Validate requester is owner/admin
    const { data: requesterMembership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
    
    if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
      return { error: 'Insufficient permissions. Only owners and admins can remove members.' }
    }
    
    // 3. Get the member being removed
    const { data: targetMember } = await supabase
      .from('workspace_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (!targetMember) {
      return { error: 'Member not found in this workspace.' }
    }
    
    // 4. If removing an owner, check if they're the last owner
    if (targetMember.role === 'owner') {
      const { count } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner')
      
      if (count && count <= 1) {
        return { error: 'Cannot remove the last owner. Transfer ownership first.' }
      }
    }
    
    // 5. Delete member record
    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)
    
    if (deleteError) {
      return { error: deleteError.message }
    }
    
    revalidatePath('/dashboard')
    
    return { data: { success: true, message: 'Member removed successfully' } }
}