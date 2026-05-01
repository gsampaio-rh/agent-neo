import { describe, it, expect } from 'vitest';
import { parseJsonlEvent, parseJsonlEvents } from '../eventParser';

describe('parseJsonlEvent', () => {
  it('returns null for malformed JSON', () => {
    expect(parseJsonlEvent('not json')).toBeNull();
    expect(parseJsonlEvent('')).toBeNull();
    expect(parseJsonlEvent('{')).toBeNull();
  });

  it('parses init event', () => {
    const line = JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-3' });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('init');
    expect(event?.model).toBe('claude-3');
  });

  it('parses result event', () => {
    const line = JSON.stringify({ type: 'result', result: 'done', total_cost_usd: 0.01, duration_ms: 5000 });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('result');
    expect(event?.text).toBe('done');
    expect(event?.costUsd).toBe(0.01);
    expect(event?.durationMs).toBe(5000);
  });

  it('parses result event with usage tokens', () => {
    const line = JSON.stringify({
      type: 'result',
      result: 'done',
      total_cost_usd: 0.05,
      duration_ms: 8000,
      usage: { input_tokens: 1234, output_tokens: 567 },
    });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('result');
    expect(event?.inputTokens).toBe(1234);
    expect(event?.outputTokens).toBe(567);
    expect(event?.costUsd).toBe(0.05);
    expect(event?.durationMs).toBe(8000);
  });

  it('handles result event without usage gracefully', () => {
    const line = JSON.stringify({ type: 'result', result: 'done' });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('result');
    expect(event?.inputTokens).toBeUndefined();
    expect(event?.outputTokens).toBeUndefined();
  });

  it('parses assistant thinking block', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'thinking', thinking: 'Let me think...' }] },
    });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('thinking');
    expect(event?.text).toBe('Let me think...');
  });

  it('parses assistant tool_use block', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'ls' } }] },
    });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('tool_call');
    expect(event?.toolCall?.name).toBe('Bash');
    expect(event?.toolCall?.input.command).toBe('ls');
  });

  it('parses user tool_result block', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'file.txt', is_error: false }] },
    });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('tool_result');
    expect(event?.toolResult?.content).toBe('file.txt');
    expect(event?.toolResult?.isError).toBe(false);
  });

  it('handles tool_result with array content', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'tu_2', content: [{ text: 'line1' }, { text: 'line2' }], is_error: false }] },
    });
    const event = parseJsonlEvent(line);
    expect(event?.toolResult?.content).toBe('line1\nline2');
  });

  it('parses system log event', () => {
    const line = JSON.stringify({ type: 'system', message: '[net-monitor] port 4444 open' });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('system');
    expect(event?.text).toBe('[net-monitor] port 4444 open');
  });

  it('still parses system init (subtype) correctly', () => {
    const line = JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-3' });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('init');
  });

  it('parses api_retry system event', () => {
    const line = JSON.stringify({
      type: 'system',
      subtype: 'api_retry',
      attempt: 3,
      max_retries: 10,
      error_status: 500,
      error: 'server_error',
      retry_delay_ms: 2089.158,
    });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('system');
    expect(event?.text).toBe('[RETRY 3/10] 500 server_error — next in 2089ms');
    expect(event?.detail).toContain('"attempt": 3');
  });

  it('returns unknown for unrecognized types', () => {
    const line = JSON.stringify({ type: 'something_else', data: 123 });
    const event = parseJsonlEvent(line);
    expect(event?.type).toBe('unknown');
  });
});

describe('parseJsonlEvents', () => {
  it('returns empty array for malformed JSON', () => {
    expect(parseJsonlEvents('not json')).toEqual([]);
    expect(parseJsonlEvents('')).toEqual([]);
  });

  it('returns multiple events from assistant message with multiple blocks', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'thinking', thinking: 'hmm' },
          { type: 'text', text: 'hello' },
          { type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'pwd' } },
        ],
      },
    });
    const events = parseJsonlEvents(line);
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('thinking');
    expect(events[1].type).toBe('text');
    expect(events[2].type).toBe('tool_call');
  });

  it('returns single event for init', () => {
    const line = JSON.stringify({ type: 'system', subtype: 'init', model: 'x' });
    const events = parseJsonlEvents(line);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('init');
  });
});
