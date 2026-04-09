import React, { useState, useCallback, useRef } from "react";
import navalMineSrc from "@assets/naval_mine_1775530215571.webp";
import { Layout } from "../components/Layout";
import { TrySomethingElse } from "../components/TrySomethingElse";
import { useStartMines, useRevealMines, useCashoutMines } from "@workspace/api-client-react";
import { GemIcon } from "../components/GemIcon";
import { useAuth } from "../contexts/AuthContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import { Diamond, Shuffle } from "lucide-react";
import { motion } from "framer-motion";

/* ── Web Audio sound synthesis ─────────────────────────────── */
function getAudioCtx(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

function playDiamondSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1320, now);
  osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.08);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.25);
  osc2.stop(now + 0.25);
}

function playCashoutSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  /* Ascending coin-chime cascade */
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    const onset = i * 0.07;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + onset);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.04, now + onset + 0.12);

    const harm = ctx.createOscillator();
    harm.type = "triangle";
    harm.frequency.setValueAtTime(freq * 2, now + onset);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + onset);
    gain.gain.linearRampToValueAtTime(0.16, now + onset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + onset + 0.38);

    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0, now + onset);
    harmGain.gain.linearRampToValueAtTime(0.06, now + onset + 0.01);
    harmGain.gain.exponentialRampToValueAtTime(0.001, now + onset + 0.22);

    osc.connect(gain); gain.connect(ctx.destination);
    harm.connect(harmGain); harmGain.connect(ctx.destination);

    osc.start(now + onset); osc.stop(now + onset + 0.42);
    harm.start(now + onset); harm.stop(now + onset + 0.26);
  });

  /* Low warm "cash" thud at the start */
  const thud = ctx.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(180, now);
  thud.frequency.exponentialRampToValueAtTime(60, now + 0.18);
  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0.22, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  thud.connect(thudGain); thudGain.connect(ctx.destination);
  thud.start(now); thud.stop(now + 0.25);
}

function playExplosionSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  /* White noise burst */
  const bufferSize = ctx.sampleRate * 0.6;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.8);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.55, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

  /* Low boom oscillator */
  const boom = ctx.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(120, now);
  boom.frequency.exponentialRampToValueAtTime(28, now + 0.35);

  const boomGain = ctx.createGain();
  boomGain.gain.setValueAtTime(0.45, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  /* Distortion filter on noise */
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  boom.connect(boomGain);
  boomGain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.65);
  boom.start(now);
  boom.stop(now + 0.5);
}

/* ─────────────────────────────────────────────────────────── */

