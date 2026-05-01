import { useCallback, useState } from 'react';
import { fetchStatus, type EnvironmentInfo } from '../services/chatApi';
import { listFiles, readFile, type FileNode } from '../services/filesApi';
import { AuditLogViewer } from './AuditLogViewer';

interface DrawerData {
  claudeMd: string | null;
  skills: string[];
  environment: EnvironmentInfo | null;
}

function extractSkills(tree: FileNode[]): string[] {
  const skillsDir = tree.find(n => n.name === 'skills' && n.type === 'dir');
  if (!skillsDir?.children) return [];
  return skillsDir.children
    .filter(n => n.type === 'file')
    .map(n => n.name.replace(/\.md$/, ''));
}

export function SettingsDrawer() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DrawerData>({ claudeMd: null, skills: [], environment: null });
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [status, tree, claudeFile] = await Promise.allSettled([
        fetchStatus(),
        listFiles(),
        readFile('CLAUDE.md'),
      ]);

      setData({
        environment: status.status === 'fulfilled' ? (status.value.environment ?? null) : null,
        skills: tree.status === 'fulfilled' ? extractSkills(tree.value) : [],
        claudeMd: claudeFile.status === 'fulfilled' ? claudeFile.value.content : null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    loadData();
  }, [loadData]);

  return (
    <>
      <button
        className="settings-gear"
        onClick={() => open ? setOpen(false) : handleOpen()}
        title="Agent Settings"
        aria-label="Agent Settings"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>
        </svg>
      </button>

      {open && (
        <div className="settings-overlay" onClick={() => setOpen(false)}>
          <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="settings-drawer__header">
              <h2 className="settings-drawer__title">Settings</h2>
              <button className="settings-drawer__close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="settings-drawer__body">
              {loading && <div className="settings-drawer__loading">Loading...</div>}

              {data.environment && (
                <div className="settings-drawer__section">
                  <h3 className="settings-drawer__section-title">Environment</h3>
                  <div className="settings-drawer__field">
                    <label className="settings-drawer__label">Model</label>
                    <div className="settings-drawer__value settings-drawer__value--mono">
                      {data.environment.model}
                    </div>
                  </div>
                  <div className="settings-drawer__field">
                    <label className="settings-drawer__label">Namespace</label>
                    <div className="settings-drawer__value settings-drawer__value--mono">
                      {data.environment.namespace}
                    </div>
                  </div>
                  <div className="settings-drawer__field">
                    <label className="settings-drawer__label">Pod</label>
                    <div className="settings-drawer__value settings-drawer__value--mono">
                      {data.environment.podName}
                    </div>
                  </div>
                  <div className="settings-drawer__field">
                    <label className="settings-drawer__label">Permission Mode</label>
                    <div className="settings-drawer__value settings-drawer__value--mono">
                      {data.environment.permissionMode}
                    </div>
                  </div>
                </div>
              )}

              {data.skills.length > 0 && (
                <div className="settings-drawer__section">
                  <h3 className="settings-drawer__section-title">Skills</h3>
                  <div className="settings-drawer__tools">
                    {data.skills.map((s) => (
                      <span key={s} className="settings-drawer__tool-badge">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="settings-drawer__section">
                <h3 className="settings-drawer__section-title">CLAUDE.md</h3>
                {data.claudeMd !== null ? (
                  <pre className="settings-drawer__prompt">{data.claudeMd}</pre>
                ) : (
                  <div className="settings-drawer__value">
                    {loading ? '' : 'No CLAUDE.md found'}
                  </div>
                )}
              </div>

              <AuditLogViewer />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
