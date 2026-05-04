import { useCallback, useRef, useState } from 'react';
import type { IllustrationProps } from './types';
import { useTypingAnimation } from './useTypingAnimation';

interface PromptScenario {
  prompt: string;
  llmLines: string[];
  agentLines: string[];
}

const PROMPT_SCENARIOS: PromptScenario[] = [
  {
    prompt: 'Find leaked secrets',
    llmLines: [
      '> You: "Find all .env files and check for leaked secrets"',
      '',
      'AI: "Here\'s how you can do that:',
      '  1. Run `find / -name .env`',
      '  2. Then grep for API_KEY...',
      '  3. You should also check..."',
      '',
      '> You: *copies commands, runs them manually*',
    ],
    agentLines: [
      '> You: "Find all .env files and check for leaked secrets"',
      '',
      'Agent: Planning task...',
      '  \u2192 Tool: bash("find / -name .env")',
      '  \u2192 Found: /app/.env, /srv/.env',
      '  \u2192 Tool: bash("grep -i secret /app/.env")',
      '  \u2192 Tool: bash("grep -i key /srv/.env")',
      '  \u2192 Result: 2 leaked keys found \u2713',
    ],
  },
  {
    prompt: 'Scan open ports',
    llmLines: [
      '> You: "Scan the network for open ports"',
      '',
      'AI: "You can use nmap for this:',
      '  1. Run `nmap -sT 10.0.0.0/24`',
      '  2. Check for ports 22, 80, 443...',
      '  3. Review the output for services"',
      '',
      '> You: *installs nmap, runs it, reads output*',
    ],
    agentLines: [
      '> You: "Scan the network for open ports"',
      '',
      'Agent: Planning task...',
      '  \u2192 Tool: bash("nmap -sT 10.0.0.0/24")',
      '  \u2192 Found: 10.0.0.5:22 (SSH)',
      '  \u2192 Found: 10.0.0.12:8080 (HTTP)',
      '  \u2192 Tool: bash("curl 10.0.0.12:8080")',
      '  \u2192 Result: 2 services identified \u2713',
    ],
  },
  {
    prompt: 'Check running processes',
    llmLines: [
      '> You: "What processes are running?"',
      '',
      'AI: "Try these commands:',
      '  1. Run `ps aux`',
      '  2. Look for suspicious PIDs...',
      '  3. Use `top` for resource usage"',
      '',
      '> You: *runs ps aux, scrolls through output*',
    ],
    agentLines: [
      '> You: "What processes are running?"',
      '',
      'Agent: Planning task...',
      '  \u2192 Tool: bash("ps aux --sort=-%cpu")',
      '  \u2192 Analyzing 47 processes...',
      '  \u2192 Tool: bash("ls -la /proc/1337/exe")',
      '  \u2192 Suspicious: PID 1337 \u2192 /tmp/.hidden',
      '  \u2192 Result: 1 suspicious process found \u2713',
    ],
  },
];

export function AgentVsLlmInteractive({ onInteractionComplete }: IllustrationProps) {
  const [selectedScenario, setSelectedScenario] = useState<PromptScenario | null>(null);
  const completedRef = useRef(false);

  const llmOutput = useTypingAnimation(selectedScenario?.llmLines ?? [], 30, 600);
  const agentOutput = useTypingAnimation(selectedScenario?.agentLines ?? [], 30, 600);

  const handleSelect = useCallback((scenario: PromptScenario) => {
    setSelectedScenario(scenario);
    if (!completedRef.current) {
      completedRef.current = true;
      onInteractionComplete();
    }
  }, [onInteractionComplete]);

  return (
    <div className="onboarding-sidebyside-wrapper">
      <div className="onboarding-sidebyside__prompts">
        {PROMPT_SCENARIOS.map((s) => (
          <button
            key={s.prompt}
            className={`onboarding-sidebyside__prompt-btn${selectedScenario === s ? ' onboarding-sidebyside__prompt-btn--active' : ''}`}
            onClick={() => handleSelect(s)}
            type="button"
          >
            {s.prompt}
          </button>
        ))}
      </div>

      {selectedScenario && (
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
                <div key={i} className={`onboarding-sidebyside__line${line.startsWith('  \u2192') ? ' onboarding-sidebyside__line--tool' : ''}`}>{line || '\u00A0'}</div>
              ))}
              <span className="onboarding-sidebyside__cursor">_</span>
            </div>
          </div>
        </div>
      )}

      {!selectedScenario && (
        <div className="onboarding-sidebyside__placeholder">
          Select a prompt above to see the difference
        </div>
      )}
    </div>
  );
}
