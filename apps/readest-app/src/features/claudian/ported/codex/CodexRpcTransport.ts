// Adapted from Claudian's CodexRpcTransport. This version targets Tauri's
// shell Child handle instead of Node child_process streams.

export interface CodexRpcProcess {
  write(data: string): Promise<void>;
  onStdout(handler: (line: string) => void): void;
  onExit(handler: () => void): void;
  getStartupDiagnostics?(): string;
  connect?(): Promise<void>;
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

type NotificationHandler = (method: string, params: unknown) => void;

export class CodexRpcTransport {
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private disposed = false;
  private notificationHandler: NotificationHandler | null = null;

  constructor(private readonly proc: CodexRpcProcess) {}

  start(): void {
    this.proc.onStdout((line) => this.handleLine(line));
    this.proc.onExit(() => this.rejectAllPending(new Error('Codex app-server exited')));
  }

  onNotification(handler: NotificationHandler): void {
    this.notificationHandler = handler;
  }

  async initialize(): Promise<void> {
    try {
      await this.proc.connect?.();
      await this.request(
        'initialize',
        {
          clientInfo: {
            name: 'readest-claudian',
            title: 'Readest Claudian',
            version: '0.0.0',
          },
          capabilities: { experimentalApi: true },
        },
        30_000,
      );
      await this.notify('initialized');
    } catch (error) {
      const details = this.proc.getStartupDiagnostics?.();
      const message = error instanceof Error ? error.message : 'Codex initialize failed';
      throw new Error(details ? `${message}\n${details}` : message);
    }
  }

  request<T = unknown>(method: string, params: unknown, timeoutMs = 30_000): Promise<T> {
    const id = this.nextId++;
    const msg = { jsonrpc: '2.0' as const, id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id);
              reject(new Error(`Request timeout: ${method} (${timeoutMs}ms)`));
            }, timeoutMs)
          : null;

      this.pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
      });

      void this.sendRaw(msg).catch(reject);
    });
  }

  notify(method: string, params?: unknown): Promise<void> {
    const msg: Record<string, unknown> = { jsonrpc: '2.0', method };
    if (params !== undefined) msg['params'] = params;
    return this.sendRaw(msg);
  }

  dispose(): void {
    this.disposed = true;
    this.rejectAllPending(new Error('Transport disposed'));
  }

  private async sendRaw(msg: unknown): Promise<void> {
    if (this.disposed) return;
    await this.proc.write(`${JSON.stringify(msg)}\n`);
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return;
    }

    const id = msg['id'] as number | undefined;
    const method = msg['method'] as string | undefined;

    if (typeof id === 'number' && !method) {
      this.handleResponse(id, msg);
      return;
    }

    if (method) {
      this.notificationHandler?.(method, msg['params']);
    }
  }

  private handleResponse(id: number, msg: Record<string, unknown>): void {
    const pending = this.pending.get(id);
    if (!pending) return;

    this.pending.delete(id);
    if (pending.timer) clearTimeout(pending.timer);

    if (msg['error']) {
      const error = msg['error'] as { message?: string };
      pending.reject(new Error(error.message || 'Codex request failed'));
    } else {
      pending.resolve(msg['result']);
    }
  }

  private rejectAllPending(error: Error): void {
    const details = this.proc.getStartupDiagnostics?.();
    const enrichedError =
      details && error.message === 'Codex app-server exited'
        ? new Error(`${error.message}\n${details}`)
        : error;
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(enrichedError);
    }
    this.pending.clear();
  }
}
