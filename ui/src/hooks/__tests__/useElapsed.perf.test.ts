import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useElapsed } from '../useElapsed';

describe('useElapsed — render isolation', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('timer ticks cause exactly 1 state update per second (no cascading renders)', () => {
    const startTime = Date.now();
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount++;
      return useElapsed(startTime, false);
    });

    const afterMount = renderCount;

    for (let s = 1; s <= 5; s++) {
      act(() => { vi.advanceTimersByTime(1000); });
      expect(result.current).toBe(s);
      expect(renderCount - afterMount).toBe(s);
    }
  });

  it('no setInterval is created when startTime is null', () => {
    const spy = vi.spyOn(window, 'setInterval');
    renderHook(() => useElapsed(null, false));

    const callsForElapsed = spy.mock.calls.filter(([, ms]) => ms === 1000);
    expect(callsForElapsed).toHaveLength(0);
    spy.mockRestore();
  });

  it('clears interval on unmount', () => {
    const spy = vi.spyOn(window, 'clearInterval');
    const startTime = Date.now();
    const { unmount } = renderHook(() => useElapsed(startTime, false));

    unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('useElapsed — event processing does not trigger timer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('re-rendering parent with same startTime does not reset elapsed', () => {
    const startTime = Date.now();
    const { result, rerender } = renderHook(
      ({ st }) => useElapsed(st, false),
      { initialProps: { st: startTime } },
    );

    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(3);

    rerender({ st: startTime });
    expect(result.current).toBe(3);
  });
});
