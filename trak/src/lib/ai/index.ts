/**
 * AI Module for Prompt-to-Action
 *
 * This module provides the AI-powered command execution system for Trak.
 * It enables users to execute natural language commands to manage their
 * projects, tasks, tables, timelines, and more.
 */

// Tool definitions
export {
  allTools,
  toolsByCategory,
  toOpenAIFormat,
  toAnthropicFormat,
  getToolByName,
  getToolNames,
  type ToolDefinition,
  type ToolParameter,
  type ToolCategory,
} from "./tool-definitions";

// System prompt
export {
  TRAK_SYSTEM_PROMPT,
  getSystemPrompt,
  CLARIFICATION_PROMPTS,
  RESPONSE_TEMPLATES,
} from "./system-prompt";

// Tool executor
export {
  executeTool,
  executeToolsSequentially,
  executeToolsParallel,
  type ToolCall,
  type ToolCallResult,
} from "./tool-executor";

// AI executor
export {
  executeAICommand,
  executeSimpleCommand,
  executeAICommandStream,
  type AIMessage,
  type AIToolCall,
  type ExecutionResult,
  type ExecutionContext,
} from "./executor";
