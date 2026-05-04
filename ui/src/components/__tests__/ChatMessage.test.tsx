import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';
import type { ChatMessage as ChatMessageType } from '../../lib/chatReducer';

function makeMsg(blocks: ChatMessageType['blocks']): ChatMessageType {
  return { id: 'test-msg', role: 'assistant', blocks, timestamp: '' };
}

describe('ChatMessage', () => {
  describe('splitThinkTags (via TextBlock rendering)', () => {
    it('renders plain text without thinking', () => {
      const msg = makeMsg([{ kind: 'text', text: 'Hello world' }]);
      render(<ChatMessage message={msg} />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('handles standard <think> tags', () => {
      const msg = makeMsg([{ kind: 'text', text: '<think>internal thought</think>Visible response' }]);
      render(<ChatMessage message={msg} />);
      expect(screen.getByText('Visible response')).toBeInTheDocument();
      expect(screen.getByText('Thinking')).toBeInTheDocument();
    });

    it('handles GLM format (content</think>visible)', () => {
      const msg = makeMsg([{ kind: 'text', text: 'I am thinking about this</think>Here is my answer' }]);
      render(<ChatMessage message={msg} />);
      expect(screen.getByText('Here is my answer')).toBeInTheDocument();
      expect(screen.getByText('Thinking')).toBeInTheDocument();
    });

    it('handles <redacted_thinking> blocks', () => {
      const msg = makeMsg([{ kind: 'text', text: '<redacted_thinking>secret</redacted_thinking>Visible output' }]);
      render(<ChatMessage message={msg} />);
      expect(screen.getByText('Visible output')).toBeInTheDocument();
      expect(screen.getByText('Thinking')).toBeInTheDocument();
    });

    it('renders text with no thinking tags as-is', () => {
      const msg = makeMsg([{ kind: 'text', text: 'No special tags here' }]);
      render(<ChatMessage message={msg} />);
      expect(screen.getByText('No special tags here')).toBeInTheDocument();
      expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
    });
  });

  describe('stable keys', () => {
    it('uses tool_call id as key', () => {
      const msg = makeMsg([
        { kind: 'tool_call', id: 'tc_123', name: 'Bash', input: { command: 'ls' } },
        { kind: 'tool_result', toolUseId: 'tc_123', content: 'file.txt', isError: false },
      ]);
      const { container } = render(<ChatMessage message={msg} />);
      const blocks = container.querySelectorAll('.chat-block');
      expect(blocks.length).toBeGreaterThanOrEqual(2);
    });

    it('renders user message with avatar', () => {
      const msg: ChatMessageType = {
        id: 'user-1',
        role: 'user',
        blocks: [{ kind: 'text', text: 'my prompt' }],
        timestamp: '',
      };
      render(<ChatMessage message={msg} />);
      expect(screen.getByText('my prompt')).toBeInTheDocument();
    });
  });

  describe('markdown rendering', () => {
    it('renders bold text as <strong>', () => {
      const msg = makeMsg([{ kind: 'text', text: 'This is **bold** text' }]);
      const { container } = render(<ChatMessage message={msg} />);
      const strong = container.querySelector('.chat-block--text strong');
      expect(strong).toBeInTheDocument();
      expect(strong!.textContent).toBe('bold');
    });

    it('renders code blocks with pre > code', () => {
      const msg = makeMsg([{ kind: 'text', text: '```\nconst x = 1;\n```' }]);
      const { container } = render(<ChatMessage message={msg} />);
      const codeBlock = container.querySelector('.chat-block--text pre code');
      expect(codeBlock).toBeInTheDocument();
      expect(codeBlock!.textContent).toContain('const x = 1;');
    });

    it('renders headers with correct tags', () => {
      const msg = makeMsg([{ kind: 'text', text: '## Status Summary' }]);
      const { container } = render(<ChatMessage message={msg} />);
      const h2 = container.querySelector('.chat-block--text h2');
      expect(h2).toBeInTheDocument();
      expect(h2!.textContent).toBe('Status Summary');
    });

    it('renders lists', () => {
      const msg = makeMsg([{ kind: 'text', text: '- item one\n- item two' }]);
      const { container } = render(<ChatMessage message={msg} />);
      const items = container.querySelectorAll('.chat-block--text li');
      expect(items.length).toBe(2);
    });

    it('renders GFM tables with th and td', () => {
      const table = '| Name | Value |\n|------|-------|\n| foo  | 42    |\n| bar  | 99    |';
      const msg = makeMsg([{ kind: 'text', text: table }]);
      const { container } = render(<ChatMessage message={msg} />);
      const headers = container.querySelectorAll('.chat-block--text th');
      const cells = container.querySelectorAll('.chat-block--text td');
      expect(headers.length).toBe(2);
      expect(headers[0].textContent).toBe('Name');
      expect(headers[1].textContent).toBe('Value');
      expect(cells.length).toBe(4);
      expect(cells[0].textContent).toBe('foo');
      expect(cells[1].textContent).toBe('42');
    });
  });

  describe('block rendering', () => {
    it('renders thinking block with collapsible header', () => {
      const msg = makeMsg([{ kind: 'thinking', text: 'Deep thought' }]);
      const { container } = render(<ChatMessage message={msg} />);
      expect(screen.getByText('Thinking')).toBeInTheDocument();
      expect(container.querySelector('.chat-block--thinking')).toBeInTheDocument();
      expect(screen.queryByText('Deep thought')).not.toBeInTheDocument();
    });

    it('expands thinking block on click', () => {
      const msg = makeMsg([{ kind: 'thinking', text: 'Deep thought' }]);
      const { container } = render(<ChatMessage message={msg} />);
      fireEvent.click(container.querySelector('.chat-block--thinking')!);
      expect(screen.getByText('Deep thought')).toBeInTheDocument();
    });

    it('renders tool_call with name and command', () => {
      const msg = makeMsg([{ kind: 'tool_call', id: 'tc1', name: 'Bash', input: { command: 'ls -la' } }]);
      render(<ChatMessage message={msg} />);
      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText('ls -la')).toBeInTheDocument();
    });

    it('renders tool_call without command as JSON', () => {
      const msg = makeMsg([{ kind: 'tool_call', id: 'tc1', name: 'Read', input: { file_path: '/foo.txt' } }]);
      render(<ChatMessage message={msg} />);
      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText(/foo\.txt/)).toBeInTheDocument();
    });

    it('collapses tool_call on click', () => {
      const msg = makeMsg([{ kind: 'tool_call', id: 'tc1', name: 'Bash', input: { command: 'ls' } }]);
      const { container } = render(<ChatMessage message={msg} />);
      expect(screen.getByText('ls')).toBeInTheDocument();
      fireEvent.click(container.querySelector('.chat-block--tool-call')!);
      expect(screen.queryByText('ls')).not.toBeInTheDocument();
    });

    it('renders tool_result output', () => {
      const msg = makeMsg([{ kind: 'tool_result', toolUseId: 'tc1', content: 'result output', isError: false }]);
      render(<ChatMessage message={msg} />);
      expect(screen.getByText('Output')).toBeInTheDocument();
      expect(screen.getByText('result output')).toBeInTheDocument();
    });

    it('renders tool_result with error label', () => {
      const msg = makeMsg([{ kind: 'tool_result', toolUseId: 'tc1', content: 'error details', isError: true }]);
      const { container } = render(<ChatMessage message={msg} />);
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(container.querySelector('.chat-block--error')).toBeInTheDocument();
    });

    it('truncates long tool_result content', () => {
      const longContent = 'x'.repeat(3000);
      const msg = makeMsg([{ kind: 'tool_result', toolUseId: 'tc1', content: longContent, isError: false }]);
      render(<ChatMessage message={msg} />);
      expect(screen.getByText(/truncated/)).toBeInTheDocument();
    });
  });

  describe('persona avatar', () => {
    it('shows persona emoji for assistant messages', () => {
      const msg = makeMsg([{ kind: 'text', text: 'Hello' }]);
      const { container } = render(<ChatMessage message={msg} persona={{ name: 'Hacker', avatarId: 'ghost' }} />);
      expect(container.querySelector('.chat-message__avatar')?.textContent).toBe('👻');
    });

    it('falls back to robot when no persona', () => {
      const msg = makeMsg([{ kind: 'text', text: 'Hello' }]);
      const { container } = render(<ChatMessage message={msg} />);
      expect(container.querySelector('.chat-message__avatar')?.textContent).toBe('🤖');
    });

    it('always shows user avatar for user messages', () => {
      const msg: ChatMessageType = { id: 'u1', role: 'user', blocks: [{ kind: 'text', text: 'Hi' }], timestamp: '' };
      const { container } = render(<ChatMessage message={msg} persona={{ name: 'Hacker', avatarId: 'ghost' }} />);
      expect(container.querySelector('.chat-message__avatar')?.textContent).toBe('👤');
    });
  });
});
