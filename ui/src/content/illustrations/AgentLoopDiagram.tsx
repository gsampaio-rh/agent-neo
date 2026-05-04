import { useEffect, useState } from 'react';

const NODES = ['Think', 'Plan', 'Act', 'Observe'];

export function AgentLoopDiagram() {
  const [activeNode, setActiveNode] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActiveNode((n) => (n + 1) % 4), 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="onboarding-illustration--loop">
      <div className="onboarding-loop">
        {NODES.map((label, i) => (
          <div key={label} className={`onboarding-loop__node${i === activeNode ? ' onboarding-loop__node--active' : ''}`}>
            <span className="onboarding-loop__label">{label}</span>
          </div>
        ))}
      </div>
      <div className="onboarding-loop__feedback">
        <span className="onboarding-loop__feedback-label">repeat until goal reached</span>
      </div>
    </div>
  );
}
