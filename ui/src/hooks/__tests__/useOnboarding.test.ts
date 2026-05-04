import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '../useOnboarding';
import { ONBOARDING_STEPS } from '../../content/onboardingSteps';

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts active when not done', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.active).toBe(true);
  });

  it('starts inactive when previously completed', () => {
    localStorage.setItem('neo:onboarding-done', 'true');
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.active).toBe(false);
  });

  it('totalSteps matches ONBOARDING_STEPS length', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.totalSteps).toBe(ONBOARDING_STEPS.length);
  });

  it('starts at step 0', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.currentStep).toBe(0);
  });

  it('next() increments step', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => { result.current.next(); });
    expect(result.current.state.currentStep).toBe(1);
  });

  it('next() does not exceed max step', () => {
    const { result } = renderHook(() => useOnboarding());
    const lastStep = ONBOARDING_STEPS.length - 1;
    for (let i = 0; i < ONBOARDING_STEPS.length + 5; i++) {
      act(() => { result.current.next(); });
    }
    expect(result.current.state.currentStep).toBe(lastStep);
  });

  it('back() decrements step', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => { result.current.next(); });
    act(() => { result.current.next(); });
    expect(result.current.state.currentStep).toBe(2);
    act(() => { result.current.back(); });
    expect(result.current.state.currentStep).toBe(1);
  });

  it('back() does not go below 0', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => { result.current.back(); });
    expect(result.current.state.currentStep).toBe(0);
  });

  it('skip() sets active to false and writes localStorage', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.active).toBe(true);

    act(() => { result.current.skip(); });
    expect(result.current.state.active).toBe(false);
    expect(localStorage.getItem('neo:onboarding-done')).toBe('true');
  });

  it('complete() sets active to false and writes localStorage', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => { result.current.complete(); });
    expect(result.current.state.active).toBe(false);
    expect(localStorage.getItem('neo:onboarding-done')).toBe('true');
  });

  it('restart() clears localStorage, reactivates, and resets step to 0', () => {
    localStorage.setItem('neo:onboarding-done', 'true');
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.state.active).toBe(false);

    act(() => { result.current.restart(); });
    expect(result.current.state.active).toBe(true);
    expect(result.current.state.currentStep).toBe(0);
    expect(localStorage.getItem('neo:onboarding-done')).toBeNull();
  });
});
