import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { FileExplorer } from '../FileExplorer';
import * as filesApi from '../../services/filesApi';

vi.mock('../../services/filesApi');

const mockTree = [
  { name: 'skills', type: 'dir' as const, children: [{ name: 'attack.md', type: 'file' as const, size: 100 }] },
  { name: 'CLAUDE.md', type: 'file' as const, size: 200 },
];

describe('FileExplorer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(filesApi.listFiles).mockResolvedValue(mockTree);
    vi.mocked(filesApi.readFile).mockResolvedValue({ path: 'CLAUDE.md', content: '# Hello' });
  });

  it('renders file tree on mount', async () => {
    render(<FileExplorer />);
    await waitFor(() => {
      expect(screen.getByText('skills/')).toBeInTheDocument();
      expect(screen.getByText('CLAUDE.md')).toBeInTheDocument();
    });
  });

  it('shows file content on click (read-only)', async () => {
    render(<FileExplorer />);
    await waitFor(() => expect(screen.getByText('CLAUDE.md')).toBeInTheDocument());
    fireEvent.click(screen.getByText('CLAUDE.md'));
    await waitFor(() => {
      expect(screen.getByText('# Hello')).toBeInTheDocument();
    });
  });

  it('closes viewer when clicking same file again', async () => {
    render(<FileExplorer />);
    await waitFor(() => expect(screen.getByText('CLAUDE.md')).toBeInTheDocument());
    fireEvent.click(screen.getByText('CLAUDE.md'));
    await waitFor(() => expect(screen.getByText('# Hello')).toBeInTheDocument());
    const treeItem = document.querySelector('.file-tree__item--selected') as HTMLElement;
    fireEvent.click(treeItem);
    expect(screen.queryByText('# Hello')).not.toBeInTheDocument();
  });

  it('renders nested directory items', async () => {
    render(<FileExplorer />);
    await waitFor(() => {
      expect(screen.getByText('skills/')).toBeInTheDocument();
      expect(screen.getByText('attack.md')).toBeInTheDocument();
    });
  });
});
