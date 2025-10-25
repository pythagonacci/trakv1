'use server'

import { createClient } from '@/lib/supabase/server'

export async function getMyInfo() {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // Get user's workspaces with roles
  const { data: workspaces, error: workspacesError } = await supabase
    .from('workspace_members')
    .select(`
      role,
      created_at,
      workspace:workspaces (
        id,
        name,
        owner_id,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (workspacesError) {
    return { 
      data: {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at
        },
        workspaces: [],
        workspaces_error: workspacesError.message
      }
    }
  }

  return { 
    data: {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      workspaces: workspaces.map(w => ({
        workspace_id: w.workspace?.id,
        workspace_name: w.workspace?.name,
        your_role: w.role,
        is_owner: w.workspace?.owner_id === user.id,
        joined_at: w.created_at
      })),
      total_workspaces: workspaces.length
    }
  }
}