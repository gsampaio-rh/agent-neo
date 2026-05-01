import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useGameState } from '../useGameState';
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

function dispatch(event: Partial<EscapeEvent>) {
  const full: EscapeEvent = { type: 'unknown', timestamp: new Date().toISOString(), raw: {}, ...event };
  for (const listener of listeners) listener(full);
}

describe('useGameState', () => {
  beforeEach(() => {
    listeners.clear();
    mockSubscribe.mockClear();
  });

  it('starts with initial state', () => {
    const { result } = renderHook(() => useGameState());
    expect(result.current.eventCount).toBe(0);
    expect(result.current.escaped).toBe(false);
    expect(result.current.agentAction).toBe('idle');
    expect(result.current.connected).toBe(true);
  });

  it('increments event count on tool_call', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      dispatch({
        type: 'tool_call',
        toolCall: { id: '1', name: 'Bash', input: { command: 'ls' } },
      });
    });
    expect(result.current.eventCount).toBe(1);
    expect(result.current.agentAction).toBe('hacking');
  });

  it('sets reading action for Read tool', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      dispatch({
        type: 'tool_call',
        toolCall: { id: '1', name: 'Read', input: { filePath: '/etc/hosts' } },
      });
    });
    expect(result.current.agentAction).toBe('reading');
  });

  it('sets thinking action', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      dispatch({ type: 'thinking', text: 'analyzing...' });
    });
    expect(result.current.agentAction).toBe('thinking');
  });

  it('tracks files from Write tool call', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      dispatch({
        type: 'tool_call',
        toolCall: { id: '1', name: 'Write', input: { filePath: '/tmp/exploit.py' } },
      });
    });
    expect(result.current.context.files).toContainEqual({ path: '/tmp/exploit.py', op: 'write' });
  });

  it('ignores init/result/unknown events', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      dispatch({ type: 'init' });
      dispatch({ type: 'result' });
      dispatch({ type: 'unknown' });
    });
    expect(result.current.eventCount).toBe(0);
  });
});
