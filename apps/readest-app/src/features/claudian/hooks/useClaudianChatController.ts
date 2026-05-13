'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  DEFAULT_CLAUDIAN_SETTINGS,
  normalizeClaudianSettings,
} from '../ported/core/defaultSettings';
import type {
  ClaudianConversationMessage,
  ClaudianRuntime,
  ClaudianSettings,
} from '../ported/core/types';
import { CodexChatRuntime } from '../ported/codex/CodexChatRuntime';
import { ClaudianChatState } from '../ported/chat/ChatState';
import {
  appendClaudianTurnChunk,
  appendClaudianTurnError,
  cancelClaudianTurn,
  createClaudianTurnState,
  getClaudianTurnErrorPatch,
  getClaudianTurnFinalPatch,
  getClaudianTurnPendingPatch,
  type ClaudianTurnState,
} from '../ported/chat/turnLifecycle';
import { getClaudianReadingContext } from '../adapters/readingContextAdapter';
import { notifyClaudian } from '../adapters/notificationAdapter';
import { useClaudianStore } from '../store/claudianStore';

interface UseClaudianChatControllerOptions {
  settings: Partial<ClaudianSettings> | null | undefined;
  openSettings: () => void;
}

interface SendPromptOptions {
  appendUserMessage?: boolean;
}

export const useClaudianChatController = ({
  settings,
  openSettings,
}: UseClaudianChatControllerOptions) => {
  const _ = useTranslation();
  const { upsertConversation } = useClaudianStore();
  const claudianSettings = useMemo(
    () => normalizeClaudianSettings(settings ?? DEFAULT_CLAUDIAN_SETTINGS),
    [settings],
  );
  const chatStateRef = useRef(new ClaudianChatState(claudianSettings.maxTabs));
  const runtimeRef = useRef<ClaudianRuntime | null>(null);
  const activeTurnRef = useRef<ClaudianTurnState | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [draft, setDraft] = useState('');

  const forceRender = useCallback(() => setRenderTick((value) => value + 1), []);
  const activeTab = chatStateRef.current.ensureInitialTab();
  const activeConversation = chatStateRef.current.getConversation(activeTab.conversationId);
  const messages: ClaudianConversationMessage[] = activeConversation?.messages ?? [];

  const getRuntime = useCallback(() => {
    runtimeRef.current ??= new CodexChatRuntime();
    return runtimeRef.current;
  }, []);

  const createChat = useCallback(() => {
    chatStateRef.current.createTab('codex');
    forceRender();
  }, [forceRender]);

  const switchTab = useCallback(
    (tabId: string) => {
      chatStateRef.current.switchTab(tabId);
      forceRender();
    },
    [forceRender],
  );

  const sendPrompt = useCallback(
    async (prompt: string, { appendUserMessage = true }: SendPromptOptions = {}) => {
      const currentTab = chatStateRef.current.getActiveTab();
      if (!prompt || !currentTab || currentTab.isStreaming || activeTurnRef.current) return;

      if (!claudianSettings.enabled) {
        notifyClaudian(_('Enable Claudian in Settings first.'), 'warning');
        openSettings();
        return;
      }

      setDraft('');
      let turn = createClaudianTurnState();
      const userResult = appendUserMessage
        ? chatStateRef.current.appendMessage(currentTab.id, {
            role: 'user',
            content: prompt,
            metadata: { requestId: turn.requestId },
          })
        : null;
      const assistantResult = chatStateRef.current.appendMessage(currentTab.id, {
        role: 'assistant',
        content: '',
        thinking: '',
        contentBlocks: [],
        pending: true,
        metadata: { requestId: turn.requestId },
      });
      if (appendUserMessage && !userResult) return;
      if (!assistantResult) return;
      const conversation = assistantResult.conversation;

      activeTurnRef.current = turn;
      if (userResult) upsertConversation(userResult.conversation);
      upsertConversation(conversation);
      chatStateRef.current.setStreaming(currentTab.id, true);
      forceRender();

      try {
        const runtime = getRuntime();
        for await (const chunk of runtime.send({
          prompt,
          context: getClaudianReadingContext(),
          settings: claudianSettings,
          conversation,
        })) {
          if (chunk.type === 'done') break;
          turn = appendClaudianTurnChunk(turn, chunk);
          const activeTurn = activeTurnRef.current;
          if (activeTurn?.requestId !== turn.requestId) break;
          if (activeTurn.canceled) {
            turn = activeTurn;
            break;
          }
          activeTurnRef.current = turn;
          chatStateRef.current.updateMessage(conversation.id, assistantResult.message.id, {
            ...getClaudianTurnPendingPatch(turn, chunk),
          });
          forceRender();
        }

        if (activeTurnRef.current?.requestId === turn.requestId) {
          turn = activeTurnRef.current;
        }
        chatStateRef.current.updateMessage(
          conversation.id,
          assistantResult.message.id,
          getClaudianTurnFinalPatch(turn, _('No response.')),
        );
        upsertConversation(conversation);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : _('Claudian request failed.');
        turn = appendClaudianTurnError(turn, errorMessage);
        chatStateRef.current.updateMessage(conversation.id, assistantResult.message.id, {
          ...getClaudianTurnErrorPatch(turn),
        });
        upsertConversation(conversation);
      } finally {
        if (activeTurnRef.current?.requestId === turn.requestId) {
          activeTurnRef.current = null;
        }
        chatStateRef.current.setStreaming(currentTab.id, false);
        forceRender();
      }
    },
    [_, claudianSettings, forceRender, getRuntime, openSettings, upsertConversation],
  );

  const send = useCallback(async () => {
    await sendPrompt(draft.trim());
  }, [draft, sendPrompt]);

  const retryLast = useCallback(async () => {
    const activeConversationId = chatStateRef.current.getActiveTab()?.conversationId;
    const activeConversation = chatStateRef.current.getConversation(activeConversationId);
    const lastUserMessage = [...(activeConversation?.messages ?? [])]
      .reverse()
      .find((message) => message.role === 'user' && message.content.trim());
    if (!lastUserMessage) return;
    await sendPrompt(lastUserMessage.content.trim(), { appendUserMessage: false });
  }, [sendPrompt]);

  const stop = useCallback(() => {
    const currentTab = chatStateRef.current.getActiveTab();
    if (activeTurnRef.current) {
      activeTurnRef.current = cancelClaudianTurn(activeTurnRef.current);
    }
    runtimeRef.current?.cancel();
    if (currentTab) chatStateRef.current.setStreaming(currentTab.id, false);
    forceRender();
  }, [forceRender]);

  return {
    activeTab,
    draft,
    messages,
    renderTick,
    tabs: chatStateRef.current.getTabs(),
    createChat,
    forceRender,
    send,
    setDraft,
    retryLast,
    stop,
    switchTab,
  };
};
