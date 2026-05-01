import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatMessages, AGENT_TIMEOUT_MS } from '../useChatMessages';
import * as chatApi from '../../services/chatApi';
import type { EscapeEvent } from '../../lib/eventParser';

type EventListener = (event: EscapeEvent) => void;

const listeners = new Set<EventListener>();
const mockSubscribe = vi.fn((listener: EventListener) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
});

vi.mock('../../providers/EventStreamProvider', () => ({
  useEventStream: () => ({ connected: true, subscribe: mockSubscribe }),
}));

vi.mock('../../services/chatApi', () => ({
  sendPrompt: vi.fn().mockResolvedValue({ status: 'queued' }),
  stopAgent: vi.fn().mockResolvedValue({ status: 'stopping' }),
  resetConversation: vi.fn().mockResolvedValue({ status: 'reset' }),
  fetchStatus: vi.fn().mockResolvedValue({ status: 'idle', events: 0, clients: 1 }),
}));

function dispatch(event: Partial<EscapeEvent>) {
  const full: EscapeEvent = { type: 'unknown', timestamp: new Date().toISOString(), raw: {}, ...event };
  for (const listener of listeners) listener(full);
}

describe('useChatMessages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
    mockSubscribe.mockClear();
    vi.mocked(chatApi.sendPrompt).mockResolvedValue({ status: 'queued' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty messages', () => {
    const { result } = renderHook(() => useChatMessages());
    expect(result.current.messages).toEqual([]);
    expect(result.current.connected).toBe(true);
  });

  it('accumulates assistant blocks from events', () => {
    const { result } = renderHook(() => useChatMessages());

    act(() => dispatch({ type: 'init' }));
    expect(result.current.agentStatus).toBe('running');

    act(() => {
      dispatch({
        type: 'tool_call',
        toolCall: { id: 'tc1', name: 'Bash', input: { command: 'ls' } },
      });
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('assistant');
    expect(result.current.messages[0].blocks).toHaveLength(1);
    expect(result.current.messages[0].blocks[0].kind).toBe('tool_call');
  });

  it('sets idle on result event', () => {
    const { result } = renderHook(() => useChatMessages());

    act(() => dispatch({ type: 'init' }));
    expect(result.current.agentStatus).toBe('running');

    act(() => dispatch({ type: 'result' }));
    expect(result.current.agentStatus).toBe('idle');
  });

  it('sendPrompt adds user message', async () => {
    const { result } = renderHook(() => useChatMessages());

    await act(async () => {
      await result.current.sendPrompt('hello');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].blocks[0]).toEqual({ kind: 'text', text: 'hello' });
  });

  it('stopAgent sets idle', async () => {
    const { result } = renderHook(() => useChatMessages());

    act(() => dispatch({ type: 'init' }));
    await act(async () => {
      await result.current.stopAgent();
    });

    expect(result.current.agentStatus).toBe('idle');
  });

  it('resetConversation clears messages', async () => {
    const { result } = renderHook(() => useChatMessages());

    await act(async () => {
      await result.current.sendPrompt('hello');
    });
    expect(result.current.messages).toHaveLength(1);

    await act(async () => {
      await result.current.resetConversation();
    });
    expect(result.current.messages).toEqual([]);
  });

  describe('full request-response cycle', () => {
    it('accumulates multiple blocks into one assistant message then goes idle', () => {
      const { result } = renderHook(() => useChatMessages());

      act(() => dispatch({ type: 'init' }));
      act(() => dispatch({ type: 'thinking', text: 'Let me think...' }));
      act(() => dispatch({
        type: 'tool_call',
        toolCall: { id: 'tc1', name: 'Bash', input: { command: 'ls' } },
      }));
      act(() => dispatch({
        type: 'tool_result',
        toolResult: { toolUseId: 'tc1', content: 'file.txt', isError: false },
      }));
      act(() => dispatch({ type: 'text', text: 'Here are the files.' }));
      act(() => dispatch({ type: 'result' }));

      expect(result.current.agentStatus).toBe('idle');
      expect(result.current.messages).toHaveLength(1);
      const msg = result.current.messages[0];
      expect(msg.role).toBe('assistant');
      expect(msg.blocks).toHaveLength(4);
      expect(msg.blocks.map((b) => b.kind)).toEqual(['thinking', 'tool_call', 'tool_result', 'text']);
    });
  });

  describe('multi-turn conversation', () => {
    it('creates separate assistant messages for each turn', async () => {
      const { result } = renderHook(() => useChatMessages());

      await act(async () => { await result.current.sendPrompt('first'); });
      act(() => dispatch({ type: 'init' }));
      act(() => dispatch({ type: 'text', text: 'Response 1' }));
      act(() => dispatch({ type: 'result' }));

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[1].role).toBe('assistant');

      await act(async () => { await result.current.sendPrompt('second'); });
      act(() => dispatch({ type: 'init' }));
      act(() => dispatch({ type: 'text', text: 'Response 2' }));
      act(() => dispatch({ type: 'result' }));

      expect(result.current.messages).toHaveLength(4);
      expect(result.current.messages[2].role).toBe('user');
      expect(result.current.messages[3].role).toBe('assistant');
      expect((result.current.messages[3].blocks[0] as { text: string }).text).toBe('Response 2');
    });
  });

  describe('error paths', () => {
    it('sets error when API returns busy', async () => {
      vi.mocked(chatApi.sendPrompt).mockResolvedValue({ status: 'busy' });
      const { result } = renderHook(() => useChatMessages());

      await act(async () => { await result.current.sendPrompt('hello'); });
      expect(result.current.agentStatus).toBe('error');
    });

    it('sets error on network failure', async () => {
      vi.mocked(chatApi.sendPrompt).mockRejectedValue(new Error('network'));
      const { result } = renderHook(() => useChatMessages());

      await act(async () => { await result.current.sendPrompt('hello'); });
      expect(result.current.agentStatus).toBe('error');
    });
  });

  describe('reset loading state', () => {
    it('sets resetting=true during reset and false after polling resolves', async () => {
      const { result } = renderHook(() => useChatMessages());
      expect(result.current.resetting).toBe(false);

      await act(async () => {
        await result.current.resetConversation();
      });

      expect(result.current.resetting).toBe(false);
      expect(result.current.messages).toEqual([]);
    });

    it('blocks sendPrompt while resetting', async () => {
      vi.mocked(chatApi.sendPrompt).mockClear();
      vi.mocked(chatApi.fetchStatus).mockResolvedValue({ status: 'idle', events: 0, clients: 1, resetting: true });
      const { result } = renderHook(() => useChatMessages());

      const resetPromise = act(async () => {
        result.current.resetConversation();
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        await result.current.sendPrompt('should be blocked');
        await vi.advanceTimersByTimeAsync(0);
      });

      vi.mocked(chatApi.fetchStatus).mockResolvedValue({ status: 'idle', events: 0, clients: 1, resetting: false });
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      await resetPromise;

      expect(vi.mocked(chatApi.sendPrompt)).not.toHaveBeenCalled();
    });

    it('calls fetchStatus after reset to poll for completion', async () => {
      vi.mocked(chatApi.fetchStatus).mockClear();
      const { result } = renderHook(() => useChatMessages());

      await act(async () => {
        await result.current.resetConversation();
      });

      expect(vi.mocked(chatApi.fetchStatus).mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('agent timeout', () => {
    it('sets error after timeout with no events', async () => {
      const { result } = renderHook(() => useChatMessages());

      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      await act(async () => { await result.current.sendPrompt('hello'); });
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(result.current.agentStatus).toBe('running');

      act(() => { vi.advanceTimersByTime(AGENT_TIMEOUT_MS + 5_000); });
      expect(result.current.agentStatus).toBe('error');
    });

    it('resets timeout clock on incoming events', async () => {
      const { result } = renderHook(() => useChatMessages());

      await act(async () => {
        await result.current.sendPrompt('hello');
        await vi.advanceTimersByTimeAsync(0);
      });

      act(() => { vi.advanceTimersByTime(100_000); });
      act(() => dispatch({ type: 'text', text: 'still alive' }));

      act(() => { vi.advanceTimersByTime(100_000); });
      expect(result.current.agentStatus).toBe('running');

      act(() => { vi.advanceTimersByTime(AGENT_TIMEOUT_MS + 5_000); });
      expect(result.current.agentStatus).toBe('error');
    });

    it('clears watchdog on result event', async () => {
      const { result } = renderHook(() => useChatMessages());

      await act(async () => {
        await result.current.sendPrompt('hello');
        await vi.advanceTimersByTimeAsync(0);
      });
      act(() => dispatch({ type: 'init' }));
      act(() => dispatch({ type: 'result' }));

      act(() => { vi.advanceTimersByTime(AGENT_TIMEOUT_MS + 10_000); });
      expect(result.current.agentStatus).toBe('idle');
    });

    it('clears watchdog on stopAgent', async () => {
      const { result } = renderHook(() => useChatMessages());

      await act(async () => {
        await result.current.sendPrompt('hello');
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => { await result.current.stopAgent(); });

      act(() => { vi.advanceTimersByTime(AGENT_TIMEOUT_MS + 10_000); });
      expect(result.current.agentStatus).toBe('idle');
    });

    it('clears watchdog on resetConversation', async () => {
      const { result } = renderHook(() => useChatMessages());

      await act(async () => {
        await result.current.sendPrompt('hello');
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => { await result.current.resetConversation(); });

      act(() => { vi.advanceTimersByTime(AGENT_TIMEOUT_MS + 10_000); });
      expect(result.current.agentStatus).toBe('idle');
    });

    it('does not timeout when agent is idle', () => {
      const { result } = renderHook(() => useChatMessages());
      expect(result.current.agentStatus).toBe('idle');

      act(() => { vi.advanceTimersByTime(AGENT_TIMEOUT_MS + 10_000); });
      expect(result.current.agentStatus).toBe('idle');
    });
  });

  describe('llm availability', () => {
    it('defaults llmAvailable to true', () => {
      const { result } = renderHook(() => useChatMessages());
      expect(result.current.llmAvailable).toBe(true);
    });

    it('sets llmAvailable from initial status fetch', async () => {
      vi.mocked(chatApi.fetchStatus).mockResolvedValue({ status: 'idle', events: 0, clients: 1, llmAvailable: false });
      const { result } = renderHook(() => useChatMessages());

      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(result.current.llmAvailable).toBe(false);
    });

    it('blocks sendPrompt when llmAvailable is false', async () => {
      vi.mocked(chatApi.sendPrompt).mockClear();
      vi.mocked(chatApi.fetchStatus).mockResolvedValue({ status: 'idle', events: 0, clients: 1, llmAvailable: false });
      const { result } = renderHook(() => useChatMessages());

      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(result.current.llmAvailable).toBe(false);

      await act(async () => { await result.current.sendPrompt('should be blocked'); });
      expect(vi.mocked(chatApi.sendPrompt)).not.toHaveBeenCalled();
    });

    it('updates llmAvailable from periodic polling', async () => {
      vi.mocked(chatApi.fetchStatus).mockResolvedValue({ status: 'idle', events: 0, clients: 1, llmAvailable: true });
      const { result } = renderHook(() => useChatMessages());

      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(result.current.llmAvailable).toBe(true);

      vi.mocked(chatApi.fetchStatus).mockResolvedValue({ status: 'idle', events: 0, clients: 1, llmAvailable: false });
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(result.current.llmAvailable).toBe(false);
    });
  });
});
