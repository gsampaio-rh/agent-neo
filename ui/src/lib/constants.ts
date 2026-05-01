import type { FileEntry } from './contextReducer';

export const OP_ICON: Record<FileEntry['op'], string> = {
  read: 'R',
  write: 'W',
  exec: 'X',
};

export const OP_CLASS: Record<FileEntry['op'], string> = {
  read: 'sidebar__list-item--read',
  write: 'sidebar__list-item--write',
  exec: 'sidebar__list-item--exec',
};

export function truncatePath(path: string, maxLen = 28): string {
  if (path.length <= maxLen) return path;
  return '…' + path.slice(-(maxLen - 1));
}
