import { describe, it, expect } from 'vitest';
import { exportAsJson, exportAsMarkdown } from '../chatExport';
import type { ChatMessage, SessionStats } from '../chatReducer';

const emptyStats: SessionStats = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalPrompts: 0,
  totalToolCalls: 0,
  sessionStartedAt: null,
};

const sampleMessages: ChatMessage[] = [
  {
    id: 'user-0',
    role: 'user',
    blocks: [{ kind: 'text', text: 'Hello' }],
    timestamp: '2026-04-30T12:00:00.000Z',
  },
  {
    id: 'assistant-0',
    role: 'assistant',
    blocks: [
      { kind: 'text', text: 'Hi there!' },
      { kind: 'tool_call', id: 'tc-1', name: 'Bash', input: { command: 'ls' } },
      { kind: 'tool_result', toolUseId: 'tc-1', content: 'file.txt', isError: false },
    ],
    timestamp: '2026-04-30T12:00:01.000Z',
    stats: {
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.003,
      durationMs: 2500,
      toolCallCount: 1,
      toolNames: ['Bash'],
    },
  },
];

const sampleStats: SessionStats = {
  totalInputTokens: 100,
  totalOutputTokens: 50,
  totalPrompts: 1,
  totalToolCalls: 1,
  sessionStartedAt: '2026-04-30T12:00:00.000Z',
};

describe('exportAsJson', () => {
  it('returns valid JSON with expected structure', () => {
    const result = exportAsJson(sampleMessages, sampleStats);
    const parsed = JSON.parse(result);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.stats.totalPrompts).toBe(1);
    expect(parsed.exportedAt).toBeDefined();
  });

  it('handles empty messages', () => {
    const result = exportAsJson([], emptyStats);
    const parsed = JSON.parse(result);
    expect(parsed.messages).toEqual([]);
    expect(parsed.stats.totalPrompts).toBe(0);
  });
});

describe('exportAsMarkdown', () => {
  it('contains role headers and message content', () => {
    const md = exportAsMarkdown(sampleMessages, sampleStats);
    expect(md).toContain('## User');
    expect(md).toContain('## Assistant');
    expect(md).toContain('Hello');
    expect(md).toContain('Hi there!');
  });

  it('includes tool call blocks', () => {
    const md = exportAsMarkdown(sampleMessages, sampleStats);
    expect(md).toContain('**Tool: Bash**');
    expect(md).toContain('ls');
  });

  it('includes per-message stats', () => {
    const md = exportAsMarkdown(sampleMessages, sampleStats);
    expect(md).toContain('IN: 100');
    expect(md).toContain('OUT: 50');
    expect(md).toContain('1 tools');
  });

  it('includes session-level stats', () => {
    const md = exportAsMarkdown(sampleMessages, sampleStats);
    expect(md).toContain('**Prompts:** 1');
    expect(md).toContain('**Tool calls:** 1');
  });

  it('handles empty messages', () => {
    const md = exportAsMarkdown([], emptyStats);
    expect(md).toContain('# Chat Export');
    expect(md).not.toContain('## User');
  });
});
