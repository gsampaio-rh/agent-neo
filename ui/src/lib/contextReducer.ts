import type { EscapeEvent } from './eventParser';
import type { TerminalLine } from './terminalLine';
import type { IsolationState } from '../hooks/useSharedState';

export type AgentAction = 'idle' | 'hacking' | 'reading' | 'thinking';

export interface FileEntry {
  path: string;
  op: 'read' | 'write' | 'exec';
}

export interface AgentContext {
  cwd: string;
  dirsVisited: string[];
  files: FileEntry[];
  networkFinds: string[];
  hasOutbound: boolean;
  outboundTarget: string;
}

export interface AgentState {
  context: AgentContext;
  terminalLines: TerminalLine[];
  eventCount: number;
  connected: boolean;
  startTime: number | null;
  escaped: boolean;
  agentAction: AgentAction;
  actionText: string;
  isolation: IsolationState | null;
}

export const IP_REGEX = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;

const FQDN_REGEX = /\b([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\.(?:svc|com|io|org|net|dev|local|internal|cloud|app|co|br|uk|de|fr|us|edu|gov|mil|info|biz|me|[a-z]{2,6}))\b/gi;

const NETWORK_CMD_PATTERNS = [
  /\bcurl\s/,
  /\bwget\s/,
  /\bnc\s/,
  /\bncat\s/,
  /\bping\s/,
  /\bnmap\s/,
  /\bsocket\b/,
  /\brequests?\./,
  /\bhttp\.client\b/,
  /\burllib/,
];

export function addFile(files: FileEntry[], path: string, op: FileEntry['op']): FileEntry[] {
  if (files.some((f) => f.path === path && f.op === op)) return files;
  return [...files, { path, op }];
}

export function addDir(dirs: string[], dir: string): string[] {
  if (dirs.includes(dir)) return dirs;
  return [...dirs, dir];
}

function isLocalIp(ip: string): boolean {
  return ip.startsWith('127.') || ip.startsWith('0.') || ip === '255.255.255.255';
}

export function extractHostsFromText(text: string): string[] {
  const hosts: string[] = [];
  const matches = text.matchAll(FQDN_REGEX);
  for (const m of matches) {
    const h = m[1].toLowerCase();
    if (!hosts.includes(h)) hosts.push(h);
  }
  return hosts;
}

export function extractIpsFromText(text: string): string[] {
  const ips: string[] = [];
  const matches = text.matchAll(IP_REGEX);
  for (const m of matches) {
    if (!isLocalIp(m[1]) && !ips.includes(m[1])) ips.push(m[1]);
  }
  return ips;
}

export function updateContext(prev: AgentContext, event: EscapeEvent): AgentContext {
  const ctx = { ...prev };

  if (event.type === 'tool_call' && event.toolCall) {
    const tool = event.toolCall;

    if (tool.name === 'Write') {
      const path = (tool.input.filePath as string) || (tool.input.file_path as string) || '';
      if (path) {
        ctx.files = addFile(ctx.files, path, 'write');
        const dir = path.substring(0, path.lastIndexOf('/')) || '/';
        ctx.dirsVisited = addDir(ctx.dirsVisited, dir);
      }
    }

    if (tool.name === 'Bash') {
      const cmd = (tool.input.command as string) || '';

      const cdMatch = cmd.match(/\bcd\s+(\S+)/);
      if (cdMatch) {
        ctx.cwd = cdMatch[1];
        ctx.dirsVisited = addDir(ctx.dirsVisited, cdMatch[1]);
      }
      const lsMatch = cmd.match(/\bls\s+[\w-]*\s*(\/([\w.-]+\/?)+)/);
      if (lsMatch) ctx.dirsVisited = addDir(ctx.dirsVisited, lsMatch[1]);

      const readCmds = cmd.matchAll(/\b(?:cat|head|tail|less|more)\s+(\/[\w./-]+)/g);
      for (const m of readCmds) {
        ctx.files = addFile(ctx.files, m[1], 'read');
        const dir = m[1].substring(0, m[1].lastIndexOf('/')) || '/';
        ctx.dirsVisited = addDir(ctx.dirsVisited, dir);
      }

      const gccOut = cmd.match(/gcc\s+.*?-o\s+(\S+)/);
      if (gccOut) ctx.files = addFile(ctx.files, gccOut[1], 'write');
      const gccIn = cmd.match(/gcc\s+(\S+\.c)/);
      if (gccIn) ctx.files = addFile(ctx.files, gccIn[1], 'read');
      const teeMatch = cmd.match(/\btee\s+(\/[\w./-]+)/);
      if (teeMatch) ctx.files = addFile(ctx.files, teeMatch[1], 'write');

      const directExec = cmd.match(/(?:^|&&\s*|;\s*)(\.\/\S+|\/tmp\/\S+|\/home\/\S+)/);
      if (directExec) ctx.files = addFile(ctx.files, directExec[1], 'exec');
      const interpreterExec = cmd.match(/\b(?:python3?|bash|sh|node)\s+(\/[\w./-]+)/);
      if (interpreterExec) ctx.files = addFile(ctx.files, interpreterExec[1], 'exec');
      const chmodExec = cmd.match(/chmod\s+\+x\s+(\S+)/);
      if (chmodExec) ctx.files = addFile(ctx.files, chmodExec[1], 'exec');

      if (NETWORK_CMD_PATTERNS.some((p) => p.test(cmd))) {
        for (const ip of extractIpsFromText(cmd)) {
          ctx.networkFinds = addDir(ctx.networkFinds, ip);
        }
        for (const host of extractHostsFromText(cmd)) {
          ctx.networkFinds = addDir(ctx.networkFinds, host);
        }
        const urlMatch = cmd.match(/https?:\/\/([\w.-]+)/);
        if (urlMatch) {
          const host = urlMatch[1].toLowerCase();
          ctx.networkFinds = addDir(ctx.networkFinds, host);
        }
      }
    }
  }

  if (event.type === 'tool_result' && event.toolResult) {
    const content = event.toolResult.content;
    for (const ip of extractIpsFromText(content)) {
      ctx.networkFinds = addDir(ctx.networkFinds, ip);
    }
    for (const host of extractHostsFromText(content)) {
      ctx.networkFinds = addDir(ctx.networkFinds, host);
    }
  }

  return ctx;
}

export const INITIAL_CONTEXT: AgentContext = {
  cwd: '~',
  dirsVisited: ['~'],
  files: [],
  networkFinds: [],
  hasOutbound: false,
  outboundTarget: '',
};

export const INITIAL_AGENT_STATE: AgentState = {
  context: { ...INITIAL_CONTEXT },
  terminalLines: [],
  eventCount: 0,
  connected: false,
  startTime: null,
  escaped: false,
  agentAction: 'idle',
  actionText: '',
  isolation: null,
};
