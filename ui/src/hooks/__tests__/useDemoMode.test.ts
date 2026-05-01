import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoMode } from '../useDemoMode';

describe('useDemoMode', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts inactive with initial state', () => {
    const { result } = renderHook(() => useDemoMode());
    expect(result.current.isDemoActive).toBe(false);
    expect(result.current.state.connected).toBe(false);
    expect(result.current.state.eventCount).toBe(0);
  });

  it('startDemo sets active and connected', () => {
    const { result } = renderHook(() => useDemoMode());
    act(() => { result.current.startDemo(); });

    expect(result.current.isDemoActive).toBe(true);
    expect(result.current.state.connected).toBe(true);
    expect(result.current.state.startTime).toBeGreaterThan(0);
  });

  it('replays events on each tick', () => {
    const { result } = renderHook(() => useDemoMode());
    act(() => { result.current.startDemo(); });

    act(() => { vi.advanceTimersByTime(6000); });
    expect(result.current.state.eventCount).toBeGreaterThan(0);
  });

  it('accumulates events over multiple ticks', () => {
    const { result } = renderHook(() => useDemoMode());
    act(() => { result.current.startDemo(); });

    act(() => { vi.advanceTimersByTime(6000); });
    const countAfterSome = result.current.state.eventCount;

    act(() => { vi.advanceTimersByTime(6000); });
    expect(result.current.state.eventCount).toBeGreaterThan(countAfterSome);
  });

  it('clears interval on unmount', () => {
    const { result, unmount } = renderHook(() => useDemoMode());
    act(() => { result.current.startDemo(); });

    unmount();
    expect(() => { vi.advanceTimersByTime(10_000); }).not.toThrow();
  });

  it('second startDemo resets state', () => {
    const { result } = renderHook(() => useDemoMode());
    act(() => { result.current.startDemo(); });
    act(() => { vi.advanceTimersByTime(5000); });

    const countBefore = result.current.state.eventCount;
    expect(countBefore).toBeGreaterThan(0);

    act(() => { result.current.startDemo(); });
    expect(result.current.state.eventCount).toBe(0);
  });
});
