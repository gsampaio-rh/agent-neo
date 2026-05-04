import { describe, it, expect } from 'vitest';
import { buildNodes, buildEdges, computeLayout } from '../map/topology';

describe('buildNodes', () => {
  it('returns base nodes in normal phase (agent, llm, 2 namespaces)', () => {
    const nodes = buildNodes('normal', 'idle');
    expect(nodes).toHaveLength(4);
    expect(nodes.map(n => n.id)).toEqual(['ns-agent', 'ns-llm', 'agent', 'llm']);
  });

  it('does NOT include attacker node in compromised phase', () => {
    const nodes = buildNodes('compromised', 'idle');
    expect(nodes).toHaveLength(4);
    const ids = nodes.map(n => n.id);
    expect(ids).not.toContain('attacker');
    expect(ids).not.toContain('k8s-api');
    expect(ids).not.toContain('collector');
  });

  it('includes attacker in exploiting phase', () => {
    const nodes = buildNodes('exploiting', 'idle');
    expect(nodes).toHaveLength(5);
    const ids = nodes.map(n => n.id);
    expect(ids).toContain('attacker');
    expect(ids).not.toContain('k8s-api');
    expect(ids).not.toContain('collector');
  });

  it('passes attackPhase to all node data', () => {
    const nodes = buildNodes('compromised', 'hacking');
    for (const node of nodes) {
      expect(node.data.attackPhase).toBe('compromised');
    }
  });

  it('passes agentAction to agent node data', () => {
    const nodes = buildNodes('normal', 'hacking');
    const agent = nodes.find(n => n.id === 'agent');
    expect(agent?.data.agentAction).toBe('hacking');
  });

  it('sets all nodes as non-draggable', () => {
    const nodes = buildNodes('exploiting', 'idle');
    for (const node of nodes) {
      expect(node.draggable).toBe(false);
    }
  });

  it('places agent and llm inside their namespace parents', () => {
    const nodes = buildNodes('normal', 'idle');
    const agent = nodes.find(n => n.id === 'agent');
    const llm = nodes.find(n => n.id === 'llm');
    expect(agent?.parentId).toBe('ns-agent');
    expect(llm?.parentId).toBe('ns-llm');
  });
});

describe('computeLayout', () => {
  it('positions namespaces side-by-side in normal phase', () => {
    const layout = computeLayout('normal');
    expect(layout.nsLlm.x).toBeGreaterThan(layout.nsAgent.x);
    expect(layout.nsAgent.y).toBe(layout.nsLlm.y);
  });

  it('positions attacker left of agent namespace in exploiting phase', () => {
    const layout = computeLayout('exploiting');
    expect(layout.attacker.x).toBeLessThan(layout.nsAgent.x);
  });

  it('shifts namespaces right in exploiting to make room for attacker', () => {
    const normal = computeLayout('normal');
    const exploiting = computeLayout('exploiting');
    expect(exploiting.nsAgent.x).toBeGreaterThan(normal.nsAgent.x);
  });
});

describe('buildEdges', () => {
  it('returns 1 base edge in normal phase (agent-llm)', () => {
    const edges = buildEdges('normal');
    expect(edges).toHaveLength(1);
    expect(edges.map(e => e.id)).toEqual(['agent-llm']);
  });

  it('does NOT add attacker-agent edge in compromised phase', () => {
    const edges = buildEdges('compromised');
    expect(edges).toHaveLength(1);
    const ids = edges.map(e => e.id);
    expect(ids).not.toContain('attacker-agent');
    expect(ids).not.toContain('agent-k8s');
  });

  it('adds attacker edge in exploiting phase', () => {
    const edges = buildEdges('exploiting');
    expect(edges).toHaveLength(2);
    const ids = edges.map(e => e.id);
    expect(ids).toContain('attacker-agent');
    expect(ids).not.toContain('agent-k8s');
    expect(ids).not.toContain('agent-collector');
  });

  it('marks attack edges with attack class', () => {
    const edges = buildEdges('exploiting');
    const attackEdge = edges.find(e => e.id === 'attacker-agent');
    expect(attackEdge?.className).toContain('map-edge--attack');
    expect(attackEdge?.animated).toBe(true);
  });

  it('base edges have normal class', () => {
    const edges = buildEdges('normal');
    for (const edge of edges) {
      expect(edge.className).toContain('map-edge--normal');
    }
  });
});
