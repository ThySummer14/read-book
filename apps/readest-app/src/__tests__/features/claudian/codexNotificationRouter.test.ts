import { describe, expect, it } from 'vitest';
import type { ClaudianStreamChunk } from '@/features/claudian/ported/core/types';
import { CodexNotificationRouter } from '@/features/claudian/ported/codex/CodexNotificationRouter';

describe('CodexNotificationRouter', () => {
  it('does not emit completed agent text again after streaming deltas', () => {
    const chunks: ClaudianStreamChunk[] = [];
    const router = new CodexNotificationRouter((chunk) => chunks.push(chunk));

    router.handleNotification('item/agentMessage/delta', {
      itemId: 'agent-1',
      delta: 'Hello',
    });
    router.handleNotification('item/completed', {
      item: {
        id: 'agent-1',
        type: 'agentMessage',
        text: 'Hello again',
      },
    });

    expect(chunks).toEqual([{ type: 'text', content: 'Hello' }]);
  });

  it('uses completed agent text as fallback when no delta was streamed', () => {
    const chunks: ClaudianStreamChunk[] = [];
    const router = new CodexNotificationRouter((chunk) => chunks.push(chunk));

    router.handleNotification('item/completed', {
      item: {
        id: 'agent-2',
        type: 'agentMessage',
        text: 'Final answer',
      },
    });

    expect(chunks).toEqual([{ type: 'text', content: 'Final answer' }]);
  });
});
