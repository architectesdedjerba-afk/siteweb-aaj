/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

interface ParticleFieldProps {
  className?: string;
  /** Approximate particle count at 1920×1080. Auto-scales by area. */
  density?: number;
  /** Hex colors used for fill. Cycled per particle. */
  colors?: string[];
  /** Max distance (px) at which two particles are linked by a line. */
  linkDistance?: number;
  /** Cursor influence radius in px. */
  mouseRadius?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
}

/**
 * Canvas-based particle background. Reactive to mouse:
 *  - particles within `mouseRadius` are pushed gently away
 *  - links between close particles fade in proportional to proximity
 *  - particles within `mouseRadius` connect to the cursor with a brighter line
 *
 * Optimized for 60fps:
 *  - single rAF loop, no React re-renders during animation
 *  - canvas backing-store sized to devicePixelRatio capped at 1.75
 *  - pause via IntersectionObserver when scrolled offscreen
 *  - skipped entirely under prefers-reduced-motion
 */
export const ParticleField = ({
  className,
  density = 90,
  colors = ["#00E5FF", "#4D7FFF", "#FFC371"],
  linkDistance = 130,
  mouseRadius = 160,
}: ParticleFieldProps) => {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;
    const mouse = { x: -9999, y: -9999, active: false };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Scale particle count by viewport area
      const area = rect.width * rect.height;
      const baseArea = 1920 * 1080;
      const target = Math.max(20, Math.round(density * Math.sqrt(area / baseArea)));
      if (particles.length < target) {
        for (let i = particles.length; i < target; i++) {
          particles.push(spawn(rect.width, rect.height));
        }
      } else if (particles.length > target) {
        particles.length = target;
      }
    };

    const spawn = (w: number, h: number): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 0.7 + Math.random() * 1.6,
      c: colors[Math.floor(Math.random() * colors.length)],
    });

    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active =
        mouse.x >= 0 && mouse.x <= rect.width && mouse.y >= 0 && mouse.y <= rect.height;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const tick = () => {
      if (!running) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      // Update positions
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Mouse repulsion
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          const r2 = mouseRadius * mouseRadius;
          if (d2 < r2 && d2 > 0.5) {
            const d = Math.sqrt(d2);
            const force = (1 - d / mouseRadius) * 0.6;
            p.vx += (dx / d) * force;
            p.vy += (dy / d) * force;
          }
        }

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }

      // Draw links — O(n²) but n is small (~90); still ~8k pair checks
      const ld2 = linkDistance * linkDistance;
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < ld2) {
            const a = (1 - d2 / ld2) * 0.18;
            ctx.strokeStyle = `rgba(0, 229, 255, ${a})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        // Cursor links — brighter
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          const cr2 = mouseRadius * mouseRadius;
          if (d2 < cr2) {
            const a = (1 - d2 / cr2) * 0.5;
            ctx.strokeStyle = `rgba(0, 229, 255, ${a})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.9;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !raf) {
          running = true;
          raf = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting) {
          running = false;
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    raf = requestAnimationFrame(tick);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      particles = [];
    };
  }, [reduce, density, colors, linkDistance, mouseRadius]);

  return (
    <div ref={wrapRef} className={`absolute inset-0 ${className ?? ""}`}>
      <canvas ref={canvasRef} className="aaj-particles-canvas w-full h-full block" />
    </div>
  );
};
