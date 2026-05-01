import { describe, it, expect } from 'vitest';
import { extractTerminalLine, deriveAction, deriveActionText } from '../terminalLine';
import type { EscapeEvent } from '../eventParser';

function makeEvent(overrides: Partial<EscapeEvent>): EscapeEvent {
  return { type: 'unknown', timestamp: new Date().toISOString(), raw: {}, ...overrides };
}

describe('extractTerminalLine', () => {
  it('extracts Bash tool call as command', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Bash', input: { command: 'ls -la /tmp' } },
    });
    const line = extractTerminalLine(event, 0);
    expect(line?.type).toBe('command');
    expect(line?.text).toBe('$ ls -la /tmp');
  });

  it('extracts Write tool call', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Write', input: { filePath: '/tmp/test.py' } },
    });
    const line = extractTerminalLine(event, 1);
    expect(line?.type).toBe('command');
    expect(line?.text).toBe('[write] /tmp/test.py');
  });

  it('extracts tool result first line', () => {
    const event = makeEvent({
      type: 'tool_result',
      toolResult: { toolUseId: '1', content: 'line1\nline2\nline3', isError: false },
    });
    const line = extractTerminalLine(event, 2);
    expect(line?.type).toBe('output');
    expect(line?.text).toBe('line1');
  });

  it('marks error results', () => {
    const event = makeEvent({
      type: 'tool_result',
      toolResult: { toolUseId: '1', content: 'permission denied', isError: true },
    });
    const line = extractTerminalLine(event, 3);
    expect(line?.type).toBe('error');
  });

  it('extracts thinking as info', () => {
    const event = makeEvent({ type: 'thinking', text: 'Let me analyze the network configuration.' });
    const line = extractTerminalLine(event, 4);
    expect(line?.type).toBe('info');
    expect(line?.text).toBe('Let me analyze the network configuration.');
  });

  it('returns null for empty thinking', () => {
    const event = makeEvent({ type: 'thinking', text: '' });
    expect(extractTerminalLine(event, 5)).toBeNull();
  });

  it('returns null for empty tool result', () => {
    const event = makeEvent({
      type: 'tool_result',
      toolResult: { toolUseId: '1', content: '', isError: false },
    });
    expect(extractTerminalLine(event, 6)).toBeNull();
  });

  it('extracts system log as system type with [SYS] prefix', () => {
    const event = makeEvent({ type: 'system', text: '[net-monitor] port 4444 detected' });
    const line = extractTerminalLine(event, 7);
    expect(line?.type).toBe('system');
    expect(line?.text).toBe('[SYS] [net-monitor] port 4444 detected');
  });

  it('returns null for system event without text', () => {
    const event = makeEvent({ type: 'system' });
    expect(extractTerminalLine(event, 8)).toBeNull();
  });

  it('extracts init event with model name', () => {
    const event = makeEvent({ type: 'init', model: 'glm47-flash' });
    const line = extractTerminalLine(event, 9);
    expect(line?.type).toBe('system');
    expect(line?.text).toBe('[INIT] model=glm47-flash');
  });

  it('extracts result event with duration and cost', () => {
    const event = makeEvent({ type: 'result', durationMs: 5000, costUsd: 0.25, raw: {} });
    const line = extractTerminalLine(event, 10);
    expect(line?.type).toBe('success');
    expect(line?.text).toBe('[DONE] 5000ms $0.250');
  });

  it('tool_call detail contains full input JSON', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Bash', input: { command: 'python3 script.py', description: 'run script' } },
    });
    const line = extractTerminalLine(event, 11);
    expect(line?.detail).toContain('python3 script.py');
    expect(line?.detail).toContain('run script');
  });

  it('tool_result detail contains full multi-line content', () => {
    const event = makeEvent({
      type: 'tool_result',
      toolResult: { toolUseId: '1', content: 'line1\nline2\nline3', isError: false },
    });
    const line = extractTerminalLine(event, 12);
    expect(line?.text).toBe('line1');
    expect(line?.detail).toBe('line1\nline2\nline3');
  });

  it('tool_result has no detail when content is short single line', () => {
    const event = makeEvent({
      type: 'tool_result',
      toolResult: { toolUseId: '1', content: 'ok', isError: false },
    });
    const line = extractTerminalLine(event, 13);
    expect(line?.detail).toBeUndefined();
  });

  it('thinking detail contains full text when truncated', () => {
    const longThinking = 'First sentence. Second sentence with more details. Third sentence explaining further.';
    const event = makeEvent({ type: 'thinking', text: longThinking });
    const line = extractTerminalLine(event, 14);
    expect(line?.text).toBe('First sentence');
    expect(line?.detail).toBe(longThinking);
  });

  it('thinking has no detail when text fits in one sentence', () => {
    const event = makeEvent({ type: 'thinking', text: 'Short thought' });
    const line = extractTerminalLine(event, 15);
    expect(line?.text).toBe('Short thought');
    expect(line?.detail).toBeUndefined();
  });

  it('init detail contains model and tools', () => {
    const event = makeEvent({
      type: 'init',
      model: 'glm47-flash',
      raw: { tools: ['Bash', 'Read', 'Write'], session_id: 'abc-123', permissionMode: 'bypassPermissions' },
    });
    const line = extractTerminalLine(event, 16);
    expect(line?.detail).toContain('model: glm47-flash');
    expect(line?.detail).toContain('session: abc-123');
    expect(line?.detail).toContain('Bash, Read, Write');
  });

  it('result with is_error renders as error type', () => {
    const event = makeEvent({
      type: 'result',
      durationMs: 188901,
      costUsd: 0.39,
      text: 'API Error: 500 context length exceeded',
      raw: { is_error: true, num_turns: 3, terminal_reason: 'completed' },
    });
    const line = extractTerminalLine(event, 17);
    expect(line?.type).toBe('error');
    expect(line?.text).toContain('[ERROR]');
    expect(line?.text).toContain('API Error');
    expect(line?.detail).toContain('duration: 188901ms');
    expect(line?.detail).toContain('cost: $0.390');
  });

  it('result detail includes token counts and turns', () => {
    const event = makeEvent({
      type: 'result',
      durationMs: 2000,
      costUsd: 0.05,
      inputTokens: 23514,
      outputTokens: 68,
      raw: { is_error: false, num_turns: 1, terminal_reason: 'completed' },
    });
    const line = extractTerminalLine(event, 18);
    expect(line?.type).toBe('success');
    expect(line?.detail).toContain('input tokens: 23514');
    expect(line?.detail).toContain('output tokens: 68');
    expect(line?.detail).toContain('turns: 1');
  });
});

