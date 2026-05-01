import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsDrawer } from '../SettingsDrawer';
import * as chatApi from '../../services/chatApi';
import * as filesApi from '../../services/filesApi';

vi.mock('../../services/chatApi');
vi.mock('../../services/filesApi');

describe('SettingsDrawer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(chatApi.fetchStatus).mockResolvedValue({
      status: 'idle',
      events: 10,
      clients: 1,
      llmAvailable: true,
      environment: {
        model: 'glm47-flash',
        namespace: 'agent-namespace',
        podName: 'neo-abc123',
        permissionMode: 'allow-all',
      },
    });
    vi.mocked(filesApi.listFiles).mockResolvedValue([
      { name: 'skills', type: 'dir', children: [
        { name: 'recon.md', type: 'file', size: 100 },
        { name: 'escape.md', type: 'file', size: 200 },
      ]},
      { name: 'CLAUDE.md', type: 'file', size: 300 },
    ]);
    vi.mocked(filesApi.readFile).mockResolvedValue({
      path: 'CLAUDE.md',
      content: '# Agent Instructions\n\nDo the thing.',
    });
  });

  it('renders gear button', () => {
    render(<SettingsDrawer />);
    expect(screen.getByTitle('Agent Settings')).toBeInTheDocument();
  });

  it('opens drawer on gear click', () => {
    render(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('closes on close button click', () => {
    render(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('closes on overlay click', () => {
    render(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    const overlay = document.querySelector('.settings-overlay')!;
    fireEvent.click(overlay);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('shows environment info when loaded', async () => {
    render(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    await waitFor(() => {
      expect(screen.getByText('glm47-flash')).toBeInTheDocument();
      expect(screen.getByText('agent-namespace')).toBeInTheDocument();
      expect(screen.getByText('neo-abc123')).toBeInTheDocument();
      expect(screen.getByText('allow-all')).toBeInTheDocument();
    });
  });

  it('shows skills from workspace', async () => {
    render(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    await waitFor(() => {
      expect(screen.getByText('recon')).toBeInTheDocument();
      expect(screen.getByText('escape')).toBeInTheDocument();
    });
  });

  it('shows CLAUDE.md content', async () => {
    render(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    await waitFor(() => {
      expect(screen.getByText(/Agent Instructions/)).toBeInTheDocument();
      expect(screen.getByText(/Do the thing/)).toBeInTheDocument();
    });
  });

  it('shows fallback when CLAUDE.md is missing', async () => {
    vi.mocked(filesApi.readFile).mockRejectedValue(new Error('not found'));
    render(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    await waitFor(() => {
      expect(screen.getByText('No CLAUDE.md found')).toBeInTheDocument();
    });
  });
});
