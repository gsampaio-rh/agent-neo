const DEFAULT_MAX_BUFFER = 10_000;

export class SseHub {
  constructor(maxBuffer = DEFAULT_MAX_BUFFER) {
    this.clients = new Set();
    this.buffer = [];
    this.maxBuffer = maxBuffer;
  }

  broadcast(line) {
    this.buffer.push(line);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }
    const payload = `data: ${line}\n\n`;
    for (const res of this.clients) {
      try { res.write(payload); } catch { this.clients.delete(res); }
    }
  }

  replayTo(res) {
    for (const line of this.buffer) {
      res.write(`data: ${line}\n\n`);
    }
    res.write(`event: replay-end\ndata: {}\n\n`);
  }

  addClient(res) {
    this.clients.add(res);
  }

  removeClient(res) {
    this.clients.delete(res);
  }

  reset() {
    this.buffer.length = 0;
  }

  get clientCount() {
    return this.clients.size;
  }

  get eventCount() {
    return this.buffer.length;
  }
}
