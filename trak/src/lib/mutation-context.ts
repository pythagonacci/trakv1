import { randomUUID } from "crypto";

export interface MutationContext {
  id: string;
  source: string;
}

export function ensureMutationContext(
  context: MutationContext | undefined,
  source: string
): MutationContext {
  return context ?? { id: randomUUID(), source };
}
