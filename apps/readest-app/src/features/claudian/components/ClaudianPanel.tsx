'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePanelResize } from '@/hooks/usePanelResize';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { getClaudianReadingContext } from '../adapters/readingContextAdapter';
import { useClaudianStore } from '../store/claudianStore';
import { useClaudianChatController } from '../hooks/useClaudianChatController';
import {
  ClaudianContextCard,
  ClaudianInputArea,
  ClaudianMessageList,
  ClaudianPanelHeader,
  ClaudianRuntimeWarning,
  ClaudianTabStrip,
} from './ClaudianPanelParts';
import '../styles/claudian.css';

const MIN_WIDTH = 0.18;
const MAX_WIDTH = 0.48;

const ClaudianPanel: React.FC = () => {
  const _ = useTranslation();
  const { settings, setSettingsDialogOpen, setRequestedPanel } = useSettingsStore();
  const { isVisible, width, setVisible, setWidth } = useClaudianStore();
  const [contextOpen, setContextOpen] = useState(true);

  const openSettings = () => {
    setRequestedPanel('AI');
    setSettingsDialogOpen(true);
  };
  const chat = useClaudianChatController({
    settings: settings?.claudianSettings,
    openSettings,
  });
  const context = useMemo(() => getClaudianReadingContext(), [chat.renderTick, isVisible]);

  const { handleResizeStart, handleResizeKeyDown } = usePanelResize({
    side: 'end',
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    getWidth: () => width,
    onResize: setWidth,
  });

  useEffect(() => {
    if (!isVisible) return;
    const id = window.setInterval(chat.forceRender, 1500);
    return () => window.clearInterval(id);
  }, [chat.forceRender, isVisible]);

  if (!isVisible) return null;

  return (
    <aside
      className='claudian-container bg-base-200 text-base-content border-base-300 relative z-20 flex h-full min-w-64 flex-col border-l shadow-xl'
      style={{ width }}
      aria-label={_('Claudian AI')}
    >
      <div
        className='absolute -left-2 top-0 h-full w-4 cursor-col-resize'
        role='slider'
        tabIndex={0}
        aria-label={_('Resize Claudian AI')}
        aria-orientation='horizontal'
        aria-valuenow={parseFloat(width)}
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
        onKeyDown={handleResizeKeyDown}
      />
      <ClaudianPanelHeader
        onNewChat={chat.createChat}
        onOpenSettings={openSettings}
        onClose={() => setVisible(false)}
      />
      <ClaudianTabStrip
        tabs={chat.tabs}
        activeTabId={chat.activeTab.id}
        onSelectTab={chat.switchTab}
      />
      <ClaudianContextCard
        context={context}
        isOpen={contextOpen}
        onToggle={() => setContextOpen((open) => !open)}
      />
      <ClaudianRuntimeWarning />
      <ClaudianMessageList messages={chat.messages} onRetryLast={chat.retryLast} />
      <ClaudianInputArea
        draft={chat.draft}
        isStreaming={chat.activeTab.isStreaming}
        onDraftChange={chat.setDraft}
        onSend={() => void chat.send()}
        onStop={chat.stop}
      />
    </aside>
  );
};

export default ClaudianPanel;
