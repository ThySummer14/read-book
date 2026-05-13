import { describe, expect, it } from 'vitest';
import {
  appendClaudianTurnChunk,
  appendClaudianTurnError,
  cancelClaudianTurn,
  createClaudianTurnState,
  getClaudianTurnErrorPatch,
  getClaudianTurnFinalPatch,
  getClaudianTurnPendingPatch,
} from '@/features/claudian/ported/chat/turnLifecycle';

describe('Claudian turn lifecycle', () => {
  it('keeps streaming updates on a single assistant message patch', () => {
    let turn = createClaudianTurnState('request-1');
    turn = appendClaudianTurnChunk(turn, { type: 'thinking', content: 'Reasoning.' });
    turn = appendClaudianTurnChunk(turn, { type: 'text', content: 'Answer.' });

    expect(getClaudianTurnPendingPatch(turn, { type: 'text', content: 'Answer.' })).toMatchObject({
      content: 'Answer.',
      thinking: 'Reasoning.',
      pending: true,
      contentBlocks: [
        { type: 'thinking', content: 'Reasoning.' },
        { type: 'text', content: 'Answer.' },
      ],
    });
  });

  it('marks canceled turns as interrupted without writing the empty fallback', () => {
    let turn = createClaudianTurnState('request-2');
    turn = appendClaudianTurnChunk(turn, { type: 'text', content: 'Partial.' });
    turn = cancelClaudianTurn(turn);

    expect(getClaudianTurnFinalPatch(turn, 'No response.')).toMatchObject({
      content: 'Partial.',
      pending: false,
      interrupted: true,
    });
  });

  it('uses fallback text only for non-canceled empty responses', () => {
    const turn = createClaudianTurnState('request-3');

    expect(getClaudianTurnFinalPatch(turn, 'No response.')).toMatchObject({
      content: 'No response.',
      pending: false,
    });
  });

  it('keeps runtime errors visible as error blocks', () => {
    const turn = appendClaudianTurnError(createClaudianTurnState('request-4'), 'Runtime failed');

    expect(getClaudianTurnErrorPatch(turn)).toMatchObject({
      content: 'Runtime failed',
      pending: false,
      error: true,
      contentBlocks: [{ type: 'error', content: 'Runtime failed' }],
    });
  });
});
