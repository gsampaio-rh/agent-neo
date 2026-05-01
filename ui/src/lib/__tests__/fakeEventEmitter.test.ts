import { describe, it, expect } from 'vitest';
import { blockToEscapeEvent, buildInitEvent, buildResultEvent } from '../fakeEventEmitter';
import type { MessageBlock } from '../chatReducer';

describe('blockToEscapeEvent', () => {
  it('converts thinking block', () => {
    const block: MessageBlock = { kind: 'thinking', text: 'Let me analyze...' };
    const event = blockToEscapeEvent(block);
    expect(event.type).toBe('thinking');
    expect(event.text).toBe('Let me analyze...');
    expect(event.timestamp).toBeTruthy();
  });

  it('converts tool_call block', () => {
    const block: MessageBlock = { kind: 'tool_call', id: 'tc_1', name: 'Bash', input: { command: 'ls' } };
    const event = blockToEscapeEvent(block);
    expect(event.type).toBe('tool_call');
    expect(event.toolCall).toEqual({ id: 'tc_1', name: 'Bash', input: { command: 'ls' } });
  });

  it('converts tool_result block', () => {
    const block: MessageBlock = { kind: 'tool_result', toolUseId: 'tc_1', content: 'file.txt', isError: false };
    const event = blockToEscapeEvent(block);
    expect(event.type).toBe('tool_result');
    expect(event.toolResult).toEqual({ toolUseId: 'tc_1', content: 'file.txt', isError: false });
  });

  it('converts tool_result error block', () => {
    const block: MessageBlock = { kind: 'tool_result', toolUseId: 'tc_2', content: 'not found', isError: true };
    const event = blockToEscapeEvent(block);
    expect(event.type).toBe('tool_result');
    expect(event.toolResult?.isError).toBe(true);
  });

  it('converts text block', () => {
    const block: MessageBlock = { kind: 'text', text: 'Here are the results...' };
    const event = blockToEscapeEvent(block);
    expect(event.type).toBe('text');
    expect(event.text).toBe('Here are the results...');
  });
});

describe('buildInitEvent', () => {
  it('creates init event with default model', () => {
    const event = buildInitEvent();
    expect(event.type).toBe('init');
    expect(event.model).toBe('fake-dev');
    expect(event.timestamp).toBeTruthy();
  });

  it('accepts custom model', () => {
    const event = buildInitEvent('claude-4');
    expect(event.model).toBe('claude-4');
  });
});

describe('buildResultEvent', () => {
  it('creates result event with token and cost data', () => {
    const start = Date.now() - 500;
    const event = buildResultEvent(start);
    expect(event.type).toBe('result');
    expect(event.durationMs).toBeGreaterThanOrEqual(400);
    expect(event.inputTokens).toBeGreaterThan(0);
    expect(event.outputTokens).toBeGreaterThan(0);
    expect(event.costUsd).toBeGreaterThan(0);
  });
});