export default function Mines() {
  const { user, updateUser, deltaBalance } = useAuth();
  const { displayToDl, dlToDisplay, formatBalance, label } = useCurrency();
  const [betAmount, setBetAmount] = useState<number>(10);
  const [mineCount, setMineCount] = useState<number>(3);

  const [gameId, setGameId] = useState<string | null>(null);
  const [revealedTiles, setRevealedTiles] = useState<Record<number, 'diamond' | 'mine'>>({});
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [allMines, setAllMines] = useState<number[]>([]);

  const startMutation = useStartMines();
  const revealMutation = useRevealMines();
  const cashoutMutation = useCashoutMines();
  const { toast } = useToast();

  const handleStart = () => {
    if (!user) {
      toast({ title: "Login required", variant: "destructive" });
      return;
    }

    startMutation.mutate({ data: { amount: betAmount, mineCount } }, {
      onSuccess: (res) => {
        deltaBalance(-betAmount);
        setGameId(res.gameId);
        setRevealedTiles({});
        setIsGameOver(false);
        setCurrentMultiplier(1.0);
        setAllMines([]);
      },
      onError: (err: any) => {
        toast({ title: "Error starting game", description: err.data?.error || err.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  const handleReveal = (index: number) => {
    if (!gameId || isGameOver || revealedTiles[index] || revealMutation.isPending) return;

    revealMutation.mutate({ data: { gameId, tileIndex: index } }, {
      onSuccess: (res) => {
        if (res.isMine) {
          playExplosionSound();
        } else {
          playDiamondSound();
        }

        setRevealedTiles(prev => ({
          ...prev,
          [index]: res.isMine ? 'mine' : 'diamond'
        }));

        if (typeof (res as any).newBalance === "number") {
          updateUser({ balance: (res as any).newBalance, ...((res as any).newLevel != null ? { level: (res as any).newLevel } : {}) });
        }
        if (res.gameOver) {
          setIsGameOver(true);
          setGameId(null);
          if (res.minePositions) setAllMines(res.minePositions);
          { const { dismiss } = toast({ title: res.isMine ? "BOOM! You hit a mine!" : "Game Over", variant: "destructive" }); setTimeout(dismiss, 3000); }
        } else {
          setCurrentMultiplier(res.currentMultiplier);
        }
      },
      onError: (err: any) => {
        const errMsg: string = err.data?.error || err.message || "Unknown error";
        if (errMsg.toLowerCase().includes("not active") || errMsg.toLowerCase().includes("not found")) {
          setIsGameOver(true);
          setGameId(null);
        }
        toast({ title: "Error revealing tile", description: errMsg, variant: "destructive" });
      }
    });
  };

  const handleAutoSelect = () => {
    if (!gameId || isGameOver || revealMutation.isPending) return;
    const unrevealed = Array.from({ length: 25 }, (_, i) => i).filter(i => !revealedTiles[i]);
    if (unrevealed.length === 0) return;
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    handleReveal(pick);
  };

  const handleCashout = () => {
    if (!gameId || isGameOver) return;

    cashoutMutation.mutate({ data: { gameId } }, {
      onSuccess: (res) => {
        playCashoutSound();
        if (typeof (res as any).newBalance === "number") {
          updateUser({ balance: (res as any).newBalance, ...((res as any).newLevel != null ? { level: (res as any).newLevel } : {}) });
        }
        setIsGameOver(true);
        setGameId(null);
        if (res.minePositions) setAllMines(res.minePositions);
        { const { dismiss } = toast({ title: <span className="text-2xl font-black text-green-400">Cashed out!</span>, description: <span className="text-xl font-bold flex items-center gap-1">Won {formatBalance(betAmount + res.profit)} <GemIcon size={18} /></span> }); setTimeout(dismiss, 3000); }
      },
      onError: (err: any) => {
        toast({ title: "Error cashing out", description: err.data?.error || err.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <img src={navalMineSrc} alt="mine" className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />
          Mines
        </h1>

        <Card className="bg-card/80 border-border overflow-hidden">
          <CardContent className="p-0 flex flex-col md:flex-row">

            {/* Grid Area */}
            <div className="flex-1 p-6 md:p-8 flex items-center justify-center min-h-[380px] md:min-h-[400px] bg-background">
              {/* Each tile is a fixed 64×64px — grid never reflows */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 64px)", gridTemplateRows: "repeat(5, 64px)", gap: 6 }}>
                {Array.from({ length: 25 }).map((_, i) => {
                  const isRevealed = !!revealedTiles[i];
                  const type = revealedTiles[i];
                  const isMineEndgame = isGameOver && allMines.includes(i) && !isRevealed;
                  const isClickable = !isGameOver && !isRevealed && !!gameId;

                  return (
                    <button
                      key={i}
                      onClick={() => handleReveal(i)}
                      disabled={isGameOver || isRevealed || !gameId}
                      className={`rounded-md flex items-center justify-center border-2 transition-colors
                        ${isRevealed
                          ? type === 'diamond'
                            ? 'bg-green-500/20 border-green-500 shadow-[inset_0_0_12px_rgba(34,197,94,0.3)]'
                            : 'bg-destructive/20 border-destructive shadow-[inset_0_0_12px_rgba(239,68,68,0.3)]'
                          : isMineEndgame
                            ? 'bg-destructive/10 border-destructive/40 opacity-50'
                            : isClickable
                              ? 'bg-card border-border hover:border-primary/60 hover:bg-primary/10 cursor-pointer'
                              : 'bg-card border-border opacity-60'
                        }
                      `}
                      style={{ width: 64, height: 64, flexShrink: 0 }}
                    >
                      {isRevealed && type === 'diamond' && (
                        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
                          <Diamond className="w-7 h-7 text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                        </motion.div>
                      )}
                      {isRevealed && type === 'mine' && (
                        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
                          <img src={navalMineSrc} alt="mine" className="w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(239,68,68,0.9)]" style={{ imageRendering: "pixelated" }} />
                        </motion.div>
                      )}
                      {isMineEndgame && (
                        <img src={navalMineSrc} alt="mine" className="w-6 h-6 object-contain opacity-50" style={{ imageRendering: "pixelated" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="w-full md:w-80 bg-sidebar p-6 border-t md:border-t-0 md:border-l border-border flex flex-col gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground flex items-center gap-1">Bet Amount (<GemIcon size={12} /> {label})</label>
                <Input
                  type="number"
                  min={dlToDisplay(0.01)}
                  value={dlToDisplay(betAmount)}
                  onChange={(e) => setBetAmount(Math.max(0.01, displayToDl(Number(e.target.value))))}
                  disabled={!!gameId}
                  className="bg-input border-border font-mono"
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 font-bold" disabled={!!gameId} onClick={() => setBetAmount(b => Math.max(0.01, b / 2))}>½</Button>
                  <Button variant="outline" className="flex-1 h-9 font-bold" disabled={!!gameId} onClick={() => setBetAmount(b => Math.min(b * 2, user?.balance ?? b * 2))}>2×</Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Mines</label>
                <Input
                  type="number"
                  value={mineCount}
                  onChange={(e) => setMineCount(Number(e.target.value))}
                  disabled={!!gameId}
                  min={1}
                  max={24}
                  className="bg-input border-border font-mono"
                />
              </div>

              {gameId && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-md text-center">
                  <div className="text-sm text-primary mb-1 font-semibold">Current Multiplier</div>
                  <div className="text-2xl font-bold font-mono text-white">{currentMultiplier.toFixed(2)}x</div>
                </div>
              )}

              {gameId ? (
                <div className="flex flex-col gap-2 mt-auto">
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold bg-green-500 hover:bg-green-600 text-white"
                    onClick={handleCashout}
                    disabled={cashoutMutation.isPending || Object.keys(revealedTiles).length === 0}
                  >
                    Cashout
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-10 font-semibold border-border hover:border-primary/60 hover:bg-primary/10 gap-2"
                    onClick={handleAutoSelect}
                    disabled={revealMutation.isPending}
                  >
                    <Shuffle className="w-4 h-4" />
                    Auto Pick
                  </Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold mt-auto bg-primary hover:bg-primary/90"
                  onClick={handleStart}
                  disabled={startMutation.isPending}
                >
                  Bet
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <TrySomethingElse current="mines" />
    </Layout>
  );
}
