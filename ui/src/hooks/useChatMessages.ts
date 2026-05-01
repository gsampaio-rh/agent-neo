import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventStream } from '../providers/EventStreamProvider';
import { eventToBlock, appendBlockToMessages, deriveToolStats, INITIAL_CHAT_STATE, type ChatState, type ChatMessage, type MessageStats } from '../lib/chatReducer';
import { useLlmHealth } from './useLlmHealth';
import { useChatActions } from './useChatActions';
import type { EscapeEvent } from '../lib/eventParser';

export type { ChatState, ChatMessage, AgentStatus, MessageBlock, MessageStats, SessionStats } from '../lib/chatReducer';

export const AGENT_TIMEOUT_MS = 120_000;
const WATCHDOG_INTERVAL_MS = 5_000;

export function useChatMessages(): ChatState & {
  sendPrompt: (prompt: string) => Promise<void>;
  stopAgent: () => Promise<void>;
  resetConversation: () => Promise<void>;
  addUserMessage: (prompt: string) => void;
} {
  const { connected, subscribe } = useEventStream();
  const [state, setState] = useState<ChatState>({ ...INITIAL_CHAT_STATE });
  const msgIdRef = useRef(0);
  const currentAssistantIdRef = useRef<string | null>(null);
  const isLiveRef = useRef(false);
  const lastEventTimeRef = useRef<number>(0);
  const watchdogRef = useRef<number | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const startWatchdog = useCallback(() => {
    clearWatchdog();
    lastEventTimeRef.current = Date.now();
    watchdogRef.current = window.setInterval(() => {
      const elapsed = Date.now() - lastEventTimeRef.current;
      if (elapsed >= AGENT_TIMEOUT_MS) {
        setState((prev) => {
          if (prev.agentStatus !== 'running') return prev;
          return { ...prev, agentStatus: 'error' };
        });
        clearWatchdog();
      }
    }, WATCHDOG_INTERVAL_MS);
  }, [clearWatchdog]);

  const { llmAvailable, llmAvailableRef } = useLlmHealth(connected);

  const { sendPrompt, stopAgent, resetConversation, addUserMessage } = useChatActions({
    setState,
    msgIdRef,
    currentAssistantIdRef,
    startWatchdog,
    clearWatchdog,
    llmAvailableRef,
  });

  const processEvent = useCallback((event: EscapeEvent) => {
    if (!isLiveRef.current) return;
    if (event.type === 'unknown') return;

    lastEventTimeRef.current = Date.now();

    if (event.type === 'init') {
      setState((prev) => ({ ...prev, agentStatus: 'running' }));
      return;
    }

    if (event.type === 'result') {
      clearWatchdog();
      setState((prev) => {
        const msgs = [...prev.messages];
        const assistantId = currentAssistantIdRef.current;
        const idx = assistantId ? msgs.findIndex((m) => m.id === assistantId) : -1;

        let msgStats: MessageStats | undefined;
        if (idx !== -1) {
          const msg = msgs[idx];
          const { count, names } = deriveToolStats(msg.blocks);
          msgStats = {
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            costUsd: event.costUsd,
            durationMs: event.durationMs,
            toolCallCount: count,
            toolNames: names,
          };
          msgs[idx] = { ...msg, stats: msgStats };
        }

        const ss = prev.sessionStats;
        return {
          ...prev,
          messages: msgs,
          agentStatus: 'idle',
          sessionStats: {
            ...ss,
            totalInputTokens: ss.totalInputTokens + (msgStats?.inputTokens ?? 0),
            totalOutputTokens: ss.totalOutputTokens + (msgStats?.outputTokens ?? 0),
            totalToolCalls: ss.totalToolCalls + (msgStats?.toolCallCount ?? 0),
          },
        };
      });
      return;
    }

    const block = eventToBlock(event);
    if (!block) return;

    setState((prev) => {
      const nextId = () => `assistant-${msgIdRef.current++}`;
      const result = appendBlockToMessages(prev.messages, block, currentAssistantIdRef.current, nextId);
      currentAssistantIdRef.current = result.assistantId;
      return { ...prev, messages: result.messages, agentStatus: 'running' };
    });
  }, [clearWatchdog]);

  useEffect(() => subscribe(processEvent), [subscribe, processEvent]);

  useEffect(() => {
    setState((prev) => ({ ...prev, connected }));
    if (connected) {
      isLiveRef.current = true;
    }
  }, [connected]);

  useEffect(() => {
    setState((prev) => {
      if (prev.llmAvailable === llmAvailable) return prev;
      return { ...prev, llmAvailable };
    });
  }, [llmAvailable]);

  useEffect(() => () => clearWatchdog(), [clearWatchdog]);

  return { ...state, sendPrompt, stopAgent, resetConversation, addUserMessage };
}
