import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickActions } from '../QuickActions';
import { QUICK_ACTIONS } from '../../content/quickActions';

describe('QuickActions', () => {
  it('renders all actions as buttons', () => {
    render(<QuickActions onSend={vi.fn()} disabled={false} />);
    for (const action of QUICK_ACTIONS) {
      expect(screen.getByText(action.label)).toBeInTheDocument();
    }
  });

  it('shows preview popup on pill click', () => {
    render(<QuickActions onSend={vi.fn()} disabled={false} />);

    const firstAction = QUICK_ACTIONS[0];
    fireEvent.click(screen.getByText(firstAction.label));

    expect(screen.getByText(firstAction.prompt)).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onSend with the action prompt on confirm', () => {
    const onSend = vi.fn();
    render(<QuickActions onSend={onSend} disabled={false} />);

    const firstAction = QUICK_ACTIONS[0];
    fireEvent.click(screen.getByText(firstAction.label));
    fireEvent.click(screen.getByText('Send'));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(firstAction.prompt);
  });

  it('closes preview without sending on cancel', () => {
    const onSend = vi.fn();
    render(<QuickActions onSend={onSend} disabled={false} />);

    const firstAction = QUICK_ACTIONS[0];
    fireEvent.click(screen.getByText(firstAction.label));
    fireEvent.click(screen.getByText('Cancel'));

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByText('Send')).not.toBeInTheDocument();
  });

  it('closes preview on overlay click', () => {
    const onSend = vi.fn();
    render(<QuickActions onSend={onSend} disabled={false} />);

    const firstAction = QUICK_ACTIONS[0];
    fireEvent.click(screen.getByText(firstAction.label));

    const overlay = document.querySelector('.quick-actions__overlay')!;
    fireEvent.click(overlay);

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByText('Send')).not.toBeInTheDocument();
  });

  it('renders buttons as disabled when disabled={true}', () => {
    render(<QuickActions onSend={vi.fn()} disabled={true} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  it('does not open preview when disabled', () => {
    const onSend = vi.fn();
    render(<QuickActions onSend={onSend} disabled={true} />);

    const firstAction = QUICK_ACTIONS[0];
    fireEvent.click(screen.getByText(firstAction.label));

    expect(screen.queryByText('Send')).not.toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('applies the correct category class to each button', () => {
    render(<QuickActions onSend={vi.fn()} disabled={false} />);
    for (const action of QUICK_ACTIONS) {
      const btn = screen.getByText(action.label).closest('button');
      expect(btn).toHaveClass(`quick-actions__btn--${action.category}`);
    }
  });
});
