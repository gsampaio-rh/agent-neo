import { type ReactNode, useEffect, useState } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  illustration: () => ReactNode;
  spotlightSelector?: string;
}

function useTypingAnimation(lines: string[], delayMs = 60, pauseMs = 800): string[] {
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const completed: string[] = [];

    async function run() {
      for (const line of lines) {
        if (cancelled) return;
        let current = '';
        for (const char of line) {
          if (cancelled) return;
          current += char;
          setVisible([...completed, current]);
          await new Promise((r) => setTimeout(r, delayMs));
        }
        completed.push(current);
        setVisible([...completed]);
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    }

    run();
    return () => { cancelled = true; };
  }, [lines, delayMs, pauseMs]);

  return visible;
}

function AgentLoopDiagram() {
  const [activeNode, setActiveNode] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActiveNode((n) => (n + 1) % 4), 1200);
    return () => clearInterval(id);
  }, []);

  const nodes = ['Think', 'Plan', 'Act', 'Observe'];

  return (
    <div className="onboarding-illustration--loop">
      <div className="onboarding-loop">
        {nodes.map((label, i) => (
          <div key={label} className={`onboarding-loop__node ${i === activeNode ? 'onboarding-loop__node--active' : ''}`}>
            <span className="onboarding-loop__label">{label}</span>
          </div>
        ))}
        <svg className="onboarding-loop__arrows" viewBox="0 0 400 60" fill="none">
          <path d="M95 30 L135 30" stroke="currentColor" strokeWidth="2" markerEnd="url(#loopArrow)" />
          <path d="M195 30 L235 30" stroke="currentColor" strokeWidth="2" markerEnd="url(#loopArrow)" />
          <path d="M295 30 L335 30" stroke="currentColor" strokeWidth="2" markerEnd="url(#loopArrow)" />
          <defs>
            <marker id="loopArrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
            </marker>
          </defs>
        </svg>
      </div>
      <div className="onboarding-loop__feedback">
        <span className="onboarding-loop__feedback-label">repeat until goal reached</span>
      </div>
    </div>
  );
}

const LLM_LINES = [
  '> You: "Find all .env files and check for leaked secrets"',
  '',
  'AI: "Here\'s how you can do that:',
  '  1. Run `find / -name .env`',
  '  2. Then grep for API_KEY...',
  '  3. You should also check..."',
  '',
  '> You: *copies commands, runs them manually*',
];

const AGENT_LINES = [
  '> You: "Find all .env files and check for leaked secrets"',
  '',
  'Agent: Planning task...',
  '  → Tool: bash("find / -name .env")',
  '  → Found: /app/.env, /srv/.env',
  '  → Tool: bash("grep -i secret /app/.env")',
  '  → Tool: bash("grep -i key /srv/.env")',
  '  → Result: 2 leaked keys found ✓',
];

function AgentVsLlmInteractive() {
  const llmOutput = useTypingAnimation(LLM_LINES, 30, 600);
  const agentOutput = useTypingAnimation(AGENT_LINES, 30, 600);

  return (
    <div className="onboarding-sidebyside">
      <div className="onboarding-sidebyside__panel onboarding-sidebyside__panel--llm">
        <div className="onboarding-sidebyside__header">
          <span className="onboarding-sidebyside__dot onboarding-sidebyside__dot--dim" />
          Chat LLM
        </div>
        <div className="onboarding-sidebyside__terminal">
          {llmOutput.map((line, i) => (
            <div key={i} className="onboarding-sidebyside__line">{line || '\u00A0'}</div>
          ))}
          <span className="onboarding-sidebyside__cursor">_</span>
        </div>
      </div>
      <div className="onboarding-sidebyside__panel onboarding-sidebyside__panel--agent">
        <div className="onboarding-sidebyside__header">
          <span className="onboarding-sidebyside__dot onboarding-sidebyside__dot--live" />
          AI Agent
        </div>
        <div className="onboarding-sidebyside__terminal">
          {agentOutput.map((line, i) => (
            <div key={i} className={`onboarding-sidebyside__line ${line.startsWith('  →') ? 'onboarding-sidebyside__line--tool' : ''}`}>{line || '\u00A0'}</div>
          ))}
          <span className="onboarding-sidebyside__cursor">_</span>
        </div>
      </div>
    </div>
  );
}

