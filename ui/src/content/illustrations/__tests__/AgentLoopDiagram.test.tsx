import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AgentLoopDiagram } from '../AgentLoopDiagram';

describe('AgentLoopDiagram', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders all four loop nodes', () => {
    const { container } = render(<AgentLoopDiagram />);
    const nodes = container.querySelectorAll('.onboarding-loop__node');
    expect(nodes.length).toBe(4);
    expect(nodes[0].textContent).toBe('Think');
    expect(nodes[1].textContent).toBe('Plan');
    expect(nodes[2].textContent).toBe('Act');
    expect(nodes[3].textContent).toBe('Observe');
  });

  it('starts with the first node active', () => {
    const { container } = render(<AgentLoopDiagram />);
    const nodes = container.querySelectorAll('.onboarding-loop__node');
    expect(nodes[0].classList.contains('onboarding-loop__node--active')).toBe(true);
    expect(nodes[1].classList.contains('onboarding-loop__node--active')).toBe(false);
  });

  it('cycles to the next node after 1200ms', () => {
    const { container } = render(<AgentLoopDiagram />);
    act(() => { vi.advanceTimersByTime(1200); });
    const nodes = container.querySelectorAll('.onboarding-loop__node');
    expect(nodes[0].classList.contains('onboarding-loop__node--active')).toBe(false);
    expect(nodes[1].classList.contains('onboarding-loop__node--active')).toBe(true);
  });

  it('wraps back to Think after Observe', () => {
    const { container } = render(<AgentLoopDiagram />);
    act(() => { vi.advanceTimersByTime(1200 * 4); });
    const nodes = container.querySelectorAll('.onboarding-loop__node');
    expect(nodes[0].classList.contains('onboarding-loop__node--active')).toBe(true);
  });

  it('shows the feedback label', () => {
    const { container } = render(<AgentLoopDiagram />);
    expect(container.querySelector('.onboarding-loop__feedback-label')?.textContent).toBe('repeat until goal reached');
  });
});
