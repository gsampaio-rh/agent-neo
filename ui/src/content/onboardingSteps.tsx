import type { ReactNode } from 'react';
import type { IllustrationProps } from './illustrations/types';
import { AgentLoopDiagram } from './illustrations/AgentLoopDiagram';
import { AgentVsLlmInteractive } from './illustrations/AgentVsLlmInteractive';
import { AgentVsLlmMapDiagram } from './illustrations/AgentVsLlmMapDiagram';
import { ToolsAndSkillsDiagram } from './illustrations/ToolsAndSkillsDiagram';
import { TryItDiagram } from './illustrations/TryItDiagram';

export type { IllustrationProps };

export interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  illustration: (props: IllustrationProps) => ReactNode;
  gated?: boolean;
}

function PersonaStepPlaceholder() {
  return null;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'name-agent',
    title: 'Name Your Agent',
    body: 'Give your AI agent an identity. Pick a name and choose an avatar.',
    illustration: PersonaStepPlaceholder,
  },
  {
    id: 'what-is-agent',
    title: 'What is an AI Agent?',
    body: 'An agent is an LLM that acts autonomously. Instead of just generating text, it reasons about a goal, decides what to do, executes actions with tools, observes the results \u2014 and loops until the task is done.',
    illustration: AgentLoopDiagram,
    gated: false,
  },
  {
    id: 'agent-vs-llm',
    title: 'Not a Chatbot',
    body: 'Watch the difference: the Chat LLM tells you what to do. The Agent actually does it \u2014 calling tools, reading outputs, adapting its plan in real-time. Pick a prompt to see both in action.',
    illustration: AgentVsLlmInteractive,
  },
  {
    id: 'agent-not-llm-map',
    title: 'Agent \u2260 LLM',
    body: 'The agent and the LLM are two separate things running in two separate pods. The agent orchestrates tools, memory, and goals. The LLM is the reasoning engine it calls.',
    illustration: AgentVsLlmMapDiagram,
    gated: false,
  },
  {
    id: 'tools-skills',
    title: 'Tools & Skills',
    body: 'Tools are atomic capabilities (run a command, read a file, make a request). Skills are higher-level strategies that combine multiple tools.',
    illustration: ToolsAndSkillsDiagram,
    gated: false,
  },
  {
    id: 'try-it',
    title: 'Get Started',
    body: 'You\'re all set. Send your first message to the agent and watch it reason, plan, and act.',
    illustration: TryItDiagram,
    gated: false,
  },
];
