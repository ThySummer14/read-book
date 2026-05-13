import { describe, expect, it } from 'vitest';
import {
  appendStreamingMessageChunk,
  createStreamingMessageState,
  getStreamingMessageContent,
} from '@/features/claudian/ported/chat/streamingMessageFormatter';

describe('Claudian streaming message formatter', () => {
  it('keeps consecutive thinking deltas in the thinking field', () => {
    let state = createStreamingMessageState();
    state = appendStreamingMessageChunk(state, { type: 'thinking', content: 'First ' });
    state = appendStreamingMessageChunk(state, { type: 'thinking', content: 'second' });

    expect(state.thinking).toBe('First second');
    expect(state.answer).toBe('');
    expect(state.contentBlocks).toEqual([{ type: 'thinking', content: 'First second' }]);
    expect(getStreamingMessageContent(state)).toBe('');
  });

  it('separates normal text after thinking into answer content', () => {
    let state = createStreamingMessageState();
    state = appendStreamingMessageChunk(state, { type: 'thinking', content: 'Reasoning.' });
    state = appendStreamingMessageChunk(state, { type: 'text', content: 'Answer.' });

    expect(state.thinking).toBe('Reasoning.');
    expect(state.answer).toBe('Answer.');
    expect(state.contentBlocks).toEqual([
      { type: 'thinking', content: 'Reasoning.' },
      { type: 'text', content: 'Answer.' },
    ]);
    expect(getStreamingMessageContent(state)).toBe('Answer.');
  });

  it('keeps multiline thinking content as plain thinking text', () => {
    let state = createStreamingMessageState();
    state = appendStreamingMessageChunk(state, {
      type: 'thinking',
      content: 'Line one\nLine two',
    });

    expect(state.thinking).toBe('Line one\nLine two');
    expect(state.contentBlocks).toEqual([{ type: 'thinking', content: 'Line one\nLine two' }]);
  });

  it('keeps tool and error chunks readable', () => {
    let state = createStreamingMessageState();
    state = appendStreamingMessageChunk(state, { type: 'tool_use', name: 'search' });
    state = appendStreamingMessageChunk(state, {
      type: 'tool_result',
      name: 'search',
      content: 'done',
    });
    state = appendStreamingMessageChunk(state, { type: 'error', content: 'failed' });

    const content = getStreamingMessageContent(state);
    expect(content).toContain('`search` started.');
    expect(content).toContain('`search`: done');
    expect(content).toContain('failed');
    expect(state.contentBlocks).toEqual([
      { type: 'tool', content: '`search` started.\n\n`search`: done' },
      { type: 'error', content: 'failed' },
    ]);
  });

  it('keeps partial answer blocks usable when a later error arrives', () => {
    let state = createStreamingMessageState();
    state = appendStreamingMessageChunk(state, { type: 'text', content: 'Partial answer.' });
    state = appendStreamingMessageChunk(state, { type: 'error', content: 'Interrupted' });

    expect(getStreamingMessageContent(state)).toBe('Partial answer.\n\nInterrupted');
    expect(state.contentBlocks).toEqual([
      { type: 'text', content: 'Partial answer.' },
      { type: 'error', content: 'Interrupted' },
    ]);
  });
});
