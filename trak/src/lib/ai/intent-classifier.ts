/**
 * Intent Classifier for Smart Tool Loading
 *
 * Analyzes user commands to determine which tool groups are actually needed.
 * This reduces token usage and confusion by only presenting relevant tools.
 */

import { aiDebug } from "./debug";

// ============================================================================
// TYPES
// ============================================================================

export type ToolGroup =
  | "core" // Always included - search and resolution tools
  | "task" // Task CRUD operations
  | "project" // Project CRUD operations
  | "table" // Table and row operations
  | "timeline" // Timeline event operations
  | "block" // Block operations
  | "tab" // Tab operations
  | "doc" // Document operations
  | "file" // File operations
  | "client" // Client operations
  | "property" // Property operations
  | "comment" // Comment operations
  | "workspace" // Workspace-level maintenance
  | "shopify"; // Shopify integration operations

export interface IntentClassification {
  /** Tool groups needed for this command */
  toolGroups: ToolGroup[];
  /** Confidence level (0-1) */
  confidence: number;
  /** Detected entities */
  entities: string[];
  /** Detected actions */
  actions: string[];
  /** Reasoning for this classification */
  reasoning: string;
}

// ============================================================================
// PATTERNS FOR DETECTION
// ============================================================================

/**
 * Entity patterns - what things are being referenced?
 */
const ENTITY_PATTERNS: Record<string, RegExp[]> = {
  task: [
    /\btask(?:s|item)?\b/i,
    /\bto-?do(?:s)?\b/i,
    /\bassign(?:ee|ment)?\b/i,
    /\btag(?:s)?\b/i,
    /\bsubtask(?:s)?\b/i,
  ],
  project: [
    /\bproject(?:s)?\b/i,
    /\bclient(?:s)?\b/i,
  ],
  workspace: [
    /\bworkspace(?:s)?\b/i,
  ],
  table: [
    /\btable(?:s)?\b/i,
    /\brow(?:s)?\b/i,
    /\bfield(?:s)?\b/i,
    /\bcolumn(?:s)?\b/i,
    /\bcell(?:s)?\b/i,
    /\bspreadsheet(?:s)?\b/i,
    /\bdata\s+table/i,
  ],
  timeline: [
    /\btimeline(?:s)?\b/i,
    /\bevent(?:s)?\b/i,
    /\bmilestone(?:s)?\b/i,
    /\bgantt/i,
    /\bdependenc(?:y|ies)/i,
  ],
  block: [
    /\bblock(?:s)?\b/i,
    /\bsection(?:s)?\b/i,
    /\btext block/i,
    /\bimage block/i,
    /\bchart(?:s)?\b/i,
    /\bgraph(?:s)?\b/i,
    /\bplot(?:s|ting)?\b/i,
    /\bvisuali[sz]e\b/i,
  ],
  tab: [
    /\btab(?:s)?\b/i,
    /\bpage(?:s)?\b/i,
  ],
  doc: [
    /\bdoc(?:s|ument)?(?:s)?\b/i,
    /\bnote(?:s)?\b/i,
  ],
  file: [
    /\bfile(?:s)?\b/i,
    /\battachment(?:s)?\b/i,
    /\bupload(?:s|ed|ing)?\b/i,
  ],
  client: [
    /\bclient(?:s)?\b/i,
    /\bcompany(?:ies)?\b/i,
    /\bcustomer(?:s)?\b/i,
  ],
  shopify: [
    /\bshopify\b/i,
    /\bproduct(?:s)?\b/i,
    /\bstore(?:s)?\b/i,
    /\bshop\b/i,
    /\binventory\b/i,
    /\bvariant(?:s)?\b/i,
    /\bsku(?:s)?\b/i,
    /\bvendor(?:s)?\b/i,
    /\bsales?\b/i,
    /\border(?:s)?\b/i,
  ],
};

/**
 * Action patterns - what operations are being requested?
 */
