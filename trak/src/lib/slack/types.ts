/**
 * TypeScript interfaces for Slack API payloads and responses
 */

/**
 * Slack slash command request payload
 * @see https://api.slack.com/interactivity/slash-commands#app_command_handling
 */
export interface SlackSlashCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  api_app_id: string;
  is_enterprise_install: string;
  response_url: string;
  trigger_id: string;
}

/**
 * Slack OAuth v2 access token response
 * @see https://api.slack.com/methods/oauth.v2.access
 */
export interface SlackOAuthAccessResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  error?: string;
}

/**
 * Slack Block Kit message structure
 * @see https://api.slack.com/block-kit
 */
export interface SlackBlockKitMessage {
  response_type?: "ephemeral" | "in_channel";
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  replace_original?: boolean;
  delete_original?: boolean;
}

/**
 * Slack Block element
 */
export interface SlackBlock {
  type: "section" | "divider" | "image" | "actions" | "context" | "input" | "header";
  block_id?: string;
  text?: SlackTextObject;
  fields?: SlackTextObject[];
  accessory?: SlackBlockElement;
  elements?: SlackBlockElement[];
  image_url?: string;
  alt_text?: string;
  title?: SlackTextObject;
}

/**
 * Slack text object
 */
export interface SlackTextObject {
  type: "plain_text" | "mrkdwn";
  text: string;
  emoji?: boolean;
  verbatim?: boolean;
}

/**
 * Slack block element (buttons, selects, etc.)
 */
export interface SlackBlockElement {
  type: "button" | "static_select" | "external_select" | "users_select" | "conversations_select" | "channels_select" | "overflow" | "datepicker" | "timepicker" | "plain_text_input" | "radio_buttons" | "checkboxes";
  action_id?: string;
  text?: SlackTextObject;
  value?: string;
  url?: string;
  style?: "primary" | "danger";
  confirm?: SlackConfirmationDialog;
  placeholder?: SlackTextObject;
  initial_option?: SlackOption;
  options?: SlackOption[];
}

/**
 * Slack option (for selects, radio buttons, etc.)
 */
export interface SlackOption {
  text: SlackTextObject;
  value: string;
  description?: SlackTextObject;
  url?: string;
}

/**
 * Slack confirmation dialog
 */
export interface SlackConfirmationDialog {
  title: SlackTextObject;
  text: SlackTextObject;
  confirm: SlackTextObject;
  deny: SlackTextObject;
  style?: "primary" | "danger";
}

/**
 * Slack attachment (legacy, but still supported)
 */
export interface SlackAttachment {
  color?: string;
  fallback?: string;
  text?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

/**
 * Slack interactive component payload
 * @see https://api.slack.com/interactivity/handling#payloads
 */
export interface SlackInteractivePayload {
  type: "block_actions" | "view_submission" | "view_closed" | "shortcut" | "message_action";
  user: {
    id: string;
    username: string;
    name: string;
    team_id: string;
  };
  api_app_id: string;
  token: string;
  container: {
    type: string;
    message_ts?: string;
    channel_id?: string;
    is_ephemeral?: boolean;
  };
  trigger_id: string;
  team: {
    id: string;
    domain: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  is_enterprise_install: boolean;
  channel?: {
    id: string;
    name: string;
  };
  message?: {
    type: string;
    user: string;
    ts: string;
    text: string;
  };
  state?: {
    values: Record<string, Record<string, any>>;
  };
  response_url: string;
  actions?: Array<{
    type: string;
    action_id: string;
    block_id: string;
    text?: SlackTextObject;
    value?: string;
    style?: string;
    action_ts: string;
    selected_option?: SlackOption;
  }>;
}

/**
 * Slack error response
 */
export interface SlackErrorResponse {
  ok: false;
  error: string;
}

/**
 * Slack API success response (generic)
 */
export interface SlackSuccessResponse {
  ok: true;
  [key: string]: any;
}
