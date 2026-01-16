import { z } from 'zod';

// ============================================================================
// Tool Input Schema
// ============================================================================

export const ToolInputSchema = z.record(z.string(), z.unknown());

// ============================================================================
// Content Block Schemas
// ============================================================================

export const TextContentBlockSchema = z.object({
    type: z.literal('text'),
    text: z.string(),
});

export const ThinkingContentBlockSchema = z.object({
    type: z.literal('thinking'),
    thinking: z.string(),
    signature: z.string(),
});

export const ToolUseContentBlockSchema = z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: ToolInputSchema,
});

export const ToolResultContentBlockSchema = z.object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.union([z.string(), z.array(TextContentBlockSchema)]),
    is_error: z.boolean().optional(),
});

export const AssistantContentBlockSchema = z.discriminatedUnion('type', [
    TextContentBlockSchema,
    ThinkingContentBlockSchema,
    ToolUseContentBlockSchema,
]);

export const UserContentBlockSchema = z.discriminatedUnion('type', [
    TextContentBlockSchema,
    ToolResultContentBlockSchema,
]);

// ============================================================================
// Cache & Usage Schemas
// ============================================================================

export const CacheCreationSchema = z.object({
    ephemeral_5m_input_tokens: z.number(),
    ephemeral_1h_input_tokens: z.number(),
});

export const ServerToolUseSchema = z.object({
    web_search_requests: z.number(),
    web_fetch_requests: z.number(),
});

export const UsageSchema = z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    cache_creation_input_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    cache_creation: CacheCreationSchema.optional(),
    service_tier: z.enum(['standard']).nullable(),
    server_tool_use: ServerToolUseSchema.optional(),
});

// ============================================================================
// Context Management & Container Schemas
// ============================================================================

export const ContextManagementSchema = z
    .object({
        truncated_tokens: z.number().optional(),
        strategy: z.string().optional(),
    })
    .passthrough();

export const ContainerSchema = z
    .object({
        id: z.string().optional(),
        status: z.string().optional(),
    })
    .passthrough();

// ============================================================================
// Tool Use Result Schema
// ============================================================================

export const ToolUseResultSchema = z
    .object({
        tool_use_id: z.string().optional(),
        content: z.union([z.string(), z.array(z.unknown())]).optional(),
        is_error: z.boolean().optional(),
    })
    .passthrough();

// ============================================================================
// Thinking Metadata Schema
// ============================================================================

export const ThinkingMetadataSchema = z
    .object({
        thinking_budget_tokens: z.number().optional(),
        thinking_used_tokens: z.number().optional(),
    })
    .passthrough();

// ============================================================================
// Todo Item Schema
// ============================================================================

export const TodoItemSchema = z.object({
    id: z.string().optional(),
    content: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed']),
    priority: z.number().optional(),
});

// ============================================================================
// File Backup Schema
// ============================================================================

export const FileBackupSchema = z
    .object({
        path: z.string().optional(),
        content: z.string().optional(),
        hash: z.string().optional(),
    })
    .passthrough();

// ============================================================================
// Message Content Schemas
// ============================================================================

export const UserMessageContentSchema = z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(UserContentBlockSchema)]),
});

export const AssistantMessageContentSchema = z.object({
    id: z.string(),
    model: z.string(),
    role: z.literal('assistant'),
    type: z.literal('message'),
    stop_reason: z.enum(['stop_sequence', 'tool_use', 'end_turn']).nullable(),
    stop_sequence: z.string().nullable(),
    content: z.array(AssistantContentBlockSchema),
    usage: UsageSchema,
    context_management: ContextManagementSchema.optional(),
    container: ContainerSchema.optional(),
});

// ============================================================================
// Base & Shared Message Fields
// ============================================================================

const BaseMessageFieldsSchema = z.object({
    uuid: z.guid(),
    parentUuid: z.guid().nullable(),
    timestamp: z.iso.datetime(),
    sessionId: z.guid(),
    version: z.string(),
    cwd: z.string(),
    gitBranch: z.string().optional(),
    isSidechain: z.boolean(),
    userType: z.literal('external'),
});

const SharedMessageFieldsSchema = z.object({
    agentId: z.string().optional(),
    slug: z.string().optional(),
    isMeta: z.boolean().optional(),
    sourceToolUseID: z.string().optional(),
    toolUseResult: ToolUseResultSchema.optional(),
});

// ============================================================================
// Message Schemas
// ============================================================================

