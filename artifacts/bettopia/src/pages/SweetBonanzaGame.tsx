import React, { useState, useCallback, useRef } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../contexts/AuthContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

// ── Symbol config ────────────────────────────────────────────
const SYMS = [
  { emoji: "🍬", label: "Candy",      bg: "from-red-500 to-pink-400",       glow: "shadow-red-400"    }, // 0 RED
  { emoji: "💙", label: "Blue",       bg: "from-blue-500 to-cyan-400",      glow: "shadow-blue-400"   }, // 1 BLUE
  { emoji: "💜", label: "Purple",     bg: "from-purple-500 to-violet-400",  glow: "shadow-purple-400" }, // 2 PURPLE
  { emoji: "🍎", label: "Apple",      bg: "from-green-500 to-emerald-400",  glow: "shadow-green-400"  }, // 3 APPLE
  { emoji: "🍑", label: "Peach",      bg: "from-orange-400 to-amber-300",   glow: "shadow-orange-400" }, // 4 PLUM
  { emoji: "🍉", label: "Watermelon", bg: "from-green-600 to-red-400",      glow: "shadow-green-400"  }, // 5 WATERMELON
  { emoji: "🍇", label: "Grape",      bg: "from-purple-700 to-purple-500",  glow: "shadow-purple-500" }, // 6 GRAPE
  { emoji: "🍭", label: "Lollipop",   bg: "from-pink-500 to-yellow-300",    glow: "shadow-pink-400"   }, // 7 LOLLIPOP
  { emoji: "⭐", label: "Scatter",    bg: "from-yellow-400 to-amber-300",   glow: "shadow-yellow-400" }, // 8 SCATTER
  { emoji: "✨", label: "Mult",       bg: "from-yellow-300 to-orange-400",  glow: "shadow-yellow-300" }, // 9 MULTIPLIER
];

const BET_OPTIONS = [0.2, 0.4, 0.8, 1, 2, 4, 8, 10, 20, 50];
const EMPTY_GRID = (): number[][] =>
  Array.from({ length: 5 }, () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 8)));

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface CascadeStep {
  grid: number[][];
  winPos: [number, number][];
  multPos: { pos: [number, number]; val: number }[];
  cascadeWin: number;
  appliedMult: number;
}

interface SpinResult {
  baseGrid: number[][];
  baseSteps: CascadeStep[];
  baseFinalGrid: number[][];
  scatterCount: number;
  freeSpinsCount: number;
  fsResults: {
    grid: number[][];
    steps: CascadeStep[];
    finalGrid: number[][];
    spinWin: number;
    accMult: number[];
  }[];
  totalWin: number;
  newBalance: number;
}

// ── Audio ────────────────────────────────────────────────────
function playWinSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch { /* ignore */ }
}

function playBigWinSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [440, 550, 660, 880].forEach((freq, i) => {
      const now = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  } catch { /* ignore */ }
}

// ── Cell component ───────────────────────────────────────────
interface CellProps {
  sym: number;
  multVal?: number;
  highlighted: boolean;
  removing: boolean;
  spinning: boolean;
}

