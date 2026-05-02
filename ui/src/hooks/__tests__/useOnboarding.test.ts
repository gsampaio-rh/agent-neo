import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '../useOnboarding';
import { ONBOARDING_STEPS } from '../../content/onboardingSteps';

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts active when localStorage has no completion flag', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.active).toBe(true);
    expect(result.current.state.currentStep).toBe(0);
    expect(result.current.state.totalSteps).toBe(ONBOARDING_STEPS.length);
  });

  it('starts inactive when localStorage has completion flag', () => {
    localStorage.setItem('neo:onboarding-complete', 'true');
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.active).toBe(false);
  });

  it('next() advances step up to last step', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => { result.current.next(); });
    expect(result.current.state.currentStep).toBe(1);

    act(() => { result.current.next(); });
    expect(result.current.state.currentStep).toBe(2);
  });

  it('next() does not exceed total steps', () => {
    const { result } = renderHook(() => useOnboarding());
    const lastIndex = ONBOARDING_STEPS.length - 1;

    for (let i = 0; i < ONBOARDING_STEPS.length + 5; i++) {
      act(() => { result.current.next(); });
    }
    expect(result.current.state.currentStep).toBe(lastIndex);
  });

  it('back() decrements step to minimum 0', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => { result.current.next(); });
    act(() => { result.current.next(); });
    expect(result.current.state.currentStep).toBe(2);

    act(() => { result.current.back(); });
    expect(result.current.state.currentStep).toBe(1);

    act(() => { result.current.back(); });
    act(() => { result.current.back(); });
    expect(result.current.state.currentStep).toBe(0);
  });

  it('complete() sets active to false and writes localStorage', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.active).toBe(true);

    act(() => { result.current.complete(); });
    expect(result.current.state.active).toBe(false);
    expect(localStorage.getItem('neo:onboarding-complete')).toBe('true');
  });

  it('skip() sets active to false and writes localStorage', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => { result.current.skip(); });
    expect(result.current.state.active).toBe(false);
    expect(localStorage.getItem('neo:onboarding-complete')).toBe('true');
  });

  it('restart() clears localStorage, resets step, and activates', () => {
    localStorage.setItem('neo:onboarding-complete', 'true');
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.active).toBe(false);

    act(() => { result.current.restart(); });
    expect(result.current.state.active).toBe(true);
    expect(result.current.state.currentStep).toBe(0);
    expect(localStorage.getItem('neo:onboarding-complete')).toBeNull();
  });

  it('complete() resets currentStep to 0', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => { result.current.next(); });
    act(() => { result.current.next(); });
    act(() => { result.current.complete(); });
    expect(result.current.state.currentStep).toBe(0);
  });
});
