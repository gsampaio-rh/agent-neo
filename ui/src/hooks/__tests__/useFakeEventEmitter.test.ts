import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, useEffect, useRef, type ReactNode } from 'react';
import { EventStreamProvider } from '../../providers/EventStreamProvider';
import { useFakeEventEmitter } from '../useFakeEventEmitter';
import { useEventStream } from '../../providers/EventStreamProvider';
import type { EscapeEvent } from '../../lib/eventParser';

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(EventStreamProvider, { url: null, children });
}

function useCollectedEvents() {
  const eventsRef = useRef<EscapeEvent[]>([]);
  const { subscribe } = useEventStream();

  useEffect(() => {
    const unsub = subscribe((e) => eventsRef.current.push(e));
    return unsub;
  }, [subscribe]);

  return eventsRef;
}

describe('useFakeEventEmitter', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sets connected to true when active', async () => {
    const { result } = renderHook(() => {
      const stream = useEventStream();
      const emitter = useFakeEventEmitter(true);
      return { stream, emitter };
    }, { wrapper: Wrapper });

    await act(async () => { await result.current.emitter.sendPrompt('test'); });
    act(() => { vi.advanceTimersByTime(30_000); });

    expect(result.current.stream.connected).toBe(true);
  });

  it('does not set connected when inactive', async () => {
    const { result } = renderHook(() => {
      const stream = useEventStream();
      useFakeEventEmitter(false);
      return { stream };
    }, { wrapper: Wrapper });

    await act(async () => { vi.advanceTimersByTime(0); });

    expect(result.current.stream.connected).toBe(false);
  });

  it('dispatches init event on sendPrompt', async () => {
    const { result } = renderHook(() => {
      const events = useCollectedEvents();
      const emitter = useFakeEventEmitter(true);
      return { events, emitter };
    }, { wrapper: Wrapper });

    await act(async () => { await result.current.emitter.sendPrompt('hello'); });

    const dispatched = result.current.events.current;
    const initEvents = dispatched.filter((e) => e.type === 'init');
    expect(initEvents).toHaveLength(1);
    expect(initEvents[0].model).toBe('fake-dev');
  });

  it('dispatches block events on scheduled timers', async () => {
    const { result } = renderHook(() => {
      const events = useCollectedEvents();
      const emitter = useFakeEventEmitter(true);
      return { events, emitter };
    }, { wrapper: Wrapper });

    await act(async () => { await result.current.emitter.sendPrompt('hello'); });
    act(() => { vi.advanceTimersByTime(30_000); });

    const types = result.current.events.current.map((e) => e.type);
    expect(types).toContain('init');
    expect(types).toContain('thinking');
    expect(types).toContain('result');
  });

  it('dispatches result event as last event', async () => {
    const { result } = renderHook(() => {
      const events = useCollectedEvents();
      const emitter = useFakeEventEmitter(true);
      return { events, emitter };
    }, { wrapper: Wrapper });

    await act(async () => { await result.current.emitter.sendPrompt('check logs'); });
    act(() => { vi.advanceTimersByTime(30_000); });

    const dispatched = result.current.events.current;
    const last = dispatched[dispatched.length - 1];
    expect(last.type).toBe('result');
    expect(last.inputTokens).toBeGreaterThan(0);
    expect(last.outputTokens).toBeGreaterThan(0);
    expect(last.costUsd).toBeGreaterThan(0);
  });

  it('stopAgent clears pending timers and dispatches result', async () => {
    const { result } = renderHook(() => {
      const events = useCollectedEvents();
      const emitter = useFakeEventEmitter(true);
      return { events, emitter };
    }, { wrapper: Wrapper });

    await act(async () => { await result.current.emitter.sendPrompt('hello'); });
    const countBefore = result.current.events.current.length;

    await act(async () => { await result.current.emitter.stopAgent(); });
    const countAfterStop = result.current.events.current.length;

    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current.events.current.length).toBe(countAfterStop);
  });

  it('does not dispatch when inactive', async () => {
    const { result } = renderHook(() => {
      const events = useCollectedEvents();
      const emitter = useFakeEventEmitter(false);
      return { events, emitter };
    }, { wrapper: Wrapper });

    await act(async () => { await result.current.emitter.sendPrompt('hello'); });
    act(() => { vi.advanceTimersByTime(30_000); });

    expect(result.current.events.current).toHaveLength(0);
  });
});
