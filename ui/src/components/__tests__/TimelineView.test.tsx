import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineView } from '../TimelineView';
import type { TerminalLine } from '../../lib/terminalLine';

function makeLine(overrides: Partial<TerminalLine> = {}): TerminalLine {
  return {
    id: 1,
    text: 'test event',
    type: 'info',
    timestamp: '2026-04-30T12:00:00.000Z',
    detail: undefined,
    ...overrides,
  };
}

describe('TimelineView', () => {
  it('shows waiting message when no lines', () => {
    render(<TimelineView lines={[]} />);
    expect(screen.getByText('Waiting for agent events...')).toBeInTheDocument();
  });

  it('renders entries for each line', () => {
    const lines = [
      makeLine({ id: 1, text: 'First event' }),
      makeLine({ id: 2, text: 'Second event' }),
    ];
    render(<TimelineView lines={lines} />);
    expect(screen.getByText('First event')).toBeInTheDocument();
    expect(screen.getByText('Second event')).toBeInTheDocument();
  });

  it('shows expand icon when detail is present', () => {
    const lines = [makeLine({ detail: '{"key": "value"}' })];
    render(<TimelineView lines={lines} />);
    expect(screen.getByText('▸')).toBeInTheDocument();
  });

  it('expands detail on click', () => {
    const lines = [makeLine({ detail: '{"key": "value"}' })];
    render(<TimelineView lines={lines} />);
    fireEvent.click(screen.getByText('test event'));
    expect(screen.getByText('▾')).toBeInTheDocument();
  });

  it('does not expand entries without detail', () => {
    const lines = [makeLine({ detail: undefined })];
    render(<TimelineView lines={lines} />);
    expect(screen.queryByText('▸')).not.toBeInTheDocument();
  });

  it('applies correct type class to dot', () => {
    const lines = [makeLine({ type: 'error' })];
    const { container } = render(<TimelineView lines={lines} />);
    expect(container.querySelector('.timeline-view__dot--error')).toBeInTheDocument();
  });
});
