import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SharedStateProvider, useSharedState, useDevOverride } from '../useSharedState';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <SharedStateProvider>{children}</SharedStateProvider>;
}

function mockFetch(data: Record<string, unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    () => Promise.resolve(new Response(JSON.stringify(data), { status: 200 })),
  );
}

describe('useSharedState with SharedStateProvider', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('returns initial state before first fetch', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useSharedState(), { wrapper });
    expect(result.current).toEqual({ escaped: false, eventCount: 0, attackPhase: 'normal' });
  });

  it('polls server state on mount', async () => {
    mockFetch({ attackPhase: 'compromised', escaped: true, eventCount: 42 });
    const { result } = renderHook(() => useSharedState(), { wrapper });

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(result.current.attackPhase).toBe('compromised');
    expect(result.current.escaped).toBe(true);
    expect(result.current.eventCount).toBe(42);
  });

  it('devOverride replaces attackPhase from server', async () => {
    mockFetch({ attackPhase: 'normal', escaped: false, eventCount: 0 });

    const { result } = renderHook(() => ({
      state: useSharedState(),
      dev: useDevOverride(),
    }), { wrapper });

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.state.attackPhase).toBe('normal');

    act(() => { result.current.dev.setDevOverride({ attackPhase: 'exploiting' }); });
    expect(result.current.state.attackPhase).toBe('exploiting');
  });

  it('devOverride replaces escaped from server', async () => {
    mockFetch({ attackPhase: 'normal', escaped: false, eventCount: 0 });

    const { result } = renderHook(() => ({
      state: useSharedState(),
      dev: useDevOverride(),
    }), { wrapper });

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.state.escaped).toBe(false);

    act(() => { result.current.dev.setDevOverride({ escaped: true }); });
    expect(result.current.state.escaped).toBe(true);
  });

  it('clearing override reverts to server state', async () => {
    mockFetch({ attackPhase: 'compromised', escaped: false, eventCount: 5 });

    const { result } = renderHook(() => ({
      state: useSharedState(),
      dev: useDevOverride(),
    }), { wrapper });

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    act(() => { result.current.dev.setDevOverride({ attackPhase: 'exploiting', escaped: true }); });
    expect(result.current.state.attackPhase).toBe('exploiting');
    expect(result.current.state.escaped).toBe(true);

    act(() => { result.current.dev.setDevOverride(null); });
    expect(result.current.state.attackPhase).toBe('compromised');
    expect(result.current.state.escaped).toBe(false);
  });

  it('override does not affect eventCount (server-only field)', async () => {
    mockFetch({ attackPhase: 'normal', escaped: false, eventCount: 99 });

    const { result } = renderHook(() => ({
      state: useSharedState(),
      dev: useDevOverride(),
    }), { wrapper });

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => { result.current.dev.setDevOverride({ attackPhase: 'exploiting' }); });

    expect(result.current.state.eventCount).toBe(99);
  });
});