const ACTION_PATTERNS: Record<string, RegExp[]> = {
  // Read-only actions - typically only need core tools
  search: [
    /\bsearch(?:ing)?\b/i,
    /\bfind(?:ing)?\b/i,
    /\blook(?:ing)?\s+(?:for|up)\b/i,
    /\bget(?:ting)?\b/i,
    /\bshow(?:ing)?\b/i,
    /\blist(?:ing)?\b/i,
    /\bdisplay(?:ing)?\b/i,
    /\bview(?:ing)?\b/i,
  ],

  // Write actions - need entity-specific tools
  create: [
    /\bcreate(?:ing)?\b/i,
    /\badd(?:ing)?\b/i,
    /\bnew\b/i,
    /\bmake(?:ing)?\b/i,
    /\binsert(?:ing)?\b/i,
    /\bgenerate(?:ing)?\b/i,
    /\bpopulate(?:ing)?\b/i,
    /\bbuild(?:ing)?\b/i,
  ],

  update: [
    /\bupdate(?:ing)?\b/i,
    /\bedit(?:ing)?\b/i,
    /\bmodif(?:y|ying)\b/i,
    /\bchange(?:ing)?\b/i,
    /\brename(?:ing)?\b/i,
    /\bset(?:ting)?\b/i,
    /\balter(?:ing)?\b/i,
    /\bmark(?:ing)?\b/i,
    /\bmove(?:ing)?\b/i,
    /\breassign(?:ing)?\b/i,
  ],

  delete: [
    /\bdelete(?:ing)?\b/i,
    /\bremove(?:ing)?\b/i,
    /\bclear(?:ing)?\b/i,
    /\barchive(?:ing)?\b/i,
  ],

  // Organizational actions
  organize: [
    /\borganiz(?:e|ing)\b/i,
    /\bgroup(?:ing)?\b/i,
    /\bsort(?:ing)?\b/i,
    /\bfilter(?:ing)?\b/i,
    /\bcategoriz(?:e|ing)\b/i,
  ],
};

/**
 * Special patterns that override standard detection
 */
const SPECIAL_PATTERNS: Array<{
  pattern: RegExp;
  toolGroups: ToolGroup[];
  actions: string[];
  reasoning: string;
}> = [
    {
      // "search tasks AND create table" → needs both search and table tools
      pattern: /(?:search|find).*tasks?.*(?:and|then).*(?:create|organize).*table/i,
      toolGroups: ["core", "table"],
      actions: ["search", "create"],
      reasoning: "Search tasks and organize into table - needs table creation tools",
    },
    {
      // "organize [data] by [field]" → implies table operations
      pattern: /organize\s+(?:all\s+)?.*?(?:by|into)/i,
      toolGroups: ["core", "table"],
      actions: ["organize"],
      reasoning: "Organizing data - needs table tools for structured organization",
    },
    {
      // "create a table with..." → needs table tools
      pattern: /create\s+(?:a\s+)?table\s+(?:with|of|for|containing)/i,
      toolGroups: ["core", "table"],
      actions: ["create"],
      reasoning: "Creating a table with data - needs table creation and population tools",
    },
    {
      // "search tasks" → only core tools needed, no task CRUD (must come after compound patterns)
      pattern: /^(?:search|find|show|list|get|display)\s+(?:all\s+)?tasks?\b/i,
      toolGroups: ["core"],
      actions: ["search"],
      reasoning: "Read-only task search - only core search tools needed",
    },
    {
      // "update tasks..." → needs task modification tools
      pattern: /(?:update|edit|modify|change)\s+(?:all\s+)?tasks?\b/i,
      toolGroups: ["core", "task"],
      actions: ["update"],
      reasoning: "Modifying tasks - needs task update tools",
    },
  ];

// ============================================================================
// CLASSIFICATION LOGIC
// ============================================================================

/**
 * Classify user intent to determine which tool groups are needed.
 */
