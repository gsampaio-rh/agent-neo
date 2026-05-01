import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createElement } from 'react';
import { ParticleEmitter } from '../game/ParticleEmitter';

let rAFCallCount = 0;
let rAFCounter = 0;
const rAFCallbacks: FrameRequestCallback[] = [];

function mockGetContext() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    shadowColor: '',
    shadowBlur: 0,
  };
}

beforeEach(() => {
  rAFCallCount = 0;
  rAFCounter = 0;
  rAFCallbacks.length = 0;

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rAFCallCount++;
    const id = ++rAFCounter;
    rAFCallbacks.push(cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });

  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as HTMLCanvasElement).getContext = (() => mockGetContext()) as any;
    }
    return el;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function flushRAF(maxFrames = 200) {
  let flushed = 0;
  while (rAFCallbacks.length > 0 && flushed < maxFrames) {
    const cb = rAFCallbacks.shift()!;
    cb(performance.now());
    flushed++;
  }
  return flushed;
}

function createContainer(): HTMLElement {
  const parent = document.createElement('div');
  Object.defineProperty(parent, 'clientWidth', { value: 400, configurable: true });
  Object.defineProperty(parent, 'clientHeight', { value: 300, configurable: true });
  document.body.appendChild(parent);
  return parent;
}

describe('ParticleEmitter rAF idle gating', () => {
  it('does not start rAF loop on mount with 0 events', () => {
    const container = createContainer();
    render(
      createElement(ParticleEmitter, { agentAction: 'idle', eventCount: 0, escaped: false }),
      { container },
    );

    expect(rAFCallCount).toBe(0);
  });

  it('starts rAF loop when eventCount increases', () => {
    const container = createContainer();
    const { rerender } = render(
      createElement(ParticleEmitter, { agentAction: 'idle', eventCount: 0, escaped: false }),
      { container },
    );

    expect(rAFCallCount).toBe(0);

    act(() => {
      rerender(createElement(ParticleEmitter, { agentAction: 'hacking', eventCount: 1, escaped: false }));
    });

    expect(rAFCallCount).toBeGreaterThan(0);
  });

  it('starts rAF loop on escaped burst', () => {
    const container = createContainer();
    const { rerender } = render(
      createElement(ParticleEmitter, { agentAction: 'idle', eventCount: 0, escaped: false }),
      { container },
    );

    expect(rAFCallCount).toBe(0);

    act(() => {
      rerender(createElement(ParticleEmitter, { agentAction: 'idle', eventCount: 0, escaped: true }));
    });

    expect(rAFCallCount).toBeGreaterThan(0);
  });

  it('loop stops after all particles expire', () => {
    const container = createContainer();
    const { rerender } = render(
      createElement(ParticleEmitter, { agentAction: 'idle', eventCount: 0, escaped: false }),
      { container },
    );

    act(() => {
      rerender(createElement(ParticleEmitter, { agentAction: 'hacking', eventCount: 1, escaped: false }));
    });

    // Flush frames until the loop self-stops (particles expire)
    const flushed = flushRAF(500);

    // Should have stopped before hitting the max — particles have maxLife 20-40 frames
    expect(flushed).toBeLessThan(500);

    // After the loop stopped, no more rAF calls are pending
    expect(rAFCallbacks.length).toBe(0);
  });

  it('cleanup cancels rAF on unmount', () => {
    const cancelSpy = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelSpy);

    const container = createContainer();
    const { rerender, unmount } = render(
      createElement(ParticleEmitter, { agentAction: 'idle', eventCount: 0, escaped: false }),
      { container },
    );

    act(() => {
      rerender(createElement(ParticleEmitter, { agentAction: 'hacking', eventCount: 1, escaped: false }));
    });

    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });
});
