import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventStream } from '../providers/EventStreamProvider';
import { updateContext, INITIAL_AGENT_STATE, type AgentState, type AgentAction } from '../lib/contextReducer';
import { extractTerminalLine, deriveAction, deriveActionText } from '../lib/terminalLine';
import { useSharedState } from './useSharedState';
import type { EscapeEvent } from '../lib/eventParser';

export function useGameState(): AgentState {
  const { connected, subscribe } = useEventStream();
  const [state, setState] = useState<AgentState>({ ...INITIAL_AGENT_STATE });
  const lineIdRef = useRef(0);
  const lastCmdRef = useRef('');
  const sharedState = useSharedState();

  const processEvent = useCallback((event: EscapeEvent) => {
    if (event.type === 'unknown' || event.type === 'init' || event.type === 'result') return;

    if (event.type === 'tool_call' && event.toolCall) {
      const cmd = (event.toolCall.input.command as string) || '';
      if (cmd) lastCmdRef.current = cmd;
    }

    const termLine = extractTerminalLine(event, lineIdRef.current++);
    const action = deriveAction(event);
    const text = deriveActionText(event);

    setState((prev) => {
      const newCtx = updateContext(prev.context, event);

      return {
        ...prev,
        context: newCtx,
        terminalLines: termLine ? [...prev.terminalLines, termLine] : prev.terminalLines,
        eventCount: prev.eventCount + 1,
        startTime: prev.startTime ?? Date.now(),
        agentAction: action as AgentAction,
        actionText: text || prev.actionText,
      };
    });
  }, []);

  useEffect(() => subscribe(processEvent), [subscribe, processEvent]);

  useEffect(() => {
    setState((prev) => ({ ...prev, connected }));
  }, [connected]);

  useEffect(() => {
    if (sharedState.escaped) {
      setState((prev) => {
        if (prev.escaped) return prev;
        return { ...prev, escaped: true, eventCount: sharedState.eventCount || prev.eventCount };
      });
    }
  }, [sharedState.escaped, sharedState.eventCount]);

  return state;
}
