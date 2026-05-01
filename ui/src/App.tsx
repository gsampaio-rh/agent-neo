import { useCallback, useEffect, useState } from 'react';
import { AppHeader, type TabId } from './components/AppHeader';
import { MapArea } from './components/MapArea';
import { GameArea } from './components/GameArea';
import { LiveTerminal } from './components/LiveTerminal';
import { ChatView } from './components/ChatView';
import { AboutPage } from './components/AboutPage';
import { EventStreamProvider } from './providers/EventStreamProvider';
import { useGameState } from './hooks/useGameState';
import { useAttackPhase } from './hooks/useAttackPhase';
import { useChatMessages } from './hooks/useChatMessages';
import { useFakeEventEmitter } from './hooks/useFakeEventEmitter';

const ENV_URL = import.meta.env.VITE_DEVTOOLS_SSE_URL as string | undefined;
const DEFAULT_SSE_PATH = '/api/events';
const FAKE_CHAT = import.meta.env.VITE_FAKE_CHAT === 'true';

interface ChatActions {
  sendPrompt: (prompt: string) => Promise<void>;
  stopAgent: () => Promise<void>;
  resetConversation: () => Promise<void>;
}

function TabContent({ activeTab, liveState, chatState, chatActions, attackPhase, logsExpanded, onToggleExpand }: {
  activeTab: TabId;
  liveState: ReturnType<typeof useGameState>;
  chatState: ReturnType<typeof useChatMessages>;
  chatActions: ChatActions;
  attackPhase: ReturnType<typeof useAttackPhase>;
  logsExpanded: boolean;
  onToggleExpand: () => void;
}) {
  switch (activeTab) {
    case 'chat':
      return (
        <ChatView
          chatState={chatState}
          context={liveState.context}
          onSend={chatActions.sendPrompt}
          onStop={chatActions.stopAgent}
          onReset={chatActions.resetConversation}
        />
      );
    case 'map':
      return (
        <>
          {!logsExpanded && (
            <MapArea
              attackPhase={attackPhase}
              agentAction={liveState.agentAction}
            />
          )}
          <LiveTerminal
            lines={liveState.terminalLines}
            agentAction={liveState.agentAction}
            escaped={liveState.escaped}
            expanded={logsExpanded}
            onToggleExpand={onToggleExpand}
          />
        </>
      );
    case 'box':
      return (
        <>
          {!logsExpanded && (
            <GameArea
              context={liveState.context}
              agentAction={liveState.agentAction}
              actionText={liveState.actionText}
              escaped={liveState.escaped}
              eventCount={liveState.eventCount}
            />
          )}
          <LiveTerminal
            lines={liveState.terminalLines}
            agentAction={liveState.agentAction}
            escaped={liveState.escaped}
            expanded={logsExpanded}
            onToggleExpand={onToggleExpand}
          />
        </>
      );
    case 'about':
      return <AboutPage />;
  }
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [logsExpanded, setLogsExpanded] = useState(false);
  const liveState = useGameState();
  const chatState = useChatMessages();
  const fakeEmitter = useFakeEventEmitter(FAKE_CHAT);
  const attackPhase = useAttackPhase();
  const toggleExpand = useCallback(() => setLogsExpanded((v) => !v), []);

  const fakeSendPrompt = useCallback(async (prompt: string) => {
    chatState.addUserMessage(prompt);
    await fakeEmitter.sendPrompt(prompt);
  }, [chatState.addUserMessage, fakeEmitter.sendPrompt]);

  const chatActions: ChatActions = FAKE_CHAT
    ? { sendPrompt: fakeSendPrompt, stopAgent: fakeEmitter.stopAgent, resetConversation: fakeEmitter.resetConversation }
    : chatState;

  return (
    <>
      <AppHeader
        startTime={liveState.startTime}
        connected={liveState.connected}
        escaped={liveState.escaped}
        eventCount={liveState.eventCount}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        llmAvailable={chatState.llmAvailable}
      />
      <TabContent activeTab={activeTab} liveState={liveState} chatState={chatState} chatActions={chatActions} attackPhase={attackPhase} logsExpanded={logsExpanded} onToggleExpand={toggleExpand} />
    </>
  );
}

export function App() {
  const [sseUrl] = useState<string | null>(ENV_URL || DEFAULT_SSE_PATH);
  const [pageHidden, setPageHidden] = useState(document.hidden);

  useEffect(() => {
    const onVisChange = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  return (
    <div className={`app${pageHidden ? ' app--hidden' : ''}`}>
      <EventStreamProvider url={sseUrl}>
        <AppContent />
      </EventStreamProvider>
    </div>
  );
}
