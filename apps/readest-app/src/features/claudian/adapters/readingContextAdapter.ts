import { useBookDataStore } from '@/store/bookDataStore';
import { useNotebookStore } from '@/store/notebookStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import type {
  ClaudianAnnotationCounts,
  ClaudianAnnotationSummary,
  ClaudianReadingContext,
} from '../ported/core/types';
import { ReadestAnnotationAdapter } from './annotationAdapter';

const annotationAdapter = new ReadestAnnotationAdapter();
const DIGEST_ITEM_LIMIT = 40;
const DIGEST_TOTAL_CHAR_LIMIT = 8_000;
const DIGEST_ITEM_CHAR_LIMIT = 240;

export const getClaudianReadingContext = (): ClaudianReadingContext => {
  const bookKey = getActiveClaudianBookKey();
  const bookData = bookKey ? useBookDataStore.getState().getBookData(bookKey) : null;
  const progress = bookKey ? useReaderStore.getState().getProgress(bookKey) : null;
  const selection = useNotebookStore.getState().notebookNewAnnotation;
  const allAnnotations = annotationAdapter.listAnnotations(bookKey);
  const notes = allAnnotations.filter(isNoteAnnotation);
  const highlights = allAnnotations.filter(isHighlightAnnotation);
  const questions = allAnnotations.filter(isQuestionAnnotation);
  const annotationCounts = getAnnotationCounts(allAnnotations, {
    notes,
    highlights,
    questions,
  });
  const digest = buildAnnotationDigest(allAnnotations);

  return {
    bookKey,
    bookHash: bookData?.book?.hash ?? null,
    title:
      bookData?.book?.title ||
      stringifyMetadataValue(bookData?.bookDoc?.metadata.title) ||
      'Untitled book',
    author:
      bookData?.book?.author || stringifyMetadataValue(bookData?.bookDoc?.metadata.author) || '',
    format: bookData?.book?.format || '',
    currentPage: progress?.page ?? bookData?.book?.progress?.[0] ?? null,
    totalPages: progress?.pageinfo.total ?? bookData?.book?.progress?.[1] ?? null,
    progressPercent:
      progress?.pageinfo.total && progress.page
        ? Math.min(100, Math.max(0, (progress.page / progress.pageinfo.total) * 100))
        : null,
    selectionText: selection?.text ?? null,
    annotationCounts,
    annotationDigest: digest.text,
    annotationDigestTruncated: digest.truncated,
    notes: notes.slice(0, 12),
    highlights: highlights.slice(0, 12),
    questions: questions.slice(0, 12),
  };
};

export const getActiveClaudianBookKey = (): string | null => {
  const readerState = useReaderStore.getState();
  const primaryView = Object.values(readerState.viewStates).find(
    (viewState) => viewState.isPrimary && viewState.key,
  );
  return primaryView?.key || useSidebarStore.getState().sideBarBookKey;
};

const stringifyMetadataValue = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(stringifyMetadataValue).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      stringifyMetadataValue(record['name']) ||
      stringifyMetadataValue(record['en']) ||
      stringifyMetadataValue(record['default']) ||
      ''
    );
  }
  return String(value);
};

const isNoteAnnotation = (item: ClaudianAnnotationSummary): boolean =>
  item.type === 'annotation' && Boolean(item.note.trim());

const isHighlightAnnotation = (item: ClaudianAnnotationSummary): boolean =>
  (item.type === 'annotation' || item.type === 'excerpt') && Boolean(item.text.trim());

const isQuestionAnnotation = (item: ClaudianAnnotationSummary): boolean => {
  const body = `${item.note}\n${item.text}`.toLowerCase();
  return body.includes('?') || body.includes('？') || body.includes('question');
};

const getAnnotationCounts = (
  annotations: ClaudianAnnotationSummary[],
  grouped: {
    notes: ClaudianAnnotationSummary[];
    highlights: ClaudianAnnotationSummary[];
    questions: ClaudianAnnotationSummary[];
  },
): ClaudianAnnotationCounts => ({
  highlights: grouped.highlights.length,
  notes: grouped.notes.length,
  questions: grouped.questions.length,
  bookmarks: annotations.filter((item) => item.type === 'bookmark').length,
  total: annotations.length,
});

