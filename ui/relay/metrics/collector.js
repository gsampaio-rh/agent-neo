const MAX_TOOL_NAMES = 100;

export class MetricsCollector {
  /** @param {{ auditLogger?: { log: Function } }} [options] */
  constructor(options = {}) {
    this._auditLogger = options.auditLogger ?? null;
    this._startedAt = Date.now();
    this.reset();
  }

  reset() {
    this._tokens = { input: 0, output: 0, lastInput: 0, lastOutput: 0 };
    this._cost = { total: 0, last: 0 };
    this._latency = { sum: 0, count: 0, max: 0, last: 0 };
    this._tools = new Map();
    this._errors = new Map();
    this._sessions = 0;
    this._prompts = 0;
  }

  /**
   * Hot-path entry: called on every JSONL line from hub.broadcast.
   * Uses string includes() to avoid JSON.parse on the 99%+ of lines
   * that carry no metrics-relevant data (streaming text, thinking, etc).
   */
  processLine(line) {
    if (line.includes('"type":"result"'))      return this._handleResult(line);
    if (line.includes('"tool_use"'))           return this._handleToolCall(line);
    if (line.includes('"subtype":"init"'))      return this._handleInit();
    if (line.includes('"subtype":"api_retry"')) return this._handleError(line);
  }

  incrementPrompts() {
    this._prompts++;
  }

  getSnapshot() {
    return {
      tokens: { ...this._tokens },
      cost: { ...this._cost },
      latency: {
        avgMs: this._latency.count > 0 ? Math.round(this._latency.sum / this._latency.count) : 0,
        maxMs: this._latency.max,
        lastMs: this._latency.last,
        count: this._latency.count,
      },
      tools: {
        total: [...this._tools.values()].reduce((s, n) => s + n, 0),
        byName: Object.fromEntries(this._tools),
      },
      errors: {
        total: [...this._errors.values()].reduce((s, n) => s + n, 0),
        byCategory: Object.fromEntries(this._errors),
      },
      sessions: this._sessions,
      prompts: this._prompts,
      uptimeMs: Date.now() - this._startedAt,
    };
  }

  _handleResult(line) {
    try {
      const obj = JSON.parse(line);
      const usage = obj.usage;
      if (usage) {
        const inp = usage.input_tokens ?? 0;
        const out = usage.output_tokens ?? 0;
        this._tokens.input += inp;
        this._tokens.output += out;
        this._tokens.lastInput = inp;
        this._tokens.lastOutput = out;
      }
      if (typeof obj.total_cost_usd === 'number') {
        this._cost.total += obj.total_cost_usd;
        this._cost.last = obj.total_cost_usd;
      }
      if (typeof obj.duration_ms === 'number') {
        const d = obj.duration_ms;
        this._latency.sum += d;
        this._latency.count++;
        this._latency.last = d;
        if (d > this._latency.max) this._latency.max = d;
      }
      if (this._auditLogger) {
        this._auditLogger.log('prompt_completed', 'system', 'Agent completed response', {
          inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens,
          costUsd: obj.total_cost_usd, durationMs: obj.duration_ms,
        });
      }
    } catch { /* malformed JSON — skip silently */ }
  }

  _handleToolCall(line) {
    try {
      const obj = JSON.parse(line);
      const content = obj.message?.content;
      if (!Array.isArray(content)) return;
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        const name = block.name ?? 'unknown';
        if (this._tools.size >= MAX_TOOL_NAMES && !this._tools.has(name)) continue;
        this._tools.set(name, (this._tools.get(name) ?? 0) + 1);
      }
    } catch { /* skip */ }
  }

  _handleInit() {
    this._sessions++;
  }

  _handleError(line) {
    try {
      const obj = JSON.parse(line);
      const category = obj.subtype ?? 'unknown';
      this._errors.set(category, (this._errors.get(category) ?? 0) + 1);
      if (this._auditLogger) {
        this._auditLogger.log('error', 'system', `API error: ${category}`, {
          category, error: obj.error,
        });
      }
    } catch { /* skip */ }
  }
}
