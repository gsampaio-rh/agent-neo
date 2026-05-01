import { useCallback, useEffect, useState } from 'react';
import * as filesApi from '../services/filesApi';
import type { FileNode } from '../services/filesApi';

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  path: string;
  onSelect: (path: string) => void;
  selectedFile: string | null;
}

function FileTreeItem({ node, depth, path, onSelect, selectedFile }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const fullPath = path ? `${path}/${node.name}` : node.name;

  if (node.type === 'dir') {
    return (
      <div className="file-tree__group">
        <button
          className="file-tree__item file-tree__item--dir"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="file-tree__arrow">{expanded ? '▾' : '▸'}</span>
          <span className="file-tree__name">{node.name}/</span>
        </button>
        {expanded && node.children && (
          <div className="file-tree__children">
            {node.children.map((child) => (
              <FileTreeItem key={child.name} node={child} depth={depth + 1} path={fullPath} onSelect={onSelect} selectedFile={selectedFile} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = fullPath === selectedFile;

  return (
    <button
      className={`file-tree__item file-tree__item--file ${isSelected ? 'file-tree__item--selected' : ''}`}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      onClick={() => onSelect(fullPath)}
    >
      <span className="file-tree__name">{node.name}</span>
      {node.size !== undefined && <span className="file-tree__size">{node.size}b</span>}
    </button>
  );
}

export function FileExplorer() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    try {
      const data = await filesApi.listFiles();
      setTree(data);
      setError(null);
    } catch {
      setError('Failed to load files');
      setTree([]);
    }
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const handleSelect = useCallback(async (path: string) => {
    if (path === selectedFile) {
      setSelectedFile(null);
      setContent('');
      return;
    }
    try {
      const data = await filesApi.readFile(path);
      setSelectedFile(path);
      setContent(data.content);
      setError(null);
    } catch {
      setError(`Failed to read ${path}`);
    }
  }, [selectedFile]);

  return (
    <div className="file-explorer">
      <div className="file-explorer__header">
        <span className="file-explorer__title">FILES</span>
        <button className="file-explorer__refresh" onClick={fetchTree} title="Refresh">↻</button>
      </div>

      {error && <div className="file-explorer__error">{error}</div>}

      <div className="file-tree">
        {tree.length === 0 && !error && <div className="file-tree__empty">No files</div>}
        {tree.map((node) => (
          <FileTreeItem key={node.name} node={node} depth={0} path="" onSelect={handleSelect} selectedFile={selectedFile} />
        ))}
      </div>

      {selectedFile && (
        <div className="file-viewer">
          <div className="file-viewer__header">
            <span className="file-viewer__path">{selectedFile}</span>
          </div>
          <pre className="file-viewer__content">{content}</pre>
        </div>
      )}
    </div>
  );
}
