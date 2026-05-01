export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError: boolean;
}

export type EscapeEventType =
  | 'init'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'text'
  | 'result'
  | 'system'
  | 'unknown';

export interface EscapeEvent {
  type: EscapeEventType;
  timestamp: string;
  raw: Record<string, unknown>;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  text?: string;
  detail?: string;
  model?: string;
  costUsd?: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export function parseJsonlEvent(line: string): EscapeEvent | null {
  try {
    const obj = JSON.parse(line);
    return classifyRawEvent(obj);
  } catch {
    return null;
  }
}

/**
 * A single JSONL line from Claude Code can contain multiple content blocks
 * (e.g. thinking + text + tool_use). This returns all of them.
 */
export function parseJsonlEvents(line: string): EscapeEvent[] {
  try {
    const obj = JSON.parse(line);
    return classifyAllEvents(obj);
  } catch {
    return [];
  }
}

function makeBase(obj: Record<string, unknown>): EscapeEvent {
  return {
    type: 'unknown',
    timestamp: new Date().toISOString(),
    raw: obj,
  };
}

function classifyRawEvent(obj: Record<string, unknown>): EscapeEvent {
  const events = classifyAllEvents(obj);
  return events[0] || makeBase(obj);
}

function classifyAllEvents(obj: Record<string, unknown>): EscapeEvent[] {
  const base = makeBase(obj);

  if (obj.type === 'system' && obj.subtype === 'init') {
    return [{ ...base, type: 'init', model: obj.model as string }];
  }

  if (obj.type === 'system' && obj.subtype === 'api_retry') {
    const attempt = obj.attempt as number;
    const maxRetries = obj.max_retries as number;
    const status = obj.error_status as number;
    const error = obj.error as string || '';
    const delayMs = Math.round(obj.retry_delay_ms as number || 0);
    return [{
      ...base,
      type: 'system',
      text: `[RETRY ${attempt}/${maxRetries}] ${status} ${error} — next in ${delayMs}ms`,
      detail: JSON.stringify(obj, null, 2),
    }];
  }

  if (obj.type === 'system' && typeof obj.message === 'string') {
    return [{
      ...base,
      type: 'system',
      text: obj.message,
      detail: typeof obj.detail === 'string' ? obj.detail : undefined,
    }];
  }

  if (obj.type === 'result') {
    const usage = obj.usage as Record<string, unknown> | undefined;
    return [{
      ...base,
      type: 'result',
      text: typeof obj.result === 'string' ? obj.result : undefined,
      costUsd: obj.total_cost_usd as number | undefined,
      durationMs: obj.duration_ms as number | undefined,
      inputTokens: usage?.input_tokens as number | undefined,
      outputTokens: usage?.output_tokens as number | undefined,
    }];
  }

  if (obj.type === 'assistant') {
    return parseAssistantMessage(obj, base);
  }

  if (obj.type === 'user') {
    return parseUserMessage(obj, base);
  }

  return [base];
}

function parseAssistantMessage(obj: Record<string, unknown>, base: EscapeEvent): EscapeEvent[] {
  const msg = obj.message as Record<string, unknown> | undefined;
  if (!msg) return [base];

  const content = msg.content as Array<Record<string, unknown>> | undefined;
  if (!content || !Array.isArray(content)) return [base];

  const events: EscapeEvent[] = [];

  for (const block of content) {
    if (block.type === 'thinking' && typeof block.thinking === 'string') {
      events.push({ ...base, type: 'thinking', text: block.thinking });
    } else if (block.type === 'text' && typeof block.text === 'string') {
      events.push({ ...base, type: 'text', text: block.text });
    } else if (block.type === 'tool_use') {
      events.push({
        ...base,
        type: 'tool_call',
        toolCall: {
          id: block.id as string,
          name: block.name as string,
          input: (block.input as Record<string, unknown>) || {},
        },
      });
    }
  }

  return events.length > 0 ? events : [base];
}

function parseUserMessage(obj: Record<string, unknown>, base: EscapeEvent): EscapeEvent[] {
  const msg = obj.message as Record<string, unknown> | undefined;
  if (!msg) return [base];

  const content = msg.content as Array<Record<string, unknown>> | undefined;
  if (!content || !Array.isArray(content)) return [base];

  const events: EscapeEvent[] = [];

  for (const block of content) {
    if (block.type === 'tool_result') {
      const rawContent = block.content;
      let contentStr: string;
      if (typeof rawContent === 'string') {
        contentStr = rawContent;
      } else if (Array.isArray(rawContent)) {
        contentStr = rawContent
          .map((c: Record<string, unknown>) =>
            typeof c.text === 'string' ? c.text : JSON.stringify(c)
          )
          .join('\n');
      } else {
        contentStr = JSON.stringify(rawContent);
      }

      events.push({
        ...base,
        type: 'tool_result',
        toolResult: {
          toolUseId: block.tool_use_id as string,
          content: contentStr,
          isError: block.is_error === true,
        },
      });
    }
  }

  return events.length > 0 ? events : [base];
}
