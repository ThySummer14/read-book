import type { ClaudianStreamChunk } from '../core/types';

type ChunkEmitter = (chunk: ClaudianStreamChunk) => void;

// Compact port of Claudian's CodexNotificationRouter. It preserves the
// app-server event mapping that matters for the reader side panel: text,
// reasoning, tool lifecycle, errors, and completion.
export class CodexNotificationRouter {
  private readonly agentMessageDeltaItemIds = new Set<string>();

  constructor(private readonly emit: ChunkEmitter) {}

  handleNotification(method: string, params: unknown): void {
    switch (method) {
      case 'item/agentMessage/delta':
        this.markAgentMessageDelta(params);
        this.emit({ type: 'text', content: getString(params, 'delta') });
        break;
      case 'item/reasoning/summaryTextDelta':
      case 'item/reasoning/textDelta':
        this.emit({ type: 'thinking', content: getString(params, 'delta') });
        break;
      case 'item/plan/delta':
        this.emit({ type: 'text', content: getString(params, 'delta') });
        break;
      case 'item/started':
        this.handleItemStarted(params);
        break;
      case 'item/completed':
        this.handleItemCompleted(params);
        break;
      case 'item/commandExecution/outputDelta':
      case 'item/fileChange/outputDelta':
        this.emit({
          type: 'tool_output',
          id: getString(params, 'itemId'),
          content: getString(params, 'delta'),
        });
        break;
      case 'turn/completed':
        this.handleTurnCompleted(params);
        break;
      case 'error':
        this.emit({
          type: 'error',
          content: getNestedString(params, ['error', 'message']) || 'Codex error',
        });
        break;
      default:
        break;
    }
  }

  private handleItemStarted(params: unknown): void {
    const item = getObject(params, 'item');
    if (!item) return;
    const type = item?.['type'];
    if (type === 'commandExecution') {
      this.emit({
        type: 'tool_use',
        id: asString(item['id']),
        name: 'command_execution',
        input: { command: item['commandActions'] ?? item['command'] ?? '' },
      });
    } else if (type === 'fileChange') {
      this.emit({
        type: 'tool_use',
        id: asString(item['id']),
        name: 'file_change',
        input: { changes: item['changes'] ?? [] },
      });
    }
  }

  private handleItemCompleted(params: unknown): void {
    const item = getObject(params, 'item');
    if (!item) return;
    const type = item?.['type'];
    if (type === 'agentMessage') {
      const itemId = asString(item['id']);
      if (itemId && this.agentMessageDeltaItemIds.has(itemId)) return;
      const text = asString(item['text']);
      if (text) this.emit({ type: 'text', content: text });
      return;
    }
    if (type === 'commandExecution') {
      this.emit({
        type: 'tool_result',
        id: asString(item['id']),
        name: 'command_execution',
        content: asString(item['aggregatedOutput']) || 'Command completed',
        isError: typeof item['exitCode'] === 'number' && item['exitCode'] !== 0,
      });
      return;
    }
    if (type === 'fileChange') {
      this.emit({
        type: 'tool_result',
        id: asString(item['id']),
        name: 'file_change',
        content: 'File change completed',
        isError: false,
      });
    }
  }

  private handleTurnCompleted(params: unknown): void {
    const turn = getObject(params, 'turn');
    if (turn?.['status'] === 'failed') {
      this.emit({
        type: 'error',
        content: getNestedString(turn, ['error', 'message']) || 'Codex turn failed',
      });
    }
    this.emit({ type: 'done' });
  }

  private markAgentMessageDelta(params: unknown): void {
    const itemId = getString(params, 'itemId') || getString(params, 'id');
    if (itemId) this.agentMessageDeltaItemIds.add(itemId);
  }
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const getObject = (value: unknown, key: string): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') return null;
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === 'object' ? (child as Record<string, unknown>) : null;
};

const getString = (value: unknown, key: string): string => {
  if (!value || typeof value !== 'object') return '';
  return asString((value as Record<string, unknown>)[key]);
};

const getNestedString = (value: unknown, keys: string[]): string => {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[key];
  }
  return asString(current);
};