const Cell: React.FC<CellProps> = ({ sym, multVal, highlighted, removing, spinning }) => {
  if (sym < 0) return <div className="aspect-square rounded-xl bg-black/20" />;
  const cfg = SYMS[sym] ?? SYMS[0];
  return (
    <div
      className={cn(
        "aspect-square rounded-xl bg-gradient-to-br flex flex-col items-center justify-center relative select-none transition-all duration-300",
        cfg.bg,
        highlighted && `ring-4 ring-yellow-300 ring-offset-1 ring-offset-black scale-105 shadow-lg ${cfg.glow}`,
        removing && "opacity-0 scale-75",
        spinning && "animate-pulse opacity-60",
      )}
    >
      <span className="text-2xl sm:text-3xl leading-none pointer-events-none">
        {sym === 9 ? "✨" : cfg.emoji}
      </span>
      {sym === 9 && multVal !== undefined && (
        <span className="text-xs font-black text-black leading-none">×{multVal}</span>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────
export default function SweetBonanzaGame() {
  const { user, updateUser } = useAuth();
  const { formatBalance: format } = useCurrency();

  const [grid, setGrid] = useState<number[][]>(EMPTY_GRID);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [multOverlay, setMultOverlay] = useState<Map<string, number>>(new Map());
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [spinning, setSpinning] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [betAmount, setBetAmount] = useState(1);
  const [winAmount, setWinAmount] = useState(0);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [totalFreeSpins, setTotalFreeSpins] = useState(0);
  const [accMults, setAccMults] = useState<number[]>([]);
  const [showFSIntro, setShowFSIntro] = useState(false);
  const [phase, setPhase] = useState<"idle" | "animating" | "done">("idle");
  const [error, setError] = useState("");
  const abortRef = useRef(false);

  const key = (r: number, c: number) => `${r},${c}`;

  async function playAnimation(result: SpinResult) {
    abortRef.current = false;
    setAnimating(true);
    setPhase("animating");
    setWinAmount(0);
    setHighlighted(new Set());
    setRemoving(new Set());
    setMultOverlay(new Map());
    setFreeSpinsLeft(0);
    setAccMults([]);

    // ── Show initial spin ──────────────────────────
    setSpinning(true);
    await sleep(400);
    setSpinning(false);
    setGrid(result.baseGrid);
    await sleep(300);

    let runningWin = 0;

    // ── Base cascades ──────────────────────────────
    for (let i = 0; i < result.baseSteps.length; i++) {
      if (abortRef.current) break;
      const step = result.baseSteps[i];
      const nextGrid =
        i + 1 < result.baseSteps.length
          ? result.baseSteps[i + 1].grid
          : result.baseFinalGrid;

      const winSet = new Set(step.winPos.map(([r, c]) => key(r, c)));
      const multMap = new Map(step.multPos.map((m) => [key(m.pos[0], m.pos[1]), m.val]));

      setHighlighted(winSet);
      setMultOverlay(multMap);
      runningWin = parseFloat((runningWin + step.cascadeWin).toFixed(4));
      setWinAmount(runningWin);
      playWinSound();
      await sleep(800);

      // Remove
      const removeSet = new Set([...winSet, ...step.multPos.map((m) => key(m.pos[0], m.pos[1]))]);
      setRemoving(removeSet);
      setHighlighted(new Set());
      await sleep(300);

      setRemoving(new Set());
      setMultOverlay(new Map());
      setGrid(nextGrid);
      await sleep(350);
    }

    // ── Free spins ─────────────────────────────────
    if (result.freeSpinsCount > 0) {
      setShowFSIntro(true);
      setTotalFreeSpins(result.freeSpinsCount);
      playBigWinSound();
      await sleep(2200);
      setShowFSIntro(false);
      await sleep(300);

      for (let fi = 0; fi < result.fsResults.length; fi++) {
        if (abortRef.current) break;
        const fs = result.fsResults[fi];
        setFreeSpinsLeft(result.freeSpinsCount - fi);

        setSpinning(true);
        await sleep(400);
        setSpinning(false);
        setGrid(fs.grid);
        await sleep(300);

        let fsAccMults: number[] = [];

        for (let i = 0; i < fs.steps.length; i++) {
          if (abortRef.current) break;
          const step = fs.steps[i];
          const nextGrid =
            i + 1 < fs.steps.length ? fs.steps[i + 1].grid : fs.finalGrid;

          if (step.multPos.length > 0) {
            fsAccMults = [...fsAccMults, ...step.multPos.map((m) => m.val)];
            setAccMults([...fsAccMults]);
          }

          const winSet = new Set(step.winPos.map(([r, c]) => key(r, c)));
          const multMap = new Map(step.multPos.map((m) => [key(m.pos[0], m.pos[1]), m.val]));

          setHighlighted(winSet);
          setMultOverlay(multMap);
          runningWin = parseFloat((runningWin + step.cascadeWin).toFixed(4));
          setWinAmount(runningWin);
          if (step.cascadeWin > 0) playWinSound();
          await sleep(800);

          const removeSet = new Set([...winSet, ...step.multPos.map((m) => key(m.pos[0], m.pos[1]))]);
          setRemoving(removeSet);
          setHighlighted(new Set());
          await sleep(300);
          setRemoving(new Set());
          setMultOverlay(new Map());
          setGrid(nextGrid);
          await sleep(350);
        }
      }

      setFreeSpinsLeft(0);
      setAccMults([]);
    }

    // ── Done ───────────────────────────────────────
    setWinAmount(result.totalWin);
    if (result.totalWin > 0) playBigWinSound();
    setPhase("done");
    updateUser({ balance: result.newBalance });
    setAnimating(false);
  }

  const spin = useCallback(
    async (isBonusBuy = false) => {
      if (animating) return;
      if (!user) { setError("Login to play"); return; }
      const cost = isBonusBuy ? betAmount * 100 : betAmount;
      if ((user.balance ?? 0) < cost) { setError("Insufficient balance"); return; }

      setError("");
      setPhase("idle");
      setWinAmount(0);
      setAnimating(true);
      setSpinning(true);

      try {
        const token = localStorage.getItem("bettopia_token");
        const res = await fetch("/api/games/sweet-bonanza/spin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ betAmount, isBonusBuy }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Spin failed");
        }

        const result: SpinResult = await res.json();
        // Optimistic balance deduct
        updateUser({ balance: (user.balance ?? 0) - cost });
        await playAnimation(result);
      } catch (err: any) {
        setError(err.message || "Something went wrong");
        setSpinning(false);
        setAnimating(false);
      }
    },
    [animating, user, betAmount, updateUser]
  );

  const isFreeSpin = freeSpinsLeft > 0;

  return (
    <Layout>
      <div
        className={cn(
          "min-h-screen flex flex-col items-center gap-4 py-4 px-2 relative transition-colors duration-500",
          isFreeSpin
            ? "bg-gradient-to-b from-purple-950 via-purple-900 to-black"
            : "bg-gradient-to-b from-slate-950 to-black"
        )}
      >
        {/* ── Free Spins intro overlay ── */}
        {showFSIntro && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 animate-pulse">
            <div className="text-center">
              <p className="text-yellow-300 text-6xl font-black mb-4 drop-shadow-lg">⭐</p>
              <p className="text-yellow-300 text-5xl font-black tracking-widest drop-shadow-lg">FREE SPINS!</p>
              <p className="text-white text-3xl font-bold mt-2">{totalFreeSpins} Spins Awarded</p>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="w-full max-w-2xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Sweet Bonanza</h1>
            <p className="text-xs text-muted-foreground">Cluster Pays · Tumble</p>
          </div>
          {user && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-lg font-bold text-white">{format(user.balance ?? 0)}</p>
            </div>
          )}
        </div>

        {/* ── Free Spins badge ── */}
        {freeSpinsLeft > 0 && (
          <div className="flex items-center gap-3 bg-yellow-400/20 border border-yellow-400/50 rounded-xl px-4 py-2">
            <span className="text-yellow-300 font-black text-lg">⭐ FREE SPINS</span>
            <span className="text-white font-bold text-xl">{freeSpinsLeft}</span>
            <span className="text-white/60 text-sm">remaining</span>
          </div>
        )}

        {/* ── Accumulated multipliers ── */}
        {accMults.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-yellow-300 text-sm font-bold">Multipliers:</span>
            {accMults.map((v, i) => (
              <span key={i} className="bg-yellow-400 text-black text-xs font-black px-2 py-0.5 rounded-full">
                ×{v}
              </span>
            ))}
            <span className="text-yellow-300 text-sm font-bold">
              = ×{accMults.reduce((a, b) => a + b, 0)}
            </span>
          </div>
        )}

        {/* ── Game grid ── */}
        <div
          className={cn(
            "w-full max-w-2xl p-2 rounded-2xl border transition-colors duration-500",
            isFreeSpin
              ? "bg-purple-900/60 border-purple-500/50"
              : "bg-black/60 border-white/10"
          )}
        >
          <div className="grid grid-cols-6 gap-1.5">
            {grid.map((row, r) =>
              row.map((sym, c) => {
                const k = key(r, c);
                const multVal = multOverlay.get(k);
                const symToShow = sym === 9 && multVal !== undefined ? 9 : sym;
                return (
                  <Cell
                    key={k}
                    sym={symToShow}
                    multVal={multVal}
                    highlighted={highlighted.has(k)}
                    removing={removing.has(k)}
                    spinning={spinning}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* ── Win display ── */}
        <div className="w-full max-w-2xl text-center min-h-[48px]">
          {phase === "animating" && winAmount > 0 && (
            <div className="text-3xl font-black text-yellow-300 animate-pulse">
              +{format(winAmount)}
            </div>
          )}
          {phase === "done" && (
            <div className={cn("font-black text-3xl", winAmount > 0 ? "text-yellow-300" : "text-white/40")}>
              {winAmount > 0 ? `+${format(winAmount)} 🎉` : "Better luck next time"}
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <p className="text-red-400 text-sm font-medium">{error}</p>
        )}

        {/* ── Controls ── */}
        <div className="w-full max-w-2xl space-y-3">
          {/* Bet selector */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Bet Amount</p>
            <div className="flex flex-wrap gap-1.5">
              {BET_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setBetAmount(opt)}
                  disabled={animating}
                  className={cn(
                    "px-3 py-1 rounded-lg text-sm font-bold transition-all border",
                    betAmount === opt
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                  )}
                >
                  {opt} DL
                </button>
              ))}
            </div>
          </div>

          {/* Spin / Buy Bonus */}
          <div className="flex gap-3">
            <Button
              className="flex-1 h-14 text-lg font-black bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-400 hover:to-orange-300 text-white border-0 shadow-lg"
              onClick={() => spin(false)}
              disabled={animating || !user}
            >
              {spinning ? "🎰 Spinning..." : animating ? "⚡ Playing..." : `🎰 Spin  (${betAmount} DL)`}
            </Button>
            <Button
              variant="outline"
              className="h-14 px-4 font-bold text-sm border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/10"
              onClick={() => spin(true)}
              disabled={animating || !user}
              title={`Buy Bonus — ${betAmount * 100} DL`}
            >
              ⭐ Buy<br />
              <span className="text-xs">{betAmount * 100} DL</span>
            </Button>
          </div>

          {/* Pay table mini */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-xs text-muted-foreground mb-2 font-semibold">Cluster Pays (8+ symbols)</p>
            <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-xs">
              {SYMS.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span>{s.emoji}</span>
                  <span className="text-muted-foreground">{["0.2x","0.3x","0.5x","0.8x","1x","1.5x","2x","8x"][i]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">⭐ 4+ Scatters = Free Spins · ⭐ Buy Feature = 100× bet</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