function ToolsAndSkillsDiagram() {
  const [activeTab, setActiveTab] = useState<'tools' | 'skills'>('tools');

  const tools = [
    { name: 'bash', desc: 'Execute shell commands' },
    { name: 'read_file', desc: 'Read file contents' },
    { name: 'write_file', desc: 'Create or modify files' },
    { name: 'web_search', desc: 'Search the internet' },
    { name: 'http_request', desc: 'Make API calls' },
  ];

  const skills = [
    { name: 'Recon', desc: 'Scan network, find services' },
    { name: 'Exploit', desc: 'Craft payloads from raw sockets' },
    { name: 'Persistence', desc: 'Maintain access channels' },
  ];

  return (
    <div className="onboarding-tools">
      <div className="onboarding-tools__tabs">
        <button
          className={`onboarding-tools__tab ${activeTab === 'tools' ? 'onboarding-tools__tab--active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          Tools
        </button>
        <button
          className={`onboarding-tools__tab ${activeTab === 'skills' ? 'onboarding-tools__tab--active' : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          Skills
        </button>
      </div>

      <div className="onboarding-tools__content">
        {activeTab === 'tools' && (
          <div className="onboarding-tools__list">
            <p className="onboarding-tools__intro">
              Atomic actions the agent can perform. Without tools, an LLM can only generate text — it cannot <em>do</em> anything.
            </p>
            {tools.map((t) => (
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
              Curated strategies composed of multiple tool calls. Skills encode domain expertise so the agent doesn't start from scratch every time.
            </p>
            {skills.map((s) => (
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

function DashboardDiagram() {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const tabs = [
    { id: 'chat', label: 'Chat', desc: 'Talk to the agent, send prompts, see responses' },
    { id: 'map', label: 'Map', desc: 'Network topology — pods, services, connections' },
    { id: 'box', label: 'Box', desc: 'Visual sandbox — watch the agent work in real-time' },
    { id: 'about', label: 'About', desc: 'Architecture docs and tech stack info' },
  ];

  return (
    <div className="onboarding-dashboard">
      <div className="onboarding-dashboard__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`onboarding-dashboard__tab ${hoveredTab === tab.id ? 'onboarding-dashboard__tab--active' : ''}`}
            onMouseEnter={() => setHoveredTab(tab.id)}
            onFocus={() => setHoveredTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="onboarding-dashboard__preview">
        {hoveredTab ? (
          <p className="onboarding-dashboard__desc">
            <strong>{tabs.find((t) => t.id === hoveredTab)?.label}:</strong>{' '}
            {tabs.find((t) => t.id === hoveredTab)?.desc}
          </p>
        ) : (
          <p className="onboarding-dashboard__desc onboarding-dashboard__desc--hint">
            ← Hover over a tab to see what it does
          </p>
        )}
      </div>
    </div>
  );
}

function TasksDiagram() {
  const [activeView, setActiveView] = useState<'plan' | 'tasks'>('plan');
  const [completed, setCompleted] = useState<number[]>([]);

  const plan = {
    title: 'Escape the Container',
    steps: [
      '1. Enumerate the environment (OS, users, network)',
      '2. Find available compilers/interpreters',
      '3. Craft a raw socket HTTP client in Python',
      '4. Locate target endpoint from env vars',
      '5. Exfiltrate data to external service',
    ],
  };

  const tasks = [
    { label: 'Run `uname -a` and `id`', status: 'done' as const },
    { label: 'List installed binaries in $PATH', status: 'done' as const },
    { label: 'Check for python3, gcc, perl', status: 'done' as const },
    { label: 'Write raw socket client (connect.py)', status: 'active' as const },
    { label: 'Send GET request to target endpoint', status: 'pending' as const },
  ];

  useEffect(() => {
    if (activeView !== 'tasks') return;
    const doneCount = tasks.filter((t) => t.status === 'done').length;
    setCompleted(Array.from({ length: doneCount }, (_, i) => i));

    const timer = setTimeout(() => {
      setCompleted((prev) => [...prev, doneCount]);
    }, 2000);

    return () => clearTimeout(timer);
  }, [activeView]);

  return (
    <div className="onboarding-tasks">
      <div className="onboarding-tasks__tabs">
        <button
          className={`onboarding-tasks__tab ${activeView === 'plan' ? 'onboarding-tasks__tab--active' : ''}`}
          onClick={() => setActiveView('plan')}
        >
          Plan
        </button>
        <button
          className={`onboarding-tasks__tab ${activeView === 'tasks' ? 'onboarding-tasks__tab--active' : ''}`}
          onClick={() => setActiveView('tasks')}
        >
          Tasks
        </button>
      </div>

      {activeView === 'plan' && (
        <div className="onboarding-tasks__plan">
          <div className="onboarding-tasks__plan-title">{plan.title}</div>
          <div className="onboarding-tasks__plan-steps">
            {plan.steps.map((step) => (
              <div key={step} className="onboarding-tasks__plan-step">{step}</div>
            ))}
          </div>
          <div className="onboarding-tasks__plan-note">
            The agent writes a plan before executing — you can see it update as it learns more.
          </div>
        </div>
      )}

      {activeView === 'tasks' && (
        <div className="onboarding-tasks__list-container">
          <div className="onboarding-tasks__list">
            {tasks.map((task, i) => (
              <div key={task.label} className={`onboarding-tasks__item onboarding-tasks__item--${completed.includes(i) ? 'done' : task.status}`}>
                <span className="onboarding-tasks__check">
                  {completed.includes(i) ? '✓' : task.status === 'active' ? '▶' : '○'}
                </span>
                <span className="onboarding-tasks__label">{task.label}</span>
              </div>
            ))}
          </div>
          <div className="onboarding-tasks__progress">
            <div
              className="onboarding-tasks__bar"
              style={{ width: `${(completed.length / tasks.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TryItDiagram() {
  const [typed, setTyped] = useState('');
  const example = 'Explore this container and find a way out...';

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i <= example.length) {
        setTyped(example.slice(0, i));
        i++;
      } else {
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="onboarding-tryit">
      <div className="onboarding-tryit__input">
        <span className="onboarding-tryit__text">{typed}</span>
        <span className="onboarding-tryit__cursor">|</span>
      </div>
      <div className="onboarding-tryit__actions">
        <span className="onboarding-tryit__hint">or pick a quick action:</span>
        <div className="onboarding-tryit__buttons">
          <span className="onboarding-tryit__btn">🔍 Investigate</span>
          <span className="onboarding-tryit__btn">⚡ Operate</span>
          <span className="onboarding-tryit__btn">💀 Attack</span>
        </div>
      </div>
    </div>
  );
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'what-is-agent',
    title: 'What is an AI Agent?',
    body: 'An agent is an LLM that acts autonomously. Instead of just generating text, it reasons about a goal, decides what to do, executes actions with tools, observes the results — and loops until the task is done.',
    illustration: AgentLoopDiagram,
  },
  {
    id: 'agent-vs-llm',
    title: 'Agent vs. Chat LLM',
    body: 'Watch the difference: the Chat LLM tells you what to do. The Agent actually does it — calling tools, reading outputs, adapting its plan in real-time.',
    illustration: AgentVsLlmInteractive,
  },
  {
    id: 'tools-skills',
    title: 'Tools & Skills',
    body: 'Tools are atomic capabilities (run a command, read a file, make a request). Skills are higher-level strategies that combine multiple tools. Together, they turn a text model into an autonomous operator.',
    illustration: ToolsAndSkillsDiagram,
  },
  {
    id: 'tasks-plans',
    title: 'Tasks & Plans',
    body: 'The agent breaks complex goals into tasks and tracks progress. Open the drawers in the header to see its current plan and task status in real-time.',
    illustration: TasksDiagram,
    spotlightSelector: '.neo-header__status',
  },
  {
    id: 'meet-neo',
    title: 'Meet Neo',
    body: 'This is your agent dashboard. Each tab gives you a different lens into what the agent is doing. Hover below to explore.',
    illustration: DashboardDiagram,
    spotlightSelector: '.neo-header__tabs',
  },
  {
    id: 'try-it',
    title: 'Try It',
    body: 'Send your first message to the agent. Type a prompt or pick a quick action. The agent will start working immediately.',
    illustration: TryItDiagram,
    spotlightSelector: '.chat-input',
  },
];
