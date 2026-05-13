import type { ClaudianContentBlock, ClaudianStreamChunk } from '../core/types';

export interface StreamingMessageState {
  answer: string;
  thinking: string;
  toolText: string;
  error: string;
  contentBlocks: ClaudianContentBlock[];
  lastChunkType: ClaudianStreamChunk['type'] | null;
}

export const createStreamingMessageState = (): StreamingMessageState => ({
  answer: '',
  thinking: '',
  toolText: '',
  error: '',
  contentBlocks: [],
  lastChunkType: null,
});

export const appendStreamingMessageChunk = (
  state: StreamingMessageState,
  chunk: ClaudianStreamChunk,
): StreamingMessageState => {
  if (chunk.type === 'done') return state;

  const nextState = appendChunkContent(state, chunk);
  return {
    ...nextState,
    lastChunkType: chunk.type,
  };
};

const appendChunkContent = (
  state: StreamingMessageState,
  chunk: ClaudianStreamChunk,
): StreamingMessageState => {
  if (chunk.type === 'thinking') {
    return appendThinkingDelta(state, chunk.content ?? '');
  }

  if (chunk.type === 'text' || chunk.type === 'tool_output') {
    return appendAnswerDelta(state, chunk.content ?? '');
  }

  if (chunk.type === 'tool_use') {
    return appendToolText(state, `\`${chunk.name ?? 'tool'}\` started.`);
  }

  if (chunk.type === 'tool_result') {
    return appendToolText(state, `\`${chunk.name ?? 'tool'}\`: ${chunk.content ?? 'done'}`);
  }

  if (chunk.type === 'error') {
    return {
      ...state,
      ...updateBlockText(
        state,
        'error',
        appendParagraph(state.error, chunk.content ?? 'Runtime error'),
      ),
    };
  }

  return state;
};

const appendThinkingDelta = (
  state: StreamingMessageState,
  delta: string,
): StreamingMessageState => {
  if (!delta) return state;
  const thinking = state.thinking + delta;
  return {
    ...state,
    thinking,
    contentBlocks: upsertStreamingBlock(state.contentBlocks, 'thinking', thinking),
  };
};

const appendAnswerDelta = (state: StreamingMessageState, delta: string): StreamingMessageState => {
  if (!delta) return state;
  const answer = state.answer + delta;
  return {
    ...state,
    answer,
    contentBlocks: upsertStreamingBlock(state.contentBlocks, 'text', answer),
  };
};

const appendToolText = (state: StreamingMessageState, text: string): StreamingMessageState => ({
  ...state,
  ...updateBlockText(state, 'tool', appendParagraph(state.toolText, text)),
});

const updateBlockText = (
  state: StreamingMessageState,
  type: Extract<ClaudianContentBlock['type'], 'tool' | 'error'>,
  content: string,
): Pick<StreamingMessageState, 'toolText' | 'error' | 'contentBlocks'> => ({
  toolText: type === 'tool' ? content : state.toolText,
  error: type === 'error' ? content : state.error,
  contentBlocks: upsertStreamingBlock(state.contentBlocks, type, content),
});

const appendParagraph = (current: string, next: string): string =>
  current ? `${current}\n\n${next}` : next;

export const getStreamingMessageContent = (state: StreamingMessageState): string =>
  [state.answer, state.toolText, state.error].filter(Boolean).join('\n\n');

const upsertStreamingBlock = (
  blocks: ClaudianContentBlock[],
  type: ClaudianContentBlock['type'],
  content: string,
): ClaudianContentBlock[] => {
  const next = [...blocks];
  const last = next[next.length - 1];
  if (last?.type === type) {
    next[next.length - 1] = { type, content };
    return next;
  }
  next.push({ type, content });
  return next;
};