export function classifyIntent(userCommand: string): IntentClassification {
  const t0 = performance.now();
  aiDebug("classifyIntent:start", { command: userCommand });

  const command = userCommand.toLowerCase();

  // Check special patterns first (they override normal detection)
  for (const special of SPECIAL_PATTERNS) {
    if (special.pattern.test(userCommand)) {
      const classification: IntentClassification = {
        toolGroups: special.toolGroups,
        confidence: 0.95,
        entities: [],
        actions: special.actions,
        reasoning: special.reasoning,
      };
      aiDebug("classifyIntent:special-match", { ...classification, ms: Math.round(performance.now() - t0) });
      return classification;
    }
  }

  // Detect entities mentioned in command
  const detectedEntities: string[] = [];
  for (const [entity, patterns] of Object.entries(ENTITY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(command)) {
        detectedEntities.push(entity);
        break;
      }
    }
  }

  // Detect actions requested
  const detectedActions: string[] = [];
  for (const [action, patterns] of Object.entries(ACTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(command)) {
        detectedActions.push(action);
        break;
      }
    }
  }

  // Determine which tool groups are needed
  const toolGroups: ToolGroup[] = ["core"]; // Core is always included

  // If only search actions detected, stick with core tools
  const isReadOnly =
    detectedActions.length > 0 &&
    detectedActions.every((action) => action === "search");

  if (isReadOnly && !hasCreateOrModifyIntent(command)) {
    const classification: IntentClassification = {
      toolGroups: ["core"],
      confidence: 0.85,
      entities: detectedEntities,
      actions: detectedActions,
      reasoning: "Read-only query - core search tools sufficient",
    };
    aiDebug("classifyIntent:read-only", { ...classification, ms: Math.round(performance.now() - t0) });
    return classification;
  }

  // Map entities to tool groups based on detected actions
  const hasWriteAction = detectedActions.some((action) =>
    ["create", "update", "delete", "organize"].includes(action)
  );

  // For write actions or create/modify intent, include entity tools
  if (hasWriteAction || hasCreateOrModifyIntent(command)) {
    for (const entity of detectedEntities) {
      // Skip "project" if it's just contextual (e.g., "in the project")
      if (entity === "project" && /\b(?:in|on|for)\s+the\s+project\b/i.test(command)) {
        continue;
      }

      const group = mapEntityToToolGroup(entity);
      if (group && !toolGroups.includes(group)) {
        toolGroups.push(group);
      }
    }
  }

  // For Shopify entities, always include Shopify tools (even for read-only queries)
  // because Shopify tools include search/read operations like searchShopifyProducts
  if (detectedEntities.includes("shopify") && !toolGroups.includes("shopify")) {
    toolGroups.push("shopify");
  }

  // Special case: if no entities detected but has write actions, include common groups
  if (toolGroups.length === 1 && hasWriteAction) {
    // Try to infer from context
    if (command.includes("assign")) {
      toolGroups.push("task");
    }
    if (command.includes("data") || command.includes("rows") || command.includes("fields")) {
      toolGroups.push("table");
    }
  }

  const confidence = calculateConfidence(detectedEntities, detectedActions);
  const reasoning = buildReasoning(detectedEntities, detectedActions, toolGroups);

  const classification: IntentClassification = {
    toolGroups,
    confidence,
    entities: detectedEntities,
    actions: detectedActions,
    reasoning,
  };

  aiDebug("classifyIntent:result", { ...classification, ms: Math.round(performance.now() - t0) });
  return classification;
}

/**
 * Check if command has create/modify intent even without explicit action words
 */
function hasCreateOrModifyIntent(command: string): boolean {
  const createIndicators = [
    /with.*(?:columns?|fields?|rows?)/i, // "create table with columns"
    /(?:add|set|mark|assign).*(?:to|as)\b/i, // "add X to Y", "mark as done"
    /populate(?:d)?\s+with/i, // "populated with"
    /(?:\d+|many|multiple|several)\s+(?:tasks?|rows?|items?)/i, // "50 tasks", "multiple rows"
  ];

  return createIndicators.some((pattern) => pattern.test(command));
}

/**
 * Map entity name to tool group
 */
function mapEntityToToolGroup(entity: string): ToolGroup | null {
  const mapping: Record<string, ToolGroup> = {
    task: "task",
    project: "project",
    table: "table",
    timeline: "timeline",
    block: "block",
    tab: "tab",
    doc: "doc",
    file: "file",
    client: "client",
    workspace: "workspace",
    shopify: "shopify",
    product: "shopify",
  };

  return mapping[entity] || null;
}

/**
 * Calculate confidence score based on detection quality
 */
function calculateConfidence(entities: string[], actions: string[]): number {
  let confidence = 0.5; // Base confidence

  // More detected entities = higher confidence
  if (entities.length > 0) confidence += 0.2;
  if (entities.length > 1) confidence += 0.1;

  // Detected actions increase confidence
  if (actions.length > 0) confidence += 0.2;

  return Math.min(confidence, 1.0);
}

/**
 * Build human-readable reasoning for the classification
 */
function buildReasoning(
  entities: string[],
  actions: string[],
  toolGroups: ToolGroup[]
): string {
  const parts: string[] = [];

  if (entities.length > 0) {
    parts.push(`Entities: ${entities.join(", ")}`);
  }

  if (actions.length > 0) {
    parts.push(`Actions: ${actions.join(", ")}`);
  }

  if (toolGroups.length === 1) {
    parts.push("Core search tools only");
  } else {
    const groups = toolGroups.filter((g) => g !== "core");
    parts.push(`Tool groups: ${groups.join(", ")}`);
  }

  return parts.join(" | ");
}

// ============================================================================
// TESTING & DEBUGGING
// ============================================================================

/**
 * Test the classifier with sample commands (for debugging)
 */
export function testClassifier(commands: string[]): void {
  console.log("\n=== Intent Classifier Test ===\n");

  for (const command of commands) {
    const result = classifyIntent(command);
    console.log(`Command: "${command}"`);
    console.log(`  Groups: ${result.toolGroups.join(", ")}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`  Reasoning: ${result.reasoning}`);
    console.log("");
  }
}

// Example usage:
// testClassifier([
//   "search all tasks assigned to Amna",
//   "create a table organizing tasks by priority",
//   "update all high priority tasks to done",
//   "show me the project timeline",
//   "create 50 tasks for Q1 planning",
// ]);
