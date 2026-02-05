export type UndoDeleteStep = {
  action: "delete";
  table: string;
  ids?: string[];
  idColumn?: string;
  where?: Record<string, unknown>;
};

export type UndoUpsertStep = {
  action: "upsert";
  table: string;
  rows: Record<string, unknown>[];
  onConflict?: string;
};

export type UndoStep = UndoDeleteStep | UndoUpsertStep;

export type UndoBatch = UndoStep[];

export type UndoTracker = {
  batches: UndoBatch[];
  skippedTools: string[];
  addBatch: (steps: UndoStep[]) => void;
  skipTool: (toolName: string) => void;
};

export function createUndoTracker(): UndoTracker {
  const tracker: UndoTracker = {
    batches: [],
    skippedTools: [],
    addBatch: (steps) => {
      if (!Array.isArray(steps) || steps.length === 0) return;
      tracker.batches.push(steps);
    },
    skipTool: (toolName) => {
      if (!toolName) return;
      if (!tracker.skippedTools.includes(toolName)) {
        tracker.skippedTools.push(toolName);
      }
    },
  };
  return tracker;
}
