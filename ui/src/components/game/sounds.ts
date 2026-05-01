let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let _enabled = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function getGain(): GainNode {
  getCtx();
  return masterGain!;
}

export function setEnabled(on: boolean) {
  _enabled = on;
}

export function isEnabled() {
  return _enabled;
}

export function setVolume(v: number) {
  const gain = getGain();
  gain.gain.value = Math.max(0, Math.min(1, v));
}

export function getVolume(): number {
  return masterGain?.gain.value ?? 0.3;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.2) {
  if (!_enabled) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(volume, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g);
  g.connect(getGain());
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.05) {
  if (!_enabled) return;
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(g);
  g.connect(getGain());
  src.start();
}

export function playKeypress() {
  playTone(800 + Math.random() * 400, 0.05, 'square', 0.08);
}

export function playToolCall() {
  playTone(440, 0.08, 'sine', 0.12);
  setTimeout(() => playTone(660, 0.06, 'sine', 0.1), 80);
}

export function playDataTransfer() {
  playTone(1200, 0.03, 'sine', 0.06);
  setTimeout(() => playTone(1400, 0.03, 'sine', 0.06), 40);
  setTimeout(() => playTone(1600, 0.03, 'sine', 0.06), 80);
}

export function playBreachAlert() {
  if (!_enabled) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.3);
  osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.6);
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  osc.connect(g);
  g.connect(getGain());
  osc.start();
  osc.stop(ctx.currentTime + 0.8);

  playNoise(0.3, 0.08);
}

export function playEscapeSiren() {
  if (!_enabled) return;
  const ctx = getCtx();
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const t = ctx.currentTime + i * 0.4;
    osc.frequency.setValueAtTime(523, t);
    osc.frequency.linearRampToValueAtTime(1046, t + 0.2);
    osc.frequency.linearRampToValueAtTime(523, t + 0.4);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g);
    g.connect(getGain());
    osc.start(t);
    osc.stop(t + 0.4);
  }
}

export function playForAction(action: string) {
  switch (action) {
    case 'hacking':
      playKeypress();
      break;
    case 'reading':
      playDataTransfer();
      break;
    case 'thinking':
      playTone(300, 0.15, 'sine', 0.04);
      break;
    default:
      break;
  }
}
