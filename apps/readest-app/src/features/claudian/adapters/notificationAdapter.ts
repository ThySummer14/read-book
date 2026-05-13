import { eventDispatcher } from '@/utils/event';

export type ClaudianToastType = 'info' | 'success' | 'warning' | 'error';

export const notifyClaudian = (
  message: string,
  type: ClaudianToastType = 'info',
  timeout = 2500,
) => {
  eventDispatcher.dispatch('toast', {
    type,
    message,
    timeout,
  });
};
