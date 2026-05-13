import type { ClaudianRuntime, ClaudianRuntimeRequest, ClaudianStreamChunk } from '../core/types';
import { CodexNotificationRouter } from './CodexNotificationRouter';
import { CodexRpcTransport } from './CodexRpcTransport';
import { createTauriCodexProcess } from '../../adapters/runtimeProcessAdapter';
import { formatReadingContextForPrompt } from '../../adapters/readingContextAdapter';
import { buildCodexSandboxPolicy, resolveCodexSandboxConfig } from '../../adapters/codexLaunch';

interface ThreadStartResult {
  thread: { id: string; path?: string | null };
}

interface TurnStartResult {
  turn: { id: string };
}

export class CodexChatRuntime implements ClaudianRuntime {
  private transport: CodexRpcTransport | null = null;
  private threadId: string | null = null;
  private currentTurnId: string | null = null;
  private canceled = false;
  private buffer: ClaudianStreamChunk[] = [];
  private resolveBuffer: (() => void) | null = null;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async *send(request: ClaudianRuntimeRequest): AsyncGenerator<ClaudianStreamChunk> {
    this.canceled = false;
    this.buffer = [];
    this.resolveBuffer = null;

    try {
      await this.ensureTransport(request);
      const permission = resolveCodexSandboxConfig(request.settings);
      const model = request.settings.model || 'gpt-5.2';

      if (!this.threadId) {
        const started = await this.transport!.request<ThreadStartResult>(
          'thread/start',
          {
            model,
            approvalPolicy: permission.approvalPolicy,
            sandbox: permission.sandbox,
            baseInstructions: buildBaseInstructions(),
            persistExtendedHistory: true,
          },
          60_000,
        );
        this.threadId = started.thread.id;
      }

      const prompt = [
        formatReadingContextForPrompt(request.context),
        '',
        'User request:',
        request.prompt,
      ].join('\n');

      const turn = await this.transport!.request<TurnStartResult>(
        'turn/start',
        {
          threadId: this.threadId,
          input: [{ type: 'text', text: prompt, text_elements: [] }],
          approvalPolicy: permission.approvalPolicy,
          model,
          effort: request.settings.reasoningEffort,
          summary: request.settings.reasoningSummary,
          sandboxPolicy: buildCodexSandboxPolicy(permission.sandbox),
        },
        60_000,
      );
      this.currentTurnId = turn.turn.id;

      while (true) {
        if (this.canceled) {
          yield { type: 'done' };
          return;
        }

        if (this.buffer.length === 0) {
          await new Promise<void>((resolve) => {
            this.resolveBuffer = resolve;
            if (this.buffer.length > 0 || this.canceled) {
              this.resolveBuffer = null;
              resolve();
            }
          });
        }

        while (this.buffer.length > 0) {
          const chunk = this.buffer.shift()!;
          yield chunk;
          if (chunk.type === 'done') return;
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Codex runtime failed',
      };
      yield { type: 'done' };
    } finally {
      this.currentTurnId = null;
    }
  }

  cancel(): void {
    this.canceled = true;
    if (this.transport && this.threadId && this.currentTurnId) {
      void this.transport.request('turn/interrupt', {
        threadId: this.threadId,
        turnId: this.currentTurnId,
      });
    }
    this.resolveBuffer?.();
  }

  private async ensureTransport(request: ClaudianRuntimeRequest): Promise<void> {
    if (this.transport) return;

    const proc = await createTauriCodexProcess(request.settings);
    const transport = new CodexRpcTransport(proc);
    const router = new CodexNotificationRouter((chunk) => this.enqueue(chunk));
    transport.onNotification((method, params) => router.handleNotification(method, params));
    transport.start();
    await transport.initialize();
    this.transport = transport;
  }

  private enqueue(chunk: ClaudianStreamChunk): void {
    this.buffer.push(chunk);
    this.resolveBuffer?.();
    this.resolveBuffer = null;
  }
}

const buildBaseInstructions = () =>
  [
    'You are Claudian inside Readest, a local reading workspace.',
    'Use the provided reading context to answer about the current book, notes, highlights, and questions.',
    'Do not delete or overwrite annotations. Ask for confirmation before suggesting data changes.',
  ].join('\n');
