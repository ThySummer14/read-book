'use client';

import clsx from 'clsx';
import React from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { ClaudianContentBlock, ClaudianConversationMessage } from '../ported/core/types';
import { renderClaudianMarkdown } from '../adapters/markdownAdapter';

const ClaudianMessage: React.FC<{
  message: ClaudianConversationMessage;
  onRetry?: () => void;
}> = ({ message, onRetry }) => {
  const _ = useTranslation();
  const isUser = message.role === 'user';
  const blocks = isUser ? [] : getMessageBlocks(message);

  return (
    <div
      className={clsx(
        'claudian-message-row',
        isUser ? 'claudian-message-user' : 'claudian-message-assistant',
      )}
    >
      <div className='claudian-message-role'>{isUser ? 'You' : 'Claudian'}</div>
      {isUser ? (
        <div className='claudian-message-bubble whitespace-pre-wrap'>{message.content}</div>
      ) : (
        <div className='claudian-message-bubble'>
          {blocks.map((block, index) => (
            <ClaudianContentBlockView
              key={`${block.type}-${index}`}
              block={block}
              thinkingLabel={_('Thinking')}
            />
          ))}
          {message.interrupted && (
            <div className='claudian-interrupted-block'>{_('Interrupted')}</div>
          )}
          {(message.error || message.interrupted) && onRetry && !message.pending && (
            <button className='claudian-retry-button' onClick={onRetry}>
              <RotateCcw className='size-3.5' />
              <span>{_('Retry')}</span>
            </button>
          )}
          {message.pending && !message.content && !message.thinking && (
            <div className='claudian-streaming-placeholder'>{_('Thinking...')}</div>
          )}
        </div>
      )}
    </div>
  );
};

const ClaudianContentBlockView: React.FC<{
  block: ClaudianContentBlock;
  thinkingLabel: string;
}> = ({ block, thinkingLabel }) => {
  const html = renderClaudianMarkdown(block.content);

  if (block.type === 'thinking') {
    return (
      <details className='claudian-thinking-block'>
        <summary>
          <ChevronDown className='claudian-thinking-icon size-3.5' />
          <span>{thinkingLabel}</span>
        </summary>
        <div
          className='claudian-thinking-content claudian-markdown'
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </details>
    );
  }

  return (
    <div
      className={clsx(
        'claudian-markdown',
        block.type === 'tool' && 'claudian-tool-text-block',
        block.type === 'error' && 'claudian-error-block',
      )}
      dangerouslySetInnerHTML={{ __html: html || block.content }}
    />
  );
};

const getMessageBlocks = (message: ClaudianConversationMessage): ClaudianContentBlock[] => {
  if (message.contentBlocks?.length) {
    return message.contentBlocks.filter((block) => block.content.trim().length > 0);
  }

  const blocks: ClaudianContentBlock[] = [];
  if (message.thinking?.trim()) {
    blocks.push({ type: 'thinking', content: message.thinking });
  }
  if (message.content.trim()) {
    blocks.push({
      type: message.error ? 'error' : 'text',
      content: message.content,
    });
  }
  return blocks;
};

export default ClaudianMessage;