const buildAnnotationDigest = (
  annotations: ClaudianAnnotationSummary[],
): { text: string; truncated: boolean } => {
  if (!annotations.length) return { text: '', truncated: false };

  const sorted = [...annotations].sort(compareAnnotationsForDigest);
  const lines = ['Current book annotation digest:'];
  let truncated = sorted.length > DIGEST_ITEM_LIMIT;

  for (const item of sorted.slice(0, DIGEST_ITEM_LIMIT)) {
    const line = formatAnnotationDigestLine(item);
    const nextText = [...lines, line].join('\n');
    if (nextText.length > DIGEST_TOTAL_CHAR_LIMIT) {
      truncated = true;
      break;
    }
    lines.push(line);
  }

  if (truncated) {
    lines.push(`...truncated. Total current-book annotations: ${annotations.length}.`);
  }

  return {
    text: lines.join('\n'),
    truncated,
  };
};

const compareAnnotationsForDigest = (
  a: ClaudianAnnotationSummary,
  b: ClaudianAnnotationSummary,
): number => {
  const pageA = a.page ?? Number.MAX_SAFE_INTEGER;
  const pageB = b.page ?? Number.MAX_SAFE_INTEGER;
  if (pageA !== pageB) return pageA - pageB;
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  return a.updatedAt - b.updatedAt;
};

const formatAnnotationDigestLine = (item: ClaudianAnnotationSummary): string => {
  const page = item.page ? `p.${item.page}` : 'no page';
  const label = getAnnotationDigestLabel(item);
  const body = normalizeDigestText([item.text, item.note].filter(Boolean).join(' | '));
  return `- ${page} [${label}] ${body || '(empty)'}`;
};

const getAnnotationDigestLabel = (item: ClaudianAnnotationSummary): string => {
  if (item.type === 'bookmark') return 'bookmark';
  if (isQuestionAnnotation(item)) return 'question';
  if (item.note.trim()) return 'note';
  if (item.text.trim()) return 'highlight';
  return item.type;
};

const normalizeDigestText = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > DIGEST_ITEM_CHAR_LIMIT
    ? `${normalized.slice(0, DIGEST_ITEM_CHAR_LIMIT)}...`
    : normalized;
};

export const formatReadingContextForPrompt = (context: ClaudianReadingContext): string => {
  const lines = [
    'Current reading context:',
    `- Book: ${context.title}${context.author ? ` by ${context.author}` : ''}`,
    `- Format: ${context.format || 'unknown'}`,
    context.currentPage
      ? `- Page: ${context.currentPage}${context.totalPages ? ` / ${context.totalPages}` : ''}`
      : '- Page: unknown',
    `- Visible annotation scope: current book only (${context.annotationCounts.total} total; ${context.annotationCounts.highlights} highlights, ${context.annotationCounts.notes} notes, ${context.annotationCounts.questions} questions, ${context.annotationCounts.bookmarks} bookmarks).`,
  ];

  if (context.selectionText) {
    lines.push('', 'Selected text:', context.selectionText);
  }

  const summarize = (label: string, items: typeof context.notes) => {
    if (!items.length) return;
    lines.push('', `${label}:`);
    for (const item of items.slice(0, 5)) {
      const page = item.page ? `p.${item.page}` : 'no page';
      const body = item.note || item.text;
      lines.push(`- ${page}: ${body.slice(0, 240)}`);
    }
  };

  summarize('Recent notes', context.notes);
  summarize('Recent highlights', context.highlights);
  summarize('Possible questions', context.questions);

  if (context.annotationDigest) {
    lines.push('', context.annotationDigest);
    if (context.annotationDigestTruncated) {
      lines.push('Annotation digest was truncated to fit the prompt budget.');
    }
  }

  return lines.join('\n');
};
