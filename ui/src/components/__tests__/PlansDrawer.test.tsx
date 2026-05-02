import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlansDrawer } from '../PlansDrawer';
import type { PlansState } from '../../hooks/usePlans';

function makePlansState(overrides: Partial<PlansState> = {}): PlansState {
  return {
    plans: [],
    selectedPlan: null,
    selectPlan: vi.fn(),
    ...overrides,
  };
}

describe('PlansDrawer', () => {
  it('renders icon button', () => {
    render(<PlansDrawer plansState={makePlansState()} />);
    expect(screen.getByLabelText('Toggle plans panel')).toBeInTheDocument();
  });

  it('opens drawer panel on icon click', () => {
    render(<PlansDrawer plansState={makePlansState()} />);
    fireEvent.click(screen.getByLabelText('Toggle plans panel'));
    expect(screen.getByText('Plans')).toBeInTheDocument();
  });

  it('shows plan list sorted by date', () => {
    const plans = [
      { filename: 'new.md', title: 'New Plan', mtime: '2026-05-02T00:00:00Z' },
      { filename: 'old.md', title: 'Old Plan', mtime: '2026-01-01T00:00:00Z' },
    ];
    render(<PlansDrawer plansState={makePlansState({ plans })} />);
    fireEvent.click(screen.getByLabelText('Toggle plans panel'));
    expect(screen.getByText('New Plan')).toBeInTheDocument();
    expect(screen.getByText('Old Plan')).toBeInTheDocument();
  });

  it('calls selectPlan on plan click', () => {
    const selectPlan = vi.fn();
    const plans = [{ filename: 'a.md', title: 'Alpha', mtime: '2026-01-01T00:00:00Z' }];
    render(<PlansDrawer plansState={makePlansState({ plans, selectPlan })} />);
    fireEvent.click(screen.getByLabelText('Toggle plans panel'));
    fireEvent.click(screen.getByText('Alpha'));
    expect(selectPlan).toHaveBeenCalledWith('a.md');
  });

  it('renders plan content when selectedPlan is set', () => {
    const state = makePlansState({
      plans: [{ filename: 'x.md', title: 'Detail', mtime: '2026-01-01T00:00:00Z' }],
      selectedPlan: { filename: 'x.md', title: 'Detail', content: '# Plan: Detail\n\nThis is a plan.' },
    });
    render(<PlansDrawer plansState={state} />);
    fireEvent.click(screen.getByLabelText('Toggle plans panel'));
    expect(screen.getByText('← Back to list')).toBeInTheDocument();
    expect(screen.getByText('This is a plan.')).toBeInTheDocument();
  });
});
