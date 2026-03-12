export type BlockCommentSource = "internal" | "external";

export interface BlockComment {
  id: string;
  parent_id?: string | null;
  author_id: string;
  author_name?: string;
  author_email?: string;
  text: string;
  timestamp: string;
  source?: BlockCommentSource;
}
