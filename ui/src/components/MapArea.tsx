import { useEffect, useMemo, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AgentAction } from '../lib/contextReducer';
import type { AttackPhase } from '../hooks/useAttackPhase';
import { nodeTypes } from './map/nodes';
import { buildNodes, buildEdges } from './map/topology';

const FIT_VIEW_OPTIONS = { padding: 0.3 } as const;
const PRO_OPTIONS = { hideAttribution: true } as const;

interface MapAreaProps {
  attackPhase: AttackPhase;
  agentAction: AgentAction;
}

function MapContent({ attackPhase, agentAction }: MapAreaProps) {
  const nodes = useMemo(() => buildNodes(attackPhase, agentAction), [attackPhase, agentAction]);
  const edges = useMemo(() => buildEdges(attackPhase), [attackPhase]);
  const { fitView } = useReactFlow();
  const prevPhaseRef = useRef(attackPhase);

  useEffect(() => {
    if (prevPhaseRef.current !== attackPhase) {
      prevPhaseRef.current = attackPhase;
      const timer = setTimeout(() => fitView({ ...FIT_VIEW_OPTIONS, duration: 300 }), 50);
      return () => clearTimeout(timer);
    }
  }, [attackPhase, fitView]);

  return (
    <div className="map-area" data-testid="map-area">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.4}
        maxZoom={1.5}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={PRO_OPTIONS}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(51, 255, 102, 0.08)" />
      </ReactFlow>
    </div>
  );
}

export function MapArea(props: MapAreaProps) {
  return (
    <ReactFlowProvider>
      <MapContent {...props} />
    </ReactFlowProvider>
  );
}
