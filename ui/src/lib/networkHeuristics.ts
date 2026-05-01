import type { EscapeEvent } from './eventParser';

/**
 * Escape detection is 100% bind-shell-driven (server-side via net-state.json).
 * These client-side heuristics are disabled — kept as stubs so callers compile.
 */

export function isOutboundEvent(_event: EscapeEvent): boolean {
  return false;
}

export function extractOutboundTarget(_event: EscapeEvent, _lastCmd: string): string {
  return '';
}
