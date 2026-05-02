import { useState } from 'react';
import Markdown from 'react-markdown';
import type { PlansState } from '../hooks/usePlans';

interface PlansDrawerProps {
  plansState: PlansState;
}

export function PlansDrawer({ plansState }: PlansDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="neo-header__icon-btn"
        onClick={() => setOpen(!open)}
        title="Plans"
        aria-label="Toggle plans panel"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 1z"/>
          <path d="M2 0a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V2a2 2 0 00-2-2H2zm12 1a1 1 0 011 1v12a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1h12z"/>
        </svg>
      </button>

      {open && (
        <div className="workspace-drawer">
          <div className="workspace-drawer__header">
            <span className="workspace-drawer__title">Plans</span>
            <button className="workspace-drawer__close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="workspace-drawer__body plans-drawer__body">
            {plansState.plans.length === 0 && (
              <div className="task-viewer__empty">No plans</div>
            )}
            {plansState.selectedPlan ? (
              <div className="plans-drawer__detail">
                <button className="plans-drawer__back" onClick={() => plansState.selectPlan(plansState.selectedPlan!.filename)}>
                  ← Back to list
                </button>
                <div className="plans-drawer__content">
                  <Markdown>{plansState.selectedPlan.content}</Markdown>
                </div>
              </div>
            ) : (
              <ul className="plans-drawer__list">
                {plansState.plans.map(plan => (
                  <li key={plan.filename} className="plans-drawer__item" onClick={() => plansState.selectPlan(plan.filename)}>
                    <span className="plans-drawer__item-title">{plan.title}</span>
                    <span className="plans-drawer__item-date">{new Date(plan.mtime).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
