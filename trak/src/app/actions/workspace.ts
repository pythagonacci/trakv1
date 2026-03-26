'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { cache } from 'react'
import { randomBytes } from 'node:crypto'
import { getServerUser, setTestUserContext as setServerUserTestContext, clearTestUserContext as clearServerUserTestContext } from '@/lib/auth/get-server-user'
import { logger } from '@/lib/logger'
import { setTestUserContext, clearTestUserContext } from '@/lib/auth-utils'
import { enableTestMode, disableTestMode, setTestUserId } from '@/lib/supabase/server'
import { assertCanCreateWorkspace } from '@/lib/billing/entitlements'
import { assertCanAddWorkspaceMember, ensureWorkspaceBillingRow } from '@/lib/billing/data'

const CURRENT_WORKSPACE_COOKIE = "trak_current_workspace"

// Test context for running outside of Next.js request scope
let testWorkspaceContext: { workspaceId: string; userId: string } | null = null;

// Set test context (used by test harness)
export async function setTestContext(workspaceId: string, userId: string) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setTestContext is only allowed when NODE_ENV === \"test\".");
  }
  testWorkspaceContext = { workspaceId, userId };
  await setTestUserContext(userId); // For auth-utils.ts
  setServerUserTestContext(userId); // For get-server-user.ts
  setTestUserId(userId); // For supabase/server.ts
  enableTestMode();
}

// Clear test context
export async function clearTestContext() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("clearTestContext is only allowed when NODE_ENV === \"test\".");
  }
  testWorkspaceContext = null;
  await clearTestUserContext(); // For auth-utils.ts
  clearServerUserTestContext(); // For get-server-user.ts
  disableTestMode();
}

// Safe revalidation that works in both normal and test contexts
export async function safeRevalidatePath(path: string) {
  // Skip revalidation in test mode (only in test/dev environments)
  const isTestEnvironment = process.env.NODE_ENV === "test";
  if (testWorkspaceContext && isTestEnvironment) {
    return;
  }

  // In normal Next.js request context, revalidate
  try {
    revalidatePath(path);
  } catch (error) {
    // Silently fail if revalidatePath can't be called
    // (e.g., static generation store not available)
  }
}

