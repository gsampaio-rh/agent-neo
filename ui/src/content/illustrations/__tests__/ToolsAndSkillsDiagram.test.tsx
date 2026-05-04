import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolsAndSkillsDiagram } from '../ToolsAndSkillsDiagram';

describe('ToolsAndSkillsDiagram', () => {
  it('renders Tools and Skills tab buttons', () => {
    render(<ToolsAndSkillsDiagram onInteractionComplete={vi.fn()} />);
    expect(screen.getByText(/^Tools/)).toBeInTheDocument();
    expect(screen.getByText(/^Skills/)).toBeInTheDocument();
  });

  it('starts on the Tools tab with tool items visible', () => {
    render(<ToolsAndSkillsDiagram onInteractionComplete={vi.fn()} />);
    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.getByText('read_file')).toBeInTheDocument();
  });

  it('switches to Skills tab and shows skill items', () => {
    render(<ToolsAndSkillsDiagram onInteractionComplete={vi.fn()} />);
    fireEvent.click(screen.getByText(/^Skills/));
    expect(screen.getByText('Recon')).toBeInTheDocument();
    expect(screen.getByText('Exploit')).toBeInTheDocument();
  });

  it('calls onInteractionComplete when both tabs have been visited', () => {
    const cb = vi.fn();
    render(<ToolsAndSkillsDiagram onInteractionComplete={cb} />);
    expect(cb).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/^Skills/));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('does not call onInteractionComplete on repeated tab clicks', () => {
    const cb = vi.fn();
    render(<ToolsAndSkillsDiagram onInteractionComplete={cb} />);
    fireEvent.click(screen.getByText(/^Skills/));
    fireEvent.click(screen.getByText(/^Tools/));
    fireEvent.click(screen.getByText(/^Skills/));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('shows the Why section', () => {
    render(<ToolsAndSkillsDiagram onInteractionComplete={vi.fn()} />);
    expect(screen.getByText(/brain without hands/)).toBeInTheDocument();
  });
});
