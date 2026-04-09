import React, { useState, useRef, useEffect } from "react";
import { Layout } from "../components/Layout";
import { GemIcon } from "../components/GemIcon";
import { TrySomethingElse } from "../components/TrySomethingElse";
import { useAuth } from "../contexts/AuthContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { useCrashGame, GRAPH_W, GRAPH_H } from "../contexts/CrashGameContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { TrendingUp } from "lucide-react";

function fmtMult(m: number): string {
  if (m >= 1000) return m.toFixed(0) + "x";
  if (m >= 100)  return m.toFixed(1) + "x";
  return m.toFixed(2) + "x";
}

export default function Crash() {
  const { user } = useAuth();
  const { displayToDl, dlToDisplay, formatBalance, label } = useCurrency();
  const {
    phase, cooldown, currentMult, history, graphPts,
    activeBet, cashedOutAt,
    placeBet, cancelBet, manualCashout,
  } = useCrashGame();

  const [betAmount, setBetAmount] = useState(10);
  const [autoCashoutAt, setAutoCashoutAt] = useState(2.0);

  const canBetNow  = phase === "cooldown" && !activeBet;
  const isBetPending = !!activeBet && phase === "cooldown";
  const isBetActive  = !!activeBet && phase === "playing" && cashedOutAt === null;
  const isBetWon     = cashedOutAt !== null && !!activeBet;
  const isBetLost    = phase === "crashed" && !!activeBet && cashedOutAt === null;

  const pnlDisplay = isBetWon && activeBet
    ? formatBalance(activeBet.amount * cashedOutAt!)
    : isBetLost && activeBet
      ? formatBalance(activeBet.amount)
      : null;

  // Build SVG path from graph points
  const maxT   = graphPts.length > 1 ? Math.max(graphPts[graphPts.length - 1][0], 5) : 5;
  const maxLogM = Math.max(Math.log(Math.max(currentMult, 1.5)), Math.log(2));
  const toXY = ([t, m]: [number, number]) => {
    const x = (t / maxT) * GRAPH_W;
    const y = GRAPH_H - (Math.log(Math.max(m, 1)) / maxLogM) * GRAPH_H * 0.88;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const polylineStr = graphPts.length > 1 ? graphPts.map(toXY).join(" ") : "";
  const fillPath    = graphPts.length > 1
    ? `M ${graphPts.map(toXY).join(" L ")} L ${GRAPH_W},${GRAPH_H} L 0,${GRAPH_H} Z`
    : "";

  const multColor =
    phase === "crashed" ? "text-destructive drop-shadow-[0_0_24px_rgba(239,68,68,0.9)]"
    : phase === "playing" ? "text-primary drop-shadow-[0_0_30px_rgba(155,89,182,0.9)]"
    : "text-muted-foreground";

  // ── Audio engine ───────────────────────────────────────────────────────────
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const engineSrcRef   = useRef<AudioBufferSourceNode | null>(null);
  const engineFiltRef  = useRef<BiquadFilterNode | null>(null);
  const engineGainRef  = useRef<GainNode | null>(null);
  const prevPhaseRef   = useRef<string>("");

  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const stopEngine = () => {
    if (engineSrcRef.current) {
      try { engineSrcRef.current.stop(); } catch {}
      engineSrcRef.current = null;
    }
    engineFiltRef.current = null;
    engineGainRef.current = null;
  };

  const startEngine = () => {
    const ctx = getCtx();
    stopEngine();

    // Looped white-noise buffer (2 s)
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 2, sr);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop   = true;

    // Bandpass gives jet-turbine timbre
    const filt = ctx.createBiquadFilter();
    filt.type            = "bandpass";
    filt.frequency.value = 120;
    filt.Q.value         = 3;

    // Second highshelf adds whine
    const shelf = ctx.createBiquadFilter();
    shelf.type            = "highshelf";
    shelf.frequency.value = 1200;
    shelf.gain.value      = 6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.8);

    src.connect(filt);
    filt.connect(shelf);
    shelf.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    engineSrcRef.current  = src;
    engineFiltRef.current = filt;
    engineGainRef.current = gain;
  };

  const playExplosion = () => {
    const ctx = getCtx();

    // --- noise burst ---
    const sr  = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * 0.7), sr);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type            = "lowpass";
    lp.frequency.value = 900;
    lp.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.35);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

    src.connect(lp); lp.connect(g); g.connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + 0.7);

    // --- low thump ---
    const osc = ctx.createOscillator();
    osc.type            = "sine";
    osc.frequency.value = 65;
    osc.frequency.exponentialRampToValueAtTime(18, ctx.currentTime + 0.15);

    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.7, ctx.currentTime);
    tg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(tg); tg.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  };

  // Respond to phase changes
  useEffect(() => {
    if (prevPhaseRef.current === phase) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase === "playing") {
      startEngine();
    } else if (phase === "crashed") {
      const g = engineGainRef.current;
      const ctx = audioCtxRef.current;
      if (g && ctx) {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
      setTimeout(stopEngine, 300);
      playExplosion();
    } else if (phase === "cooldown" && prev !== "") {
      stopEngine();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Update engine pitch as multiplier rises
  useEffect(() => {
    if (phase !== "playing" || !engineFiltRef.current || !audioCtxRef.current) return;
    // 120 Hz at 1x → ~2400 Hz at ~50x (logarithmic)
    const freq = 120 * Math.pow(Math.max(currentMult, 1), 0.9);
    engineFiltRef.current.frequency.setTargetAtTime(
      Math.min(freq, 3200),
      audioCtxRef.current.currentTime,
      0.06
    );
  }, [currentMult, phase]);

  // Cleanup on unmount
  useEffect(() => () => { stopEngine(); }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="text-primary w-8 h-8" />
          Crash
        </h1>

        {/* History pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {history.length === 0 && <span className="text-sm text-muted-foreground italic">No history yet</span>}
          {history.map((cp, i) => (
            <div key={i} className={`px-3 py-1 rounded-full text-sm font-bold flex-shrink-0 ${cp >= 2 ? "bg-green-500/20 text-green-400" : "bg-destructive/20 text-destructive"}`}>
              {fmtMult(cp)}
            </div>
          ))}
        </div>

        <Card className="bg-card/80 border-border overflow-hidden">
          <CardContent className="p-0 flex flex-col md:flex-row">

            {/* Game area */}
            <div className="flex-1 relative min-h-[260px] md:min-h-[420px] bg-[#0d0d1a] overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:linear-gradient(to_bottom,transparent,black)]" />

              {/* SVG graph */}
              {phase === "playing" && polylineStr && (
                <div className="absolute inset-0 pointer-events-none">
                  <svg width="100%" height="100%" viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9b59b6" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#9b59b6" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <path d={fillPath} fill="url(#crashFill)" />
                    <polyline
                      points={polylineStr}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      style={{ filter: "drop-shadow(0 0 6px #9b59b6)" }}
                    />
                  </svg>
                </div>
              )}

              {/* Center display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                {phase === "cooldown" ? (
                  <div className="text-center space-y-2">
                    <div className="text-8xl font-black font-mono text-primary">{cooldown}s</div>
                    <div className="text-xl font-semibold text-muted-foreground tracking-wide">Place your bets!</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className={`text-7xl md:text-9xl font-black font-mono tracking-tighter transition-colors ${multColor}`}>
                      {fmtMult(currentMult)}
                    </div>
                    {phase === "crashed" && (
                      <div className="text-3xl font-black text-destructive mt-4 uppercase tracking-widest animate-pulse">
                        CRASHED!
                      </div>
                    )}
                    {isBetWon && (
                      <div className="mt-3 text-lg font-bold text-green-400">
                        ✓ Cashed out at {fmtMult(cashedOutAt!)}
                      </div>
                    )}
                    {isBetLost && (
                      <div className="mt-3 text-lg font-bold text-destructive">
                        ✗ Lost your bet
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="w-full md:w-80 bg-sidebar p-6 border-t md:border-t-0 md:border-l border-border flex flex-col gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                  Bet Amount (<GemIcon size={12} /> {label})
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={dlToDisplay(0.01)}
                    value={dlToDisplay(betAmount)}
                    onChange={e => setBetAmount(Math.max(0.01, displayToDl(Number(e.target.value))))}
                    disabled={!canBetNow}
                    className="bg-input border-border font-mono"
                  />
                  <Button variant="outline" onClick={() => setBetAmount(b => Math.max(0.01, b / 2))} disabled={!canBetNow}>½</Button>
                  <Button variant="outline" onClick={() => setBetAmount(b => Math.min(b * 2, user?.balance ?? b * 2))} disabled={!canBetNow}>2×</Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Auto Cashout At</label>
                <Input
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={autoCashoutAt}
                  onChange={e => setAutoCashoutAt(Number(e.target.value))}
                  disabled={!canBetNow}
                  className="bg-input border-border font-mono text-primary font-bold"
                />
              </div>

              {/* Bet status */}
              {activeBet && (
                <div className={`p-3 rounded-md border text-sm space-y-1 ${
                  isBetWon  ? "bg-green-500/10 border-green-500/30"
                  : isBetLost ? "bg-destructive/10 border-destructive/30"
                  : "bg-primary/10 border-primary/20"
                }`}>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bet</span>
                    <span className="font-bold flex items-center gap-0.5">{Math.floor(dlToDisplay(activeBet.amount)).toLocaleString()} <GemIcon size={11} /></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auto cashout</span>
                    <span className="font-bold text-primary">{activeBet.autoCashout}x</span>
                  </div>
                  {pnlDisplay !== null && (
                    <div className={`flex justify-between pt-1 border-t ${isBetWon ? "border-green-500/20" : "border-destructive/20"}`}>
                      <span className="text-muted-foreground">{isBetWon ? "Won" : "Lost"}</span>
                      <span className={`font-bold flex items-center gap-0.5 ${isBetWon ? "text-green-400" : "text-destructive"}`}>
                        {isBetLost && "-"}{pnlDisplay} <GemIcon size={11} />
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action button */}
              <div className="mt-auto">
                {canBetNow && (
                  <Button size="lg" className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90" onClick={() => { getCtx(); placeBet(betAmount, autoCashoutAt); }} disabled={!user}>
                    Place Bet
                  </Button>
                )}
                {isBetPending && (
                  <Button size="lg" variant="outline" className="w-full h-14 text-lg font-bold border-destructive/50 text-destructive hover:bg-destructive/10" onClick={cancelBet}>
                    Cancel Bet
                  </Button>
                )}
                {isBetActive && (
                  <Button size="lg" className="w-full h-14 text-lg font-bold bg-orange-500 hover:bg-orange-600 text-white animate-pulse" onClick={manualCashout}>
                    Cash Out {fmtMult(currentMult)}
                  </Button>
                )}
                {phase === "playing" && !isBetActive && !isBetWon && !activeBet && (
                  <Button size="lg" disabled className="w-full h-14 text-lg font-bold">
                    Bet next round
                  </Button>
                )}
                {isBetWon && phase === "playing" && (
                  <Button size="lg" disabled className="w-full h-14 text-lg font-bold bg-green-600/80 text-white">
                    ✓ Cashed out!
                  </Button>
                )}
                {phase === "crashed" && (
                  <Button size="lg" disabled className="w-full h-14 text-lg font-bold bg-destructive/60 text-white">
                    Crashed!
                  </Button>
                )}
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
      <TrySomethingElse current="crash" />
    </Layout>
  );
}
