"use server";

import { revalidatePath } from "next/cache";
import { requireCardAccess, requireCardsBlockAccess } from "./context";
import { revalidateClientPages } from "@/app/actions/revalidate-client-page";
import { setEntityProperties } from "@/app/actions/entity-properties";
import type { AuthContext } from "@/lib/auth-context";
import type { CardItem, CardAssetKind, CardWidth, CardHeight, TextCardRow } from "@/types/card";
import type { DueDateRange, Priority, Status } from "@/types/properties";
import { revalidateDashboardProjectTabPath } from "@/app/actions/dashboard-path-revalidation";

type ActionResult<T> = { data: T } | { error: string };

type CardPropertyInput = {
  status?: Status | null;
  priority?: Priority | null;
  assigneeIds?: string[] | null;
  dueDate?: DueDateRange | null;
  tags?: string[];
  statuses?: Array<{ field_name: string; value: Status | null }> | null;
  priorities?: Array<{ field_name: string; value: Priority | null }> | null;
  assignees?: Array<{ field_name: string; value: string[] | null }> | null;
  dueDates?: Array<{ field_name: string; value: DueDateRange | null }> | null;
};

function hasPropertyUpdates(input: CardPropertyInput) {
  return (
    input.status !== undefined ||
    input.priority !== undefined ||
    input.assigneeIds !== undefined ||
    input.dueDate !== undefined ||
    input.tags !== undefined ||
    input.statuses !== undefined ||
    input.priorities !== undefined ||
    input.assignees !== undefined ||
    input.dueDates !== undefined
  );
}

async function revalidateCardBlockPaths(projectId: string | null, tabId: string | null) {
  if (projectId && tabId) {
    await revalidateDashboardProjectTabPath({ projectId, tabId });
    await revalidateClientPages(projectId, tabId);
  }
  revalidatePath("/dashboard/projects");
}

async function fetchCardById(supabase: any, cardId: string): Promise<CardItem | null> {
  const { data } = await supabase.from("cards").select("*").eq("id", cardId).maybeSingle();
  return (data as CardItem | null) ?? null;
}

export async function createCard(
  input: {
    cardsBlockId: string;
    title?: string;
    notes?: string | null;
    assetFileId?: string | null;
    assetFileIds?: string[];
    assetKind?: CardAssetKind;
    assetCaption?: string | null;
    displayOrder?: number;
    width?: CardWidth;
    height?: CardHeight;
    textRows?: TextCardRow[];
  } & CardPropertyInput,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<CardItem>> {
  const access = await requireCardsBlockAccess(input.cardsBlockId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, block } = access;

  let displayOrder = input.displayOrder;
  if (displayOrder === undefined) {
    const { data: lastCard } = await supabase
      .from("cards")
      .select("display_order")
      .eq("cards_block_id", input.cardsBlockId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    displayOrder = (lastCard?.display_order ?? -1) + 1;
  }

  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      cards_block_id: input.cardsBlockId,
      workspace_id: block.workspace_id,
      project_id: block.project_id,
      tab_id: block.tab_id,
      title: input.title?.trim() || "Untitled card",
      notes: input.notes ?? null,
      asset_file_id: input.assetFileId ?? (input.assetFileIds?.[0] ?? null),
      asset_file_ids: input.assetFileIds ?? (input.assetFileId ? [input.assetFileId] : []),
      asset_kind: input.assetKind ?? null,
      asset_caption: input.assetCaption ?? null,
      display_order: displayOrder,
      width: input.width ?? "half",
      height: input.height ?? "tall",
      text_rows: input.textRows ?? [],
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !card) return { error: "Failed to create card" };

  if (hasPropertyUpdates(input)) {
    const propertyResult = await setEntityProperties({
      entity_type: "card",
      entity_id: card.id,
      workspace_id: block.workspace_id,
      updates: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.assigneeIds !== undefined ? { assignee_ids: input.assigneeIds } : {}),
        ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.statuses !== undefined ? { statuses: input.statuses } : {}),
        ...(input.priorities !== undefined ? { priorities: input.priorities } : {}),
        ...(input.assignees !== undefined ? { assignees: input.assignees } : {}),
        ...(input.dueDates !== undefined ? { due_dates: input.dueDates } : {}),
      },
    });
    if ("error" in propertyResult) return { error: propertyResult.error };
  }

  const finalCard = await fetchCardById(supabase, card.id);
  await revalidateCardBlockPaths(block.project_id, block.tab_id);
  return { data: finalCard ?? (card as CardItem) };
}

export async function updateCard(
  cardId: string,
  updates: Partial<{
    title: string;
    notes: string | null;
    assetFileId: string | null;
    assetFileIds: string[];
    assetKind: CardAssetKind;
    assetCaption: string | null;
    width: CardWidth;
    height: CardHeight;
    textRows: TextCardRow[];
  }> &
    CardPropertyInput,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<CardItem>> {
  const access = await requireCardAccess(cardId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, card } = access;

  const payload: Record<string, unknown> = { updated_by: userId };
  if (updates.title !== undefined) payload.title = updates.title.trim() || "Untitled card";
  if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
  if (updates.assetFileId !== undefined) payload.asset_file_id = updates.assetFileId ?? null;
  if (updates.assetFileIds !== undefined) {
    payload.asset_file_ids = updates.assetFileIds;
    if (updates.assetFileIds.length > 0 && !updates.assetFileId) {
      payload.asset_file_id = updates.assetFileIds[0];
    }
  }
  if (updates.assetKind !== undefined) payload.asset_kind = updates.assetKind ?? null;
  if (updates.assetCaption !== undefined) payload.asset_caption = updates.assetCaption ?? null;
  if (updates.width !== undefined) payload.width = updates.width;
  if (updates.height !== undefined) payload.height = updates.height;
  if (updates.textRows !== undefined) payload.text_rows = updates.textRows ?? [];

  let updatedCard = card as CardItem;
  if (Object.keys(payload).length > 1) {
    const { data, error } = await supabase
      .from("cards")
      .update(payload)
      .eq("id", cardId)
      .select("*")
      .single();
    if (error || !data) return { error: "Failed to update card" };
    updatedCard = data as CardItem;
  }

  if (hasPropertyUpdates(updates)) {
    const propertyResult = await setEntityProperties({
      entity_type: "card",
      entity_id: cardId,
      workspace_id: card.workspace_id,
      updates: {
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
        ...(updates.assigneeIds !== undefined ? { assignee_ids: updates.assigneeIds } : {}),
        ...(updates.dueDate !== undefined ? { due_date: updates.dueDate } : {}),
        ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
        ...(updates.statuses !== undefined ? { statuses: updates.statuses } : {}),
        ...(updates.priorities !== undefined ? { priorities: updates.priorities } : {}),
        ...(updates.assignees !== undefined ? { assignees: updates.assignees } : {}),
        ...(updates.dueDates !== undefined ? { due_dates: updates.dueDates } : {}),
      },
    });
    if ("error" in propertyResult) return { error: propertyResult.error };
  }

  const finalCard = await fetchCardById(supabase, cardId);
  await revalidateCardBlockPaths(card.project_id, card.tab_id);
  return { data: finalCard ?? updatedCard };
}

export async function deleteCard(
  cardId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
  const access = await requireCardAccess(cardId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, card } = access;

  const { error } = await supabase.from("cards").delete().eq("id", cardId);
  if (error) return { error: "Failed to delete card" };

  await revalidateCardBlockPaths(card.project_id, card.tab_id);
  return { data: null };
}
