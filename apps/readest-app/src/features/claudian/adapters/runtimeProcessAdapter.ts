import { Command, type Child } from '@tauri-apps/plugin-shell';
import { isTauriAppPlatform } from '@/services/environment';
import type { ClaudianSettings } from '../ported/core/types';
import { buildCodexAppServerLaunchSpec } from './codexLaunch';
import type { CodexRpcProcess } from '../ported/codex/CodexRpcTransport';
import type TauriWebSocket from '@tauri-apps/plugin-websocket';
import type { Message as TauriWebSocketMessage } from '@tauri-apps/plugin-websocket';

class TauriCodexRpcProcess implements CodexRpcProcess {
  private child: Child | null = null;
  private socket: TauriWebSocket | null = null;
  private socketUnlisten: (() => void) | null = null;
  private stdoutHandlers: Array<(line: string) => void> = [];
  private exitHandlers: Array<() => void> = [];
  private stdoutBuffer = '';
  private stderrLines: string[] = [];
  private appServerUrl: string | null = null;
  private socketBuffer = '';

  async start(settings: ClaudianSettings): Promise<void> {
    if (!isTauriAppPlatform()) {
      throw new Error('Claudian Codex runtime requires the Readest desktop app.');
    }

    const spec = buildCodexAppServerLaunchSpec(settings);
    const command = Command.create(spec.program, spec.args);
    command.stdout.on('data', (data) => {
      this.stdoutBuffer += String(data);
      const lines = this.stdoutBuffer.split(/\r?\n/);
      this.stdoutBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.trim()) {
          this.stdoutHandlers.forEach((handler) => handler(line));
        }
      }
    });
    command.stderr.on('data', (data) => {
      const text = String(data).trim();
      if (!text) return;
      this.captureAppServerUrl(text);
      this.stderrLines.push(text);
      this.stderrLines = this.stderrLines.slice(-8);
      console.warn('[Claudian Codex]', text);
    });
    command.on('close', () => {
      const remaining = this.stdoutBuffer.trim();
      if (remaining) {
        this.stdoutHandlers.forEach((handler) => handler(remaining));
      }
      this.stdoutBuffer = '';
      this.exitHandlers.forEach((handler) => handler());
    });
    command.on('error', (error) => {
      console.warn('[Claudian Codex] process error', error);
      this.exitHandlers.forEach((handler) => handler());
    });
    this.child = await command.spawn();
  }

  async connect(): Promise<void> {
    const url = await this.waitForAppServerUrl();
    const TauriWebSocket = (await import('@tauri-apps/plugin-websocket')).default;
    let socket: TauriWebSocket | null = null;

    try {
      socket = await this.withTimeout(
        TauriWebSocket.connect(url),
        10_000,
        'Codex app-server WebSocket connection timed out.',
      );
    } catch (error) {
      throw new Error(
        `Codex app-server WebSocket connection failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    this.socket = socket;
    this.socketUnlisten = socket.addListener((message) => this.handleSocketEvent(message));
  }

  async write(data: string): Promise<void> {
    if (this.socket) {
      await this.socket.send(data.trimEnd());
      return;
    }
    if (!this.child) throw new Error('Codex process is not running.');
    await this.child.write(data);
  }

  onStdout(handler: (line: string) => void): void {
    this.stdoutHandlers.push(handler);
  }

  onExit(handler: () => void): void {
    this.exitHandlers.push(handler);
  }

  getStartupDiagnostics(): string {
    if (this.stderrLines.length === 0) return '';
    return this.stderrLines.join('\n');
  }

  async kill(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    this.socketUnlisten?.();
    this.socketUnlisten = null;
    await socket?.disconnect().catch(() => undefined);
    this.socket = null;
    await this.child?.kill();
    this.child = null;
  }

  private captureAppServerUrl(text: string): void {
    const match = text.match(/listening on:\s*(ws:\/\/127\.0\.0\.1:\d+)/);
    if (match?.[1]) {
      this.appServerUrl = match[1];
    }
  }

  private waitForAppServerUrl(): Promise<string> {
    if (this.appServerUrl) return Promise.resolve(this.appServerUrl);

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const poll = () => {
        if (this.appServerUrl) {
          resolve(this.appServerUrl);
          return;
        }
        if (Date.now() - startedAt > 10_000) {
          reject(new Error('Codex app-server did not report a WebSocket URL.'));
          return;
        }
        window.setTimeout(poll, 50);
      };
      poll();
    });
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private handleSocketEvent(message: TauriWebSocketMessage): void {
    if (message.type === 'Text') {
      this.handleSocketMessage(message.data);
      return;
    }

    if (message.type === 'Binary') {
      const bytes = new Uint8Array(message.data);
      this.handleSocketMessage(new TextDecoder().decode(bytes));
      return;
    }

    if (message.type === 'Close') {
      this.socketUnlisten?.();
      this.socketUnlisten = null;
      this.socket = null;
      this.exitHandlers.forEach((handler) => handler());
    }
  }

  private handleSocketMessage(data: unknown): void {
    this.socketBuffer += String(data);
    const lines = this.socketBuffer.split(/\r?\n/);
    this.socketBuffer = lines.pop() ?? '';

    if (lines.length === 0 && this.socketBuffer.trim().startsWith('{')) {
      this.stdoutHandlers.forEach((handler) => handler(this.socketBuffer));
      this.socketBuffer = '';
      return;
    }

    for (const line of lines) {
      if (line.trim()) {
        this.stdoutHandlers.forEach((handler) => handler(line));
      }
    }
  }
}

export const createTauriCodexProcess = async (
  settings: ClaudianSettings,
): Promise<TauriCodexRpcProcess> => {
  const proc = new TauriCodexRpcProcess();
  await proc.start(settings);
  return proc;
};
