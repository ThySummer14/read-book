import { beforeEach, describe, expect, it } from 'vitest';
import { useBookDataStore } from '@/store/bookDataStore';
import { useNotebookStore } from '@/store/notebookStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import {
  formatReadingContextForPrompt,
  getActiveClaudianBookKey,
  getClaudianReadingContext,
} from '@/features/claudian/adapters/readingContextAdapter';

describe('Claudian reading context adapter', () => {
  beforeEach(() => {
    useSidebarStore.setState({ sideBarBookKey: 'bookhash-view' });
    useNotebookStore.setState({ notebookNewAnnotation: null });
    useReaderStore.setState({
      viewStates: {
        'bookhash-view': {
          key: 'bookhash-view',
          view: null,
          viewerKey: '',
          isPrimary: true,
          loading: false,
          inited: true,
          error: null,
          progress: {
            location: 'loc',
            sectionHref: '',
            sectionLabel: '',
            section: { current: 1, total: 10 },
            pageinfo: { current: 3, total: 100 },
            timeinfo: { section: 0, total: 0 },
            index: 0,
            range: new Range(),
            page: 3,
          },
          ribbonVisible: false,
          ttsEnabled: false,
          syncing: false,
          gridInsets: null,
          previewMode: false,
          viewSettings: null,
        },
      },
    });
    useBookDataStore.setState({
      booksData: {
        bookhash: {
          id: 'bookhash',
          file: null,
          isFixedLayout: false,
          bookDoc: null,
          book: {
            hash: 'bookhash',
            format: 'PDF',
            title: 'Test Book',
            author: 'Reader',
            createdAt: 1,
            updatedAt: 1,
          },
          config: {
            updatedAt: 1,
            booknotes: [
              {
                id: 'note-1',
                type: 'annotation',
                cfi: 'cfi-1',
                page: 3,
                text: 'Highlighted text',
                note: 'Why is this important?',
                createdAt: 1,
                updatedAt: 2,
              },
              {
                id: 'excerpt-1',
                type: 'excerpt',
                cfi: 'cfi-2',
                page: 5,
                text: 'A saved excerpt',
                note: '',
                createdAt: 1,
                updatedAt: 3,
              },
              {
                id: 'bookmark-1',
                type: 'bookmark',
                cfi: 'cfi-3',
                page: 8,
                text: '',
                note: 'Chapter marker',
                createdAt: 1,
                updatedAt: 4,
              },
              {
                id: 'deleted-1',
                type: 'annotation',
                cfi: 'cfi-4',
                page: 9,
                text: 'Deleted text',
                note: 'Deleted note?',
                createdAt: 1,
                updatedAt: 5,
                deletedAt: 6,
              },
            ],
          },
        },
        otherhash: {
          id: 'otherhash',
          file: null,
          isFixedLayout: false,
          bookDoc: null,
          book: {
            hash: 'otherhash',
            format: 'EPUB',
            title: 'Sidebar Book',
            author: 'Other',
            createdAt: 1,
            updatedAt: 1,
          },
          config: {
            updatedAt: 1,
            booknotes: [],
          },
        },
      },
    });
  });

  it('prefers the primary reader view over the sidebar book key', () => {
    useSidebarStore.setState({ sideBarBookKey: 'otherhash-view' });

    expect(getActiveClaudianBookKey()).toBe('bookhash-view');
    expect(getClaudianReadingContext().title).toBe('Test Book');
  });

  it('falls back to the sidebar book key when no primary reader view exists', () => {
    useSidebarStore.setState({ sideBarBookKey: 'otherhash-view' });
    useReaderStore.setState({ viewStates: {} });

    expect(getActiveClaudianBookKey()).toBe('otherhash-view');
    expect(getClaudianReadingContext().title).toBe('Sidebar Book');
  });

  it('reads current book, page, notes, and questions', () => {
    const context = getClaudianReadingContext();
    expect(context.title).toBe('Test Book');
    expect(context.format).toBe('PDF');
    expect(context.currentPage).toBe(3);
    expect(context.totalPages).toBe(100);
    expect(context.notes).toHaveLength(1);
    expect(context.highlights).toHaveLength(2);
    expect(context.questions).toHaveLength(1);
    expect(context.annotationCounts).toEqual({
      highlights: 2,
      notes: 1,
      questions: 1,
      bookmarks: 1,
      total: 3,
    });
    expect(context.annotationDigest).toContain('Current book annotation digest');
    expect(context.annotationDigest).toContain('p.3 [question]');
    expect(context.annotationDigest).toContain('p.5 [highlight]');
    expect(context.annotationDigest).not.toContain('Deleted text');
  });

  it('describes current-book annotation scope in the prompt', () => {
    const prompt = formatReadingContextForPrompt(getClaudianReadingContext());
    expect(prompt).toContain('Visible annotation scope: current book only');
    expect(prompt).toContain('3 total');
    expect(prompt).toContain('Current book annotation digest');
  });
});
