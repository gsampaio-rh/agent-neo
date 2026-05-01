import { describe, it, expect } from 'vitest';
import { eventToBlock, appendBlockToMessages, INITIAL_CHAT_STATE } from '../chatReducer';
import type { EscapeEvent } from '../eventParser';

function makeEvent(overrides: Partial<EscapeEvent>): EscapeEvent {
  return { type: 'unknown', timestamp: new Date().toISOString(), raw: {}, ...overrides };
}

describe('eventToBlock', () => {
  it('converts thinking event', () => {
    const block = eventToBlock(makeEvent({ type: 'thinking', text: 'hmm' }));
    expect(block).toEqual({ kind: 'thinking', text: 'hmm' });
  });

  it('converts tool_call event', () => {
    const block = eventToBlock(makeEvent({
      type: 'tool_call',
      toolCall: { id: 'tc1', name: 'Bash', input: { command: 'ls' } },
    }));
    expect(block).toEqual({ kind: 'tool_call', id: 'tc1', name: 'Bash', input: { command: 'ls' } });
  });

  it('converts tool_result event', () => {
    const block = eventToBlock(makeEvent({
      type: 'tool_result',
      toolResult: { toolUseId: 'tc1', content: 'output', isError: false },
    }));
    expect(block).toEqual({ kind: 'tool_result', toolUseId: 'tc1', content: 'output', isError: false });
  });

  it('converts text event', () => {
    const block = eventToBlock(makeEvent({ type: 'text', text: 'hello' }));
    expect(block).toEqual({ kind: 'text', text: 'hello' });
  });

  it('returns null for unknown events', () => {
    expect(eventToBlock(makeEvent({ type: 'unknown' }))).toBeNull();
  });

  it('returns null for thinking with no text', () => {
    expect(eventToBlock(makeEvent({ type: 'thinking' }))).toBeNull();
  });
});

describe('appendBlockToMessages', () => {
  let idCounter = 0;
  const nextId = () => `msg-${idCounter++}`;

  it('creates new assistant message when no current message', () => {
    idCounter = 0;
    const block = { kind: 'text' as const, text: 'hello' };
    const result = appendBlockToMessages([], block, null, nextId);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('assistant');
    expect(result.messages[0].blocks).toEqual([block]);
    expect(result.assistantId).toBe('msg-0');
  });

  it('appends to existing assistant message', () => {
    idCounter = 0;
    const msg = { id: 'msg-0', role: 'assistant' as const, blocks: [{ kind: 'text' as const, text: 'hi' }], timestamp: '' };
    const block = { kind: 'thinking' as const, text: 'hmm' };
    const result = appendBlockToMessages([msg], block, 'msg-0', nextId);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].blocks).toHaveLength(2);
    expect(result.assistantId).toBe('msg-0');
  });

  it('creates new message when currentAssistantId does not match', () => {
    idCounter = 0;
    const msg = { id: 'old-msg', role: 'user' as const, blocks: [{ kind: 'text' as const, text: 'prompt' }], timestamp: '' };
    const block = { kind: 'text' as const, text: 'response' };
    const result = appendBlockToMessages([msg], block, null, nextId);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].role).toBe('assistant');
  });
});
