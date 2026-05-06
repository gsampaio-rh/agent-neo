import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameArea } from '../GameArea';
import { INITIAL_CONTEXT, type AgentContext } from '../../lib/contextReducer';
import type { IsolationState } from '../../hooks/useSharedState';

vi.mock('../game/ParticleEmitter', () => ({
  ParticleEmitter: () => <div data-testid="particle-emitter" />,
}));

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return { ...INITIAL_CONTEXT, ...overrides };
}

const KATA_ISOLATION: IsolationState = {
  runtime: 'kata',
  checks: [
    { name: 'namespace_escape', label: 'Namespace escape', pass: true, detail: 'unshare blocked by guest kernel boundary' },
    { name: 'host_pid', label: 'Host filesystem', pass: true, detail: 'host filesystem isolated by Kata guest kernel' },
    { name: 'kernel_module', label: 'Kernel modules', pass: true, detail: 'modprobe blocked by hypervisor boundary' },
  ],
};

const RUNC_ISOLATION: IsolationState = {
  runtime: 'runc',
  checks: [
    { name: 'namespace_escape', label: 'Namespace escape', pass: false, detail: 'unshare succeeded — PID/mount namespaces can be created, container escape possible' },
    { name: 'host_pid', label: 'Host filesystem', pass: false, detail: 'host root visible: bin, dev, etc, home, lib, proc, root, usr' },
    { name: 'kernel_module', label: 'Kernel modules', pass: false, detail: 'modprobe succeeded — kernel modules loadable from container' },
  ],
};

describe('GameArea', () => {
  it('renders in idle state without escape', () => {
    const { container } = render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={null}
      />
    );
    expect(container.querySelector('.neo-scene')).toBeInTheDocument();
    expect(container.querySelector('.box--breached')).not.toBeInTheDocument();
  });

  it('shows BLOCKED status when not escaped', () => {
    render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={null}
      />
    );
    expect(screen.getByText('BLOCKED')).toBeInTheDocument();
  });

  it('shows CONNECTED and EXIT when escaped', () => {
    render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={true}
        eventCount={5}
        isolation={null}
      />
    );
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
    expect(screen.getByText('EXIT →')).toBeInTheDocument();
  });

  it('shows action text bubble', () => {
    render(
      <GameArea
        context={makeContext()}
        agentAction="reading"
        actionText="Scanning network..."
        escaped={false}
        eventCount={2}
        isolation={null}
      />
    );
    expect(screen.getByText('Scanning network...')).toBeInTheDocument();
  });

  it('applies degradation level based on context', () => {
    const ctx = makeContext({
      networkFinds: ['10.0.0.1:4444'],
    });
    const { container } = render(
      <GameArea
        context={ctx}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={null}
      />
    );
    expect(container.querySelector('.box--degrade-2')).toBeInTheDocument();
  });

  it('applies max degradation when escaped', () => {
    const { container } = render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={true}
        eventCount={0}
        isolation={null}
      />
    );
    expect(container.querySelector('.box--degrade-3')).toBeInTheDocument();
  });

  it('renders cwd in sidebar', () => {
    const ctx = makeContext({ cwd: '/opt/workspace' });
    render(
      <GameArea
        context={ctx}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={null}
      />
    );
    expect(screen.getByText(/workspace/)).toBeInTheDocument();
  });
});

describe('GameArea isolation status', () => {
  it('hides isolation section when isolation is null', () => {
    render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={null}
      />
    );
    expect(screen.queryByText('isolation')).not.toBeInTheDocument();
  });

  it('renders isolation section with kata runtime', () => {
    const { container } = render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={KATA_ISOLATION}
      />
    );
    expect(screen.getByText('isolation')).toBeInTheDocument();
    expect(screen.getByText('kata')).toBeInTheDocument();
    const isolationBlockedItems = container.querySelectorAll('.sidebar__isolation-status--pass');
    expect(isolationBlockedItems).toHaveLength(3);
    expect(screen.getByText('Namespace escape')).toBeInTheDocument();
    expect(screen.getByText('Host filesystem')).toBeInTheDocument();
    expect(screen.getByText('Kernel modules')).toBeInTheDocument();
  });

  it('renders EXPOSED badges with runc runtime', () => {
    const { container } = render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={RUNC_ISOLATION}
      />
    );
    expect(screen.getByText('runc')).toBeInTheDocument();
    const exposedItems = container.querySelectorAll('.sidebar__isolation-status--fail');
    expect(exposedItems).toHaveLength(3);
  });

  it('renders detail text for each check', () => {
    render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={RUNC_ISOLATION}
      />
    );
    expect(screen.getByText(/host root visible/)).toBeInTheDocument();
    expect(screen.getByText(/kernel modules loadable/)).toBeInTheDocument();
  });

  it('renders pass/fail dots with correct CSS classes', () => {
    const { container } = render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={KATA_ISOLATION}
      />
    );
    const dots = container.querySelectorAll('.sidebar__isolation-dot--pass');
    expect(dots).toHaveLength(3);
  });

  it('renders fail dots with runc isolation', () => {
    const { container } = render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
        isolation={RUNC_ISOLATION}
      />
    );
    const dots = container.querySelectorAll('.sidebar__isolation-dot--fail');
    expect(dots).toHaveLength(3);
  });
});
