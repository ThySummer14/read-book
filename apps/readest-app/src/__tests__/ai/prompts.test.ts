import { describe, expect, test } from 'vitest';
import { buildSelectionAIPrompt } from '@/services/ai/prompts';
import type { BookNote } from '@/types/book';

describe('buildSelectionAIPrompt', () => {
  test('builds an explain prompt with book, page, and selection context', () => {
    const result = buildSelectionAIPrompt({
      action: 'explain',
      bookTitle: 'Thinking in Systems',
      selectionText: 'A system is more than the sum of its parts.',
      page: 12,
    });

    expect(result.conversationTitle).toBe('Explain: A system is more than the sum of its parts.');
    expect(result.prompt).toContain('from "Thinking in Systems"');
    expect(result.prompt).toContain('Page: 12');
    expect(result.prompt).toContain('Explain the selected passage in plain language.');
    expect(result.prompt).toContain('A system is more than the sum of its parts.');
  });

  test('uses action-specific instructions for summary and questions', () => {
    const summarize = buildSelectionAIPrompt({
      action: 'summarize',
      bookTitle: 'Book',
      selectionText: 'A long section worth summarizing.',
    });
    const questions = buildSelectionAIPrompt({
      action: 'questions',
      bookTitle: 'Book',
      selectionText: 'A passage that deserves questions.',
    });

    expect(summarize.prompt).toContain('Summarize the selected passage concisely.');
    expect(questions.prompt).toContain('Turn the selected passage into useful study questions.');
  });

  test('includes recent note summaries for connect-to-notes prompts', () => {
    const notes: BookNote[] = [
      {
        id: 'old',
        type: 'annotation',
        cfi: 'old',
        note: 'Old note',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'recent',
        type: 'annotation',
        cfi: 'recent',
        note: 'Recent note about feedback loops and incentives',
        createdAt: 2,
        updatedAt: 3,
      },
    ];

    const result = buildSelectionAIPrompt({
      action: 'connect-notes',
      bookTitle: 'Book',
      selectionText: 'This selection mentions feedback.',
      notes,
    });

    expect(result.conversationTitle).toBe('Connect notes: This selection mentions feedback.');
    expect(result.prompt).toContain(
      'Connect the selected passage to my existing notes if possible.',
    );
    expect(result.prompt).toContain('- Recent note about feedback loops and incentives');
  });
});
