'use client';

import clsx from 'clsx';
import React from 'react';
import { Bot, Plus, Send, Settings, Square, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { isTauriAppPlatform } from '@/services/environment';
import type {
  ClaudianConversationMessage,
  ClaudianReadingContext,
  ClaudianTabState,
} from '../ported/core/types';
import ClaudianMessage from './ClaudianMessage';

interface ClaudianPanelHeaderProps {
  onNewChat: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export const ClaudianPanelHeader: React.FC<ClaudianPanelHeaderProps> = ({
  onNewChat,
  onOpenSettings,
  onClose,
}) => {
  const _ = useTranslation();

  return (
    <header className='claudian-header'>
      <div className='claudian-title-slot'>
        <Bot className='size-4' />
        <span className='claudian-title-text'>Claudian</span>
        <span className='claudian-provider-badge'>Codex</span>
      </div>
      <div className='claudian-header-actions'>
        <button className='claudian-icon-button' title={_('New chat')} onClick={onNewChat}>
          <Plus className='size-4' />
        </button>
        <button className='claudian-icon-button' title={_('AI Settings')} onClick={onOpenSettings}>
          <Settings className='size-4' />
        </button>
        <button className='claudian-icon-button' title={_('Close')} onClick={onClose}>
          <X className='size-4' />
        </button>
      </div>
    </header>
  );
};

interface ClaudianTabStripProps {
  tabs: ClaudianTabState[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
}

export const ClaudianTabStrip: React.FC<ClaudianTabStripProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
}) => (
  <div className='claudian-tab-strip'>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        className={clsx('claudian-tab', tab.id === activeTabId && 'claudian-tab-active')}
        onClick={() => onSelectTab(tab.id)}
      >
        {tab.title}
      </button>
    ))}
  </div>
);

interface ClaudianContextCardProps {
  context: ClaudianReadingContext;
  isOpen: boolean;
  onToggle: () => void;
}

export const ClaudianContextCard: React.FC<ClaudianContextCardProps> = ({
  context,
  isOpen,
  onToggle,
}) => {
  const _ = useTranslation();

  return (
    <section className='claudian-context-card'>
      <button className='claudian-context-title' onClick={onToggle}>
        {_('Reading Context')}
        <span>{isOpen ? '-' : '+'}</span>
      </button>
      {isOpen && (
        <div className='claudian-context-body'>
          <div className='font-medium'>{context.title}</div>
          <div className='text-xs opacity-70'>
            {context.currentPage ? `Page ${context.currentPage}` : _('No active page')}
            {context.selectionText ? ` · ${_('Selection ready')}` : ''}
          </div>
          <div className='claudian-context-counts'>
            <span>
              {_('Current book annotations')}: {context.annotationCounts.total}
            </span>
            <span>
              {_('Highlights')}: {context.annotationCounts.highlights}
            </span>
            <span>
              {_('Notes')}: {context.annotationCounts.notes}
            </span>
            <span>
              {_('Questions')}: {context.annotationCounts.questions}
            </span>
          </div>
          <div className='claudian-context-scope'>
            {context.annotationCounts.total
              ? context.annotationDigestTruncated
                ? _('Includes a truncated summary of current-book annotations.')
                : _('Includes a summary of current-book annotations.')
              : _('No annotations from the current book are included.')}
          </div>
        </div>
      )}
    </section>
  );
};

export const ClaudianRuntimeWarning: React.FC = () => {
  const _ = useTranslation();

  if (isTauriAppPlatform()) return null;

  return (
    <div className='claudian-warning'>
      {_('Claudian Codex runtime requires the Readest desktop app.')}
    </div>
  );
};

interface ClaudianMessageListProps {
  messages: ClaudianConversationMessage[];
  onRetryLast: () => void;
}

export const ClaudianMessageList: React.FC<ClaudianMessageListProps> = ({
  messages,
  onRetryLast,
}) => {
  const _ = useTranslation();

  return (
    <main className='claudian-messages'>
      {messages.length === 0 ? (
        <div className='claudian-empty'>
          <Bot className='size-8 opacity-70' />
          <p>{_('Ask about the current book, selection, notes, or highlights.')}</p>
        </div>
      ) : (
        messages.map((message) => (
          <ClaudianMessage
            key={message.id}
            message={message}
            onRetry={message.role === 'assistant' ? onRetryLast : undefined}
          />
        ))
      )}
    </main>
  );
};

interface ClaudianInputAreaProps {
  draft: string;
  isStreaming: boolean;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  onStop: () => void;
}

export const ClaudianInputArea: React.FC<ClaudianInputAreaProps> = ({
  draft,
  isStreaming,
  onDraftChange,
  onSend,
  onStop,
}) => {
  const _ = useTranslation();

  return (
    <footer className='claudian-input-area'>
      <textarea
        className='claudian-input'
        value={draft}
        placeholder={_('Ask Claudian about this book...')}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      <button
        className='claudian-send-button'
        onClick={isStreaming ? onStop : onSend}
        disabled={!draft.trim() && !isStreaming}
        title={isStreaming ? _('Stop') : _('Send')}
      >
        {isStreaming ? <Square className='size-4' /> : <Send className='size-4' />}
      </button>
    </footer>
  );
};
