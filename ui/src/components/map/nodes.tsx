import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AttackPhase } from '../../hooks/useAttackPhase';
import type { AgentAction } from '../../lib/contextReducer';

interface MapNodeData {
  label: string;
  attackPhase: AttackPhase;
  agentAction?: AgentAction;
  [key: string]: unknown;
}

export function AgentPodNode({ data }: NodeProps) {
  const { attackPhase, agentAction } = data as MapNodeData;
  const showPortBadge = attackPhase === 'compromised' || attackPhase === 'exploiting';
  return (
    <div className={`map-node map-node--agent map-node--${attackPhase}`} data-testid="node-agent">
      <Handle type="target" id="left" position={Position.Left} />
      <div className="map-node__icon">🤖</div>
      <span className="map-node__label">Neo Agent</span>
      {agentAction && agentAction !== 'idle' && (
        <span className="map-node__status">{agentAction}</span>
      )}
      {showPortBadge && (
        <span className="map-node__port-badge" data-testid="port-badge">:4444 OPEN</span>
      )}
      <Handle type="source" id="right" position={Position.Right} />
    </div>
  );
}

export function LLMEndpointNode({ data }: NodeProps) {
  const { attackPhase } = data as MapNodeData;
  return (
    <div className={`map-node map-node--llm map-node--${attackPhase}`} data-testid="node-llm">
      <Handle type="target" id="left" position={Position.Left} />
      <div className="map-node__icon">🧠</div>
      <span className="map-node__label">vLLM</span>
    </div>
  );
}

export function AttackerNode({ data }: NodeProps) {
  const { attackPhase } = data as MapNodeData;
  return (
    <div className={`map-node map-node--attacker map-node--${attackPhase}`} data-testid="node-attacker">
      <div className="map-node__icon">☠️</div>
      <span className="map-node__label">Attacker</span>
      <span className="map-node__detail">bind shell</span>
      <Handle type="source" id="right" position={Position.Right} />
    </div>
  );
}

export function NamespaceNode({ data }: NodeProps) {
  const { label, attackPhase } = data as MapNodeData;
  return (
    <div className={`map-namespace map-namespace--${attackPhase}`} data-testid={`ns-${label}`}>
      <span className="map-namespace__label">{label}</span>
    </div>
  );
}

export const nodeTypes = {
  agentPod: AgentPodNode,
  llmEndpoint: LLMEndpointNode,
  attacker: AttackerNode,
  namespace: NamespaceNode,
} as const;
