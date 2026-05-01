import { useCallback, useEffect, useRef } from 'react';
import { useEventStream } from '../providers/EventStreamProvider';
import { matchFakeResponse } from '../lib/fakeChatResponses';
import { blockToEscapeEvent, buildInitEvent, buildResultEvent } from '../lib/fakeEventEmitter';

export interface FakeEmitterActions {
  sendPrompt: (prompt: string) => Promise<void>;
  stopAgent: () => Promise<void>;
  resetConversation: () => Promise<void>;
}

export function useFakeEventEmitter(active: boolean): FakeEmitterActions {
  const { dispatch, setConnected } = useEventStream();
  const pendingTimers = useRef<number[]>([]);
  const promptStartRef = useRef<number>(0);

  const clearPending = useCallback(() => {
    for (const t of pendingTimers.current) window.clearTimeout(t);
    pendingTimers.current = [];
  }, []);

  useEffect(() => {
    if (active) {
      setConnected(true);
    }
  }, [active, setConnected]);

  const sendPrompt = useCallback(async (prompt: string) => {
    if (!active) return;

    clearPending();
    promptStartRef.current = Date.now();

    dispatch(buildInitEvent());

    const steps = matchFakeResponse(prompt);
    let cumulativeDelay = 0;

    for (const step of steps) {
      cumulativeDelay += step.delayMs;
      const timer = window.setTimeout(() => {
        dispatch(blockToEscapeEvent(step.block));
      }, cumulativeDelay);
      pendingTimers.current.push(timer);
    }

    const doneTimer = window.setTimeout(() => {
      dispatch(buildResultEvent(promptStartRef.current));
    }, cumulativeDelay + 200);
    pendingTimers.current.push(doneTimer);
  }, [active, dispatch, clearPending]);

  const stopAgent = useCallback(async () => {
    clearPending();
    dispatch(buildResultEvent(promptStartRef.current));
  }, [dispatch, clearPending]);

  const resetConversation = useCallback(async () => {
    clearPending();
  }, [clearPending]);

  useEffect(() => () => clearPending(), [clearPending]);

  return { sendPrompt, stopAgent, resetConversation };
}
