export interface FileNode {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
}

export async function listFiles(): Promise<FileNode[]> {
  const res = await fetch('/api/files');
  return res.json();
}

export async function readFile(path: string): Promise<{ path: string; content: string }> {
  const res = await fetch(`/api/files/${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to read ${path}`);
  return res.json();
}

