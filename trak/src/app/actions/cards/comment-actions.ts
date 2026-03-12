"use server";

import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";
import type { AuthContext } from "@/lib/auth-context";
import type { CardComment } from "@/types/card";

type ActionResult<T> = { data: T } | { error: string };

async function requireCardCommentAccess(commentId: string, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;

  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    supabase = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" } as const;
    userId = user.id;
  }

  const { data: comment, error } = await supabase
    .from("card_comments")
    .select("id, card_id, cards!inner(id, workspace_id)")
    .eq("id", commentId)
    .maybeSingle();

  if (error || !comment) return { error: "Comment not found" } as const;
  const card = Array.isArray((comment as any).cards) ? (comment as any).cards[0] : (comment as any).cards;
  if (!card?.workspace_id) return { error: "Card not found" } as const;

  const membership = await checkWorkspaceMembership(card.workspace_id, userId);
  if (!membership) return { error: "Not a member of this workspace" } as const;

  return { supabase, userId, comment } as const;
}

export async function createCardComment(
  input: { cardId: string; text: string; authContext?: AuthContext }
): Promise<ActionResult<CardComment>> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;

  if (input.authContext) {
    supabase = input.authContext.supabase;
    userId = input.authContext.userId;
  } else {
    supabase = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    userId = user.id;
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, workspace_id")
    .eq("id", input.cardId)
    .maybeSingle();
  if (cardError || !card) return { error: "Card not found" };

  const membership = await checkWorkspaceMembership(card.workspace_id, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  const { data, error } = await supabase
    .from("card_comments")
    .insert({
      card_id: input.cardId,
      author_id: userId,
      text: input.text,
    })
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to create comment" };
  return { data: data as CardComment };
}

export async function updateCardComment(
  commentId: string,
  updates: Partial<{ text: string }>,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<CardComment>> {
  const access = await requireCardCommentAccess(commentId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("card_comments")
    .update({
      ...(updates.text !== undefined ? { text: updates.text } : {}),
    })
    .eq("id", commentId)
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to update comment" };
  return { data: data as CardComment };
}

export async function deleteCardComment(
  commentId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
  const access = await requireCardCommentAccess(commentId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase.from("card_comments").delete().eq("id", commentId);
  if (error) return { error: "Failed to delete comment" };
  return { data: null };
}
