import { useCallback, useRef, useState } from 'react';
import type { AgentStatus } from '../lib/chatReducer';

interface ChatInputProps {
  onSend: (prompt: string) => void;
  onStop: () => void;
  onReset: () => void;
  agentStatus: AgentStatus;
  resetting?: boolean;
  llmAvailable?: boolean;
}

export function ChatInput({ onSend, onStop, onReset, agentStatus, resetting = false, llmAvailable = true }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busy = agentStatus === 'running';
  const disabled = busy || resetting || !llmAvailable;

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    textareaRef.current?.focus();
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const containerClass = `chat-input${resetting ? ' chat-input--resetting' : ''}${!llmAvailable ? ' chat-input--llm-down' : ''}`;

  const placeholder = !llmAvailable
    ? 'LLM backend unavailable — waiting for vLLM...'
    : resetting
      ? 'Resetting session...'
      : busy
        ? 'Agent is running...'
        : 'Send a prompt to Claude Code...';

  return (
    <div className={containerClass}>
      <textarea
        ref={textareaRef}
        className="chat-input__textarea"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={3}
      />
      <div className="chat-input__actions">
        {busy ? (
          <button
            className="chat-input__btn chat-input__btn--stop"
            onClick={onStop}
            title="Stop agent"
            aria-label="Stop agent"
          >
            ■
          </button>
        ) : (
          <button
            className="chat-input__btn chat-input__btn--send"
            onClick={submit}
            disabled={!value.trim() || resetting}
            title="Send (Enter)"
          >
            ▶
          </button>
        )}
        <button
          className="chat-input__btn chat-input__btn--reset"
          onClick={onReset}
          disabled={disabled}
          title="Reset conversation"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
