import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContextSidebar } from '../ContextSidebar';
import { INITIAL_CONTEXT, type AgentContext } from '../../lib/contextReducer';

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return { ...INITIAL_CONTEXT, ...overrides };
}

describe('ContextSidebar', () => {
  it('displays cwd', () => {
    const ctx = makeContext({ cwd: '/home/agent/workspace' });
    render(<ContextSidebar context={ctx} />);
    expect(screen.getByText(/workspace/)).toBeInTheDocument();
  });

  it('shows "none" when no files', () => {
    render(<ContextSidebar context={makeContext()} />);
    const nones = screen.getAllByText('none');
    expect(nones.length).toBeGreaterThanOrEqual(1);
  });

  it('renders files list when files exist', () => {
    const ctx = makeContext({
      files: [{ path: '/tmp/test.py', op: 'read' as const }],
    });
    render(<ContextSidebar context={ctx} />);
    expect(screen.getByText(/test\.py/)).toBeInTheDocument();
  });

  it('limits displayed files to maxFiles', () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      path: `/tmp/file${i}.txt`,
      op: 'read' as const,
    }));
    const ctx = makeContext({ files });
    render(<ContextSidebar context={ctx} maxFiles={3} />);
    expect(screen.getByText(/file9\.txt/)).toBeInTheDocument();
    expect(screen.queryByText(/file0\.txt/)).not.toBeInTheDocument();
  });

  it('renders network finds', () => {
    const ctx = makeContext({ networkFinds: ['10.0.0.1:8080'] });
    render(<ContextSidebar context={ctx} />);
    expect(screen.getByText('10.0.0.1:8080')).toBeInTheDocument();
  });

  it('renders children and footer slots', () => {
    render(
      <ContextSidebar context={makeContext()} footer={<div>footer content</div>}>
        <div>child content</div>
      </ContextSidebar>
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
    expect(screen.getByText('footer content')).toBeInTheDocument();
  });

  it('uses custom className', () => {
    const { container } = render(
      <ContextSidebar context={makeContext()} className="custom-sidebar" />
    );
    expect(container.querySelector('.custom-sidebar')).toBeInTheDocument();
  });
});
