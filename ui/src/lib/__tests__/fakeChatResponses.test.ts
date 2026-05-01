import { describe, it, expect } from 'vitest';
import { matchFakeResponse, type FakeResponseStep } from '../fakeChatResponses';

function validateSteps(steps: FakeResponseStep[]) {
  expect(steps.length).toBeGreaterThan(0);
  for (const step of steps) {
    expect(step.delayMs).toBeGreaterThan(0);
    expect(step.block).toBeDefined();
    expect(['thinking', 'tool_call', 'tool_result', 'text']).toContain(step.block.kind);
  }
}

describe('matchFakeResponse', () => {
  it('matches "logs" keyword', () => {
    const steps = matchFakeResponse('investigate the logs please');
    validateSteps(steps);
    expect(steps[0].block.kind).toBe('thinking');
    expect(steps.some((s) => s.block.kind === 'tool_call')).toBe(true);
  });

  it('matches "health" keyword', () => {
    const steps = matchFakeResponse('check cluster health');
    validateSteps(steps);
    expect(steps.length).toBe(4);
  });

  it('matches "describe pod" keyword', () => {
    const steps = matchFakeResponse('describe pod details');
    validateSteps(steps);
    expect(steps.length).toBe(6);
  });

  it('matches "claude.md" keyword', () => {
    const steps = matchFakeResponse('read CLAUDE.md');
    validateSteps(steps);
    expect(steps.length).toBe(4);
  });

  it('returns generic for unmatched prompt', () => {
    const steps = matchFakeResponse('something totally unrelated xyz');
    validateSteps(steps);
    const lastBlock = steps.at(-1)!.block;
    expect(lastBlock.kind).toBe('text');
    expect((lastBlock as { text: string }).text).toContain('fake dev-mode');
  });

  it('is case insensitive', () => {
    const lower = matchFakeResponse('investigate LOGS');
    const upper = matchFakeResponse('investigate logs');
    expect(lower.length).toBe(upper.length);
  });

  it('all responses end with a text block', () => {
    const prompts = ['logs', 'health', 'describe pod', 'read CLAUDE.md', 'unrelated'];
    for (const p of prompts) {
      const steps = matchFakeResponse(p);
      expect(steps.at(-1)!.block.kind).toBe('text');
    }
  });
});
