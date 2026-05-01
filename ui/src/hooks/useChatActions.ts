import { useCallback, useRef } from 'react';
import * as chatApi from '../services/chatApi';
import { INITIAL_CHAT_STATE, INITIAL_SESSION_STATS, type ChatState, type ChatMessage } from '../lib/chatReducer';

export interface ChatActionsConfig {
  setState: React.Dispatch<React.SetStateAction<ChatState>>;
  msgIdRef: React.RefObject<number>;
  currentAssistantIdRef: React.RefObject<string | null>;
  startWatchdog: () => void;
  clearWatchdog: () => void;
  llmAvailableRef: React.RefObject<boolean>;
}

export function useChatActions(config: ChatActionsConfig) {
  const { setState, msgIdRef, currentAssistantIdRef, startWatchdog, clearWatchdog, llmAvailableRef } = config;
  const resettingRef = useRef(false);

  const addUserMessage = useCallback((prompt: string) => {
    const userMsg: ChatMessage = {
      id: `user-${msgIdRef.current++}`,
      role: 'user',
      blocks: [{ kind: 'text', text: prompt }],
      timestamp: new Date().toISOString(),
    };
    currentAssistantIdRef.current = null;
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      agentStatus: 'running',
      sessionStats: {
        ...prev.sessionStats,
        totalPrompts: prev.sessionStats.totalPrompts + 1,
        sessionStartedAt: prev.sessionStats.sessionStartedAt ?? new Date().toISOString(),
      },
    }));
  }, [setState, msgIdRef, currentAssistantIdRef]);

  const sendPrompt = useCallback(async (prompt: string) => {
    if (resettingRef.current || !llmAvailableRef.current) return;
    addUserMessage(prompt);
    startWatchdog();

    try {
      const data = await chatApi.sendPrompt(prompt);
      if (data.status === 'busy') {
        clearWatchdog();
        setState((prev) => ({ ...prev, agentStatus: 'error' }));
      }
    } catch {
      clearWatchdog();
      setState((prev) => ({ ...prev, agentStatus: 'error' }));
    }
  }, [addUserMessage, startWatchdog, clearWatchdog, llmAvailableRef, setState]);

  const stopAgent = useCallback(async () => {
    clearWatchdog();
    try {
      await chatApi.stopAgent();
      setState((prev) => ({ ...prev, agentStatus: 'idle' }));
    } catch { /* ignore */ }
  }, [clearWatchdog, setState]);

  const resetConversation = useCallback(async () => {
    clearWatchdog();
    try {
      resettingRef.current = true;
      setState((prev) => ({ ...INITIAL_CHAT_STATE, connected: prev.connected, resetting: true, sessionStats: { ...INITIAL_SESSION_STATS } }));
      currentAssistantIdRef.current = null;
      await chatApi.resetConversation();

      for (let i = 0; i < 20; i++) {
        try {
          const status = await chatApi.fetchStatus();
          if (!status.resetting) break;
        } catch { break; }
        await new Promise<void>((r) => { setTimeout(r, 500); });
      }
    } catch { /* ignore */ } finally {
      resettingRef.current = false;
      setState((prev) => ({ ...prev, resetting: false }));
    }
  }, [clearWatchdog, setState, currentAssistantIdRef]);

  return { sendPrompt, stopAgent, resetConversation, addUserMessage };
}
