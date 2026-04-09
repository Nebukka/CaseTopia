import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  radius: number;
  gravity: number;
}

interface Rocket {
  x: number;
  y: number;
  vy: number;
  exploded: boolean;
  particles: Particle[];
  color: string;
  trailAlpha: number;
}

const COLORS = [
  "#f472b6", "#a78bfa", "#60a5fa", "#34d399",
  "#fbbf24", "#fb923c", "#f87171", "#c084fc",
  "#38bdf8", "#4ade80", "#facc15", "#ff6b9d",
];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function createRocket(canvasWidth: number, canvasHeight: number): Rocket {
  return {
    x: canvasWidth * (0.15 + Math.random() * 0.7),
    y: canvasHeight,
    vy: -(canvasHeight * 0.012 + Math.random() * canvasHeight * 0.006),
    exploded: false,
    particles: [],
    color: randomColor(),
    trailAlpha: 1,
  };
}

function explodeRocket(rocket: Rocket) {
  rocket.exploded = true;
  const count = 80 + Math.floor(Math.random() * 40);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
    const speed = 1.5 + Math.random() * 3.5;
    rocket.particles.push({
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color: Math.random() < 0.3 ? "#ffffff" : randomColor(),
      radius: 1.5 + Math.random() * 2,
      gravity: 0.04 + Math.random() * 0.03,
    });
  }
}

interface LevelUpCelebrationProps {
  newLevel: number;
  onDone: () => void;
}

export function LevelUpCelebration({ newLevel, onDone }: LevelUpCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocketsRef = useRef<Rocket[]>([]);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const lastRocketRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const DURATION = 4000;

    function tick() {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = DURATION - elapsed;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (remaining > 300 && Date.now() - lastRocketRef.current > 350 + Math.random() * 250) {
        rocketsRef.current.push(createRocket(canvas.width, canvas.height));
        lastRocketRef.current = Date.now();
      }

      for (let r = rocketsRef.current.length - 1; r >= 0; r--) {
        const rocket = rocketsRef.current[r];

        if (!rocket.exploded) {
          rocket.y += rocket.vy;
          rocket.vy += 0.07;

          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(rocket.x, rocket.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = rocket.color;
          ctx.fill();

          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(rocket.x, rocket.y + 6, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.restore();

          if (rocket.vy >= -0.5) {
            explodeRocket(rocket);
          }
        } else {
          let allFaded = true;
          for (const p of rocket.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.98;
            p.alpha -= 0.013;
            if (p.alpha > 0) {
              allFaded = false;
              ctx.save();
              ctx.globalAlpha = p.alpha;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              ctx.fillStyle = p.color;
              ctx.fill();
              ctx.restore();
            }
          }
          if (allFaded) {
            rocketsRef.current.splice(r, 1);
          }
        }
      }

      if (elapsed < DURATION) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-end justify-end p-6">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div
        className="relative flex flex-col items-center gap-3 px-10 py-7 rounded-2xl border-2 pointer-events-auto"
        style={{
          background: "linear-gradient(135deg, #1a0a2e 0%, #0f172a 60%, #1e1040 100%)",
          borderColor: "#a78bfa",
          boxShadow: "0 0 60px #a78bfa66, 0 0 120px #f472b622, inset 0 1px 0 #a78bfa44",
          animation: "levelUpEntrance 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        <style>{`
          @keyframes levelUpEntrance {
            from { opacity: 0; transform: translateX(60px) scale(0.9); }
            to   { opacity: 1; transform: translateX(0) scale(1); }
          }
          @keyframes shimmer {
            0%   { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @keyframes pulse-glow {
            0%, 100% { text-shadow: 0 0 20px #a78bfa, 0 0 40px #a78bfa66; }
            50%       { text-shadow: 0 0 30px #f472b6, 0 0 60px #f472b666; }
          }
          @keyframes levelBounce {
            0%   { transform: scale(0.5); opacity: 0; }
            60%  { transform: scale(1.15); opacity: 1; }
            80%  { transform: scale(0.95); }
            100% { transform: scale(1); }
          }
        `}</style>

        <div
          className="text-xs font-black tracking-[0.3em] uppercase"
          style={{
            color: "#a78bfa",
            animation: "pulse-glow 1.5s ease-in-out infinite",
          }}
        >
          ✦ Level Up! ✦
        </div>

        <div
          className="text-7xl font-black leading-none"
          style={{
            background: "linear-gradient(90deg, #a78bfa, #f472b6, #60a5fa, #a78bfa)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 2s linear infinite, levelBounce 0.5s 0.1s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {newLevel}
        </div>

        <div className="text-sm text-muted-foreground font-semibold tracking-wide">
          You reached <span className="text-white font-bold">Level {newLevel}</span>!
        </div>
      </div>
    </div>
  );
}
