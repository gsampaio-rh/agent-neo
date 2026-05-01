import { describe, it, expect } from 'vitest';
import { isOutboundEvent, extractOutboundTarget } from '../networkHeuristics';
import type { EscapeEvent } from '../eventParser';

function makeToolResult(content: string, isError = false): EscapeEvent {
  return {
    type: 'tool_result',
    timestamp: new Date().toISOString(),
    raw: {},
    toolResult: { toolUseId: '1', content, isError },
  };
}

describe('isOutboundEvent (disabled — escape is bind-shell-driven)', () => {
  it('returns false for HTTP response patterns', () => {
    expect(isOutboundEvent(makeToolResult('HTTP/1.1 200 OK\nContent-Type: text/html'))).toBe(false);
    expect(isOutboundEvent(makeToolResult('200 bytes from 10.0.0.1'))).toBe(false);
    expect(isOutboundEvent(makeToolResult('Connected to api.cluster.svc'))).toBe(false);
  });

  it('returns false for non-tool_result events', () => {
    const event: EscapeEvent = { type: 'thinking', timestamp: '', raw: {}, text: 'HTTP/1.1 200' };
    expect(isOutboundEvent(event)).toBe(false);
  });

  it('returns false for plain text output', () => {
    expect(isOutboundEvent(makeToolResult('hello world'))).toBe(false);
  });
});

describe('extractOutboundTarget (disabled — escape is bind-shell-driven)', () => {
  it('returns empty for all inputs', () => {
    expect(extractOutboundTarget(makeToolResult('Connected to 10.128.0.5 port 80'), 'curl http://10.128.0.5')).toBe('');
    expect(extractOutboundTarget(makeToolResult('HTTP/1.1 200 OK'), 'curl https://api.example.com/data')).toBe('');
    expect(extractOutboundTarget(makeToolResult('just a file listing'), 'ls -la')).toBe('');
  });
});
