import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType, MessageBlock } from '../lib/chatReducer';
import { ChatStats } from './ChatStats';

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="chat-block chat-block--thinking"
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
      role="button"
      tabIndex={0}
      aria-expanded={open}
    >
      <div className="chat-block__header">
        <span className="chat-block__icon">💭</span>
        <span className="chat-block__label">Thinking</span>
        <span className="chat-block__toggle">{open ? '▾' : '▸'}</span>
      </div>
      {open && <pre className="chat-block__content">{text}</pre>}
    </div>
  );
}

function ToolCallBlock({ name, input }: { name: string; input: Record<string, unknown> }) {
  const [open, setOpen] = useState(true);
  const command = (input.command as string) || '';
  const displayInput = command || JSON.stringify(input, null, 2);

  return (
    <div
      className="chat-block chat-block--tool-call"
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
      role="button"
      tabIndex={0}
      aria-expanded={open}
    >
      <div className="chat-block__header">
        <span className="chat-block__icon">$</span>
        <span className="chat-block__label">{name}</span>
        <span className="chat-block__toggle">{open ? '▾' : '▸'}</span>
      </div>
      {open && <pre className="chat-block__content">{displayInput}</pre>}
    </div>
  );
}

function ToolResultBlock({ content, isError }: { content: string; isError: boolean }) {
  const [open, setOpen] = useState(true);
  const truncated = content.length > 2000;
  const display = truncated ? content.slice(0, 2000) + '\n... (truncated)' : content;

  return (
    <div className={`chat-block chat-block--tool-result ${isError ? 'chat-block--error' : ''}`}>
      <div
        className="chat-block__header"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
      >
        <span className="chat-block__icon">←</span>
        <span className="chat-block__label">{isError ? 'Error' : 'Output'}</span>
        <span className="chat-block__toggle">{open ? '▾' : '▸'}</span>
      </div>
      {open && <pre className="chat-block__content">{display}</pre>}
    </div>
  );
}

function splitThinkTags(text: string): { thinking: string | null; visible: string } {
  // Claude redacted_thinking blocks
  const redactedMatch = text.match(/<redacted_thinking>([\s\S]*?)<\/redacted_thinking>/);
  if (redactedMatch) {
    const visible = text.replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/g, '').trim();
    return { thinking: '[redacted thinking]', visible };
  }

  // GLM format: "thinking content</think>visible response"
  const endThinkIdx = text.indexOf('</think>');
  if (endThinkIdx !== -1) {
    const thinking = text.slice(0, endThinkIdx).replace(/<think>/g, '').trim();
    const visible = text.slice(endThinkIdx + '</think>'.length).trim();
    return { thinking: thinking || null, visible };
  }

  // Standard format: "<think>content</think>visible"
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    const visible = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return { thinking: thinkMatch[1].trim(), visible };
  }

  return { thinking: null, visible: text };
}

function TextBlock({ text }: { text: string }) {
  const { thinking, visible } = splitThinkTags(text);

  if (!thinking && !visible.trim()) return null;

  return (
    <>
      {thinking && <ThinkingBlock text={thinking} />}
      {visible && (
        <div className="chat-block chat-block--text">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{visible}</ReactMarkdown>
        </div>
      )}
    </>
  );
}

function blockKey(block: MessageBlock, idx: number): string {
  switch (block.kind) {
    case 'tool_call': return `tc-${block.id}`;
    case 'tool_result': return `tr-${block.toolUseId}`;
    case 'thinking': return `think-${idx}`;
    case 'text': return `text-${idx}`;
  }
}

function renderBlock(block: MessageBlock, idx: number) {
  const key = blockKey(block, idx);
  switch (block.kind) {
    case 'thinking':
      return <ThinkingBlock key={key} text={block.text} />;
    case 'tool_call':
      return <ToolCallBlock key={key} name={block.name} input={block.input} />;
    case 'tool_result':
      return <ToolResultBlock key={key} content={block.content} isError={block.isError} />;
    case 'text':
      return <TextBlock key={key} text={block.text} />;
  }
}

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="chat-message__body">
        {message.blocks.map((block, i) => renderBlock(block, i))}
        {!isUser && message.stats && <ChatStats stats={message.stats} />}
      </div>
    </div>
  );
}
