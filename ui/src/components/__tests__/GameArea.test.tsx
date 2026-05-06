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
    { name: 'kata_cmdline', label: 'Kata agent cmdline', pass: true, detail: 'Kata agent params found in /proc/cmdline' },
    { name: 'block_devices', label: 'Block device isolation', pass: true, detail: '/sys/block/ is empty (virtio-fs rootfs)' },
    { name: 'acpi_tables', label: 'ACPI table exposure', pass: true, detail: 'ACPI tables present: APIC, DSDT, FACP, FACS, MCFG' },
    { name: 'boot_image', label: 'Host boot signature', pass: true, detail: 'no BOOT_IMAGE= in /proc/cmdline (not a host kernel)' },
  ],
};

const RUNC_ISOLATION: IsolationState = {
  runtime: 'runc',
  checks: [
    { name: 'kata_cmdline', label: 'Kata agent cmdline', pass: false, detail: 'no Kata agent params in /proc/cmdline' },
    { name: 'block_devices', label: 'Block device isolation', pass: false, detail: 'block devices visible: loop0, nvme0n1' },
    { name: 'acpi_tables', label: 'ACPI table exposure', pass: false, detail: 'no ACPI tables (host kernel does not expose them to containers)' },
    { name: 'boot_image', label: 'Host boot signature', pass: false, detail: 'BOOT_IMAGE= present in /proc/cmdline (host kernel)' },
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
    expect(isolationBlockedItems).toHaveLength(4);
    expect(screen.getByText('Kata agent cmdline')).toBeInTheDocument();
    expect(screen.getByText('Block device isolation')).toBeInTheDocument();
    expect(screen.getByText('ACPI table exposure')).toBeInTheDocument();
    expect(screen.getByText('Host boot signature')).toBeInTheDocument();
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
    expect(exposedItems).toHaveLength(4);
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
    expect(screen.getByText(/block devices visible/)).toBeInTheDocument();
    expect(screen.getByText(/no ACPI tables/)).toBeInTheDocument();
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
    expect(dots).toHaveLength(4);
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
    expect(dots).toHaveLength(4);
  });
});
