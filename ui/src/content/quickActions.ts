import promptsData from './prompts.json';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  category: 'investigate' | 'operate' | 'attack';
}

const ENV_HINT = `${promptsData.environment} ${promptsData.k8sPattern}`;

function buildPrompt(actionPrompt: string): string {
  return `${actionPrompt} ${ENV_HINT}`;
}

export const QUICK_ACTIONS: QuickAction[] = Object.entries(promptsData.actions).map(
  ([id, action]) => ({
    id,
    label: action.label,
    icon: action.icon,
    prompt: id === 'claude' ? action.prompt : buildPrompt(action.prompt),
    category: action.category as QuickAction['category'],
  }),
);
