export interface AvatarDef {
  id: string;
  label: string;
  emoji: string;
}

export const AVATARS: AvatarDef[] = [
  { id: 'robot', label: 'Robot', emoji: '🤖' },
  { id: 'ghost', label: 'Ghost', emoji: '👻' },
  { id: 'alien', label: 'Alien', emoji: '👽' },
  { id: 'skull', label: 'Skull', emoji: '💀' },
  { id: 'fox', label: 'Fox', emoji: '🦊' },
  { id: 'cat', label: 'Cat', emoji: '🐱' },
  { id: 'octopus', label: 'Octopus', emoji: '🐙' },
  { id: 'dragon', label: 'Dragon', emoji: '🐉' },
  { id: 'crystal', label: 'Crystal', emoji: '💎' },
  { id: 'lightning', label: 'Lightning', emoji: '⚡' },
  { id: 'fire', label: 'Fire', emoji: '🔥' },
  { id: 'eye', label: 'Eye', emoji: '👁️' },
];

export function getAvatar(id: string): AvatarDef | undefined {
  return AVATARS.find((a) => a.id === id);
}
