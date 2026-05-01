import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('calls onSend with trimmed text on Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} onStop={vi.fn()} onReset={vi.fn()} agentStatus="idle" />);

    const textarea = screen.getByPlaceholderText(/Send a prompt/);
    fireEvent.change(textarea, { target: { value: '  hello world  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledWith('hello world');
  });

  it('clears input after sending', () => {
    render(<ChatInput onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} agentStatus="idle" />);

    const textarea = screen.getByPlaceholderText(/Send a prompt/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(textarea.value).toBe('');
  });

  it('does not submit on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} onStop={vi.fn()} onReset={vi.fn()} agentStatus="idle" />);

    const textarea = screen.getByPlaceholderText(/Send a prompt/);
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send empty or whitespace-only input', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} onStop={vi.fn()} onReset={vi.fn()} agentStatus="idle" />);

    const textarea = screen.getByPlaceholderText(/Send a prompt/);
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('Send button calls onSend', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} onStop={vi.fn()} onReset={vi.fn()} agentStatus="idle" />);

    const textarea = screen.getByPlaceholderText(/Send a prompt/);
    fireEvent.change(textarea, { target: { value: 'click test' } });
    fireEvent.click(screen.getByTitle('Send (Enter)'));

    expect(onSend).toHaveBeenCalledWith('click test');
  });

  it('shows Stop button and calls onStop when running', () => {
    const onStop = vi.fn();
    render(<ChatInput onSend={vi.fn()} onStop={onStop} onReset={vi.fn()} agentStatus="running" />);

    const stopBtn = screen.getByTitle('Stop agent');
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('disables textarea when running', () => {
    render(<ChatInput onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} agentStatus="running" />);

    const textarea = screen.getByPlaceholderText('Agent is running...');
    expect(textarea).toBeDisabled();
  });

  it('Reset button calls onReset', () => {
    const onReset = vi.fn();
    render(<ChatInput onSend={vi.fn()} onStop={vi.fn()} onReset={onReset} agentStatus="idle" />);

    fireEvent.click(screen.getByTitle('Reset conversation'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('disables Reset button when running', () => {
    render(<ChatInput onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} agentStatus="running" />);

    expect(screen.getByTitle('Reset conversation')).toBeDisabled();
  });

  it('disables Send button when input is empty', () => {
    render(<ChatInput onSend={vi.fn()} onStop={vi.fn()} onReset={vi.fn()} agentStatus="idle" />);

    expect(screen.getByTitle('Send (Enter)')).toBeDisabled();
  });
});
