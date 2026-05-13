import type { ClaudianSettings } from '../ported/core/types';

const DANGEROUS_SHELL_CHARS = /[;&|`$<>]/;
const MACOS_CODEX_APP_CLI_PATH = '/Applications/Codex.app/Contents/Resources/codex';

export interface CodexLaunchSpec {
  program: 'claudian-codex';
  args: string[];
  displayCommand: string;
}

export const sanitizeCodexCliPath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed) return 'codex';
  if (DANGEROUS_SHELL_CHARS.test(trimmed)) {
    throw new Error('Codex CLI path must be a command path, not a shell expression.');
  }
  return trimmed;
};

export const defaultCodexCliPath = (): string => {
  if (typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)) {
    return MACOS_CODEX_APP_CLI_PATH;
  }
  return 'codex';
};

export const resolveCodexSandboxConfig = (
  settings: Pick<ClaudianSettings, 'permissionMode' | 'safeMode'>,
): { approvalPolicy: 'never' | 'on-request'; sandbox: ClaudianSettings['safeMode'] } => {
  if (settings.permissionMode === 'yolo') {
    return { approvalPolicy: 'never', sandbox: 'danger-full-access' };
  }
  if (settings.permissionMode === 'plan') {
    return { approvalPolicy: 'on-request', sandbox: 'workspace-write' };
  }
  return { approvalPolicy: 'on-request', sandbox: settings.safeMode };
};

export const buildCodexSandboxPolicy = (
  sandbox: ClaudianSettings['safeMode'],
):
  | { type: 'dangerFullAccess' }
  | { type: 'readOnly'; networkAccess: boolean }
  | {
      type: 'workspaceWrite';
      writableRoots: string[];
      networkAccess: boolean;
      excludeTmpdirEnvVar: boolean;
      excludeSlashTmp: boolean;
    } => {
  if (sandbox === 'danger-full-access') {
    return { type: 'dangerFullAccess' };
  }
  if (sandbox === 'read-only') {
    return { type: 'readOnly', networkAccess: false };
  }
  return {
    type: 'workspaceWrite',
    writableRoots: [],
    networkAccess: false,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  };
};

export const buildCodexAppServerLaunchSpec = (settings: ClaudianSettings): CodexLaunchSpec => {
  const savedPath = settings.codexCliPath.trim();
  const command = sanitizeCodexCliPath(
    savedPath && savedPath !== 'codex' ? savedPath : defaultCodexCliPath(),
  );
  const listenUrl = 'ws://127.0.0.1:0';
  return {
    program: 'claudian-codex',
    args: [command, 'app-server', '--listen', listenUrl],
    displayCommand: `${command} app-server --listen ${listenUrl}`,
  };
};
