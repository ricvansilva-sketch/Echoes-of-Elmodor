import React, { useEffect, useRef } from 'react';
import { CharacterSheetId, PortraitMood, SwordElement } from '../game/tacticsEngine';

export type AnimatedPortraitVariant = 'hud' | 'crest' | 'inspect' | 'status';

interface AnimatedPortraitProps {
  src: string | undefined;
  sheetId: CharacterSheetId;
  name: string;
  mood?: PortraitMood;
  isEnemy: boolean;
  swordElement?: SwordElement;
  hidden?: boolean;
  variant?: AnimatedPortraitVariant;
  className?: string;
}

const EMBER_SPECS = [
  { left: '16%', bottom: '12%', delay: '0s', duration: '3.2s', size: 3 },
  { left: '34%', bottom: '6%', delay: '1.1s', duration: '3.9s', size: 2.5 },
  { left: '62%', bottom: '10%', delay: '0.5s', duration: '3.4s', size: 3 },
  { left: '80%', bottom: '16%', delay: '1.9s', duration: '4.1s', size: 2 },
  { left: '48%', bottom: '4%', delay: '2.3s', duration: '3.6s', size: 2.5 },
];

interface LiveParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  smoke: boolean;
}

/**
 * True Frame-by-Frame Animated Living Portrait Canvas for the bottom-left HUD profile pic.
 * Renders continuous GIF-like character movement: sinusoidal wind-wave cloth & hair ripple,
 * breathing chest heave, subtle head bob, dynamic eye/firelight pulse, and live elemental
 * particles (Aryon Fire Mage flames, Aiori Ferunium Fire / Auruinum Arcane sword aura,
 * and Shadow's swirling Smoke Screen wisps).
 */
