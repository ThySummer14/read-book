import { describe, expect, it } from 'vitest';
import { ClaudianChatState } from '@/features/claudian/ported/chat/ChatState';

describe('Claudian chat state', () => {
  it('can append a regenerated assistant response without duplicating the user message', () => {
    const state = new ClaudianChatState(4);
    const tab = state.ensureInitialTab();
    const user = state.appendMessage(tab.id, {
      role: 'user',
      content: 'Summarize my notes',
    });
    expect(user).not.toBeNull();

    const firstAssistant = state.appendMessage(tab.id, {
      role: 'assistant',
      content: 'First answer',
    });
    const regeneratedAssistant = state.appendMessage(tab.id, {
      role: 'assistant',
      content: 'Regenerated answer',
    });

    expect(firstAssistant?.conversation.id).toBe(user?.conversation.id);
    expect(regeneratedAssistant?.conversation.id).toBe(user?.conversation.id);
    expect(user?.conversation.messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'assistant',
    ]);
    expect(user?.conversation.messages.filter((message) => message.role === 'user')).toHaveLength(
      1,
    );
  });
});