export const UserMessageSchema = z.object({
    ...BaseMessageFieldsSchema.shape,
    ...SharedMessageFieldsSchema.shape,
    type: z.literal('user'),
    message: UserMessageContentSchema,
});

export const AssistantMessageSchema = z.object({
    ...BaseMessageFieldsSchema.shape,
    ...SharedMessageFieldsSchema.shape,
    type: z.literal('assistant'),
    message: AssistantMessageContentSchema,
    requestId: z.string().optional(),
    thinkingMetadata: ThinkingMetadataSchema.optional(),
    todos: z.array(TodoItemSchema).optional(),
    isApiErrorMessage: z.boolean().optional(),
});

export const FileHistorySnapshotSchema = z.object({
    type: z.literal('file-history-snapshot'),
    messageId: z.guid(),
    isSnapshotUpdate: z.boolean(),
    snapshot: z.object({
        messageId: z.guid(),
        trackedFileBackups: z.record(z.string(), FileBackupSchema),
        timestamp: z.iso.datetime(),
    }),
});

export const MessageSchema = z.discriminatedUnion('type', [
    UserMessageSchema,
    AssistantMessageSchema,
    FileHistorySnapshotSchema,
]);

// ============================================================================
// Claude Stream Message Schemas (for claude.ts)
// ============================================================================

export const StreamMessageContentSchema = z
    .object({
        type: z.string(),
        text: z.string().optional(),
    })
    .passthrough();

export const StreamMessagePayloadSchema = z
    .object({
        role: z.string().optional(),
        content: z.union([z.string(), z.array(StreamMessageContentSchema)]).optional(),
    })
    .passthrough();

export const ClaudeStreamMessageSchema = z
    .object({
        type: z.string(),
        subtype: z.string().optional(),
        message: StreamMessagePayloadSchema.optional(),
        session_id: z.string().optional(),
        result: z.string().optional(),
    })
    .passthrough();

export const ClaudeOptionsSchema = z.object({
    cwd: z.string().optional(),
    model: z.string().optional(),
    allowedTools: z.array(z.string()).optional(),
    systemPrompt: z.string().optional(),
    dangerouslySkipPermissions: z.boolean().optional(),
    sessionId: z.string().optional(),
    resume: z.boolean().optional(),
    args: z.array(z.string()).optional(),
});

export const ClaudeResponseSchema = z.object({
    sessionId: z.string(),
    messages: z.array(ClaudeStreamMessageSchema),
    text: z.string(),
    result: ClaudeStreamMessageSchema.optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ToolInput = z.infer<typeof ToolInputSchema>;

export type TextContentBlock = z.infer<typeof TextContentBlockSchema>;
export type ThinkingContentBlock = z.infer<typeof ThinkingContentBlockSchema>;
export type ToolUseContentBlock = z.infer<typeof ToolUseContentBlockSchema>;
export type ToolResultContentBlock = z.infer<typeof ToolResultContentBlockSchema>;
export type AssistantContentBlock = z.infer<typeof AssistantContentBlockSchema>;
export type UserContentBlock = z.infer<typeof UserContentBlockSchema>;

export type CacheCreation = z.infer<typeof CacheCreationSchema>;
export type ServerToolUse = z.infer<typeof ServerToolUseSchema>;
export type Usage = z.infer<typeof UsageSchema>;

export type ContextManagement = z.infer<typeof ContextManagementSchema>;
export type Container = z.infer<typeof ContainerSchema>;
export type ToolUseResult = z.infer<typeof ToolUseResultSchema>;
export type ThinkingMetadata = z.infer<typeof ThinkingMetadataSchema>;
export type TodoItem = z.infer<typeof TodoItemSchema>;
export type FileBackup = z.infer<typeof FileBackupSchema>;

export type UserMessageContent = z.infer<typeof UserMessageContentSchema>;
export type AssistantMessageContent = z.infer<typeof AssistantMessageContentSchema>;

export type UserMessage = z.infer<typeof UserMessageSchema>;
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
export type FileHistorySnapshot = z.infer<typeof FileHistorySnapshotSchema>;
export type Message = z.infer<typeof MessageSchema>;

export type StreamMessageContent = z.infer<typeof StreamMessageContentSchema>;
export type StreamMessagePayload = z.infer<typeof StreamMessagePayloadSchema>;
export type ClaudeStreamMessage = z.infer<typeof ClaudeStreamMessageSchema>;
export type ClaudeOptions = z.infer<typeof ClaudeOptionsSchema>;
export type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>;