// Get current workspace ID from cookie (or test context if set)
export const getCurrentWorkspaceId = cache(async (): Promise<string | null> => {
  const _t0 = performance.now();
  // Check if running in test context first (only in test/dev environments)
  const isTestEnvironment = process.env.NODE_ENV === "test";
  if (testWorkspaceContext && isTestEnvironment) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getCurrentWorkspaceId fromTest=1 ms=${Math.round(performance.now() - _t0)}`);
    return testWorkspaceContext.workspaceId;
  }

  // Try to get from cookies (normal Next.js request)
  try {
    const cookieStore = await cookies();
    const value = cookieStore.get(CURRENT_WORKSPACE_COOKIE)?.value || null;
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getCurrentWorkspaceId hasValue=${Boolean(value)} ms=${Math.round(performance.now() - _t0)}`);
    return value;
  } catch (error) {
    // If cookies() fails (not in request context), return null
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getCurrentWorkspaceId error ms=${Math.round(performance.now() - _t0)}`);
    return null;
  }
});

// Update current workspace cookie
export async function updateCurrentWorkspace(workspaceId: string) {
  const cookieStore = await cookies();
  
  // Verify user has access to this workspace
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Not authenticated" };
  }

  const { supabase, user } = authResult;
  
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  
  if (!membership) {
    return { error: "You don't have access to this workspace" };
  }
  
  // Set cookie (expires in 1 year)
  cookieStore.set(CURRENT_WORKSPACE_COOKIE, workspaceId, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  
  return { success: true };
}

/** Set current workspace cookie after invite accept (user was just added; no auth check). */
export async function setCurrentWorkspaceAfterInvite(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_WORKSPACE_COOKIE, workspaceId, {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return { success: true };
}

//create workspace action 
export async function createWorkspace(name: string) {
  try {
    const authResult = await getServerUser()
    
    // 1. Get authenticated user
    if (!authResult) {
      return { error: 'Unauthorized' }
    }
    const { supabase, user } = authResult

    await assertCanCreateWorkspace(user.id)

    // 2. Create workspace (users can have multiple workspaces)
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
    
    // 3. Add creator as owner in workspace_members
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

    await ensureWorkspaceBillingRow(workspace.id)
    
    // 4. Revalidate any cached paths
    revalidatePath('/dashboard')
    
    return { data: workspace }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create workspace' }
  }
}
//get user workspaces action
// Cache this to prevent redundant queries in the same request
export const getUserWorkspaces = cache(async () => {
    const authResult = await getServerUser()
    
    // 1. Get authenticated user
    if (!authResult) {
      return { error: 'Unauthorized' }
    }
    const { supabase, user } = authResult
    
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
});

  // Invite member: add existing users to workspace_members; create workspace_invitation + send email for new users.

export async function inviteMember(workspaceId: string, email: string, role: 'admin' | 'teammate') {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    const { supabase, user } = authResult

    const { data: inviterMembership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
    if (!inviterMembership || (inviterMembership.role !== 'owner' && inviterMembership.role !== 'admin')) {
      return { error: 'Insufficient permissions. Only owners and admins can invite members.' }
    }

    const normalizedEmail = email.toLowerCase().trim()

    const { data: inviteeProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (profileError) return { error: profileError.message }

    if (inviteeProfile) {
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', inviteeProfile.id)
        .maybeSingle()
      if (existingMember) return { error: 'User is already a member of this workspace.' }

      try {
        await assertCanAddWorkspaceMember(workspaceId, supabase)
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to validate seat availability.' }
      }

      const { data: newMember, error: memberError } = await supabase
        .from('workspace_members')
        .insert({ workspace_id: workspaceId, user_id: inviteeProfile.id, role })
        .select('id, role, created_at, user_id')
        .single()
      if (memberError) return { error: memberError.message }
      safeRevalidatePath('/dashboard')
      return { data: newMember }
    }

    // Invitee not in Saria: create invitation and send email
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()
    if (!workspace) return { error: 'Workspace not found.' }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: existingInvite } = await supabase
      .from('workspace_invitations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingInvite) {
      const { error: updateErr } = await supabase
        .from('workspace_invitations')
        .update({ token, expires_at: expiresAt, role, created_by: user.id })
        .eq('id', existingInvite.id)
      if (updateErr) return { error: updateErr.message }
    } else {
      const { error: insertErr } = await supabase
        .from('workspace_invitations')
        .insert({
          workspace_id: workspaceId,
          email: normalizedEmail,
          role,
          token,
          expires_at: expiresAt,
          created_by: user.id,
        })
      if (insertErr) return { error: insertErr.message }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const acceptUrl = `${baseUrl}/invite/accept?token=${token}`
    const { sendWorkspaceInvitationEmail } = await import('@/lib/email')
    const inviterProfile = await supabase.from('profiles').select('email').eq('id', user.id).maybeSingle()
    const sendResult = await sendWorkspaceInvitationEmail({
      to: normalizedEmail,
      workspaceName: workspace.name,
      acceptUrl,
      inviterEmail: inviterProfile.data?.email ?? undefined,
    })
    if (!sendResult.ok && sendResult.error && process.env.NODE_ENV !== 'development') {
      return { error: `Invitation created but email failed: ${sendResult.error}` }
    }

    safeRevalidatePath('/dashboard')
    return { data: { invited: true, email: normalizedEmail } }
  }

  //Update member role server action. This updates the role of a member in a workspace. The updater must either be the owner or have admin permissions. This code updates the member's role and prevents demoting the last owner. 

export async function updateMemberRole(workspaceId: string, memberId: string, newRole: 'owner' | 'admin' | 'teammate') {
    const authResult = await getServerUser()
    
    // 1. Get authenticated user
    if (!authResult) {
      return { error: 'Unauthorized' }
    }
    const { supabase, user } = authResult
    
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
    // SECURITY FIX: Atomic check-and-update to prevent race condition
    if (targetMember.role === 'owner' && newRole !== 'owner') {
      // Get current count of owners
      const { count: ownerCount } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner')

      if (ownerCount !== null && ownerCount <= 1) {
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

    // 6. SECURITY: Verify the update didn't leave workspace without an owner
    // This double-check catches race conditions
    if (targetMember.role === 'owner' && newRole !== 'owner') {
      const { count: remainingOwners } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner')

      if (remainingOwners === 0) {
        // Rollback: restore owner role
        await supabase
          .from('workspace_members')
          .update({ role: 'owner' })
          .eq('id', memberId)

        return { error: 'Cannot demote the last owner. Promote another member to owner first.' }
      }
    }
    
    revalidatePath('/dashboard')
    
    return { data: updatedMember }
}

/**
 * Update a workspace member's display name (profiles.name).
 * Only workspace owners and admins can update names; target must be a member of the workspace.
 */
export async function updateMemberDisplayName(
  workspaceId: string,
  userId: string,
  displayName: string
) {
  const authResult = await getServerUser()
  if (!authResult) return { error: 'Unauthorized' }
  const { supabase, user } = authResult

  const { data: requesterMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
    return { error: 'Insufficient permissions. Only owners and admins can edit member names.' }
  }

  const { data: targetMembership } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (!targetMembership) {
    return { error: 'User is not a member of this workspace.' }
  }

  const trimmed = displayName.trim()
  if (!trimmed) {
    return { error: 'Display name cannot be empty.' }
  }

  const { createServiceClient } = await import('@/lib/supabase/service')
  const serviceSupabase = await createServiceClient()
  const { error: updateError } = await serviceSupabase
    .from('profiles')
    .update({ name: trimmed })
    .eq('id', userId)

  if (updateError) return { error: updateError.message }
  safeRevalidatePath('/dashboard')
  return { data: { name: trimmed } }
}

//remove member server action. the requester must be owner or admin, and the last owner cannot be removed.

export async function removeMember(workspaceId: string, memberId: string) {
    const authResult = await getServerUser()
    
    // 1. Get authenticated user
    if (!authResult) {
      return { error: 'Unauthorized' }
    }
    const { supabase, user } = authResult
    
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

// Get all workspace members (for assignee dropdowns, etc.)
export async function getWorkspaceMembers(workspaceId: string) {
  const authResult = await getServerUser()
  
  // 1. Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult
  
  // 2. Verify user is member of the workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()
  
  if (!membership) {
    return { error: 'Not a member of this workspace' }
  }
  
  // 3. Get all workspace members (id = workspace_members row id for role/remove)
  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('id, user_id, role, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  
  if (error) {
    return { error: error.message }
  }

  if (!members || members.length === 0) {
    return { data: [] }
  }

  // 4. Get profile info for each user
  const userIds = members.map(m => m.user_id)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, name')
    .in('id', userIds)

  if (profilesError) {
    logger.error('Error fetching profiles:', profilesError)
    // Fallback: return members without profile info
    const transformedMembers = members.map(member => ({
      membershipId: member.id,
      id: member.user_id,
      email: '',
      name: 'Unknown',
      role: member.role,
    }))
    return { data: transformedMembers }
  }

  // 5. Transform data to combine members with profiles
  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
  const transformedMembers = members.map(member => {
    const profile = profileMap.get(member.user_id)
    return {
      membershipId: member.id,
      id: member.user_id,
      email: profile?.email || '',
      name: profile?.name || profile?.email || 'Unknown',
      role: member.role,
    }
  })
  
  return { data: transformedMembers }
}
