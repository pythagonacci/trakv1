"use server";

import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/lib/auth-context";

export interface CardBlockAccessContext {
  supabase: SupabaseClient;
  userId: string;
  block: {
    id: string;
    tab_id: string;
    workspace_id: string;
    project_id: string | null;
  };
}

async function getClientAndUser(opts?: { authContext?: AuthContext }) {
  if (opts?.authContext) {
    return {
      supabase: opts.authContext.supabase,
      userId: opts.authContext.userId,
    };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;
  return { supabase, userId: user.id } as const;
}

export async function requireCardsBlockAccess(
  cardsBlockId: string,
  opts?: { authContext?: AuthContext }
): Promise<{ error: string } | CardBlockAccessContext> {
  const auth = await getClientAndUser(opts);
  if ("error" in auth) return { error: auth.error ?? "Unknown error" };
  const { supabase, userId } = auth;

  const { data: block, error } = await supabase
    .from("blocks")
    .select("id, tab_id, type, tabs!inner(id, project_id, projects!inner(id, workspace_id))")
    .eq("id", cardsBlockId)
    .maybeSingle();

  if (error || !block) return { error: "Cards block not found" };
  if (block.type !== "cards") return { error: "Block is not a cards block" };

  const workspaceId = (block.tabs as { projects?: { workspace_id?: string; id?: string } })?.projects?.workspace_id ?? null;
  const projectId = (block.tabs as { projects?: { id?: string } })?.projects?.id ?? null;
  if (!workspaceId) return { error: "Cards block is missing workspace" };

  const membership = await checkWorkspaceMembership(workspaceId, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  return {
    supabase,
    userId,
    block: {
      id: block.id,
      tab_id: block.tab_id,
      workspace_id: workspaceId,
      project_id: projectId,
    },
  };
}

export async function requireCardAccess(
  cardId: string,
  opts?: { authContext?: AuthContext }
) {
  const auth = await getClientAndUser(opts);
  if ("error" in auth) return { error: auth.error ?? "Unknown error" };
  const { supabase, userId } = auth;

  const { data: card, error } = await supabase
    .from("cards")
    .select("id, cards_block_id, workspace_id, project_id, tab_id")
    .eq("id", cardId)
    .maybeSingle();

  if (error || !card) return { error: "Card not found" } as const;

  const membership = await checkWorkspaceMembership(card.workspace_id, userId);
  if (!membership) return { error: "Not a member of this workspace" } as const;

  return { supabase, userId, card } as const;
}

export async function requireWorkspaceAccessForCards(
  workspaceId: string,
  opts?: { authContext?: AuthContext }
) {
  const auth = await getClientAndUser(opts);
  if ("error" in auth) return { error: auth.error ?? "Unknown error" };
  const { supabase, userId } = auth;

  const membership = await checkWorkspaceMembership(workspaceId, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, userId };
}
