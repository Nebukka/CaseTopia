import React, { useState } from "react";
import { Layout } from "../components/Layout";
import { TrySomethingElse } from "../components/TrySomethingElse";
import { useAuth } from "../contexts/AuthContext";
import { GemIcon } from "../components/GemIcon";
import { useCurrency } from "../contexts/CurrencyContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import { motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import navalMineSrc from "@assets/naval_mine_1775529823663.webp";

// ── Audio (same as Mines) ──────────────────────────────────────────────────
function getAudioCtx(): AudioContext | null {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}

function playDiamondSound() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const gain = ctx.createGain();
  osc1.type = "sine"; osc1.frequency.setValueAtTime(880, now); osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
  osc2.type = "sine"; osc2.frequency.setValueAtTime(1320, now); osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
  gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
  osc1.start(now); osc2.start(now); osc1.stop(now + 0.25); osc2.stop(now + 0.25);
}

function playExplosionSound() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.6;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.8);
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const noiseGain = ctx.createGain(); noiseGain.gain.setValueAtTime(0.55, now); noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  const boom = ctx.createOscillator(); boom.type = "sine"; boom.frequency.setValueAtTime(120, now); boom.frequency.exponentialRampToValueAtTime(28, now + 0.35);
  const boomGain = ctx.createGain(); boomGain.gain.setValueAtTime(0.45, now); boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.setValueAtTime(800, now); filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);
  noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(ctx.destination);
  boom.connect(boomGain); boomGain.connect(ctx.destination);
  noise.start(now); noise.stop(now + 0.65); boom.start(now); boom.stop(now + 0.5);
}

function playCashoutSound() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  // Ascending coin arpeggio — quick four-note run
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.07);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + i * 0.07 + 0.08);
    gain.gain.setValueAtTime(0, now + i * 0.07);
    gain.gain.linearRampToValueAtTime(0.22, now + i * 0.07 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.28);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.32);
  });
  // Deep bass thud — weight and impact
  const boom = ctx.createOscillator(); boom.type = "sine";
  boom.frequency.setValueAtTime(160, now); boom.frequency.exponentialRampToValueAtTime(45, now + 0.18);
  const boomGain = ctx.createGain();
  boomGain.gain.setValueAtTime(0.4, now); boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  boom.connect(boomGain); boomGain.connect(ctx.destination);
  boom.start(now); boom.stop(now + 0.26);
  // Final shimmer chord — rings out after the arpeggio
  [523, 659, 784].forEach((freq) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + 0.30);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.80);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now + 0.30); osc.stop(now + 0.85);
  });
}

// ── Difficulty config ────────────────────────────────────────────────────────
type Difficulty = "easy" | "medium" | "hard" | "extreme";

interface DiffConfig {
  label: string;
  tilesPerRow: number;
  bombsPerRow: number;
  mults: number[]; // index 0 = bottom row
}

const DIFF: Record<Difficulty, DiffConfig> = {
  easy: {
    label: "Easy",
    tilesPerRow: 4,
    bombsPerRow: 1,
    mults: [1.29, 1.72, 2.30, 3.07, 4.09, 5.45, 7.27, 9.69, 12.92, 17.22, 22.97, 30.62],
  },
  medium: {
    label: "Medium",
    tilesPerRow: 3,
    bombsPerRow: 1,
    mults: [1.46, 2.18, 3.27, 4.91, 7.37, 11.05, 16.57, 24.86, 37.29, 55.94, 83.90, 125.85],
  },
  hard: {
    label: "Hard",
    tilesPerRow: 2,
    bombsPerRow: 1,
    mults: [1.94, 3.88, 7.76, 15.52, 31.04, 62.08, 124.16, 248.32, 496.64, 993.28],
  },
  extreme: {
    label: "Extreme",
    tilesPerRow: 3,
    bombsPerRow: 2,
    mults: [2.91, 8.73, 26.19, 78.57, 235.71, 707.13, 2121.39, 6364.17],
  },
};

const DIFF_KEYS: Difficulty[] = ["easy", "medium", "hard", "extreme"];
const DIFF_COLORS: Record<Difficulty, string> = {
  easy:    "bg-green-500/20 text-green-400 border-green-500/40 data-[active=true]:bg-green-500 data-[active=true]:text-white data-[active=true]:border-green-500",
  medium:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 data-[active=true]:bg-yellow-500 data-[active=true]:text-white data-[active=true]:border-yellow-500",
  hard:    "bg-orange-500/20 text-orange-400 border-orange-500/40 data-[active=true]:bg-orange-500 data-[active=true]:text-white data-[active=true]:border-orange-500",
  extreme: "bg-red-500/20 text-red-400 border-red-500/40 data-[active=true]:bg-red-500 data-[active=true]:text-white data-[active=true]:border-red-500",
};

