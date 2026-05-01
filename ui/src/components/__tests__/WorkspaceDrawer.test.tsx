import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceDrawer } from '../WorkspaceDrawer';

vi.mock('../FileExplorer', () => ({
  FileExplorer: () => <div data-testid="file-explorer">Explorer</div>,
}));

describe('WorkspaceDrawer', () => {
  it('renders toggle button with aria-label', () => {
    render(<WorkspaceDrawer />);
    expect(screen.getByLabelText('Toggle workspace explorer')).toBeInTheDocument();
  });

  it('does not show drawer content initially', () => {
    render(<WorkspaceDrawer />);
    expect(screen.queryByText('.claude workspace')).not.toBeInTheDocument();
  });

  it('opens drawer on button click', () => {
    render(<WorkspaceDrawer />);
    fireEvent.click(screen.getByLabelText('Toggle workspace explorer'));
    expect(screen.getByText('.claude workspace')).toBeInTheDocument();
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
  });

  it('closes drawer on close button click', () => {
    render(<WorkspaceDrawer />);
    fireEvent.click(screen.getByLabelText('Toggle workspace explorer'));
    expect(screen.getByText('.claude workspace')).toBeInTheDocument();

    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('.claude workspace')).not.toBeInTheDocument();
  });

  it('toggles drawer on repeated clicks', () => {
    render(<WorkspaceDrawer />);
    const btn = screen.getByLabelText('Toggle workspace explorer');

    fireEvent.click(btn);
    expect(screen.getByText('.claude workspace')).toBeInTheDocument();

    fireEvent.click(btn);
    expect(screen.queryByText('.claude workspace')).not.toBeInTheDocument();
  });
});
