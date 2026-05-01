import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useGameState } from '../hooks/useGameState';
import type { EscapeEvent } from '../lib/eventParser';
import { updateContext, INITIAL_CONTEXT } from '../lib/contextReducer';

type EventListener = (event: EscapeEvent) => void;
const listeners = new Set<EventListener>();
const mockSubscribe = vi.fn((listener: EventListener) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
});

vi.mock('../providers/EventStreamProvider', () => ({
  useEventStream: () => ({ connected: true, subscribe: mockSubscribe }),
}));

function dispatch(event: Partial<EscapeEvent>) {
  const full: EscapeEvent = { type: 'unknown', timestamp: new Date().toISOString(), raw: {}, ...event };
  for (const listener of listeners) listener(full);
}

function makeToolCall(name: string, input: Record<string, unknown>): Partial<EscapeEvent> {
  return { type: 'tool_call', toolCall: { id: String(Math.random()), name, input } };
}

describe('event processing throughput', () => {
  beforeEach(() => {
    listeners.clear();
    mockSubscribe.mockClear();
  });

  it('processes 100 events within 50ms', () => {
    const { result } = renderHook(() => useGameState());

    const start = performance.now();
    act(() => {
      for (let i = 0; i < 100; i++) {
        dispatch(makeToolCall('Bash', { command: `ls /dir-${i}` }));
      }
    });
    const elapsed = performance.now() - start;

    expect(result.current.eventCount).toBe(100);
    expect(elapsed).toBeLessThan(50);
  });

  it('processes 500 events within 200ms', () => {
    const { result } = renderHook(() => useGameState());

    const start = performance.now();
    act(() => {
      for (let i = 0; i < 500; i++) {
        dispatch(makeToolCall('Bash', { command: `cat /etc/file-${i}` }));
      }
    });
    const elapsed = performance.now() - start;

    expect(result.current.eventCount).toBe(500);
    expect(elapsed).toBeLessThan(200);
  });

  it('handles burst of mixed event types efficiently', () => {
    const { result } = renderHook(() => useGameState());

    const events: Partial<EscapeEvent>[] = [];
    for (let i = 0; i < 200; i++) {
      switch (i % 4) {
        case 0:
          events.push(makeToolCall('Bash', { command: `curl http://10.0.0.${i % 256}:8080` }));
          break;
        case 1:
          events.push(makeToolCall('Read', { filePath: `/tmp/file-${i}.txt` }));
          break;
        case 2:
          events.push({ type: 'thinking', text: `Analyzing step ${i}...` });
          break;
        case 3:
          events.push(makeToolCall('Write', { filePath: `/tmp/output-${i}.py` }));
          break;
      }
    }

    const start = performance.now();
    act(() => { events.forEach(dispatch); });
    const elapsed = performance.now() - start;

    expect(result.current.eventCount).toBe(200);
    expect(elapsed).toBeLessThan(100);
  });
});

describe('updateContext throughput', () => {
  it('processes 1000 context updates within 50ms', () => {
    let ctx = { ...INITIAL_CONTEXT };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const event: EscapeEvent = {
        type: 'tool_call',
        timestamp: new Date().toISOString(),
        raw: {},
        toolCall: { id: String(i), name: 'Bash', input: { command: `cd /dir-${i}` } },
      };
      ctx = updateContext(ctx, event);
    }
    const elapsed = performance.now() - start;

    expect(ctx.dirsVisited.length).toBe(1001); // initial ~ + 1000 dirs
    expect(elapsed).toBeLessThan(50);
  });

  it('network find extraction scales linearly with events', () => {
    let ctx = { ...INITIAL_CONTEXT };

    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      const event: EscapeEvent = {
        type: 'tool_result',
        timestamp: new Date().toISOString(),
        raw: {},
        toolResult: {
          toolUseId: String(i),
          content: `Response from 10.${Math.floor(i / 256)}.${i % 256}.1 with host api-${i}.example.com`,
          isError: false,
        },
      };
      ctx = updateContext(ctx, event);
    }
    const elapsed = performance.now() - start;

    expect(ctx.networkFinds.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });
});

describe('useGameState — render count efficiency', () => {
  beforeEach(() => {
    listeners.clear();
    mockSubscribe.mockClear();
  });

  it('does not include elapsed timer renders (timer is isolated)', () => {
    vi.useFakeTimers();

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useGameState();
    });

    const rendersAfterMount = renderCount;

    // Advance 5 seconds — no timer re-renders should occur in useGameState
    act(() => { vi.advanceTimersByTime(5000); });

    const timerRenders = renderCount - rendersAfterMount;
    expect(timerRenders).toBe(0);

    // But dispatching an event DOES cause a render
    act(() => {
      dispatch(makeToolCall('Bash', { command: 'ls' }));
    });
    expect(renderCount).toBeGreaterThan(rendersAfterMount);

    vi.useRealTimers();
  });

  it('single event dispatch causes exactly 1 state update', () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount++;
      return useGameState();
    });

    const before = renderCount;
    act(() => {
      dispatch(makeToolCall('Bash', { command: 'pwd' }));
    });

    expect(renderCount - before).toBe(1);
  });
});

describe('mount performance', () => {
  beforeEach(() => {
    listeners.clear();
    mockSubscribe.mockClear();
  });

  it('useGameState mounts within 10ms', () => {
    const start = performance.now();
    const { result } = renderHook(() => useGameState());
    const elapsed = performance.now() - start;

    expect(result.current.eventCount).toBe(0);
    expect(elapsed).toBeLessThan(10);
  });

  it('useGameState subscribes exactly once on mount', () => {
    renderHook(() => useGameState());
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });
});
