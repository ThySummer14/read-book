import { create } from 'zustand';
import type { ClaudianConversation } from '../ported/core/types';

interface ClaudianPanelState {
  isVisible: boolean;
  width: string;
  conversations: ClaudianConversation[];
  toggleVisible: () => void;
  setVisible: (visible: boolean) => void;
  setWidth: (width: string) => void;
  upsertConversation: (conversation: ClaudianConversation) => void;
}

export const useClaudianStore = create<ClaudianPanelState>((set) => ({
  isVisible: false,
  width: '28%',
  conversations: [],
  toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),
  setVisible: (visible) => set({ isVisible: visible }),
  setWidth: (width) => set({ width }),
  upsertConversation: (conversation) =>
    set((state) => {
      const existing = state.conversations.findIndex((item) => item.id === conversation.id);
      if (existing === -1) {
        return { conversations: [conversation, ...state.conversations] };
      }
      const next = [...state.conversations];
      next[existing] = conversation;
      return { conversations: next };
    }),
}));
