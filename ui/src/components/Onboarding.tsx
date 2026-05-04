import { useCallback, useEffect, useRef, useState } from 'react';
import { PersonaSetup } from './PersonaSetup';
import { ONBOARDING_STEPS } from '../content/onboardingSteps';
import type { OnboardingActions } from '../hooks/useOnboarding';
import type { Persona } from '../hooks/usePersona';

interface OnboardingProps {
  onboarding: OnboardingActions;
  persona: Persona | null;
  onPersonaComplete: (persona: Persona) => void;
}

export function Onboarding({ onboarding, persona, onPersonaComplete }: OnboardingProps) {
  const { state, next, back, skip, complete } = onboarding;
  const { active, currentStep, totalSteps } = state;
  const stepIsGated = ONBOARDING_STEPS[currentStep]?.gated !== false;
  const [stepCompleted, setStepCompleted] = useState(!stepIsGated);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const prevStepRef = useRef(currentStep);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentStep !== prevStepRef.current) {
      setDirection(currentStep > prevStepRef.current ? 'forward' : 'backward');
      setStepCompleted(!stepIsGated);
      prevStepRef.current = currentStep;
    }
  }, [currentStep, stepIsGated]);

  useEffect(() => {
    if (!active) return;
    cardRef.current?.focus();
  }, [active, currentStep]);

  const handleInteractionComplete = useCallback(() => {
    setStepCompleted(true);
  }, []);

  const handleNext = useCallback(() => {
    if (!stepCompleted) return;
    if (currentStep === totalSteps - 1) {
      complete();
    } else {
      next();
    }
  }, [stepCompleted, currentStep, totalSteps, complete, next]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) back();
  }, [currentStep, back]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') skip();
    if (e.key === 'ArrowRight' && stepCompleted) handleNext();
    if (e.key === 'ArrowLeft') handleBack();
  }, [skip, stepCompleted, handleNext, handleBack]);

  useEffect(() => {
    if (!active) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, handleKeyDown]);

  const handlePersonaComplete = useCallback((p: Persona) => {
    onPersonaComplete(p);
    setStepCompleted(true);
    setTimeout(() => next(), 150);
  }, [onPersonaComplete, next]);

  if (!active) return null;

  const step = ONBOARDING_STEPS[currentStep];
  if (!step) return null;

  const isPersonaStep = step.id === 'name-agent';
  const isLastStep = currentStep === totalSteps - 1;
  const Illustration = step.illustration;

  return (
    <div className="onboarding-overlay">
      <div
        ref={cardRef}
        className={`onboarding-card onboarding-card--${direction}`}
        key={currentStep}
        tabIndex={-1}
      >
        <div className="onboarding-card__dots">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={`onboarding-card__dot${i === currentStep ? ' onboarding-card__dot--active' : ''}${i < currentStep ? ' onboarding-card__dot--done' : ''}`}
            />
          ))}
        </div>

        {isPersonaStep ? (
          <div className="onboarding-card__persona-wrapper">
            <PersonaSetup
              initialPersona={persona}
              onComplete={handlePersonaComplete}
              onSkip={skip}
            />
          </div>
        ) : (
          <>
            <h2 className="onboarding-card__title">{step.title}</h2>
            <p className="onboarding-card__body">{step.body}</p>

            <div className="onboarding-card__illustration">
              <Illustration onInteractionComplete={handleInteractionComplete} />
            </div>

            <div className="onboarding-card__nav">
              {currentStep > 0 && (
                <button className="onboarding-card__btn" onClick={handleBack} type="button">
                  Back
                </button>
              )}
              <button
                className={`onboarding-card__btn${isLastStep ? ' onboarding-card__btn--done' : ' onboarding-card__btn--next'}`}
                onClick={handleNext}
                disabled={!stepCompleted}
                type="button"
              >
                {isLastStep ? 'Get Started' : 'Next'}
              </button>
            </div>
          </>
        )}

        <div className="onboarding-card__step-count">
          Step {currentStep + 1} of {totalSteps}
        </div>

        <button
          className="onboarding-card__btn onboarding-card__btn--skip"
          onClick={skip}
          type="button"
        >
          Skip onboarding
        </button>
      </div>
    </div>
  );
}
