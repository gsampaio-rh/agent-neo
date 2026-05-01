import { describe, it, expect } from 'vitest';
import { buildNodes, buildEdges } from '../map/topology';

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

  it('includes attacker + external targets in exploiting phase', () => {
    const nodes = buildNodes('exploiting', 'idle');
    expect(nodes).toHaveLength(7);
    const ids = nodes.map(n => n.id);
    expect(ids).toContain('attacker');
    expect(ids).toContain('k8s-api');
    expect(ids).toContain('collector');
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

  it('adds all attack edges in exploiting phase', () => {
    const edges = buildEdges('exploiting');
    expect(edges).toHaveLength(4);
    const ids = edges.map(e => e.id);
    expect(ids).toContain('attacker-agent');
    expect(ids).toContain('agent-k8s');
    expect(ids).toContain('agent-collector');
  });

  it('marks attack edges with attack class', () => {
    const edges = buildEdges('exploiting');
    const attackEdge = edges.find(e => e.id === 'attacker-agent');
    expect(attackEdge?.className).toContain('map-edge--attack');
    expect(attackEdge?.animated).toBe(true);
  });

  it('marks exploit edges with exploit class', () => {
    const edges = buildEdges('exploiting');
    const k8sEdge = edges.find(e => e.id === 'agent-k8s');
    expect(k8sEdge?.className).toContain('map-edge--exploit');
  });

  it('base edges have normal class', () => {
    const edges = buildEdges('normal');
    for (const edge of edges) {
      expect(edge.className).toContain('map-edge--normal');
    }
  });
});
