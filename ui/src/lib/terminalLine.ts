import type { EscapeEvent } from './eventParser';
import type { AgentAction } from './contextReducer';

export interface TerminalLine {
  id: number;
  type: 'command' | 'output' | 'info' | 'success' | 'error' | 'system';
  text: string;
  timestamp: string;
  detail?: string;
}

function toolInputDetail(input: Record<string, unknown>): string {
  return JSON.stringify(input, null, 2);
}

export function extractTerminalLine(event: EscapeEvent, id: number): TerminalLine | null {
  if (event.type === 'tool_call' && event.toolCall) {
    const tool = event.toolCall;
    let text: string;

    if (tool.name === 'Bash') {
      text = `$ ${(tool.input.command as string) || ''}`;
    } else if (tool.name === 'Write') {
      const path = (tool.input.filePath as string) || (tool.input.file_path as string) || '';
      text = `[write] ${path}`;
    } else if (tool.name === 'Read') {
      const path = (tool.input.filePath as string) || (tool.input.file_path as string) || '';
      text = `[read] ${path}`;
    } else {
      text = `[${tool.name}] ${JSON.stringify(tool.input).slice(0, 80)}`;
    }

    return {
      id, type: 'command', text: text.slice(0, 160), timestamp: event.timestamp,
      detail: toolInputDetail(tool.input),
    };
  }

  if (event.type === 'tool_result' && event.toolResult) {
    const content = event.toolResult.content;
    const firstLine = content.split('\n')[0]?.slice(0, 160) || '';
    if (!firstLine) return null;
    const type = event.toolResult.isError ? 'error' : 'output';
    const hasMore = content.includes('\n') || content.length > 160;
    return {
      id, type, text: firstLine, timestamp: event.timestamp,
      detail: hasMore ? content : undefined,
    };
  }

  if (event.type === 'thinking' && event.text) {
    const clean = event.text.replace(/<\/?think>/g, '').trim();
    if (!clean) return null;
    const firstSentence = clean.split(/[.!]\s/)[0]?.slice(0, 120) || clean.slice(0, 120);
    const truncated = firstSentence.length < clean.length;
    return {
      id, type: 'info', text: firstSentence, timestamp: event.timestamp,
      detail: truncated ? clean : undefined,
    };
  }

  if (event.type === 'init') {
    const model = event.model || '?';
    const raw = event.raw;
    const tools = Array.isArray(raw.tools) ? (raw.tools as string[]).join(', ') : '';
    const initDetail = [
      `model: ${model}`,
      `session: ${raw.session_id || '?'}`,
      `permission: ${raw.permissionMode || '?'}`,
      tools ? `tools: ${tools}` : '',
    ].filter(Boolean).join('\n');
    return { id, type: 'system', text: `[INIT] model=${model}`, timestamp: event.timestamp, detail: initDetail };
  }

  if (event.type === 'result') {
    const ms = event.durationMs || 0;
    const cost = event.costUsd ? `$${event.costUsd.toFixed(3)}` : '';
    const isError = event.raw.is_error === true;
    const resultDetail = [
      `duration: ${ms}ms`,
      event.inputTokens != null ? `input tokens: ${event.inputTokens}` : '',
      event.outputTokens != null ? `output tokens: ${event.outputTokens}` : '',
      cost ? `cost: ${cost}` : '',
      `turns: ${event.raw.num_turns || '?'}`,
      event.raw.terminal_reason ? `reason: ${event.raw.terminal_reason}` : '',
      isError && event.text ? `error: ${event.text.slice(0, 500)}` : '',
    ].filter(Boolean).join('\n');
    return {
      id,
      type: isError ? 'error' : 'success',
      text: isError ? `[ERROR] ${(event.text || '').slice(0, 120)}` : `[DONE] ${ms}ms ${cost}`.trim(),
      timestamp: event.timestamp,
      detail: resultDetail,
    };
  }

  if (event.type === 'system' && event.text) {
    return {
      id, type: 'system',
      text: `[SYS] ${event.text.slice(0, 140)}`,
      timestamp: event.timestamp,
      detail: event.detail,
    };
  }

  return null;
}

export function deriveAction(event: EscapeEvent): AgentAction {
  if (event.type === 'tool_call') {
    const name = event.toolCall?.name;
    if (name === 'Read' || name === 'Grep' || name === 'Glob') return 'reading';
    return 'hacking';
  }
  if (event.type === 'thinking') return 'thinking';
  if (event.type === 'tool_result') return 'reading';
  return 'idle';
}

export function deriveActionText(event: EscapeEvent): string {
  if (event.type === 'thinking' && event.text) {
    const clean = event.text.replace(/<\/?think>/g, '').trim();
    const sentence = clean.split(/[.!]\s/)[0] || clean;
    return sentence.slice(0, 80);
  }
  if (event.type === 'tool_call' && event.toolCall) {
    const tool = event.toolCall;
    if (tool.name === 'Bash') {
      const cmd = (tool.input.command as string) || '';
      return `$ ${cmd.slice(0, 70)}`;
    }
    if (tool.name === 'Write') {
      const path = (tool.input.filePath as string) || (tool.input.file_path as string) || '';
      const name = path.split('/').pop() || path;
      return `Writing ${name}`;
    }
    if (tool.name === 'Read') return 'Reading file...';
    return `Using ${tool.name}...`;
  }
  if (event.type === 'tool_result') {
    if (event.toolResult?.isError) return 'Error — adjusting...';
    return '';
  }
  return '';
}
