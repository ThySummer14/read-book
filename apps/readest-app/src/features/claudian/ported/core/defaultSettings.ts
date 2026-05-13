import type { ClaudianSettings } from './types';

export const DEFAULT_CLAUDIAN_SETTINGS: ClaudianSettings = {
  enabled: false,
  provider: 'codex',
  codexCliPath: '',
  model: 'gpt-5.2',
  permissionMode: 'normal',
  safeMode: 'workspace-write',
  reasoningEffort: 'medium',
  reasoningSummary: 'auto',
  autoScroll: true,
  maxTabs: 4,
  tabBarPosition: 'header',
};

export const normalizeClaudianSettings = (
  settings?: Partial<ClaudianSettings> | null,
): ClaudianSettings => ({
  ...DEFAULT_CLAUDIAN_SETTINGS,
  ...(settings ?? {}),
  provider: 'codex',
  maxTabs: Math.max(1, Math.min(8, settings?.maxTabs ?? DEFAULT_CLAUDIAN_SETTINGS.maxTabs)),
});
