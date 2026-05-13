import type { ClaudianConversationMessage, ClaudianStreamChunk } from '../core/types';
import {
  appendStreamingMessageChunk,
  createStreamingMessageState,
  getStreamingMessageContent,
  type StreamingMessageState,
} from './streamingMessageFormatter';

export interface ClaudianTurnState {
  requestId: string;
  streamState: StreamingMessageState;
  canceled: boolean;
}

export const createClaudianTurnState = (
  requestId = createClaudianRequestId(),
): ClaudianTurnState => ({
  requestId,
  streamState: createStreamingMessageState(),
  canceled: false,
});

export const appendClaudianTurnChunk = (
  turn: ClaudianTurnState,
  chunk: ClaudianStreamChunk,
): ClaudianTurnState => ({
  ...turn,
  streamState: appendStreamingMessageChunk(turn.streamState, chunk),
});

export const cancelClaudianTurn = (turn: ClaudianTurnState): ClaudianTurnState => ({
  ...turn,
  canceled: true,
});

export const appendClaudianTurnError = (
  turn: ClaudianTurnState,
  message: string,
): ClaudianTurnState =>
  appendClaudianTurnChunk(turn, {
    type: 'error',
    content: message,
  });

export const getClaudianTurnPendingPatch = (
  turn: ClaudianTurnState,
  chunk: ClaudianStreamChunk,
): Partial<ClaudianConversationMessage> => ({
  content: getStreamingMessageContent(turn.streamState),
  thinking: turn.streamState.thinking,
  contentBlocks: turn.streamState.contentBlocks,
  pending: true,
  error: chunk.type === 'error' || undefined,
});

export const getClaudianTurnFinalPatch = (
  turn: ClaudianTurnState,
  emptyResponseText: string,
): Partial<ClaudianConversationMessage> =>
  turn.canceled
    ? {
        content: getStreamingMessageContent(turn.streamState),
        thinking: turn.streamState.thinking,
        contentBlocks: turn.streamState.contentBlocks,
        pending: false,
        interrupted: true,
      }
    : {
        content: getStreamingMessageContent(turn.streamState) || emptyResponseText,
        thinking: turn.streamState.thinking,
        contentBlocks: turn.streamState.contentBlocks,
        pending: false,
      };

export const getClaudianTurnErrorPatch = (
  turn: ClaudianTurnState,
): Partial<ClaudianConversationMessage> => ({
  content: getStreamingMessageContent(turn.streamState),
  thinking: turn.streamState.thinking,
  contentBlocks: turn.streamState.contentBlocks,
  pending: false,
  error: true,
});

export const createClaudianRequestId = () =>
  `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
