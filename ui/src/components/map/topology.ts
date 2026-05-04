import { type Node, type Edge, MarkerType } from '@xyflow/react';
import type { AttackPhase } from '../../hooks/useAttackPhase';
import type { AgentAction } from '../../lib/contextReducer';

const NS_W = 220;
const NS_H = 160;
const NS_PAD = 30;
const NS_GAP = 120;
const ATK_GAP = 80;
const ATTACKER_NODE_H = 80;

interface LayoutPositions {
  nsAgent: { x: number; y: number };
  nsLlm: { x: number; y: number };
  agentInNs: { x: number; y: number };
  llmInNs: { x: number; y: number };
  attacker: { x: number; y: number };
}

// Manual positioning over dagre/elkjs: with 3-5 nodes the overhead of an
// auto-layout library isn't justified; manual gives pixel-perfect control.
export function computeLayout(attackPhase: AttackPhase): LayoutPositions {
  const childInNs = { x: NS_PAD, y: 40 };

  if (attackPhase === 'exploiting') {
    const attackerX = 0;
    const nsAgentX = attackerX + ATK_GAP + 100;
    return {
      nsAgent:   { x: nsAgentX, y: 0 },
      nsLlm:     { x: nsAgentX + NS_W + NS_GAP, y: 0 },
      agentInNs: childInNs,
      llmInNs:   childInNs,
      attacker:  { x: attackerX, y: (NS_H - ATTACKER_NODE_H) / 2 },
    };
  }

  return {
    nsAgent:   { x: 0, y: 0 },
    nsLlm:     { x: NS_W + NS_GAP, y: 0 },
    agentInNs: childInNs,
    llmInNs:   childInNs,
    attacker:  { x: 0, y: 0 },
  };
}

export function buildNodes(attackPhase: AttackPhase, agentAction: AgentAction): Node[] {
  const layout = computeLayout(attackPhase);
  const shared = { attackPhase };
  const nodes: Node[] = [
    {
      id: 'ns-agent',
      type: 'namespace',
      position: layout.nsAgent,
      data: { label: 'agent-namespace', attackPhase },
      draggable: false,
      style: { width: NS_W, height: NS_H },
    },
    {
      id: 'ns-llm',
      type: 'namespace',
      position: layout.nsLlm,
      data: { label: 'llm-inference', attackPhase },
      draggable: false,
      style: { width: NS_W, height: NS_H },
    },
    {
      id: 'agent',
      type: 'agentPod',
      position: layout.agentInNs,
      data: { ...shared, label: 'Agent Pod', agentAction },
      draggable: false,
      parentId: 'ns-agent',
      extent: 'parent' as const,
    },
    {
      id: 'llm',
      type: 'llmEndpoint',
      position: layout.llmInNs,
      data: { ...shared, label: 'vLLM' },
      draggable: false,
      parentId: 'ns-llm',
      extent: 'parent' as const,
    },
  ];

  if (attackPhase === 'exploiting') {
    nodes.push({
      id: 'attacker',
      type: 'attacker',
      position: layout.attacker,
      data: { ...shared, label: 'Attacker' },
      draggable: false,
    });
  }

  return nodes;
}

const EDGE_LABEL_NORMAL = {
  labelStyle: { fill: '#33ff66', fontSize: 11, fontFamily: 'monospace', fontWeight: 600 },
  labelBgStyle: { fill: '#0a0a0a', fillOpacity: 0.85 },
  labelBgPadding: [8, 4] as [number, number],
  labelBgBorderRadius: 4,
};

const EDGE_LABEL_ATTACK = {
  labelStyle: { fill: '#ff3232', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 },
  labelBgStyle: { fill: '#0a0a0a', fillOpacity: 0.9 },
  labelBgPadding: [8, 4] as [number, number],
  labelBgBorderRadius: 4,
};

export function buildEdges(attackPhase: AttackPhase): Edge[] {
  const edges: Edge[] = [
    {
      id: 'agent-llm',
      source: 'agent',
      target: 'llm',
      type: 'smoothstep',
      animated: true,
      label: '8080',
      ...EDGE_LABEL_NORMAL,
      className: 'map-edge map-edge--normal',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#33ff66' },
      sourceHandle: 'right',
      targetHandle: 'left',
    },
  ];

  if (attackPhase === 'exploiting') {
    edges.push({
      id: 'attacker-agent',
      source: 'attacker',
      target: 'agent',
      type: 'smoothstep',
      animated: true,
      label: '4444',
      ...EDGE_LABEL_ATTACK,
      className: 'map-edge map-edge--attack',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#ff3232' },
      sourceHandle: 'right',
      targetHandle: 'left',
    });
  }

  return edges;
}
