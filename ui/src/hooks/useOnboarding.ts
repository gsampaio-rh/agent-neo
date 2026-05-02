import { useCallback, useState } from 'react';
import { ONBOARDING_STEPS } from '../content/onboardingSteps';

const STORAGE_KEY = 'neo:onboarding-complete';

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

function isCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch { /* localStorage unavailable */ }
}

function clearCompleted() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* localStorage unavailable */ }
}

export function useOnboarding(): OnboardingActions {
  const [active, setActive] = useState(() => !isCompleted());
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = ONBOARDING_STEPS.length;

  const next = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const back = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const complete = useCallback(() => {
    markCompleted();
    setActive(false);
    setCurrentStep(0);
  }, []);

  const skip = useCallback(() => {
    markCompleted();
    setActive(false);
    setCurrentStep(0);
  }, []);

  const restart = useCallback(() => {
    clearCompleted();
    setCurrentStep(0);
    setActive(true);
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
