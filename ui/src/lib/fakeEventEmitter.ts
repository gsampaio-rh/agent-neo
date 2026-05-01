import type { EscapeEvent } from './eventParser';
import type { MessageBlock } from './chatReducer';

export function blockToEscapeEvent(block: MessageBlock): EscapeEvent {
  const base: EscapeEvent = {
    type: 'unknown',
    timestamp: new Date().toISOString(),
    raw: {},
  };

  switch (block.kind) {
    case 'thinking':
      return { ...base, type: 'thinking', text: block.text };
    case 'tool_call':
      return {
        ...base,
        type: 'tool_call',
        toolCall: { id: block.id, name: block.name, input: block.input },
      };
    case 'tool_result':
      return {
        ...base,
        type: 'tool_result',
        toolResult: { toolUseId: block.toolUseId, content: block.content, isError: block.isError },
      };
    case 'text':
      return { ...base, type: 'text', text: block.text };
  }
}

export function buildInitEvent(model = 'fake-dev'): EscapeEvent {
  return {
    type: 'init',
    timestamp: new Date().toISOString(),
    raw: { type: 'system', subtype: 'init', model },
    model,
  };
}

export function buildResultEvent(startTime: number): EscapeEvent {
  const durationMs = Date.now() - startTime;
  const inputTokens = Math.floor(Math.random() * 2000) + 500;
  const outputTokens = Math.floor(Math.random() * 800) + 100;
  const costUsd = inputTokens * 0.000003 + outputTokens * 0.000015;

  return {
    type: 'result',
    timestamp: new Date().toISOString(),
    raw: { type: 'result' },
    costUsd,
    durationMs,
    inputTokens,
    outputTokens,
  };
}
