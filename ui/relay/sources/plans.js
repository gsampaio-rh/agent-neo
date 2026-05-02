import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function extractTitle(content) {
  const match = content.match(/^#\s+(?:Plan:\s*)?(.+)/m);
  return match ? match[1].trim() : null;
}

export function createPlanReader(workspaceDir) {
  const plansDir = join(workspaceDir, 'plans');

  return {
    getPlans() {
      if (!existsSync(plansDir)) return [];
      try {
        return readdirSync(plansDir)
          .filter(f => f.endsWith('.md'))
          .map(filename => {
            const fullPath = join(plansDir, filename);
            const content = readFileSync(fullPath, 'utf8');
            const mtime = statSync(fullPath).mtime.toISOString();
            return { filename, title: extractTitle(content) || filename.replace('.md', ''), mtime };
          })
          .sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
      } catch { return []; }
    },

    getPlan(filename) {
      if (!filename || filename.includes('/') || filename.includes('..')) return null;
      const fullPath = join(plansDir, filename);
      if (!existsSync(fullPath)) return null;
      try {
        const content = readFileSync(fullPath, 'utf8');
        return { filename, title: extractTitle(content) || filename.replace('.md', ''), content };
      } catch { return null; }
    },
  };
}
