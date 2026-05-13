'use client';

import React from 'react';
import clsx from 'clsx';
import { Bot } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { useClaudianStore } from '../store/claudianStore';

const ClaudianToggler: React.FC = () => {
  const _ = useTranslation();
  const iconSize = useResponsiveSize(16);
  const { isVisible, toggleVisible } = useClaudianStore();

  return (
    <button
      type='button'
      title={_('Open Claudian AI')}
      aria-label={_('Open Claudian AI')}
      className={clsx('btn btn-ghost h-8 min-h-8 w-8 p-0', isVisible && 'bg-base-300/60')}
      onClick={toggleVisible}
    >
      <Bot size={iconSize} />
    </button>
  );
};

export default ClaudianToggler;
