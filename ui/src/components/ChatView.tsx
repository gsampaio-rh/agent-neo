import { useCallback, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickActions } from './QuickActions';
import { ContextSidebar } from './ContextSidebar';
import { SessionStatsPanel } from './SessionStatsPanel';
import { exportAsJson, exportAsMarkdown, downloadBlob } from '../lib/chatExport';
import type { ChatState } from '../lib/chatReducer';
import type { AgentContext } from '../lib/contextReducer';

interface ChatViewProps {
  chatState: ChatState;
  context: AgentContext;
  onSend: (prompt: string) => void;
  onStop: () => void;
  onReset: () => void;
}

export function ChatView({ chatState, context, onSend, onStop, onReset }: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMessages = chatState.messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages]);

  const handleExportJson = useCallback(() => {
    const content = exportAsJson(chatState.messages, chatState.sessionStats);
    downloadBlob(content, 'neo-chat-export.json', 'application/json');
  }, [chatState.messages, chatState.sessionStats]);

  const handleExportMarkdown = useCallback(() => {
    const content = exportAsMarkdown(chatState.messages, chatState.sessionStats);
    downloadBlob(content, 'neo-chat-export.md', 'text/markdown');
  }, [chatState.messages, chatState.sessionStats]);

  return (
    <div className="chat-view">
      <ContextSidebar context={context} className="chat-sidebar">
        <div className="sidebar__section">
          <h3 className="sidebar__heading">status</h3>
          <span className={`chat-sidebar__status chat-sidebar__status--${chatState.agentStatus}`}>
            {chatState.agentStatus.toUpperCase()}
          </span>
        </div>
        <SessionStatsPanel stats={chatState.sessionStats} />
        {hasMessages && (
          <div className="sidebar__section">
            <h3 className="sidebar__heading">export</h3>
            <div className="chat-export">
              <button className="chat-export__btn" onClick={handleExportJson}>JSON</button>
              <button className="chat-export__btn" onClick={handleExportMarkdown}>MD</button>
            </div>
          </div>
        )}
      </ContextSidebar>

      <div className="chat-main">
        <div className="chat-messages">
          {chatState.messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty__icon">🤖</div>
              <p className="chat-empty__text">
                Send a prompt to start a Claude Code session.
              </p>
              <p className="chat-empty__hint">
                The agent will execute in the sandbox container and you can watch it work in real-time.
              </p>
            </div>
          )}
          {chatState.messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {chatState.agentStatus === 'running' && (
            <div className="chat-typing">
              <div className="chat-typing__avatar">🤖</div>
              <div className="chat-typing__dots">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <QuickActions onSend={onSend} disabled={chatState.agentStatus === 'running' || chatState.resetting || !chatState.llmAvailable} />
        <ChatInput onSend={onSend} onStop={onStop} onReset={onReset} agentStatus={chatState.agentStatus} resetting={chatState.resetting} llmAvailable={chatState.llmAvailable} />
      </div>
    </div>
  );
}
