// src/types/query.ts

import type { ID, Timestamp } from "./common";

/** Author role for a message within a conversation. */
export type ChatRole = "user" | "assistant" | "system";

/** A grounded reference to a specific location in the source code backing an AI answer. */
export interface Citation {
  readonly id: ID;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly snippet?: string;
  readonly symbolName?: string;
  readonly codePreview?: string;
  readonly relevanceScore?: number;
}

/** A single message rendered in the chat window. */
export interface ChatMessage {
  readonly id: ID;
  readonly role: ChatRole;
  readonly content: string;
  readonly citations?: readonly Citation[];
  readonly createdAt: Timestamp;
  readonly isStreaming?: boolean;
  readonly status?: "pending" | "streaming" | "complete" | "error";
}

/** Payload sent when asking a natural-language question about a repository. */
export interface QueryRequest {
  readonly repositoryId: ID;
  readonly question: string;
  readonly conversationId?: ID;
  readonly maxResults?: number;
}

/** Complete (non-streamed) response to a query request. */
export interface QueryResponse {
  readonly answer: string;
  readonly citations: readonly Citation[];
  readonly conversationId: ID;
  readonly messageId: ID;
  readonly latencyMs?: number;
}

/** A single incremental chunk of a streamed AI answer. */
export interface StreamingChunk {
  readonly delta: string;
  readonly isFinal: boolean;
  readonly citations?: readonly Citation[];
}

/** A persisted message belonging to a stored conversation. */
export interface ConversationMessage extends Omit<ChatMessage, "isStreaming"> {
  readonly conversationId: ID;
  readonly sequence: number;
}

/** A stored, multi-turn conversation scoped to a single repository. */
export interface Conversation {
  readonly id: ID;
  readonly repositoryId: ID;
  readonly title?: string;
  readonly messages: readonly ConversationMessage[];
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}