function shuffledMines(count: number, bombs: number): number[] {
  const tiles = Array.from({ length: count }, (_, i) => i);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.slice(0, bombs);
}

export default function Cross() {
  const { user, deltaBalance } = useAuth();
  const { displayToDl, dlToDisplay, formatBalance, label } = useCurrency();
  const [betAmount, setBetAmount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  // mines[rowIndex] = array of tile indices that are mines
  const [mines, setMines] = useState<number[][]>([]);
  // which tile the player clicked per row (to show safe highlight)
  const [picks, setPicks] = useState<number[]>([]);
  const [lost, setLost] = useState(false);
  const [lostRow, setLostRow] = useState<number | null>(null);
  const { toast } = useToast();

  const cfg = DIFF[difficulty];
  const ROWS = cfg.mults.length;

  const currentMult = currentRow > 0 ? cfg.mults[currentRow - 1] : 1;

  const handleStart = () => {
    if (!user) {
      toast({ title: "Login required", variant: "destructive" });
      return;
    }
    deltaBalance(-betAmount);

    // Pre-generate all mines for every row
    const allMines = Array.from({ length: ROWS }, () =>
      shuffledMines(cfg.tilesPerRow, cfg.bombsPerRow)
    );
    setMines(allMines);
    setPicks([]);
    setIsPlaying(true);
    setCurrentRow(0);
    setLost(false);
    setLostRow(null);
  };

  const handleStep = (tileIndex: number) => {
    const rowMines = mines[currentRow] ?? [];
    const isMine = rowMines.includes(tileIndex);
    const newPicks = [...picks, tileIndex];
    setPicks(newPicks);

    if (isMine) {
      playExplosionSound();
      setLost(true);
      setLostRow(currentRow);
      setIsPlaying(false);
      { const { dismiss } = toast({ title: "Blown up! Better luck next time.", variant: "destructive" }); setTimeout(dismiss, 3000); }
    } else {
      playDiamondSound();
      const nextRow = currentRow + 1;
      setCurrentRow(nextRow);
      if (nextRow === ROWS) {
        const payout = betAmount * cfg.mults[ROWS - 1];
        deltaBalance(payout);
        { const { dismiss } = toast({ title: <span className="text-2xl font-black text-green-400">You made it!</span>, description: <span className="text-xl font-bold flex items-center gap-1">Won {formatBalance(payout)} <GemIcon size={18} /></span> }); setTimeout(dismiss, 3000); }
        setIsPlaying(false);
      }
    }
  };

  const handleAutoSelect = () => {
    if (!isPlaying || currentRow >= ROWS) return;
    const pick = Math.floor(Math.random() * cfg.tilesPerRow);
    handleStep(pick);
  };

  const handleCashout = () => {
    const payout = betAmount * currentMult;
    deltaBalance(payout);
    playCashoutSound();
    { const { dismiss } = toast({ title: <span className="text-2xl font-black text-green-400">Cashed out!</span>, description: <span className="text-xl font-bold flex items-center gap-1">Won {formatBalance(payout)} <GemIcon size={18} /></span> }); setTimeout(dismiss, 3000); }
    setIsPlaying(false);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Tower</h1>

        <Card className="bg-card/80 border-border overflow-hidden">
          <CardContent className="p-0 flex flex-col-reverse md:flex-row">

            {/* Game grid */}
            <div className="flex-1 p-3 sm:p-6 flex flex-col items-center justify-end min-h-[360px] sm:min-h-[500px] bg-[#0d0d1a] gap-1 sm:gap-1.5 overflow-y-auto">
              {[...Array(ROWS)].map((_, rowIndex) => {
                const r = ROWS - 1 - rowIndex;
                const isActive   = isPlaying && currentRow === r;
                const isPassed   = currentRow > r && !lost;
                const isLostRow  = lostRow === r;
                const rowMines   = mines[r] ?? [];
                const pickedTile = picks[r];
                const gameOver   = !isPlaying && (lost || currentRow === ROWS);

                return (
                  <div key={r} className="flex items-center gap-2 w-full" style={{ maxWidth: cfg.tilesPerRow * 80 + 90 }}>
                    {/* Multiplier label */}
                    <div className={`text-xs sm:text-base font-bold font-mono w-14 sm:w-24 text-right flex-shrink-0 transition-colors ${
                      isActive ? "text-primary" : isPassed ? "text-green-400" : isLostRow ? "text-destructive" : "text-muted-foreground/50"
                    }`}>
                      {cfg.mults[r].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×
                    </div>

                    {/* Tiles */}
                    <div className="flex gap-1 sm:gap-2 flex-1">
                      {[...Array(cfg.tilesPerRow)].map((_, t) => {
                        const isMineHere   = rowMines.includes(t);
                        const isPickedSafe = pickedTile === t && !isMineHere;
                        const isPickedBomb = pickedTile === t && isMineHere;
                        const showMine     = (gameOver || isLostRow) && isMineHere && pickedTile !== undefined;
                        const revealMine   = showMine && !isPickedBomb;

                        return (
                          <motion.button
                            whileHover={isActive ? { scale: 1.06 } : {}}
                            whileTap={isActive ? { scale: 0.94 } : {}}
                            key={t}
                            disabled={!isActive}
                            onClick={() => handleStep(t)}
                            className={`h-8 sm:h-11 flex-1 rounded-md border-2 transition-all flex items-center justify-center ${
                              isPickedBomb
                                ? "bg-red-500/30 border-red-500"
                                : isPickedSafe
                                  ? "bg-green-500/25 border-green-500/70"
                                  : revealMine
                                    ? "bg-orange-500/10 border-orange-500/30"
                                    : isPassed && pickedTile === undefined
                                      ? "bg-green-500/10 border-green-500/20"
                                      : isActive
                                        ? "bg-primary/15 border-primary/60 cursor-pointer hover:bg-primary/30 hover:border-primary"
                                        : "bg-card/50 border-border/40 opacity-40"
                            }`}
                          >
                            {(isPickedBomb || revealMine) && (
                              <img
                                src={navalMineSrc}
                                alt="mine"
                                className="w-7 h-7 object-contain"
                                style={{ imageRendering: "pixelated", opacity: revealMine ? 0.45 : 1 }}
                              />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Controls sidebar */}
            <div className="w-full md:w-72 bg-sidebar p-4 sm:p-5 border-b md:border-b-0 md:border-l border-border flex flex-col sm:flex-row md:flex-col flex-wrap gap-4 sm:gap-3 md:gap-5">

              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Difficulty</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {DIFF_KEYS.map(d => (
                    <button
                      key={d}
                      disabled={isPlaying}
                      data-active={difficulty === d}
                      onClick={() => setDifficulty(d)}
                      className={`py-2.5 px-3 rounded-md border text-sm font-bold transition-all ${DIFF_COLORS[d]} disabled:opacity-50`}
                    >
                      {DIFF[d].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bet amount */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                  Bet (<GemIcon size={12} /> {label})
                </label>
                <Input
                  type="number"
                  min={dlToDisplay(0.01)}
                  value={dlToDisplay(betAmount)}
                  onChange={e => setBetAmount(Math.max(0.01, displayToDl(Number(e.target.value))))}
                  disabled={isPlaying}
                  className="bg-input border-border font-mono text-lg h-11"
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 font-bold" disabled={isPlaying} onClick={() => setBetAmount(b => Math.max(0.01, b / 2))}>½</Button>
                  <Button variant="outline" className="flex-1 h-9 font-bold" disabled={isPlaying} onClick={() => setBetAmount(b => Math.min(b * 2, user?.balance ?? b * 2))}>2×</Button>
                </div>
              </div>

              {/* Current multiplier */}
              {isPlaying && currentRow > 0 && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-md text-center">
                  <div className="text-xs text-primary font-semibold mb-0.5">Current payout</div>
                  <div className="text-2xl font-black font-mono text-white">{currentMult.toFixed(2)}×</div>
                  <div className="text-xs text-muted-foreground mt-0.5">= {dlToDisplay(betAmount * currentMult).toFixed(0)} {label}</div>
                </div>
              )}

              {/* Action button */}
              <div className="mt-auto flex flex-col gap-2">
                {!isPlaying ? (
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90"
                    onClick={handleStart}
                    disabled={!user}
                  >
                    Bet
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      className="w-full h-14 text-lg font-bold bg-green-500 hover:bg-green-600 text-white"
                      onClick={handleCashout}
                      disabled={currentRow === 0}
                    >
                      Cash Out
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-10 font-semibold border-border hover:border-primary/60 hover:bg-primary/10 gap-2"
                      onClick={handleAutoSelect}
                    >
                      <Shuffle className="w-4 h-4" />
                      Auto Pick
                    </Button>
                  </>
                )}
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
      <TrySomethingElse current="tower" />
    </Layout>
  );
}
