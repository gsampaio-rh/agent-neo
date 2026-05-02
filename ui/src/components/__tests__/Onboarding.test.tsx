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

describe('Onboarding', () => {
  const onNavigateToChat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when inactive', () => {
    const onboarding = createMockOnboarding({ active: false });
    const { container } = render(
      <Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders overlay and first step when active', () => {
    const onboarding = createMockOnboarding();
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(ONBOARDING_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(ONBOARDING_STEPS[0].body)).toBeInTheDocument();
  });

  it('shows step indicator dots matching total steps', () => {
    const onboarding = createMockOnboarding();
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    const dots = document.querySelectorAll('.onboarding-card__dot');
    expect(dots.length).toBe(ONBOARDING_STEPS.length);
  });

  it('marks current step dot as active', () => {
    const onboarding = createMockOnboarding({ currentStep: 2 });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    const dots = document.querySelectorAll('.onboarding-card__dot');
    expect(dots[2].classList.contains('onboarding-card__dot--active')).toBe(true);
    expect(dots[0].classList.contains('onboarding-card__dot--done')).toBe(true);
    expect(dots[1].classList.contains('onboarding-card__dot--done')).toBe(true);
  });

  it('calls next() when Next button is clicked', () => {
    const onboarding = createMockOnboarding({ currentStep: 0 });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    fireEvent.click(screen.getByText('Next'));
    expect(onboarding.next).toHaveBeenCalledOnce();
  });

  it('calls back() when Back button is clicked', () => {
    const onboarding = createMockOnboarding({ currentStep: 2 });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    fireEvent.click(screen.getByText('Back'));
    expect(onboarding.back).toHaveBeenCalledOnce();
  });

  it('does not show Back button on first step', () => {
    const onboarding = createMockOnboarding({ currentStep: 0 });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('calls skip() when Skip button is clicked', () => {
    const onboarding = createMockOnboarding();
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    fireEvent.click(screen.getByText('Skip'));
    expect(onboarding.skip).toHaveBeenCalledOnce();
  });

  it('shows Get Started on last step and navigates to chat on click', () => {
    const lastStep = ONBOARDING_STEPS.length - 1;
    const onboarding = createMockOnboarding({ currentStep: lastStep });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    expect(screen.queryByText('Next')).not.toBeInTheDocument();
    const doneBtn = screen.getByText('Get Started');
    expect(doneBtn).toBeInTheDocument();

    fireEvent.click(doneBtn);
    expect(onboarding.complete).toHaveBeenCalledOnce();
    expect(onNavigateToChat).toHaveBeenCalledOnce();
  });

  it('responds to Escape key by calling skip()', () => {
    const onboarding = createMockOnboarding();
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onboarding.skip).toHaveBeenCalledOnce();
  });

  it('responds to ArrowRight key by calling next()', () => {
    const onboarding = createMockOnboarding({ currentStep: 1 });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onboarding.next).toHaveBeenCalledOnce();
  });

  it('responds to ArrowLeft key by calling back()', () => {
    const onboarding = createMockOnboarding({ currentStep: 2 });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(onboarding.back).toHaveBeenCalledOnce();
  });

  it('does not call next on ArrowRight at last step', () => {
    const lastStep = ONBOARDING_STEPS.length - 1;
    const onboarding = createMockOnboarding({ currentStep: lastStep });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onboarding.next).not.toHaveBeenCalled();
  });

  it('does not call back on ArrowLeft at first step', () => {
    const onboarding = createMockOnboarding({ currentStep: 0 });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(onboarding.back).not.toHaveBeenCalled();
  });

  it('displays step count', () => {
    const onboarding = createMockOnboarding({ currentStep: 2 });
    render(<Onboarding onboarding={onboarding} onNavigateToChat={onNavigateToChat} />);

    expect(screen.getByText(`3 / ${ONBOARDING_STEPS.length}`)).toBeInTheDocument();
  });
});
