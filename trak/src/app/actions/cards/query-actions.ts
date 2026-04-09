"use server";

import { buildEntityPropertiesFromRows } from "@/app/actions/entity-properties";
import { requireCardsBlockAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { EntityProperties } from "@/types/properties";
import type { CardItem, CardComment, TextCardRow } from "@/types/card";

type ActionResult<T> = { data: T } | { error: string };

export type CardEntityPropertiesMap = Record<string, EntityProperties>;

export interface CardCommentView {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface CardItemView {
  id: string;
  clientKey?: string;
  title: string;
  notes?: string | null;
  assetFileId?: string | null;
  /** Ordered list of file IDs for slideshow. When non-empty, used for slideshow. */
  assetFileIds?: string[];
  assetKind?: "image" | "video" | "file" | null;
  assetCaption?: string | null;
  width?: "half" | "full";
  height?: "compact" | "tall";
  textRows?: TextCardRow[];
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  statuses: Array<{ field_name: string; value: string | null }>;
  priorities: Array<{ field_name: string; value: string | null }>;
  assignees: Array<{ field_name: string; value: string[] | null }>;
  dueDates: Array<{ field_name: string; value: { start: string | null; end: string | null } | null }>;
  tags: string[];
  comments: CardCommentView[];
  created_at: string;
  updated_at: string;
}

export interface CardsBlockBundle {
  cards: CardItemView[];
  entityPropertiesByCardId: CardEntityPropertiesMap;
}

export async function getCardsByBlock(
  cardsBlockId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<CardsBlockBundle>> {
  const access = await requireCardsBlockAccess(cardsBlockId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, block } = access;

  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, title, notes, asset_file_id, asset_file_ids, asset_kind, asset_caption, width, height, text_rows, assignee_id, due_date, start_date, display_order, tags, statuses, priorities, assignees, due_dates, created_at, updated_at")
    .eq("cards_block_id", cardsBlockId)
    .order("display_order", { ascending: true });

  if (error) return { error: "Failed to load cards" };
  if (!cards || cards.length === 0) {
    return { data: { cards: [], entityPropertiesByCardId: {} } };
  }

  const cardIds = cards.map((card: any) => String(card.id));
  const [entityPropsResult, commentsResult] = await Promise.all([
    supabase
      .from("entity_properties")
      .select("id, entity_id, entity_type, field_name, field_type, value, workspace_id, created_at, updated_at")
      .eq("entity_type", "card")
      .in("entity_id", cardIds),
    supabase
      .from("card_comments")
      .select("id, card_id, author_id, text, created_at")
      .in("card_id", cardIds)
      .order("created_at", { ascending: true }),
  ]);

  const propsByCardId = new Map<string, any[]>();
  for (const prop of entityPropsResult.data ?? []) {
    const list = propsByCardId.get(prop.entity_id) ?? [];
    list.push(prop);
    propsByCardId.set(prop.entity_id, list);
  }

  const entityPropertiesByCardId: CardEntityPropertiesMap = {};
  await Promise.all(cardIds.map(async (id) => {
    const rows = propsByCardId.get(id) ?? [];
    const workspaceId = rows[0]?.workspace_id ?? block.workspace_id;
    entityPropertiesByCardId[id] = await buildEntityPropertiesFromRows("card", id, workspaceId, rows);
  }));

  const authorIds = Array.from(
    new Set(
      (commentsResult.data ?? [])
        .map((comment: any) => comment.author_id)
        .concat(cards.map((card: any) => card.assignee_id))
        .filter(Boolean)
    )
  ) as string[];
  const { data: profiles } = authorIds.length
    ? await supabase.from("profiles").select("id, name, email").in("id", authorIds)
    : { data: [] as Array<{ id: string; name: string | null; email: string | null }> };
  const profileMap = new Map<string, string>();
  for (const profile of profiles ?? []) {
    profileMap.set(profile.id, profile.name || profile.email || "Unknown");
  }

  const commentsByCard = new Map<string, CardCommentView[]>();
  for (const comment of (commentsResult.data ?? []) as Array<CardComment & { author_id: string | null }>) {
    const list = commentsByCard.get(comment.card_id) ?? [];
    list.push({
      id: comment.id,
      author: comment.author_id ? (profileMap.get(comment.author_id) ?? "Unknown") : "Unknown",
      text: comment.text,
      timestamp: comment.created_at,
    });
    commentsByCard.set(comment.card_id, list);
  }

  const cardViews = (cards as CardItem[]).map((card) => ({
    id: card.id,
    title: card.title,
    notes: card.notes,
    assetFileId: card.asset_file_id,
    assetFileIds: Array.isArray((card as any).asset_file_ids) && (card as any).asset_file_ids.length > 0
      ? (card as any).asset_file_ids
      : undefined,
    assetKind: card.asset_kind,
    assetCaption: card.asset_caption,
    width: (card.width === "full" ? "full" : "half") as "full" | "half",
    height: (card.height === "compact" ? "compact" : "tall") as "compact" | "tall",
    textRows: Array.isArray((card as any).text_rows) ? ((card as any).text_rows as TextCardRow[]) : [],
    assigneeId: card.assignee_id,
    assigneeName: card.assignee_id ? (profileMap.get(card.assignee_id) ?? null) : null,
    dueDate: card.due_date,
    startDate: card.start_date,
    statuses: Array.isArray(card.statuses) ? card.statuses : [],
    priorities: Array.isArray(card.priorities) ? card.priorities : [],
    assignees: Array.isArray(card.assignees) ? card.assignees : [],
    dueDates: Array.isArray(card.due_dates) ? card.due_dates : [],
    tags: Array.isArray(card.tags) ? card.tags : [],
    comments: commentsByCard.get(card.id) ?? [],
    created_at: card.created_at,
    updated_at: card.updated_at,
  }));

  return {
    data: {
      cards: cardViews,
      entityPropertiesByCardId,
    },
  };
}
