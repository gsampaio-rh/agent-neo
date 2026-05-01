import type { EscapeEvent } from './eventParser';

export interface ToolCallBlock {
  kind: 'tool_call';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  kind: 'tool_result';
  toolUseId: string;
  content: string;
  isError: boolean;
}

export interface ThinkingBlock {
  kind: 'thinking';
  text: string;
}

export interface TextBlock {
  kind: 'text';
  text: string;
}

export type MessageBlock = ToolCallBlock | ToolResultBlock | ThinkingBlock | TextBlock;

export interface MessageStats {
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  toolCallCount: number;
  toolNames: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: MessageBlock[];
  timestamp: string;
  stats?: MessageStats;
}

export type AgentStatus = 'idle' | 'running' | 'error';

export interface SessionStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalPrompts: number;
  totalToolCalls: number;
  sessionStartedAt: string | null;
}

export const INITIAL_SESSION_STATS: SessionStats = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalPrompts: 0,
  totalToolCalls: 0,
  sessionStartedAt: null,
};

export interface ChatState {
  messages: ChatMessage[];
  agentStatus: AgentStatus;
  connected: boolean;
  resetting: boolean;
  llmAvailable: boolean;
  sessionStats: SessionStats;
}

export const INITIAL_CHAT_STATE: ChatState = {
  messages: [],
  agentStatus: 'idle',
  connected: false,
  resetting: false,
  llmAvailable: true,
  sessionStats: { ...INITIAL_SESSION_STATS },
};

export function eventToBlock(event: EscapeEvent): MessageBlock | null {
  switch (event.type) {
    case 'thinking':
      return event.text ? { kind: 'thinking', text: event.text } : null;
    case 'tool_call':
      return event.toolCall
        ? { kind: 'tool_call', id: event.toolCall.id, name: event.toolCall.name, input: event.toolCall.input }
        : null;
    case 'tool_result':
      return event.toolResult
        ? { kind: 'tool_result', toolUseId: event.toolResult.toolUseId, content: event.toolResult.content, isError: event.toolResult.isError }
        : null;
    case 'text':
      return event.text ? { kind: 'text', text: event.text } : null;
    default:
      return null;
  }
}

export function appendBlockToMessages(
  messages: ChatMessage[],
  block: MessageBlock,
  currentAssistantId: string | null,
  nextId: () => string,
): { messages: ChatMessage[]; assistantId: string } {
  const msgs = [...messages];
  const lastMsg = msgs[msgs.length - 1];

  if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === currentAssistantId) {
    msgs[msgs.length - 1] = { ...lastMsg, blocks: [...lastMsg.blocks, block] };
    return { messages: msgs, assistantId: currentAssistantId! };
  }

  const id = nextId();
  msgs.push({ id, role: 'assistant', blocks: [block], timestamp: new Date().toISOString() });
  return { messages: msgs, assistantId: id };
}

export function deriveToolStats(blocks: MessageBlock[]): { count: number; names: string[] } {
  const names: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'tool_call') names.push(b.name);
  }
  return { count: names.length, names };
}
