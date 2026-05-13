import type { BookNote } from '@/types/book';
import { useBookDataStore } from '@/store/bookDataStore';
import type { ClaudianAnnotationSummary } from '../ported/core/types';

export interface ClaudianAnnotationAdapter {
  listAnnotations(bookKey: string | null): ClaudianAnnotationSummary[];
  createAnnotation(): never;
  updateAnnotation(): never;
  deleteAnnotation(): never;
}

export const toClaudianAnnotationSummary = (note: BookNote): ClaudianAnnotationSummary => ({
  id: note.id,
  type: note.type,
  page: note.page ?? null,
  text: note.text ?? '',
  note: note.note ?? '',
  color: note.color,
  style: note.style,
  updatedAt: note.updatedAt,
});

export class ReadestAnnotationAdapter implements ClaudianAnnotationAdapter {
  listAnnotations(bookKey: string | null): ClaudianAnnotationSummary[] {
    if (!bookKey) return [];
    const config = useBookDataStore.getState().getConfig(bookKey);
    const notes = config?.booknotes ?? [];
    return notes
      .filter((note) => !note.deletedAt)
      .map(toClaudianAnnotationSummary)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  createAnnotation(): never {
    throw new Error(ANNOTATION_WRITES_DISABLED_MESSAGE);
  }

  updateAnnotation(): never {
    throw new Error(ANNOTATION_WRITES_DISABLED_MESSAGE);
  }

  deleteAnnotation(): never {
    throw new Error(ANNOTATION_WRITES_DISABLED_MESSAGE);
  }
}

const ANNOTATION_WRITES_DISABLED_MESSAGE =
  'Claudian annotation writes are disabled in this version.';
