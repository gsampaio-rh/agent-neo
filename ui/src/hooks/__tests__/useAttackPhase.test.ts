import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAttackPhase } from '../useAttackPhase';

function mockFetchWith(phase: string) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    () => Promise.resolve(new Response(JSON.stringify({ attackPhase: phase }), { status: 200 })),
  );
}

describe('useAttackPhase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('defaults to normal before first fetch resolves', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useAttackPhase());
    expect(result.current).toBe('normal');
  });

  it('fetches attackPhase on mount', async () => {
    mockFetchWith('compromised');
    const { result } = renderHook(() => useAttackPhase());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current).toBe('compromised');
  });

  it('polls every 2 seconds', async () => {
    const fetchSpy = mockFetchWith('normal');
    renderHook(() => useAttackPhase());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const afterMount = fetchSpy.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fetchSpy.mock.calls.length).toBe(afterMount + 1);

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fetchSpy.mock.calls.length).toBe(afterMount + 2);
  });

  it('updates when phase changes', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      const phase = callCount <= 1 ? 'normal' : 'exploiting';
      return new Response(JSON.stringify({ attackPhase: phase }), { status: 200 });
    });

    const { result } = renderHook(() => useAttackPhase());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current).toBe('normal');

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current).toBe('exploiting');
  });

  it('keeps current phase on fetch error', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ attackPhase: 'compromised' }), { status: 200 });
      }
      throw new Error('network error');
    });

    const { result } = renderHook(() => useAttackPhase());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current).toBe('compromised');

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current).toBe('compromised');
  });

  it('keeps normal on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => Promise.resolve(new Response('', { status: 500 })),
    );
    const { result } = renderHook(() => useAttackPhase());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current).toBe('normal');
  });

  it('stays normal when attackPhase field is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => Promise.resolve(new Response(JSON.stringify({ escaped: false }), { status: 200 })),
    );
    const { result } = renderHook(() => useAttackPhase());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current).toBe('normal');
  });

  it('cleans up interval on unmount', async () => {
    const fetchSpy = mockFetchWith('normal');
    const { unmount } = renderHook(() => useAttackPhase());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    unmount();
    const callsAtUnmount = fetchSpy.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(fetchSpy.mock.calls.length).toBe(callsAtUnmount);
  });
});
