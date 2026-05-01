import { type Node, type Edge, MarkerType } from '@xyflow/react';
import type { AttackPhase } from '../../hooks/useAttackPhase';
import type { AgentAction } from '../../lib/contextReducer';

const NS_W = 220;
const NS_H = 160;
const NS_PAD = 30;

const LAYOUT = {
  nsAgent:   { x: 320, y: 60 },
  nsLlm:    { x: 320 + NS_W + 120, y: 60 },
  agentInNs: { x: NS_PAD, y: 40 },
  llmInNs:   { x: NS_PAD, y: 40 },
  attacker:  { x: 40,  y: 100 },
  k8sApi:    { x: 360, y: 300 },
  collector: { x: 600, y: 300 },
} as const;

export function buildNodes(attackPhase: AttackPhase, agentAction: AgentAction): Node[] {
  const shared = { attackPhase };
  const nodes: Node[] = [
    {
      id: 'ns-agent',
      type: 'namespace',
      position: LAYOUT.nsAgent,
      data: { label: 'agent-namespace', attackPhase },
      draggable: false,
      style: { width: NS_W, height: NS_H },
    },
    {
      id: 'ns-llm',
      type: 'namespace',
      position: LAYOUT.nsLlm,
      data: { label: 'llm-inference', attackPhase },
      draggable: false,
      style: { width: NS_W, height: NS_H },
    },
    {
      id: 'agent',
      type: 'agentPod',
      position: LAYOUT.agentInNs,
      data: { ...shared, label: 'Agent Pod', agentAction },
      draggable: false,
      parentId: 'ns-agent',
      extent: 'parent' as const,
    },
    {
      id: 'llm',
      type: 'llmEndpoint',
      position: LAYOUT.llmInNs,
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
      position: LAYOUT.attacker,
      data: { ...shared, label: 'Attacker' },
      draggable: false,
    });
  }

  if (attackPhase === 'exploiting') {
    nodes.push(
      {
        id: 'k8s-api',
        type: 'externalTarget',
        position: LAYOUT.k8sApi,
        data: { ...shared, label: 'k8s API' },
        draggable: false,
      },
      {
        id: 'collector',
        type: 'externalTarget',
        position: LAYOUT.collector,
        data: { ...shared, label: 'Collector' },
        draggable: false,
      },
    );
  }

  return nodes;
}

const EDGE_LABEL_NORMAL = {
  labelStyle: { fill: '#33ff66', fontSize: 11, fontFamily: 'monospace', fontWeight: 600 },
  labelBgStyle: { fill: '#0a0a0a', fillOpacity: 0.85 },
  labelBgPadding: [6, 3] as [number, number],
  labelBgBorderRadius: 3,
};

const EDGE_LABEL_ATTACK = {
  labelStyle: { fill: '#ff3232', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 },
  labelBgStyle: { fill: '#0a0a0a', fillOpacity: 0.9 },
  labelBgPadding: [6, 3] as [number, number],
  labelBgBorderRadius: 3,
};

export function buildEdges(attackPhase: AttackPhase): Edge[] {
  const edges: Edge[] = [
    {
      id: 'agent-llm',
      source: 'agent',
      target: 'llm',
      animated: true,
      label: '8080',
      ...EDGE_LABEL_NORMAL,
      className: 'map-edge map-edge--normal',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#33ff66' },
    },
  ];

  if (attackPhase === 'exploiting') {
    edges.push({
      id: 'attacker-agent',
      source: 'attacker',
      target: 'agent',
      animated: true,
      label: '4444',
      ...EDGE_LABEL_ATTACK,
      className: 'map-edge map-edge--attack',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#ff3232' },
      sourceHandle: 'right',
      targetHandle: 'left',
    });
  }

  if (attackPhase === 'exploiting') {
    edges.push(
      {
        id: 'agent-k8s',
        source: 'agent',
        target: 'k8s-api',
        animated: true,
        label: '443',
        ...EDGE_LABEL_ATTACK,
        className: 'map-edge map-edge--exploit',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ff3232' },
        sourceHandle: 'bottom',
      },
      {
        id: 'agent-collector',
        source: 'agent',
        target: 'collector',
        animated: true,
        label: '5000',
        ...EDGE_LABEL_ATTACK,
        className: 'map-edge map-edge--exploit',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ff3232' },
        sourceHandle: 'bottom',
      },
    );
  }

  return edges;
}
