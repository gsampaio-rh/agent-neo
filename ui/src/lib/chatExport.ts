import type { ChatMessage, SessionStats, MessageBlock } from './chatReducer';

export interface ExportedChat {
  messages: ChatMessage[];
  stats: SessionStats;
  exportedAt: string;
}

export function exportAsJson(messages: ChatMessage[], stats: SessionStats): string {
  const payload: ExportedChat = {
    messages,
    stats,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

function blockToMarkdown(block: MessageBlock): string {
  switch (block.kind) {
    case 'thinking':
      return `> *Thinking:* ${block.text}`;
    case 'tool_call':
      return `**Tool: ${block.name}**\n\`\`\`\n${block.input.command ?? JSON.stringify(block.input, null, 2)}\n\`\`\``;
    case 'tool_result':
      return `${block.isError ? '**Error:**' : '**Output:**'}\n\`\`\`\n${block.content}\n\`\`\``;
    case 'text':
      return block.text;
  }
}

export function exportAsMarkdown(messages: ChatMessage[], stats: SessionStats): string {
  const lines: string[] = [
    '# Chat Export',
    '',
    `**Exported:** ${new Date().toISOString()}`,
    `**Prompts:** ${stats.totalPrompts}`,
  ];

  if (stats.totalInputTokens > 0 || stats.totalOutputTokens > 0) {
    lines.push(`**Tokens:** ${stats.totalInputTokens} in / ${stats.totalOutputTokens} out`);
  }
  if (stats.totalToolCalls > 0) {
    lines.push(`**Tool calls:** ${stats.totalToolCalls}`);
  }

  lines.push('', '---', '');

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    lines.push(`## ${role}`, '');
    for (const block of msg.blocks) {
      lines.push(blockToMarkdown(block), '');
    }
    if (msg.stats) {
      const parts: string[] = [];
      if (msg.stats.inputTokens != null) parts.push(`IN: ${msg.stats.inputTokens}`);
      if (msg.stats.outputTokens != null) parts.push(`OUT: ${msg.stats.outputTokens}`);
      if (msg.stats.durationMs != null) parts.push(`${msg.stats.durationMs}ms`);
      if (msg.stats.costUsd != null) parts.push(`$${msg.stats.costUsd.toFixed(4)}`);
      if (msg.stats.toolCallCount > 0) parts.push(`${msg.stats.toolCallCount} tools`);
      if (parts.length > 0) lines.push(`*${parts.join(' | ')}*`, '');
    }
  }

  return lines.join('\n');
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
