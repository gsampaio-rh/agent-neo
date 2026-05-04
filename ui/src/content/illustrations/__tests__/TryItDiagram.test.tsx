import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { TryItDiagram } from '../TryItDiagram';

describe('TryItDiagram', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders the input area and cursor', () => {
    const { container } = render(<TryItDiagram />);
    expect(container.querySelector('.onboarding-tryit__input')).toBeInTheDocument();
    expect(container.querySelector('.onboarding-tryit__cursor')).toBeInTheDocument();
  });

  it('starts with empty text', () => {
    const { container } = render(<TryItDiagram />);
    expect(container.querySelector('.onboarding-tryit__text')?.textContent).toBe('');
  });

  it('types out text over time', () => {
    const { container } = render(<TryItDiagram />);
    act(() => { vi.advanceTimersByTime(50 * 10); });
    const text = container.querySelector('.onboarding-tryit__text')?.textContent ?? '';
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(10);
  });
});
