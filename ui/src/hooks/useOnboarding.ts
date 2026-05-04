import { useCallback, useState } from 'react';
import { ONBOARDING_STEPS } from '../content/onboardingSteps';

const STORAGE_KEY = 'neo:onboarding-done';

export interface OnboardingState {
  active: boolean;
  currentStep: number;
  totalSteps: number;
}

export interface OnboardingActions {
  state: OnboardingState;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
  restart: () => void;
}

function isDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markDone() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch { /* localStorage unavailable */ }
}

function clearDone() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* localStorage unavailable */ }
}

export function useOnboarding(): OnboardingActions {
  const [done, setDone] = useState(isDone);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = ONBOARDING_STEPS.length;

  const active = !done;

  const next = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const back = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const skip = useCallback(() => {
    markDone();
    setDone(true);
  }, []);

  const complete = useCallback(() => {
    markDone();
    setDone(true);
  }, []);

  const restart = useCallback(() => {
    clearDone();
    setDone(false);
    setCurrentStep(0);
  }, []);

  return {
    state: { active, currentStep, totalSteps },
    next,
    back,
    skip,
    complete,
    restart,
  };
}
