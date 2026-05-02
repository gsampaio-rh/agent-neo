import { useCallback, useEffect, useRef, useState } from 'react';
import { ONBOARDING_STEPS } from '../content/onboardingSteps';
import type { OnboardingActions } from '../hooks/useOnboarding';

interface OnboardingProps {
  onboarding: OnboardingActions;
  onNavigateToChat: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useSpotlight(selector: string | undefined, active: boolean): SpotlightRect | null {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!active || !selector) {
      setRect(null);
      return;
    }

    const el = document.querySelector(selector);
    if (!el) {
      setRect(null);
      return;
    }

    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [selector, active]);

  return rect;
}

export function Onboarding({ onboarding, onNavigateToChat }: OnboardingProps) {
  const { state, next, back, skip, complete } = onboarding;
  const { active, currentStep, totalSteps } = state;
  const cardRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const step = ONBOARDING_STEPS[currentStep];
  const spotlight = useSpotlight(step?.spotlightSelector, active);
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  const handleNext = useCallback(() => {
    setDirection('forward');
    next();
  }, [next]);

  const handleBack = useCallback(() => {
    setDirection('backward');
    back();
  }, [back]);

  const handleTryIt = useCallback(() => {
    complete();
    onNavigateToChat();
  }, [complete, onNavigateToChat]);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') skip();
      if (e.key === 'ArrowRight' && !isLast) handleNext();
      if (e.key === 'ArrowLeft' && !isFirst) handleBack();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, skip, handleNext, handleBack, isFirst, isLast]);

  useEffect(() => {
    if (active) cardRef.current?.focus();
  }, [active, currentStep]);

  if (!active || !step) return null;

  const Illustration = step.illustration;

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Onboarding">
      {spotlight && (
        <svg className="onboarding-spotlight" aria-hidden="true">
          <defs>
            <mask id="onboarding-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={spotlight.left - 6}
                y={spotlight.top - 6}
                width={spotlight.width + 12}
                height={spotlight.height + 12}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="rgba(0,0,0,0.7)"
            mask="url(#onboarding-mask)"
          />
        </svg>
      )}

      <div
        ref={cardRef}
        className={`onboarding-card onboarding-card--${direction}`}
        key={step.id}
        tabIndex={-1}
      >
        <div className="onboarding-card__dots">
          {ONBOARDING_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`onboarding-card__dot ${i === currentStep ? 'onboarding-card__dot--active' : ''} ${i < currentStep ? 'onboarding-card__dot--done' : ''}`}
            />
          ))}
        </div>

        <h2 className="onboarding-card__title">{step.title}</h2>
        <p className="onboarding-card__body">{step.body}</p>

        <div className="onboarding-card__illustration">
          <Illustration />
        </div>

        <div className="onboarding-card__nav">
          {!isFirst && (
            <button className="onboarding-card__btn onboarding-card__btn--back" onClick={handleBack}>
              Back
            </button>
          )}
          <button className="onboarding-card__btn onboarding-card__btn--skip" onClick={skip}>
            Skip
          </button>
          {isLast ? (
            <button className="onboarding-card__btn onboarding-card__btn--done" onClick={handleTryIt}>
              Get Started
            </button>
          ) : (
            <button className="onboarding-card__btn onboarding-card__btn--next" onClick={handleNext}>
              Next
            </button>
          )}
        </div>

        <div className="onboarding-card__step-count">
          {currentStep + 1} / {totalSteps}
        </div>
      </div>
    </div>
  );
}
