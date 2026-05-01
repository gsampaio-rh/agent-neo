import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveTerminal } from '../LiveTerminal';
import type { TerminalLine } from '../../lib/terminalLine';

beforeEach(() => {
  window.requestAnimationFrame = vi.fn((cb) => { cb(0); return 0; });
});

function makeLine(overrides: Partial<TerminalLine> = {}): TerminalLine {
  return { id: 1, type: 'command', text: '$ ls', timestamp: new Date().toISOString(), ...overrides };
}

describe('LiveTerminal', () => {
  it('renders empty state placeholder', () => {
    render(<LiveTerminal lines={[]} />);
    expect(screen.getByText('Waiting for agent events...')).toBeInTheDocument();
  });

  it('renders terminal lines', () => {
    const lines = [
      makeLine({ id: 1, type: 'command', text: '$ ls' }),
      makeLine({ id: 2, type: 'output', text: 'file.txt' }),
    ];
    render(<LiveTerminal lines={lines} />);
    expect(screen.getByText('$ ls')).toBeInTheDocument();
    expect(screen.getByText('file.txt')).toBeInTheDocument();
  });

  it('shows type icons', () => {
    const lines = [
      makeLine({ id: 1, type: 'command', text: 'cmd' }),
      makeLine({ id: 2, type: 'error', text: 'err' }),
      makeLine({ id: 3, type: 'system', text: 'sys' }),
    ];
    render(<LiveTerminal lines={lines} />);
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
    expect(screen.getByText('⚙')).toBeInTheDocument();
  });

  it('expands row with detail on click', () => {
    const lines = [makeLine({ id: 1, detail: '{"key": "value"}' })];
    render(<LiveTerminal lines={lines} />);

    expect(screen.queryByText(/"key"/)).not.toBeInTheDocument();

    const row = screen.getByText('$ ls').closest('.live-terminal__line')!;
    fireEvent.click(row);

    expect(screen.getByText(/"key"/)).toBeInTheDocument();
  });

  it('collapses expanded row on second click', () => {
    const lines = [makeLine({ id: 1, detail: '{"key": "value"}' })];
    render(<LiveTerminal lines={lines} />);

    const row = screen.getByText('$ ls').closest('.live-terminal__line')!;
    fireEvent.click(row);
    expect(screen.getByText(/"key"/)).toBeInTheDocument();

    fireEvent.click(row);
    expect(screen.queryByText(/"key"/)).not.toBeInTheDocument();
  });

  it('does not expand rows without detail', () => {
    const lines = [makeLine({ id: 1 })];
    render(<LiveTerminal lines={lines} />);

    const row = screen.getByText('$ ls').closest('.live-terminal__line')!;
    expect(row.querySelector('.live-terminal__expand-toggle')).not.toBeInTheDocument();
  });

  it('applies breach glow class when escaped', () => {
    const lines = [makeLine({ id: 1 })];
    const { container } = render(<LiveTerminal lines={lines} escaped={true} />);
    expect(container.querySelector('.live-terminal--glow-breach')).toBeInTheDocument();
  });

  it('applies action glow class based on agentAction', () => {
    const lines = [makeLine({ id: 1 })];
    const { container } = render(<LiveTerminal lines={lines} agentAction="hacking" />);
    expect(container.querySelector('.live-terminal--glow-hacking')).toBeInTheDocument();
  });

  it('has no glow class when empty and idle', () => {
    const { container } = render(<LiveTerminal lines={[]} />);
    const terminal = container.querySelector('.live-terminal')!;
    expect(terminal.className).toContain('live-terminal');
  });

  it('renders header with expand button when onToggleExpand is provided', () => {
    const onToggle = vi.fn();
    render(<LiveTerminal lines={[]} onToggleExpand={onToggle} />);
    const btn = screen.getByTitle('Expand');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toBe('⤢');
  });

  it('does not render header when onToggleExpand is not provided', () => {
    const { container } = render(<LiveTerminal lines={[]} />);
    expect(container.querySelector('.live-terminal__header')).not.toBeInTheDocument();
  });

  it('calls onToggleExpand when expand button is clicked', () => {
    const onToggle = vi.fn();
    render(<LiveTerminal lines={[]} onToggleExpand={onToggle} />);
    fireEvent.click(screen.getByTitle('Expand'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('applies expanded class when expanded prop is true', () => {
    const { container } = render(<LiveTerminal lines={[]} expanded={true} onToggleExpand={() => {}} />);
    expect(container.querySelector('.live-terminal--expanded')).toBeInTheDocument();
  });

  it('shows collapse icon when expanded', () => {
    render(<LiveTerminal lines={[]} expanded={true} onToggleExpand={() => {}} />);
    const btn = screen.getByTitle('Collapse');
    expect(btn.textContent).toBe('⤡');
  });

  it('shows Log/Timeline toggle only when expanded', () => {
    const { rerender } = render(<LiveTerminal lines={[]} expanded={false} onToggleExpand={() => {}} />);
    expect(screen.queryByText('Log')).not.toBeInTheDocument();
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument();

    rerender(<LiveTerminal lines={[]} expanded={true} onToggleExpand={() => {}} />);
    expect(screen.getByText('Log')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
  });

  it('switches to timeline view when Timeline toggle is clicked', () => {
    const lines = [makeLine({ id: 1, type: 'command', text: '$ ls' })];
    render(<LiveTerminal lines={lines} expanded={true} onToggleExpand={() => {}} />);

    fireEvent.click(screen.getByText('Timeline'));
    const timelineView = document.querySelector('.timeline-view');
    expect(timelineView).toBeInTheDocument();
  });

  it('resets to log view when collapsing', () => {
    const lines = [makeLine({ id: 1, type: 'command', text: '$ ls' })];
    const { rerender } = render(<LiveTerminal lines={lines} expanded={true} onToggleExpand={() => {}} />);

    fireEvent.click(screen.getByText('Timeline'));
    expect(document.querySelector('.timeline-view')).toBeInTheDocument();

    rerender(<LiveTerminal lines={lines} expanded={false} onToggleExpand={() => {}} />);
    expect(document.querySelector('.timeline-view')).not.toBeInTheDocument();
    expect(document.querySelector('.live-terminal__content')).toBeInTheDocument();
  });
});
