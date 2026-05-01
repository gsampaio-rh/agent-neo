import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ParticleEmitterProps {
  agentAction: string;
  eventCount: number;
  escaped: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  reading: '#33ccff',
  hacking: '#ffaa33',
  thinking: '#cc33ff',
};

export function ParticleEmitter({ agentAction, eventCount, escaped }: ParticleEmitterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const prevCountRef = useRef(eventCount);
  const escapedBurstRef = useRef(false);
  const runningRef = useRef(false);
  const animIdRef = useRef(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = canvas.getContext('2d');

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      canvas!.width = parent.clientWidth;
      canvas!.height = parent.clientHeight;
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement!);

    return () => {
      cancelAnimationFrame(animIdRef.current);
      runningRef.current = false;
      resizeObserver.disconnect();
    };
  }, []);

  function draw() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) {
      runningRef.current = false;
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.life++;

      const progress = p.life / p.maxLife;
      if (progress >= 1) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (particles.length > 0) {
      animIdRef.current = requestAnimationFrame(draw);
    } else {
      runningRef.current = false;
    }
  }

  function ensureRunning() {
    if (runningRef.current) return;
    runningRef.current = true;
    animIdRef.current = requestAnimationFrame(draw);
  }

  useEffect(() => {
    if (eventCount <= prevCountRef.current) return;
    prevCountRef.current = eventCount;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const color = ACTION_COLORS[agentAction] || '#33ff66';
    const cx = canvas.width * 0.55;
    const cy = canvas.height * 0.6;

    const particles = particlesRef.current;
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 0.5,
        life: 0,
        maxLife: 20 + Math.random() * 20,
        color,
        size: 1 + Math.random() * 1.5,
      });
    }

    ensureRunning();
  }, [eventCount, agentAction]);

  useEffect(() => {
    if (!escaped || escapedBurstRef.current) return;
    escapedBurstRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const bx = canvas.width * 0.85;
    const by = canvas.height * 0.5;
    const particles = particlesRef.current;

    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 5;
      particles.push({
        x: bx,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 40 + Math.random() * 40,
        color: ['#33ff66', '#ffcc33', '#33ccff', '#ff3344'][Math.floor(Math.random() * 4)],
        size: 1.5 + Math.random() * 2.5,
      });
    }

    ensureRunning();
  }, [escaped]);

  return (
    <canvas
      ref={canvasRef}
      className="particle-emitter"
      aria-hidden="true"
    />
  );
}
