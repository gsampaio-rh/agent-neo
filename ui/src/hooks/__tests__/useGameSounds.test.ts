import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameSounds } from '../useGameSounds';
import * as sounds from '../../components/game/sounds';

vi.mock('../../components/game/sounds', () => ({
  playForAction: vi.fn(),
  playBreachAlert: vi.fn(),
  playEscapeSiren: vi.fn(),
  setEnabled: vi.fn(),
  setVolume: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

describe('useGameSounds', () => {
  it('plays sound when eventCount increases', () => {
    const { rerender } = renderHook(
      (props) => useGameSounds(props),
      { initialProps: { agentAction: 'hacking', eventCount: 0, escaped: false } },
    );

    rerender({ agentAction: 'hacking', eventCount: 1, escaped: false });
    expect(sounds.playForAction).toHaveBeenCalledWith('hacking');
  });

  it('does not play when eventCount stays the same', () => {
    const { rerender } = renderHook(
      (props) => useGameSounds(props),
      { initialProps: { agentAction: 'reading', eventCount: 5, escaped: false } },
    );

    rerender({ agentAction: 'reading', eventCount: 5, escaped: false });
    expect(sounds.playForAction).not.toHaveBeenCalled();
  });

  it('plays breach alert once on escaped', () => {
    const { rerender } = renderHook(
      (props) => useGameSounds(props),
      { initialProps: { agentAction: 'idle', eventCount: 0, escaped: false } },
    );

    rerender({ agentAction: 'idle', eventCount: 0, escaped: true });
    expect(sounds.playBreachAlert).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(sounds.playEscapeSiren).toHaveBeenCalledTimes(1);
  });

  it('does not replay breach alert on subsequent renders', () => {
    const { rerender } = renderHook(
      (props) => useGameSounds(props),
      { initialProps: { agentAction: 'idle', eventCount: 0, escaped: false } },
    );

    rerender({ agentAction: 'idle', eventCount: 0, escaped: true });
    rerender({ agentAction: 'idle', eventCount: 0, escaped: true });

    expect(sounds.playBreachAlert).toHaveBeenCalledTimes(1);
  });

  it('toggleEnabled delegates to sounds module', () => {
    const { result } = renderHook(() =>
      useGameSounds({ agentAction: 'idle', eventCount: 0, escaped: false }),
    );

    expect(result.current.enabled).toBe(false);
    result.current.toggleEnabled();
    expect(sounds.setEnabled).toHaveBeenCalledWith(true);
  });

  it('changeVolume delegates to sounds module', () => {
    const { result } = renderHook(() =>
      useGameSounds({ agentAction: 'idle', eventCount: 0, escaped: false }),
    );

    result.current.changeVolume(0.8);
    expect(sounds.setVolume).toHaveBeenCalledWith(0.8);
  });
});

afterAll(() => {
  vi.useRealTimers();
});
