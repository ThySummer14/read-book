// Ported from Claudian's core chat/settings/provider boundaries and adapted
// for Readest's reader-first AI side panel.

export type ClaudianProviderId = 'codex';
export type ClaudianPermissionMode = 'normal' | 'plan' | 'yolo';
export type ClaudianSafeMode = 'read-only' | 'workspace-write' | 'danger-full-access';
export type ClaudianReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface ClaudianSettings {
  enabled: boolean;
  provider: ClaudianProviderId;
  codexCliPath: string;
  model: string;
  permissionMode: ClaudianPermissionMode;
  safeMode: ClaudianSafeMode;
  reasoningEffort: ClaudianReasoningEffort;
  reasoningSummary: 'auto' | 'concise' | 'detailed' | 'none';
  autoScroll: boolean;
  maxTabs: number;
  tabBarPosition: 'header' | 'input';
}

export interface ClaudianConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  contentBlocks?: ClaudianContentBlock[];
  createdAt: number;
  pending?: boolean;
  interrupted?: boolean;
  error?: boolean;
  metadata?: {
    requestId?: string;
    providerTurnId?: string;
  };
}

export type ClaudianContentBlock =
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'tool'; content: string }
  | { type: 'error'; content: string };

export interface ClaudianConversation {
  id: string;
  title: string;
  provider: ClaudianProviderId;
  bookKey?: string | null;
  createdAt: number;
  updatedAt: number;
  messages: ClaudianConversationMessage[];
}

export interface ClaudianTabState {
  id: string;
  title: string;
  conversationId: string | null;
  provider: ClaudianProviderId;
  isStreaming: boolean;
}

export interface ClaudianStreamChunk {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'tool_output' | 'error' | 'done';
  content?: string;
  id?: string;
  name?: string;
  input?: unknown;
  isError?: boolean;
}

export interface ClaudianReadingContext {
  bookKey: string | null;
  bookHash: string | null;
  title: string;
  author: string;
  format: string;
  currentPage: number | null;
  totalPages: number | null;
  progressPercent: number | null;
  selectionText: string | null;
  annotationCounts: ClaudianAnnotationCounts;
  annotationDigest: string;
  annotationDigestTruncated: boolean;
  notes: ClaudianAnnotationSummary[];
  highlights: ClaudianAnnotationSummary[];
  questions: ClaudianAnnotationSummary[];
}

export interface ClaudianAnnotationCounts {
  highlights: number;
  notes: number;
  questions: number;
  bookmarks: number;
  total: number;
}

export interface ClaudianAnnotationSummary {
  id: string;
  type: string;
  page: number | null;
  text: string;
  note: string;
  color?: string;
  style?: string;
  updatedAt: number;
}

export interface ClaudianRuntimeRequest {
  prompt: string;
  context: ClaudianReadingContext;
  settings: ClaudianSettings;
  conversation: ClaudianConversation | null;
}

export interface ClaudianRuntime {
  send(request: ClaudianRuntimeRequest): AsyncGenerator<ClaudianStreamChunk>;
  cancel(): void;
  isAvailable(): Promise<boolean>;
}
