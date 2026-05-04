import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppHeader } from '../AppHeader';

vi.mock('../../hooks/useElapsed', () => ({
  useElapsed: () => 65,
}));

describe('AppHeader', () => {
  const defaults = {
    startTime: Date.now(),
    connected: true,
    escaped: false,
    eventCount: 42,
    activeTab: 'chat' as const,
    onTabChange: vi.fn(),
  };

  it('renders NEO title when not escaped', () => {
    render(<AppHeader {...defaults} />);
    expect(screen.getByText('NEO')).toBeInTheDocument();
    expect(screen.getByText('CONTAINED')).toBeInTheDocument();
  });

  it('renders BREACHED title when escaped', () => {
    render(<AppHeader {...defaults} escaped={true} />);
    expect(screen.getByText('!! BREACHED !!')).toBeInTheDocument();
    expect(screen.getByText('BREACHED')).toBeInTheDocument();
  });

  it('renders formatted timer', () => {
    render(<AppHeader {...defaults} />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('renders event count', () => {
    render(<AppHeader {...defaults} />);
    expect(screen.getByText('42 events')).toBeInTheDocument();
  });

  it('shows LIVE when connected', () => {
    render(<AppHeader {...defaults} connected={true} />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('shows OFFLINE when disconnected', () => {
    render(<AppHeader {...defaults} connected={false} />);
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });

  it('calls onTabChange on tab click', () => {
    const onTabChange = vi.fn();
    render(<AppHeader {...defaults} onTabChange={onTabChange} />);

    fireEvent.click(screen.getByText('Map'));
    expect(onTabChange).toHaveBeenCalledWith('map');

    fireEvent.click(screen.getByText('Box'));
    expect(onTabChange).toHaveBeenCalledWith('box');
  });

  it('highlights active tab', () => {
    render(<AppHeader {...defaults} activeTab="map" />);
    const mapBtn = screen.getByText('Map');
    expect(mapBtn.className).toContain('neo-header__tab--active');
  });

  describe('persona display', () => {
    it('shows persona name and avatar when persona is set', () => {
      render(<AppHeader {...defaults} persona={{ name: 'Hacker', avatarId: 'ghost' }} />);
      expect(screen.getByText('Hacker')).toBeInTheDocument();
      expect(screen.getByText('👻')).toBeInTheDocument();
      expect(screen.queryByText('NEO')).not.toBeInTheDocument();
    });

    it('shows BREACHED instead of persona name when escaped', () => {
      render(<AppHeader {...defaults} escaped persona={{ name: 'Hacker', avatarId: 'ghost' }} />);
      expect(screen.getByText('!! BREACHED !!')).toBeInTheDocument();
      expect(screen.queryByText('Hacker')).not.toBeInTheDocument();
    });

    it('falls back to NEO when no persona is set', () => {
      render(<AppHeader {...defaults} persona={null} />);
      expect(screen.getByText('NEO')).toBeInTheDocument();
    });
  });
});
