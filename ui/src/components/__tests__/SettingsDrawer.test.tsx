import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsDrawer } from '../SettingsDrawer';
import { SharedStateProvider } from '../../hooks/useSharedState';
import * as chatApi from '../../services/chatApi';
import * as filesApi from '../../services/filesApi';

vi.mock('../../services/chatApi');
vi.mock('../../services/filesApi');

function mockFetchByUrl() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url.includes('/api/state')) {
      return Promise.resolve(new Response(
        JSON.stringify({ attackPhase: 'normal', escaped: false, eventCount: 0 }),
        { status: 200 },
      ));
    }
    if (url.includes('/api/audit')) {
      return Promise.resolve(new Response(
        JSON.stringify({ events: [], total: 0 }),
        { status: 200 },
      ));
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
}

function renderWithProvider(ui: React.ReactElement) {
  mockFetchByUrl();
  return render(<SharedStateProvider>{ui}</SharedStateProvider>);
}

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
    renderWithProvider(<SettingsDrawer />);
    expect(screen.getByTitle('Agent Settings')).toBeInTheDocument();
  });

  it('opens drawer on gear click', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('closes on close button click', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('closes on overlay click', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    const overlay = document.querySelector('.settings-overlay')!;
    fireEvent.click(overlay);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('shows environment info when loaded', async () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    await waitFor(() => {
      expect(screen.getByText('glm47-flash')).toBeInTheDocument();
      expect(screen.getByText('agent-namespace')).toBeInTheDocument();
      expect(screen.getByText('neo-abc123')).toBeInTheDocument();
      expect(screen.getByText('allow-all')).toBeInTheDocument();
    });
  });

  it('shows skills from workspace', async () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    await waitFor(() => {
      expect(screen.getByText('recon')).toBeInTheDocument();
      expect(screen.getByText('escape')).toBeInTheDocument();
    });
  });

  it('shows CLAUDE.md content', async () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    await waitFor(() => {
      expect(screen.getByText(/Agent Instructions/)).toBeInTheDocument();
      expect(screen.getByText(/Do the thing/)).toBeInTheDocument();
    });
  });

  it('shows fallback when CLAUDE.md is missing', async () => {
    vi.mocked(filesApi.readFile).mockRejectedValue(new Error('not found'));
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    await waitFor(() => {
      expect(screen.getByText('No CLAUDE.md found')).toBeInTheDocument();
    });
  });
});

describe('SettingsDrawer — Dev Tools', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(chatApi.fetchStatus).mockResolvedValue({
      status: 'idle', events: 0, clients: 0, llmAvailable: true,
      environment: { model: 'test', namespace: 'test', podName: 'test', permissionMode: 'default' },
    });
    vi.mocked(filesApi.listFiles).mockResolvedValue([]);
    vi.mocked(filesApi.readFile).mockRejectedValue(new Error('not found'));
  });

  it('shows Dev Tools section in dev mode', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    expect(screen.getByText('Dev Tools')).toBeInTheDocument();
    expect(screen.getByText('Local only — resets on refresh')).toBeInTheDocument();
  });

  it('renders all three attack phase buttons', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    expect(screen.getByText('normal')).toBeInTheDocument();
    expect(screen.getByText('compromised')).toBeInTheDocument();
    expect(screen.getByText('exploiting')).toBeInTheDocument();
  });

  it('renders escaped toggle starting as OFF', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('clicking a phase button highlights it', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    const btn = screen.getByText('exploiting');
    fireEvent.click(btn);
    expect(btn.className).toContain('settings-drawer__dev-phase--active');
  });

  it('toggling escaped changes button text', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    const toggle = screen.getByText('OFF');
    fireEvent.click(toggle);
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('shows reset button only when override is active', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));
    expect(screen.queryByText('Reset to live state')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('exploiting'));
    expect(screen.getByText('Reset to live state')).toBeInTheDocument();
  });

  it('reset clears all overrides', () => {
    renderWithProvider(<SettingsDrawer />);
    fireEvent.click(screen.getByTitle('Agent Settings'));

    fireEvent.click(screen.getByText('exploiting'));
    fireEvent.click(screen.getByText('OFF'));
    expect(screen.getByText('Reset to live state')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Reset to live state'));
    expect(screen.queryByText('Reset to live state')).not.toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
    const exploitingBtn = screen.getByText('exploiting');
    expect(exploitingBtn.className).not.toContain('settings-drawer__dev-phase--active');
  });
});
