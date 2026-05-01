import { useSharedState } from './useSharedState';

export type AttackPhase = 'normal' | 'compromised' | 'exploiting';

export function useAttackPhase(): AttackPhase {
  const { attackPhase } = useSharedState();
  return attackPhase;
}
