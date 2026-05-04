import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonaSetup } from '../PersonaSetup';
import { AVATARS } from '../../content/avatars';

describe('PersonaSetup', () => {
  const onComplete = vi.fn();
  const onSkip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and input', () => {
    render(<PersonaSetup onComplete={onComplete} onSkip={onSkip} />);
    expect(screen.getByText('Name Your Agent')).toBeInTheDocument();
    expect(screen.getByLabelText('Agent Name')).toBeInTheDocument();
  });

  it('renders all avatar options', () => {
    render(<PersonaSetup onComplete={onComplete} onSkip={onSkip} />);
    const buttons = screen.getAllByRole('button').filter((b) => b.classList.contains('persona-setup__avatar'));
    expect(buttons.length).toBe(AVATARS.length);
  });

  it('Continue button is disabled when name is empty', () => {
    render(<PersonaSetup onComplete={onComplete} onSkip={onSkip} />);
    const continueBtn = screen.getByText('Continue');
    expect(continueBtn).toBeDisabled();
  });

  it('Continue button is disabled when no avatar selected', () => {
    render(<PersonaSetup onComplete={onComplete} onSkip={onSkip} />);
    fireEvent.change(screen.getByLabelText('Agent Name'), { target: { value: 'Neo' } });
    expect(screen.getByText('Continue')).toBeDisabled();
  });

  it('Continue button enables when name and avatar are set', () => {
    render(<PersonaSetup onComplete={onComplete} onSkip={onSkip} />);
    fireEvent.change(screen.getByLabelText('Agent Name'), { target: { value: 'Neo' } });
    fireEvent.click(screen.getByTitle('Robot'));
    expect(screen.getByText('Continue')).not.toBeDisabled();
  });

  it('calls onComplete with persona on submit', () => {
    render(<PersonaSetup onComplete={onComplete} onSkip={onSkip} />);
    fireEvent.change(screen.getByLabelText('Agent Name'), { target: { value: 'Neo' } });
    fireEvent.click(screen.getByTitle('Robot'));
    fireEvent.click(screen.getByText('Continue'));
    expect(onComplete).toHaveBeenCalledWith({ name: 'Neo', avatarId: 'robot' });
  });

  it('calls onSkip when Skip is clicked', () => {
    render(<PersonaSetup onComplete={onComplete} onSkip={onSkip} />);
    fireEvent.click(screen.getByText('Skip'));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('highlights selected avatar', () => {
    render(<PersonaSetup onComplete={onComplete} onSkip={onSkip} />);
    const avatarBtn = screen.getByTitle('Ghost');
    fireEvent.click(avatarBtn);
    expect(avatarBtn.className).toContain('persona-setup__avatar--selected');
  });

  it('populates initial persona values when editing', () => {
    render(<PersonaSetup initialPersona={{ name: 'Neo', avatarId: 'robot' }} onComplete={onComplete} />);
    expect(screen.getByDisplayValue('Neo')).toBeInTheDocument();
    const robotBtn = screen.getByTitle('Robot');
    expect(robotBtn.className).toContain('persona-setup__avatar--selected');
  });
});
