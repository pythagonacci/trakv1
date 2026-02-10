import type { SlackBlockKitMessage, SlackBlock, SlackOption } from "./types";

export interface SlackExecutionResult {
  success: boolean;
  response: string;
  needsContext?: {
    type: "project" | "tab";
    options: Array<{ id: string; name: string }>;
    originalCommand?: string;
  };
  error?: string;
}

/**
 * Builds a Slack Block Kit formatted response from an execution result
 * @param result The execution result from the AI
 * @returns Slack Block Kit message
 */
export function buildSlackResponse(result: SlackExecutionResult): SlackBlockKitMessage {
  // Case 1: Needs context selection (project or tab)
  if (result.needsContext) {
    return buildContextSelectionMessage(result);
  }

  // Case 2: Success response
  if (result.success) {
    return buildSuccessMessage(result.response);
  }

  // Case 3: Error response
  return buildErrorMessage(result.response, result.error);
}

/**
 * Builds a message prompting the user to select a project or tab
 */
function buildContextSelectionMessage(result: SlackExecutionResult): SlackBlockKitMessage {
  if (!result.needsContext) {
    return buildErrorMessage("Internal error: needsContext is missing");
  }

  const { type, options, originalCommand } = result.needsContext;

  const selectOptions: SlackOption[] = options.map((opt) => ({
    text: {
      type: "plain_text",
      text: opt.name,
    },
    value: opt.id,
  }));

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: result.response || `Which ${type} should I use for this command?`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: `Select a ${type}`,
          },
          options: selectOptions,
          action_id: `select_${type}`,
        },
      ],
    },
  ];

  // Add a divider and hint if there are many options
  if (options.length > 5) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "plain_text",
          text: `💡 Tip: You can specify the ${type} in your command next time, e.g., "/trak in the Marketing ${type}, create task..."`,
        } as any,
      ],
    });
  }

  return {
    response_type: "ephemeral",
    blocks,
  };
}

/**
 * Builds a success message
 */
function buildSuccessMessage(response: string): SlackBlockKitMessage {
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `✅ ${response}`,
      },
    },
  ];

  return {
    response_type: "ephemeral",
    blocks,
  };
}

/**
 * Builds an error message
 */
function buildErrorMessage(response: string, error?: string): SlackBlockKitMessage {
  const errorText = error ? `\n\n_Error details: ${error}_` : "";

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `❌ ${response}${errorText}`,
      },
    },
  ];

  return {
    response_type: "ephemeral",
    blocks,
  };
}

/**
 * Builds a simple text-only ephemeral message
 */
export function buildSimpleEphemeralMessage(text: string): SlackBlockKitMessage {
  return {
    response_type: "ephemeral",
    text,
  };
}

/**
 * Builds a message with a list of items (e.g., tasks, projects)
 */
export function buildListMessage(
  title: string,
  items: Array<{ text: string; details?: string }>,
  maxItems: number = 10
): SlackBlockKitMessage {
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*`,
      },
    },
    {
      type: "divider",
    },
  ];

  const displayItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  displayItems.forEach((item, index) => {
    const itemText = item.details
      ? `${index + 1}. *${item.text}*\n   ${item.details}`
      : `${index + 1}. ${item.text}`;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: itemText,
      },
    });
  });

  if (hasMore) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "plain_text",
          text: `... and ${items.length - maxItems} more. View all in TWOD.`,
        } as any,
      ],
    });
  }

  return {
    response_type: "ephemeral",
    blocks,
  };
}

/**
 * Builds a processing/loading message
 */
export function buildProcessingMessage(): SlackBlockKitMessage {
  return {
    response_type: "ephemeral",
    text: "⏳ Processing your request...",
  };
}
