import React, { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "../components/Layout";
import { TrySomethingElse } from "../components/TrySomethingElse";
import { usePlayLimbo } from "@workspace/api-client-react";
import { GemIcon } from "../components/GemIcon";
import { useAuth } from "../contexts/AuthContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function Limbo() {
  const { user, updateUser, deltaBalance } = useAuth();
  const { displayToDl, dlToDisplay, formatBalance, label } = useCurrency();
  const [betAmount, setBetAmount]       = useState<number>(10);
  const [targetMultiplier, setTargetMultiplier] = useState<number>(2.0);
  const [lastResult, setLastResult]     = useState<any>(null);
  const [isRolling, setIsRolling]       = useState(false);
  const [displayedMult, setDisplayedMult] = useState<number | null>(null);
  const playMutation = usePlayLimbo();
  const { toast } = useToast();

  // ── Animation refs ───────────────────────────────────────────────────────
  const rafRef       = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const fromRef      = useRef<number>(1);
  const toRef        = useRef<number>(1);

  const stopAnim = () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const startAnim = useCallback((from: number, to: number, durationMs: number, onDone: () => void) => {
    stopAnim();
    fromRef.current = from;
    toRef.current   = to;
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - startTimeRef.current) / durationMs, 1);
      // fast linear ramp — feels like a spinning counter
      const val = from + (to - from) * t;
      setDisplayedMult(val);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayedMult(to);
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => stopAnim(), []);

  // ── Audio ────────────────────────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const playWinSound = () => {
    const ctx = getCtx();
    // Ascending C-E-G-C chime
    const notes   = [523.25, 659.25, 783.99, 1046.5];
    const spacing = 0.09;
    notes.forEach((freq, i) => {
      const t    = ctx.currentTime + i * spacing;
      const osc  = ctx.createOscillator();
      osc.type   = "sine";
      osc.frequency.value = freq;

      // Bell-like second partial
      const osc2 = ctx.createOscillator();
      osc2.type  = "sine";
      osc2.frequency.value = freq * 2.756;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(i === notes.length - 1 ? 0.17 : 0.11, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.032, t + 0.015);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(g);   g.connect(ctx.destination);
      osc2.connect(g2); g2.connect(ctx.destination);
      osc.start(t);     osc.stop(t + 0.6);
      osc2.start(t);    osc2.stop(t + 0.3);
    });
  };

  // ── Game logic ───────────────────────────────────────────────────────────
  const handlePlay = () => {
    if (!user) {
      toast({ title: "Login required", variant: "destructive" });
      return;
    }
    if (betAmount <= 0 || targetMultiplier <= 1) {
      toast({ title: "Invalid bet or multiplier", variant: "destructive" });
      return;
    }

    // Prime audio context on user click
    getCtx();

    setIsRolling(true);
    setLastResult(null);
    setDisplayedMult(1.00);

    const snapshotBet = betAmount;
    const snapshotTarget = targetMultiplier;
    deltaBalance(-snapshotBet);

    playMutation.mutate({ data: { amount: snapshotBet, targetMultiplier: snapshotTarget } }, {
      onSuccess: (res) => {
        if ((res as any).newLevel != null) updateUser({ level: (res as any).newLevel });
        const resultVal: number = (res as any).result ?? 1;
        // Animate from 1.00 → result (faster for big values to avoid long waits)
        const dur = Math.min(900 + resultVal * 4, 1400);
        startAnim(1, resultVal, dur, () => {
          if ((res as any).win) deltaBalance(snapshotBet * snapshotTarget);
          setLastResult({ ...res, snapshotBet });
          setIsRolling(false);
          if ((res as any).win) playWinSound();
        });
      },
      onError: (err: any) => {
        deltaBalance(snapshotBet);
        toast({ title: "Error", description: err.data?.error || err.message || "Failed to play", variant: "destructive" });
        setIsRolling(false);
        setDisplayedMult(null);
      },
    });
  };

  const winChance = targetMultiplier > 1 ? (99 / targetMultiplier).toFixed(2) : "0.00";

  // Color during animation: green once we've passed the target
  const rollingColor =
    displayedMult !== null && displayedMult >= targetMultiplier
      ? "text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]"
      : "text-primary drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Limbo</h1>

        <Card className="bg-card/80 border-border overflow-hidden">
          <CardContent className="p-0 flex flex-col md:flex-row">

            {/* Game Area */}
            <div className="flex-1 p-6 md:p-12 flex items-center justify-center relative min-h-[240px] md:min-h-[400px]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

              <div className="relative z-10 text-center select-none">
                <AnimatePresence mode="wait">
                  {isRolling && displayedMult !== null ? (
                    /* Rapidly counting multiplier */
                    <div
                      key="rolling"
                      className={`text-6xl md:text-8xl font-black font-mono transition-colors duration-100 ${rollingColor}`}
                    >
                      {displayedMult.toFixed(2)}x
                    </div>
                  ) : lastResult ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`text-6xl md:text-8xl font-black font-mono ${
                        lastResult.win
                          ? "text-green-500 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                          : "text-destructive drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                      }`}
                    >
                      {lastResult.result.toFixed(2)}x
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      className="text-6xl md:text-8xl font-black font-mono text-muted-foreground"
                    >
                      {targetMultiplier.toFixed(2)}x
                    </motion.div>
                  )}
                </AnimatePresence>

                {lastResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-4 text-5xl font-bold ${lastResult.win ? "text-green-500" : "text-destructive"}`}
                  >
                    {lastResult.win
                      ? <>{`Won ${formatBalance(lastResult.snapshotBet + lastResult.profit)} `}<GemIcon size={36} /></>
                      : <>{`Lost ${formatBalance(lastResult.snapshotBet)} `}<GemIcon size={36} /></>}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="w-full md:w-80 bg-sidebar p-6 border-t md:border-t-0 md:border-l border-border flex flex-col gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground flex items-center gap-1">Bet Amount (<GemIcon size={12} /> {label})</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={dlToDisplay(0.01)}
                    value={dlToDisplay(betAmount)}
                    onChange={e => setBetAmount(Math.max(0.01, displayToDl(Number(e.target.value))))}
                    disabled={isRolling}
                    className="bg-input border-border font-mono"
                  />
                  <Button variant="outline" onClick={() => setBetAmount(Math.max(0.01, betAmount / 2))} disabled={isRolling}>½</Button>
                  <Button variant="outline" onClick={() => setBetAmount(Math.min(betAmount * 2, user?.balance ?? betAmount * 2))} disabled={isRolling}>2×</Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Target Multiplier</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={targetMultiplier}
                    onChange={e => setTargetMultiplier(Number(e.target.value))}
                    disabled={isRolling}
                    className="bg-input border-border font-mono text-primary font-bold"
                  />
                  <Button variant="outline" disabled={isRolling} onClick={() => setTargetMultiplier(m => Math.max(1.01, parseFloat((m / 2).toFixed(2))))}>½</Button>
                  <Button variant="outline" disabled={isRolling} onClick={() => setTargetMultiplier(m => Math.min(1000, parseFloat((m * 2).toFixed(2))))}>2×</Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Win Chance</label>
                <div className="bg-input/50 border border-border rounded-md px-3 py-2 font-mono text-muted-foreground">
                  {winChance}%
                </div>
              </div>

              <Button
                size="lg"
                className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 mt-auto"
                onClick={handlePlay}
                disabled={isRolling || playMutation.isPending}
              >
                {isRolling ? "Rolling…" : "Play"}
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
      <TrySomethingElse current="limbo" />
    </Layout>
  );
}
