import type {
  ClaudianConversation,
  ClaudianConversationMessage,
  ClaudianProviderId,
  ClaudianTabState,
} from '../core/types';

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Adapted from Claudian's ChatState/TabManager split: keep tab/session state
// explicit so the Readest panel can stay independent from Notebook AI.
export class ClaudianChatState {
  private tabs = new Map<string, ClaudianTabState>();
  private conversations = new Map<string, ClaudianConversation>();
  private activeTabId: string | null = null;

  constructor(private readonly maxTabs: number) {}

  getTabs(): ClaudianTabState[] {
    return Array.from(this.tabs.values());
  }

  getActiveTab(): ClaudianTabState | null {
    return this.activeTabId ? (this.tabs.get(this.activeTabId) ?? null) : null;
  }

  getConversation(id: string | null | undefined): ClaudianConversation | null {
    return id ? (this.conversations.get(id) ?? null) : null;
  }

  ensureInitialTab(provider: ClaudianProviderId = 'codex'): ClaudianTabState {
    const active = this.getActiveTab();
    if (active) return active;
    return this.createTab(provider);
  }

  createTab(provider: ClaudianProviderId = 'codex'): ClaudianTabState {
    if (this.tabs.size >= this.maxTabs) {
      const existing = this.getActiveTab();
      if (existing) return existing;
    }

    const tab: ClaudianTabState = {
      id: createId('tab'),
      title: 'New chat',
      conversationId: null,
      provider,
      isStreaming: false,
    };
    this.tabs.set(tab.id, tab);
    this.activeTabId = tab.id;
    return tab;
  }

  closeTab(tabId: string): void {
    this.tabs.delete(tabId);
    if (this.activeTabId !== tabId) return;
    this.activeTabId = this.tabs.values().next().value?.id ?? null;
  }

  switchTab(tabId: string): void {
    if (this.tabs.has(tabId)) {
      this.activeTabId = tabId;
    }
  }

  setStreaming(tabId: string, isStreaming: boolean): void {
    const tab = this.tabs.get(tabId);
    if (tab) tab.isStreaming = isStreaming;
  }

  appendMessage(
    tabId: string,
    message: Omit<ClaudianConversationMessage, 'id' | 'createdAt'>,
  ): {
    conversation: ClaudianConversation;
    message: ClaudianConversationMessage;
  } | null {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    let conversation = tab.conversationId ? this.conversations.get(tab.conversationId) : undefined;

    if (!conversation) {
      conversation = {
        id: createId('conversation'),
        title: message.role === 'user' ? message.content.slice(0, 48) || 'New chat' : 'New chat',
        provider: tab.provider,
        bookKey: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      this.conversations.set(conversation.id, conversation);
      tab.conversationId = conversation.id;
    }

    const savedMessage: ClaudianConversationMessage = {
      ...message,
      id: createId('message'),
      createdAt: Date.now(),
    };
    conversation.messages.push(savedMessage);
    conversation.updatedAt = Date.now();
    if (message.role === 'user' && conversation.title === 'New chat') {
      conversation.title = message.content.slice(0, 48) || 'New chat';
      tab.title = conversation.title;
    }
    return { conversation, message: savedMessage };
  }

  updateMessage(
    conversationId: string,
    messageId: string,
    update: Partial<ClaudianConversationMessage>,
  ): void {
    const conversation = this.conversations.get(conversationId);
    const message = conversation?.messages.find((item) => item.id === messageId);
    if (!conversation || !message) return;
    Object.assign(message, update);
    conversation.updatedAt = Date.now();
  }

  toJSON(): {
    activeTabId: string | null;
    tabs: ClaudianTabState[];
    conversations: ClaudianConversation[];
  } {
    return {
      activeTabId: this.activeTabId,
      tabs: this.getTabs(),
      conversations: Array.from(this.conversations.values()),
    };
  }

  restore(snapshot: ReturnType<ClaudianChatState['toJSON']> | null | undefined): void {
    if (!snapshot) return;
    this.tabs = new Map(snapshot.tabs.map((tab) => [tab.id, tab]));
    this.conversations = new Map(
      snapshot.conversations.map((conversation) => [conversation.id, conversation]),
    );
    this.activeTabId =
      snapshot.activeTabId && this.tabs.has(snapshot.activeTabId)
        ? snapshot.activeTabId
        : (this.tabs.values().next().value?.id ?? null);
  }
}
