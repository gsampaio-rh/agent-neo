import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatView } from '../ChatView';
import type { ChatState } from '../../lib/chatReducer';
import { INITIAL_SESSION_STATS } from '../../lib/chatReducer';
import { INITIAL_CONTEXT } from '../../lib/contextReducer';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const defaultContext = { ...INITIAL_CONTEXT };

function makeChatState(overrides: Partial<ChatState> = {}): ChatState {
  return { messages: [], agentStatus: 'idle', connected: true, resetting: false, llmAvailable: true, sessionStats: { ...INITIAL_SESSION_STATS }, ...overrides };
}

describe('ChatView', () => {
  it('renders empty state placeholder when no messages', () => {
    render(
      <ChatView chatState={makeChatState()} context={defaultContext} onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} />,
    );
    expect(screen.getByText(/Send a prompt to start a Claude Code session/)).toBeInTheDocument();
  });

  it('renders messages when chatState has messages', () => {
    const chatState = makeChatState({
      messages: [
        { id: 'u1', role: 'user', blocks: [{ kind: 'text', text: 'Hello agent' }], timestamp: '' },
        { id: 'a1', role: 'assistant', blocks: [{ kind: 'text', text: 'Hi there' }], timestamp: '' },
      ],
    });
    render(
      <ChatView chatState={chatState} context={defaultContext} onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} />,
    );
    expect(screen.getByText('Hello agent')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(screen.queryByText(/Send a prompt to start/)).not.toBeInTheDocument();
  });

  it('shows typing indicator when running', () => {
    render(
      <ChatView chatState={makeChatState({ agentStatus: 'running' })} context={defaultContext} onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} />,
    );
    const typingAvatar = document.querySelector('.chat-typing__avatar');
    expect(typingAvatar).toBeInTheDocument();
  });

  it('hides typing indicator when idle', () => {
    render(
      <ChatView chatState={makeChatState({ agentStatus: 'idle' })} context={defaultContext} onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} />,
    );
    const typingAvatar = document.querySelector('.chat-typing__avatar');
    expect(typingAvatar).not.toBeInTheDocument();
  });

  it('displays agent status in sidebar', () => {
    render(
      <ChatView chatState={makeChatState({ agentStatus: 'running' })} context={defaultContext} onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} />,
    );
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });

  it('disables quick actions when running', () => {
    render(
      <ChatView chatState={makeChatState({ agentStatus: 'running' })} context={defaultContext} onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} />,
    );
    const quickActionBtns = document.querySelectorAll('.quick-actions__btn');
    for (const btn of quickActionBtns) {
      expect(btn).toBeDisabled();
    }
  });
});
