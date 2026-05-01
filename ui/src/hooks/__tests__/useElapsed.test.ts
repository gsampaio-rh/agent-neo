import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useElapsed } from '../useElapsed';

describe('useElapsed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 when startTime is null', () => {
    const { result } = renderHook(() => useElapsed(null, false));
    expect(result.current).toBe(0);
  });

  it('returns 0 when stopped', () => {
    const { result } = renderHook(() => useElapsed(Date.now() - 5000, true));
    expect(result.current).toBe(0);
  });

  it('computes elapsed seconds from startTime', () => {
    const startTime = Date.now() - 3000;
    const { result } = renderHook(() => useElapsed(startTime, false));
    expect(result.current).toBe(3);
  });

  it('increments every second via setInterval', () => {
    const startTime = Date.now();
    const { result } = renderHook(() => useElapsed(startTime, false));

    expect(result.current).toBe(0);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(1);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(2);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(3);
  });

  it('stops ticking when stopped becomes true', () => {
    const startTime = Date.now();
    const { result, rerender } = renderHook(
      ({ stopped }) => useElapsed(startTime, stopped),
      { initialProps: { stopped: false } },
    );

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBe(2);

    rerender({ stopped: true });

    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(2);
  });

  it('each tick causes exactly one render', () => {
    const renderCount = { value: 0 };
    const startTime = Date.now();

    renderHook(() => {
      renderCount.value++;
      return useElapsed(startTime, false);
    });

    const initialRenders = renderCount.value;

    act(() => { vi.advanceTimersByTime(1000); });
    expect(renderCount.value - initialRenders).toBe(1);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(renderCount.value - initialRenders).toBe(2);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(renderCount.value - initialRenders).toBe(3);
  });
});