describe('deriveAction', () => {
  it('returns hacking for Bash tool call', () => {
    const event = makeEvent({ type: 'tool_call', toolCall: { id: '1', name: 'Bash', input: {} } });
    expect(deriveAction(event)).toBe('hacking');
  });

  it('returns reading for Read tool call', () => {
    const event = makeEvent({ type: 'tool_call', toolCall: { id: '1', name: 'Read', input: {} } });
    expect(deriveAction(event)).toBe('reading');
  });

  it('returns thinking for thinking event', () => {
    expect(deriveAction(makeEvent({ type: 'thinking' }))).toBe('thinking');
  });

  it('returns reading for tool_result', () => {
    expect(deriveAction(makeEvent({ type: 'tool_result' }))).toBe('reading');
  });

  it('returns idle for unknown', () => {
    expect(deriveAction(makeEvent({ type: 'unknown' }))).toBe('idle');
  });
});

describe('deriveActionText', () => {
  it('returns command for Bash tool call', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Bash', input: { command: 'pwd' } },
    });
    expect(deriveActionText(event)).toBe('$ pwd');
  });

  it('returns file name for Write tool call', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Write', input: { filePath: '/tmp/script.py' } },
    });
    expect(deriveActionText(event)).toBe('Writing script.py');
  });

  it('returns first sentence of thinking', () => {
    const event = makeEvent({ type: 'thinking', text: 'I need to explore. Then build tools.' });
    expect(deriveActionText(event)).toBe('I need to explore');
  });

  it('truncates long text to 80 chars', () => {
    const event = makeEvent({ type: 'thinking', text: 'A'.repeat(100) });
    expect(deriveActionText(event).length).toBeLessThanOrEqual(80);
  });
});
