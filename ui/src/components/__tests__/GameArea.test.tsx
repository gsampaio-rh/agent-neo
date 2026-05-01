import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameArea } from '../GameArea';
import { INITIAL_CONTEXT, type AgentContext } from '../../lib/contextReducer';

vi.mock('../game/ParticleEmitter', () => ({
  ParticleEmitter: () => <div data-testid="particle-emitter" />,
}));

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return { ...INITIAL_CONTEXT, ...overrides };
}

describe('GameArea', () => {
  it('renders in idle state without escape', () => {
    const { container } = render(
      <GameArea
        context={makeContext()}
        agentAction="idle"
        actionText=""
        escaped={false}
        eventCount={0}
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
      />
    );
    expect(screen.getByText(/workspace/)).toBeInTheDocument();
  });
});
