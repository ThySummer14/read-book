import DOMPurify from 'dompurify';
import { marked } from 'marked';

export const renderClaudianMarkdown = (markdown: string): string => {
  const raw = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;
  return DOMPurify.sanitize(raw);
};
