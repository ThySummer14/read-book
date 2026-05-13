import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLAUDIAN_SETTINGS,
  normalizeClaudianSettings,
} from '@/features/claudian/ported/core/defaultSettings';
import {
  buildCodexSandboxPolicy,
  buildCodexAppServerLaunchSpec,
  defaultCodexCliPath,
  resolveCodexSandboxConfig,
  sanitizeCodexCliPath,
} from '@/features/claudian/adapters/codexLaunch';
import { DEFAULT_SYSTEM_SETTINGS } from '@/services/constants';

describe('Claudian settings', () => {
  it('adds default Claudian settings to system settings', () => {
    expect(DEFAULT_SYSTEM_SETTINGS.claudianSettings).toEqual(DEFAULT_CLAUDIAN_SETTINGS);
  });

  it('normalizes missing and out-of-range values', () => {
    const settings = normalizeClaudianSettings({ maxTabs: 99, model: 'gpt-test' });
    expect(settings.provider).toBe('codex');
    expect(settings.maxTabs).toBe(8);
    expect(settings.model).toBe('gpt-test');
  });

  it('rejects shell expressions in Codex CLI path', () => {
    expect(() => sanitizeCodexCliPath('codex; rm -rf ~')).toThrow(/shell expression/);
    expect(sanitizeCodexCliPath('')).toBe('codex');
    expect(defaultCodexCliPath()).toContain('codex');
  });

  it('builds app-server args without shell concatenation', () => {
    const spec = buildCodexAppServerLaunchSpec({
      ...DEFAULT_CLAUDIAN_SETTINGS,
      codexCliPath: '/opt/homebrew/bin/codex',
    });
    expect(spec.program).toBe('claudian-codex');
    expect(spec.args).toEqual([
      '/opt/homebrew/bin/codex',
      'app-server',
      '--listen',
      'ws://127.0.0.1:0',
    ]);
  });

  it('treats an empty or bare codex path as the auto-detected command', () => {
    const emptySpec = buildCodexAppServerLaunchSpec({
      ...DEFAULT_CLAUDIAN_SETTINGS,
      codexCliPath: '',
    });
    const bareSpec = buildCodexAppServerLaunchSpec({
      ...DEFAULT_CLAUDIAN_SETTINGS,
      codexCliPath: 'codex',
    });

    expect(emptySpec.args[0]).toBe(defaultCodexCliPath());
    expect(bareSpec.args[0]).toBe(defaultCodexCliPath());
  });

  it('maps permission mode to Codex sandbox policy', () => {
    expect(resolveCodexSandboxConfig({ permissionMode: 'normal', safeMode: 'read-only' })).toEqual({
      approvalPolicy: 'on-request',
      sandbox: 'read-only',
    });
    expect(resolveCodexSandboxConfig({ permissionMode: 'yolo', safeMode: 'read-only' })).toEqual({
      approvalPolicy: 'never',
      sandbox: 'danger-full-access',
    });
  });

  it('builds app-server sandbox policy with the current Codex protocol shape', () => {
    expect(buildCodexSandboxPolicy('read-only')).toEqual({
      type: 'readOnly',
      networkAccess: false,
    });
    expect(buildCodexSandboxPolicy('workspace-write')).toEqual({
      type: 'workspaceWrite',
      writableRoots: [],
      networkAccess: false,
      excludeTmpdirEnvVar: false,
      excludeSlashTmp: false,
    });
    expect(buildCodexSandboxPolicy('danger-full-access')).toEqual({
      type: 'dangerFullAccess',
    });
  });
});
