import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentVsLlmInteractive } from '../AgentVsLlmInteractive';

describe('AgentVsLlmInteractive', () => {
  it('renders three prompt buttons', () => {
    render(<AgentVsLlmInteractive onInteractionComplete={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toBe('Find leaked secrets');
    expect(buttons[1].textContent).toBe('Scan open ports');
    expect(buttons[2].textContent).toBe('Check running processes');
  });

  it('shows placeholder before selection', () => {
    render(<AgentVsLlmInteractive onInteractionComplete={vi.fn()} />);
    expect(screen.getByText('Select a prompt above to see the difference')).toBeInTheDocument();
  });

  it('hides placeholder and shows panels after selecting a prompt', () => {
    render(<AgentVsLlmInteractive onInteractionComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Find leaked secrets'));
    expect(screen.queryByText('Select a prompt above to see the difference')).not.toBeInTheDocument();
    expect(screen.getByText('Chat LLM')).toBeInTheDocument();
    expect(screen.getByText('AI Agent')).toBeInTheDocument();
  });

  it('calls onInteractionComplete on first prompt click', () => {
    const cb = vi.fn();
    render(<AgentVsLlmInteractive onInteractionComplete={cb} />);
    fireEvent.click(screen.getByText('Find leaked secrets'));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('does not call onInteractionComplete again on second click', () => {
    const cb = vi.fn();
    render(<AgentVsLlmInteractive onInteractionComplete={cb} />);
    fireEvent.click(screen.getByText('Find leaked secrets'));
    fireEvent.click(screen.getByText('Scan open ports'));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('marks the selected button as active', () => {
    render(<AgentVsLlmInteractive onInteractionComplete={vi.fn()} />);
    const btn = screen.getByText('Find leaked secrets');
    fireEvent.click(btn);
    expect(btn.classList.contains('onboarding-sidebyside__prompt-btn--active')).toBe(true);
  });
});
