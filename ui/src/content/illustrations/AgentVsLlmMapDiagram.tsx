export function AgentVsLlmMapDiagram() {
  return (
    <div className="onboarding-map-diagram">
      <div className="onboarding-map-diagram__topology">
        <div className="onboarding-map-diagram__pod onboarding-map-diagram__pod--revealed">
          <span className="onboarding-map-diagram__pod-icon">{'{ }'}</span>
          <span className="onboarding-map-diagram__pod-label">AGENT</span>
        </div>

        <div className="onboarding-map-diagram__arrow">
          <svg viewBox="0 0 120 24" fill="none" className="onboarding-map-diagram__arrow-svg">
            <path d="M0 12 L100 12" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
            <path d="M96 6 L108 12 L96 18" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
          <span className="onboarding-map-diagram__arrow-label">API calls</span>
        </div>

        <div className="onboarding-map-diagram__pod onboarding-map-diagram__pod--llm onboarding-map-diagram__pod--revealed">
          <span className="onboarding-map-diagram__pod-icon">vLLM</span>
          <span className="onboarding-map-diagram__pod-label">LLM</span>
        </div>
      </div>

      <div className="onboarding-map-diagram__descriptions">
        <div className="onboarding-map-diagram__desc onboarding-map-diagram__desc--agent">
          <strong>Agent</strong> &mdash; Orchestrates tools, manages memory, pursues goals. The brain that decides <em>what</em> to do.
        </div>
        <div className="onboarding-map-diagram__desc onboarding-map-diagram__desc--llm">
          <strong>LLM</strong> &mdash; Reasoning engine that generates text when asked. The muscle that decides <em>how</em> to phrase it.
        </div>
      </div>

      <div className="onboarding-map-diagram__hint">
        Two separate processes. Two separate pods. The agent calls the LLM &mdash; not the other way around.
      </div>
    </div>
  );
}