const LiveMotionPortraitCanvas: React.FC<{
  src: string;
  sheetId: CharacterSheetId;
  mood: PortraitMood;
  swordElement: SwordElement;
  hidden: boolean;
}> = ({ src, sheetId, mood, swordElement, hidden }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ sheetId, mood, swordElement, hidden });
  stateRef.current = { sheetId, mood, swordElement, hidden };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 192;
    const H = 224;
    canvas.width = W;
    canvas.height = H;

    let disposed = false;
    let rafId = 0;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const particles: LiveParticle[] = Array.from({ length: 16 }, (_, idx) => ({
      x: (idx * 37) % W,
      y: H * (0.2 + ((idx * 19) % 80) / 100),
      vx: ((idx % 5) - 2) * 4,
      vy: -14 - (idx % 4) * 7,
      r: 1.5 + (idx % 3) * 1.1,
      life: (idx * 0.23) % 2.4,
      maxLife: 1.8 + (idx % 4) * 0.5,
      smoke: idx % 3 === 0,
    }));

    let lastTime = performance.now();
    let lastDraw = 0;

    const drawLoop = (now: number) => {
      if (disposed) return;
      // Smooth ~24fps GIF-style cadence for crisp character motion with minimal CPU overhead
      if (now - lastDraw < 40 && !reducedMotion) {
        rafId = requestAnimationFrame(drawLoop);
        return;
      }
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;
      lastDraw = now;

      const t = now * 0.001;
      const st = stateRef.current;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0c0f15';
      ctx.fillRect(0, 0, W, H);

      if (img.complete && img.naturalWidth > 0) {
        // Compute cover crop aligned to face/upper-torso
        const sw = img.naturalWidth;
        const sh = img.naturalHeight;
        const targetAspect = W / H;
        const srcAspect = sw / sh;
        let cropW = sw;
        let cropH = sh;
        let cropX = 0;
        let cropY = 0;

        if (srcAspect > targetAspect) {
          cropW = sh * targetAspect;
          cropX = st.sheetId === 'panther' ? (sw - cropW) * 0.56 : (sw - cropW) * 0.5;
        } else {
          cropH = sw / targetAspect;
          cropY = st.sheetId === 'panther' ? (sh - cropH) * 0.18 : (sh - cropH) * 0.1;
        }

        // Layered sinusoidal strip animation:
        // - Upper hair & lower cloak ripple smoothly in the highland wind
        // - Chest gently heaves with organic breathing cycle
        const strips = 28;
        const breath = reducedMotion ? 0 : Math.sin(t * 2.15);
        const headBob = reducedMotion ? 0 : Math.sin(t * 2.15 - 0.55) * 1.7;
        const swayX = reducedMotion ? 0 : Math.sin(t * 1.45) * 1.8;

        ctx.save();
        if (st.hidden) {
          ctx.globalAlpha = 0.64 + Math.sin(t * 3.1) * 0.12;
        }

        const scaleX = 1.045 + breath * 0.012;
        const scaleY = 1.045 + breath * 0.018;
        const drawW = W * scaleX;
        const drawH = H * scaleY;
        const baseX = (W - drawW) / 2 + swayX;
        const baseY = (H - drawH) / 2 + headBob;

        for (let i = 0; i < strips; i++) {
          const frac0 = i / strips;
          const frac1 = (i + 1) / strips;
          const sy = cropY + frac0 * cropH;
          const shSlice = Math.max(1, (frac1 - frac0) * cropH);
          const dy = baseY + frac0 * drawH;
          const dhSlice = Math.ceil((frac1 - frac0) * drawH) + 1;

          // Stronger wind wave on hair (top 32%) and cloak/mane (bottom 38%), steady across eyes/face
          const windAmp =
            reducedMotion
              ? 0
              : frac0 < 0.3
              ? 2.2 * (1 - frac0 / 0.3)
              : frac0 > 0.62
              ? 2.8 * ((frac0 - 0.62) / 0.38)
              : 0.45;
          const waveX = Math.sin(t * 3.6 + frac0 * 7.5) * windAmp;

          ctx.drawImage(
            img,
            cropX,
            sy,
            cropW,
            shSlice,
            baseX + waveX,
            dy,
            drawW,
            dhSlice
          );
        }
        ctx.restore();

        // Subtle animated atmospheric rim & elemental glow
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
        let glowRgb = '232, 186, 102';
        if (st.mood === 'hurt') glowRgb = '238, 68, 62';
        else if (st.sheetId === 'aryon') glowRgb = '255, 102, 54';
        else if (st.sheetId === 'aiori' && st.swordElement === 'ferunium') glowRgb = '255, 88, 52';
        else if (st.sheetId === 'aiori' && st.swordElement === 'auruinum') glowRgb = '88, 178, 255';
        else if (st.sheetId === 'panther') glowRgb = st.hidden ? '138, 92, 224' : '244, 152, 52';

        const grad = ctx.createRadialGradient(
          W * 0.5,
          H * 0.85,
          12,
          W * 0.5,
          H * 0.6,
          H * 0.72
        );
        grad.addColorStop(0, `rgba(${glowRgb}, ${0.22 + pulse * 0.14})`);
        grad.addColorStop(0.65, `rgba(${glowRgb}, 0.04)`);
        grad.addColorStop(1, 'rgba(8, 10, 15, 0.42)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Animated elemental embers / smoke screen wisps
        if (!reducedMotion) {
          for (const p of particles) {
            p.life += dt;
            if (p.life >= p.maxLife) {
              p.life = 0;
              p.x = Math.random() * W;
              p.y = H + 4;
            }
            const progress = p.life / p.maxLife;
            p.x += (p.vx + Math.sin(t * 2.5 + p.y * 0.06) * 9) * dt;
            p.y += p.vy * dt;

            const alpha = Math.sin(progress * Math.PI);
            if (st.sheetId === 'panther' && (p.smoke || st.hidden)) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.r * 5.2, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(38, 24, 58, ${alpha * (st.hidden ? 0.5 : 0.28)})`;
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.r * (1.2 - progress * 0.5), 0, Math.PI * 2);
              ctx.fillStyle = `rgba(${glowRgb}, ${alpha * 0.88})`;
              ctx.fill();
            }
          }
        }

        // Specular diagonal glint sweep every ~4.5s
        const glintPhase = (t % 4.6) / 4.6;
        if (!reducedMotion && glintPhase < 0.24) {
          const gx = -W * 0.4 + (glintPhase / 0.24) * (W * 1.8);
          const gGrad = ctx.createLinearGradient(gx - 28, 0, gx + 28, H * 0.4);
          gGrad.addColorStop(0, 'rgba(255,244,214,0)');
          gGrad.addColorStop(0.5, 'rgba(255,244,214,0.18)');
          gGrad.addColorStop(1, 'rgba(255,244,214,0)');
          ctx.fillStyle = gGrad;
          ctx.fillRect(0, 0, W, H);
        }
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(drawLoop);
      }
    };

    img.onload = () => {
      if (!disposed) {
        rafId = requestAnimationFrame(drawLoop);
      }
    };
    img.src = src;

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="w-full h-full block object-cover"
    />
  );
};

/**
 * Modern Living Animated Character Portrait Component.
 * - Bottom-left HUD (`variant="hud"`): real-time multi-layer animated motion canvas
 *   (wind-rippling hair/cloak, breathing heave, elemental flames/sparks/smoke).
 * - Inspect / Status / Turn Crests: full-bleed glamour portrait with smooth GPU motion & embers.
 */
export const AnimatedPortrait: React.FC<AnimatedPortraitProps> = ({
  src,
  sheetId,
  name,
  mood = 'neutral',
  isEnemy,
  swordElement = 'none',
  hidden = false,
  variant = 'hud',
  className = '',
}) => {
  const emberColor =
    sheetId === 'aryon'
      ? '#ff6b42'
      : sheetId === 'aiori'
      ? swordElement === 'ferunium'
        ? '#ff5a3c'
        : swordElement === 'auruinum'
        ? '#58b4ff'
        : '#f5c76e'
      : hidden
      ? '#a27bff'
      : '#ff9d3b';

  const auraGradient =
    mood === 'hurt'
      ? 'radial-gradient(circle at 50% 45%, rgba(235, 64, 58, 0.36), rgba(10, 12, 16, 0.2) 70%)'
      : mood === 'attacking'
      ? 'radial-gradient(circle at 50% 45%, rgba(242, 178, 72, 0.28), rgba(10, 12, 16, 0.14) 70%)'
      : mood === 'wounded'
      ? 'radial-gradient(circle at 50% 50%, rgba(120, 22, 24, 0.32), rgba(8, 9, 12, 0.45) 80%)'
      : isEnemy
      ? 'radial-gradient(circle at 50% 25%, rgba(224, 96, 52, 0.14), rgba(8, 10, 14, 0.32) 82%)'
      : 'radial-gradient(circle at 50% 25%, rgba(226, 184, 106, 0.14), rgba(8, 10, 14, 0.28) 82%)';

  const objectPosition =
    sheetId === 'panther'
      ? 'object-[56%_22%]'
      : sheetId === 'aiori'
      ? 'object-[50%_14%]'
      : 'object-[50%_12%]';

  // Bottom-left profile portrait uses true continuous frame-by-frame animated motion canvas
  if (variant === 'hud' && src) {
    return (
      <div
        className={`relative overflow-hidden bg-[#0c0f15] select-none ${className}`}
        role="img"
        aria-label={`${name} animated portrait (${mood})`}
      >
        <LiveMotionPortraitCanvas
          src={src}
          sheetId={sheetId}
          mood={mood}
          swordElement={swordElement}
          hidden={hidden}
        />
      </div>
    );
  }

  const showParticles = variant !== 'crest';
  const emberCount = variant === 'status' ? 5 : 3;

  return (
    <div
      className={`relative overflow-hidden bg-[#0c0f15] select-none ${className}`}
      aria-label={`${name} portrait (${mood})`}
    >
      {src ? (
        <img
          src={src}
          alt={`${name} (${mood})`}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover ${objectPosition} will-change-transform ${
            variant === 'status'
              ? 'animate-portrait-sway'
              : variant === 'crest'
              ? ''
              : 'animate-portrait-breathe'
          } ${
            hidden
              ? 'opacity-70 saturate-[0.7]'
              : mood === 'wounded'
              ? 'saturate-[0.76] contrast-[1.08]'
              : mood === 'attacking'
              ? 'brightness-[1.08] contrast-[1.06]'
              : ''
          }`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-display font-bold text-sm text-[#a89e8c]">
          {name.slice(0, 2)}
        </div>
      )}

      {/* Living Mood & Rim Aura Overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: auraGradient }}
      />

      {/* Soft Highland Mist Rolling Along Bottom Edge */}
      {showParticles && (
        <div
          aria-hidden="true"
          className="absolute inset-x-[-14%] bottom-0 h-[36%] pointer-events-none animate-mist-drift"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(14, 18, 26, 0.42) 55%, rgba(8, 10, 15, 0.82) 100%)',
          }}
        />
      )}

      {/* Rising Drifting Embers / Arcane Motes */}
      {showParticles && (
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          {EMBER_SPECS.slice(0, emberCount).map((e, idx) => (
            <span
              key={idx}
              className="absolute rounded-full animate-ember-drift"
              style={{
                left: e.left,
                bottom: e.bottom,
                width: `${variant === 'status' ? e.size + 1.5 : e.size}px`,
                height: `${variant === 'status' ? e.size + 1.5 : e.size}px`,
                backgroundColor: emberColor,
                boxShadow: `0 0 ${variant === 'status' ? 10 : 6}px ${emberColor}`,
                animationDelay: e.delay,
                animationDuration: e.duration,
              }}
            />
          ))}
        </div>
      )}

      {/* Subtle Specular Glint Sweep Across Portrait */}
      {variant !== 'crest' && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-[34%] pointer-events-none animate-portrait-glint"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255, 240, 206, 0.24), transparent)',
          }}
        />
      )}
    </div>
  );
};
