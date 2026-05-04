import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MilestoneProvider, useMilestones, useEmitMilestone, useResetMilestones } from '../useMilestones';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <MilestoneProvider>{children}</MilestoneProvider>;
}

describe('useMilestones', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty milestone set', () => {
    const { result } = renderHook(() => useMilestones(), { wrapper });
    expect(result.current.size).toBe(0);
  });

  it('loads milestones from localStorage', () => {
    localStorage.setItem('neo:milestones', JSON.stringify(['persona_set', 'first_response']));
    const { result } = renderHook(() => useMilestones(), { wrapper });
    expect(result.current.has('persona_set')).toBe(true);
    expect(result.current.has('first_response')).toBe(true);
    expect(result.current.size).toBe(2);
  });

  it('emit adds a milestone and persists', () => {
    const { result } = renderHook(() => ({
      milestones: useMilestones(),
      emit: useEmitMilestone(),
    }), { wrapper });

    act(() => { result.current.emit('persona_set'); });

    expect(result.current.milestones.has('persona_set')).toBe(true);
    expect(JSON.parse(localStorage.getItem('neo:milestones')!)).toContain('persona_set');
  });

  it('emit is idempotent — re-emitting same milestone is a no-op', () => {
    const { result } = renderHook(() => ({
      milestones: useMilestones(),
      emit: useEmitMilestone(),
    }), { wrapper });

    act(() => { result.current.emit('persona_set'); });
    const sizeAfterFirst = result.current.milestones.size;

    act(() => { result.current.emit('persona_set'); });
    expect(result.current.milestones.size).toBe(sizeAfterFirst);
  });

  it('reset clears all milestones and localStorage', () => {
    const { result } = renderHook(() => ({
      milestones: useMilestones(),
      emit: useEmitMilestone(),
      reset: useResetMilestones(),
    }), { wrapper });

    act(() => { result.current.emit('persona_set'); });
    act(() => { result.current.emit('first_response'); });
    expect(result.current.milestones.size).toBe(2);

    act(() => { result.current.reset(); });
    expect(result.current.milestones.size).toBe(0);
    expect(localStorage.getItem('neo:milestones')).toBeNull();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('neo:milestones', 'not-json');
    const { result } = renderHook(() => useMilestones(), { wrapper });
    expect(result.current.size).toBe(0);
  });
});
