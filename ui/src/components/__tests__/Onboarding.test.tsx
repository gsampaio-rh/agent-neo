import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Onboarding } from '../Onboarding';
import { ONBOARDING_STEPS } from '../../content/onboardingSteps';
import type { OnboardingActions } from '../../hooks/useOnboarding';

function createMockOnboarding(overrides: Partial<OnboardingActions['state']> = {}): OnboardingActions {
  return {
    state: {
      active: true,
      currentStep: 0,
      totalSteps: ONBOARDING_STEPS.length,
      ...overrides,
    },
    next: vi.fn(),
    back: vi.fn(),
    skip: vi.fn(),
    complete: vi.fn(),
    restart: vi.fn(),
  };
}

function findGatedStepIndex(): number {
  return ONBOARDING_STEPS.findIndex((s) => s.gated !== false && s.id !== 'name-agent');
}

function findNonGatedStepIndex(): number {
  return ONBOARDING_STEPS.findIndex((s) => s.gated === false);
}

describe('Onboarding', () => {
  const onPersonaComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when inactive', () => {
    const onboarding = createMockOnboarding({ active: false });
    const { container } = render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders overlay when active', () => {
    const onboarding = createMockOnboarding();
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    expect(document.querySelector('.onboarding-overlay')).toBeInTheDocument();
  });

  it('renders PersonaSetup on step 0 (name-agent)', () => {
    const onboarding = createMockOnboarding({ currentStep: 0 });
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    expect(screen.getByText('Name Your Agent')).toBeInTheDocument();
    expect(screen.getByLabelText('Agent Name')).toBeInTheDocument();
  });

  it('renders title, body, and nav buttons on non-persona step', () => {
    const onboarding = createMockOnboarding({ currentStep: 1 });
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    expect(screen.getByText('What is an AI Agent?')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('Next button is disabled on a gated step', () => {
    const gatedIdx = findGatedStepIndex();
    const onboarding = createMockOnboarding({ currentStep: gatedIdx });
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    const nextBtn = screen.getByText('Next');
    expect(nextBtn).toBeDisabled();
  });

  it('Next button is enabled on a non-gated step', () => {
    const nonGatedIdx = findNonGatedStepIndex();
    const onboarding = createMockOnboarding({ currentStep: nonGatedIdx });
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    const nextBtn = screen.getByText('Next');
    expect(nextBtn).not.toBeDisabled();
  });

  it('shows "Get Started" button on the last step', () => {
    const lastStep = ONBOARDING_STEPS.length - 1;
    const onboarding = createMockOnboarding({ currentStep: lastStep });
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('calls skip() on Escape key', () => {
    const onboarding = createMockOnboarding();
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onboarding.skip).toHaveBeenCalledOnce();
  });

  it('skip onboarding button calls skip()', () => {
    const onboarding = createMockOnboarding();
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    fireEvent.click(screen.getByText('Skip onboarding'));
    expect(onboarding.skip).toHaveBeenCalledOnce();
  });

  it('displays step count', () => {
    const onboarding = createMockOnboarding({ currentStep: 2 });
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    expect(screen.getByText(`Step 3 of ${ONBOARDING_STEPS.length}`)).toBeInTheDocument();
  });

  it('renders correct number of dots', () => {
    const onboarding = createMockOnboarding();
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    const dots = document.querySelectorAll('.onboarding-card__dot');
    expect(dots.length).toBe(ONBOARDING_STEPS.length);
  });

  it('does not render Back button on step 0', () => {
    const onboarding = createMockOnboarding({ currentStep: 0 });
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('title renders before illustration in the DOM on non-persona steps', () => {
    const onboarding = createMockOnboarding({ currentStep: 1 });
    render(
      <Onboarding onboarding={onboarding} persona={null} onPersonaComplete={onPersonaComplete} />,
    );
    const title = document.querySelector('.onboarding-card__title');
    const illustration = document.querySelector('.onboarding-card__illustration');
    expect(title).toBeInTheDocument();
    expect(illustration).toBeInTheDocument();
    expect(title!.compareDocumentPosition(illustration!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe('ONBOARDING_STEPS data', () => {
  it('has exactly 6 steps', () => {
    expect(ONBOARDING_STEPS.length).toBe(6);
  });

  it('does not contain removed step IDs', () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(ids).not.toContain('meet-neo');
    expect(ids).not.toContain('tasks-plans');
  });

  it('has the expected step order', () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(ids).toEqual([
      'name-agent',
      'what-is-agent',
      'agent-vs-llm',
      'agent-not-llm-map',
      'tools-skills',
      'try-it',
    ]);
  });
});
