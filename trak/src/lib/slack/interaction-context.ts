import { createClient as createServiceClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const INTERACTION_TTL_HOURS = 2;
const INTERACTION_PREFIX = "interactive_ctx";

export interface SlackInteractionContext {
  teamId: string;
  slackUserId: string;
  workspaceId: string;
  trakUserId: string;
  originalCommand: string;
  selectedProjectId?: string;
}

function buildContextKey(teamId: string, contextId: string) {
  return `team:${teamId}:${INTERACTION_PREFIX}:${contextId}`;
}

export async function createInteractionContext(
  context: SlackInteractionContext
): Promise<string | null> {
  const contextId = crypto.randomUUID();
  const key = buildContextKey(context.teamId, contextId);
  const expiresAt = new Date(Date.now() + INTERACTION_TTL_HOURS * 60 * 60 * 1000);
  const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { error } = await supabase.from("slack_idempotency_keys").upsert(
    {
      idempotency_key: key,
      response_payload: context,
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "idempotency_key" }
  );

  if (error) {
    console.error("Failed to create Slack interaction context:", error);
    return null;
  }

  return contextId;
}

export async function getInteractionContext(
  teamId: string,
  contextId: string
): Promise<SlackInteractionContext | null> {
  const key = buildContextKey(teamId, contextId);
  const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from("slack_idempotency_keys")
    .select("response_payload")
    .eq("idempotency_key", key)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("Failed to fetch Slack interaction context:", error);
    }
    return null;
  }

  return (data?.response_payload as SlackInteractionContext | undefined) ?? null;
}

export async function updateInteractionContext(
  teamId: string,
  contextId: string,
  updates: Partial<SlackInteractionContext>
): Promise<void> {
  const existing = await getInteractionContext(teamId, contextId);
  if (!existing) return;

  const merged = { ...existing, ...updates };
  const key = buildContextKey(teamId, contextId);
  const expiresAt = new Date(Date.now() + INTERACTION_TTL_HOURS * 60 * 60 * 1000);
  const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { error } = await supabase
    .from("slack_idempotency_keys")
    .update({
      response_payload: merged,
      expires_at: expiresAt.toISOString(),
    })
    .eq("idempotency_key", key);

  if (error) {
    console.error("Failed to update Slack interaction context:", error);
  }
}

export async function deleteInteractionContext(teamId: string, contextId: string): Promise<void> {
  const key = buildContextKey(teamId, contextId);
  const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { error } = await supabase
    .from("slack_idempotency_keys")
    .delete()
    .eq("idempotency_key", key);

  if (error) {
    console.error("Failed to delete Slack interaction context:", error);
  }
}
