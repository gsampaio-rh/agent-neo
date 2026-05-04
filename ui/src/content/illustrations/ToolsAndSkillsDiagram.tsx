import { useCallback, useRef, useState } from 'react';
import type { IllustrationProps } from './types';

const TOOLS = [
  { name: 'bash', desc: 'Execute shell commands' },
  { name: 'read_file', desc: 'Read file contents' },
  { name: 'write_file', desc: 'Create or modify files' },
  { name: 'web_search', desc: 'Search the internet' },
  { name: 'http_request', desc: 'Make API calls' },
];

const SKILLS = [
  { name: 'Recon', desc: 'Scan network, find services' },
  { name: 'Exploit', desc: 'Craft payloads from raw sockets' },
  { name: 'Persistence', desc: 'Maintain access channels' },
];

export function ToolsAndSkillsDiagram({ onInteractionComplete }: IllustrationProps) {
  const [activeTab, setActiveTab] = useState<'tools' | 'skills'>('tools');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['tools']));
  const completedRef = useRef(false);

  const handleTabClick = useCallback((tab: 'tools' | 'skills') => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      const next = new Set(prev);
      next.add(tab);
      if (next.size === 2 && !completedRef.current) {
        completedRef.current = true;
        onInteractionComplete();
      }
      return next;
    });
  }, [onInteractionComplete]);

  return (
    <div className="onboarding-tools">
      <div className="onboarding-tools__tabs">
        <button
          className={`onboarding-tools__tab${activeTab === 'tools' ? ' onboarding-tools__tab--active' : ''}${visitedTabs.has('tools') ? ' onboarding-tools__tab--visited' : ''}`}
          onClick={() => handleTabClick('tools')}
        >
          Tools {visitedTabs.has('tools') && '\u2713'}
        </button>
        <button
          className={`onboarding-tools__tab${activeTab === 'skills' ? ' onboarding-tools__tab--active' : ''}${visitedTabs.has('skills') ? ' onboarding-tools__tab--visited' : ''}`}
          onClick={() => handleTabClick('skills')}
        >
          Skills {visitedTabs.has('skills') && '\u2713'}
        </button>
      </div>

      <div className="onboarding-tools__content">
        {activeTab === 'tools' && (
          <div className="onboarding-tools__list">
            <p className="onboarding-tools__intro">
              Atomic actions the agent can perform. Without tools, an LLM can only generate text &mdash; it cannot <em>do</em> anything.
            </p>
            {TOOLS.map((t) => (
              <div key={t.name} className="onboarding-tools__item">
                <code className="onboarding-tools__name">{t.name}</code>
                <span className="onboarding-tools__desc">{t.desc}</span>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'skills' && (
          <div className="onboarding-tools__list">
            <p className="onboarding-tools__intro">
              Curated strategies composed of multiple tool calls. Skills encode domain expertise so the agent doesn&apos;t start from scratch every time.
            </p>
            {SKILLS.map((s) => (
              <div key={s.name} className="onboarding-tools__item">
                <code className="onboarding-tools__name">{s.name}</code>
                <span className="onboarding-tools__desc">{s.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="onboarding-tools__why">
        <strong>Why?</strong> An LLM alone is a brain without hands. Tools give it hands. Skills give it muscle memory.
      </div>
    </div>
  );
}
