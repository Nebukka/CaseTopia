import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";

function playCrashCashoutSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    // Rising whoosh — the escape
    const bufSize = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (i / bufSize);
    const whoosh = ctx.createBufferSource(); whoosh.buffer = buf;
    const whooshFilter = ctx.createBiquadFilter(); whooshFilter.type = "bandpass";
    whooshFilter.frequency.setValueAtTime(800, now); whooshFilter.frequency.exponentialRampToValueAtTime(4200, now + 0.16);
    const whooshGain = ctx.createGain(); whooshGain.gain.setValueAtTime(0.28, now); whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    whoosh.connect(whooshFilter); whooshFilter.connect(whooshGain); whooshGain.connect(ctx.destination);
    whoosh.start(now); whoosh.stop(now + 0.2);
    // Bright coin arpeggio — reward hits
    [659, 880, 1109, 1319, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + 0.10 + i * 0.055);
      gain.gain.setValueAtTime(0, now + 0.10 + i * 0.055);
      gain.gain.linearRampToValueAtTime(0.20, now + 0.10 + i * 0.055 + 0.010);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.10 + i * 0.055 + 0.22);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + 0.10 + i * 0.055); osc.stop(now + 0.10 + i * 0.055 + 0.26);
    });
    // Heavy bass thud — weight and satisfaction
    const boom = ctx.createOscillator(); boom.type = "sine";
    boom.frequency.setValueAtTime(140, now + 0.10); boom.frequency.exponentialRampToValueAtTime(38, now + 0.30);
    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(0.55, now + 0.10); boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    boom.connect(boomGain); boomGain.connect(ctx.destination);
    boom.start(now + 0.10); boom.stop(now + 0.40);
    // Shimmer tail — bright resolution chord
    [659, 880, 1109].forEach((freq) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + 0.42);
      gain.gain.linearRampToValueAtTime(0.10, now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + 0.42); osc.stop(now + 1.05);
    });
  } catch (_) {}
}

export type CrashPhase = "cooldown" | "playing" | "crashed";

export interface ActiveBet {
  amount: number;
  autoCashout: number;
}

interface CrashGameState {
  phase: CrashPhase;
  cooldown: number;
  currentMult: number;
  history: number[];
  graphPts: Array<[number, number]>;
  activeBet: ActiveBet | null;
  cashedOutAt: number | null;
  placeBet: (amount: number, autoCashout: number) => void;
  cancelBet: () => void;
  manualCashout: () => void;
}

const CrashGameContext = createContext<CrashGameState | null>(null);

export const GRAPH_W = 600;
export const GRAPH_H = 300;
const COOLDOWN_SECS = 10;
const CRASHED_DISPLAY_MS = 4000;

const CRASH_TABLE: Array<[number, number]> = [
  [1.0,    1.0       ],
  [1.3,    0.65      ],
  [1.5,    0.50      ],
  [2.0,    0.30      ],
  [3.0,    0.15      ],
  [4.0,    0.08      ],
  [10.0,   0.05      ],
  [25.0,   0.03      ],
  [50.0,   0.02      ],
  [100.0,  0.01      ],
  [200.0,  0.005     ],
  [500.0,  0.001     ],
  [1000.0, 0.0001    ],
  [2000.0, 0.00001   ],
  [3000.0, 0.000001  ],
  [5000.0, 0.0000001 ],
];

function generateCrashPoint(): number {
  const r = Math.random();
  for (let i = 0; i < CRASH_TABLE.length - 1; i++) {
    const [x0, p0] = CRASH_TABLE[i];
    const [x1, p1] = CRASH_TABLE[i + 1];
    if (r <= p0 && r >= p1) {
      const t = (Math.log(r) - Math.log(p0)) / (Math.log(p1) - Math.log(p0));
      return parseFloat(Math.exp(Math.log(x0) + t * (Math.log(x1) - Math.log(x0))).toFixed(2));
    }
  }
  return 1.0;
}

export function CrashGameProvider({ children }: { children: React.ReactNode }) {
  const { deltaBalance } = useAuth();
  // Keep deltaBalance in a ref so the RAF loop can call it without stale closures
  const deltaBalanceRef = useRef(deltaBalance);
  useEffect(() => { deltaBalanceRef.current = deltaBalance; }, [deltaBalance]);

  // Display state (React)
  const [phase, setPhase]               = useState<CrashPhase>("cooldown");
  const [cooldown, setCooldown]         = useState(COOLDOWN_SECS);
  const [currentMult, setCurrentMult]   = useState(1.0);
  const [history, setHistory]           = useState<number[]>([]);
  const [graphPts, setGraphPts]         = useState<Array<[number, number]>>([]);
  const [activeBet, setActiveBet]       = useState<ActiveBet | null>(null);
  const [cashedOutAt, setCashedOutAt]   = useState<number | null>(null);

  // All mutable game state lives here — read directly inside loops so closures never go stale
  const g = useRef({
    phase: "cooldown" as CrashPhase,
    cooldown: COOLDOWN_SECS,
    crashPoint: 1.0,
    startTime: 0,
    lastGraphTime: 0,
    activeBet: null as ActiveBet | null,
    cashedOut: false,
    cashedOutAt: null as number | null,
    history: [] as number[],
  });

  const rafId        = useRef<number>(0);
  const cooldownId   = useRef<ReturnType<typeof setTimeout>>();
  const crashedId    = useRef<ReturnType<typeof setTimeout>>();

  // Forward-declared so startRound can call startCooldown
  const startCooldownRef = useRef<() => void>(() => {});

  const startRound = useCallback(() => {
    const state = g.current;
    state.phase       = "playing";
    state.crashPoint  = generateCrashPoint();
    state.startTime   = Date.now();
    state.lastGraphTime = 0;
    state.cashedOut   = false;
    state.cashedOutAt = null;

    setPhase("playing");
    setCurrentMult(1.0);
    setGraphPts([[0, 1.0]]);
    setCashedOutAt(null);

    const loop = () => {
      const elapsed = (Date.now() - state.startTime) / 1000;
      const m = Math.pow(1.06, elapsed);

      setCurrentMult(m);

      // Graph throttle
      const now = Date.now();
      if (now - state.lastGraphTime >= 120) {
        state.lastGraphTime = now;
        setGraphPts(prev => [...prev, [elapsed, m]]);
      }

      // Auto-cashout
      if (state.activeBet && !state.cashedOut && m >= state.activeBet.autoCashout) {
        const cashMult = state.activeBet.autoCashout;
        deltaBalanceRef.current(state.activeBet.amount * cashMult);
        state.cashedOut   = true;
        state.cashedOutAt = cashMult;
        setCashedOutAt(cashMult);
        playCrashCashoutSound();
      }

      // Crash check
      if (m >= state.crashPoint) {
        const cp = state.crashPoint;
        state.phase   = "crashed";
        state.history = [cp, ...state.history].slice(0, 20);
        setCurrentMult(cp);
        setPhase("crashed");
        setHistory([...state.history]);
        crashedId.current = setTimeout(() => startCooldownRef.current(), CRASHED_DISPLAY_MS);
        return; // stop loop
      }

      rafId.current = requestAnimationFrame(loop);
    };

    rafId.current = requestAnimationFrame(loop);
  }, []);

  const startCooldown = useCallback(() => {
    const state = g.current;
    if (rafId.current) cancelAnimationFrame(rafId.current);

    state.phase      = "cooldown";
    state.cooldown   = COOLDOWN_SECS;
    state.activeBet  = null;
    state.cashedOut  = false;
    state.cashedOutAt = null;

    setPhase("cooldown");
    setCooldown(COOLDOWN_SECS);
    setActiveBet(null);
    setCashedOutAt(null);
    setGraphPts([]);
    setCurrentMult(1.0);

    const tick = () => {
      state.cooldown -= 1;
      setCooldown(state.cooldown);
      if (state.cooldown > 0) {
        cooldownId.current = setTimeout(tick, 1000);
      } else {
        startRound();
      }
    };
    cooldownId.current = setTimeout(tick, 1000);
  }, [startRound]);

  // Keep the ref in sync so the crash callback can call the latest version
  useEffect(() => { startCooldownRef.current = startCooldown; }, [startCooldown]);

  // Kick off on mount only
  useEffect(() => {
    startCooldown();
    return () => {
      cancelAnimationFrame(rafId.current);
      clearTimeout(cooldownId.current);
      clearTimeout(crashedId.current);
    };
  }, []); // eslint-disable-line

  const placeBet = useCallback((amount: number, autoCashout: number) => {
    const bet = { amount, autoCashout: Math.max(autoCashout, 1.01) };
    g.current.activeBet = bet;
    setActiveBet(bet);
    deltaBalanceRef.current(-amount);
  }, []);

  const cancelBet = useCallback(() => {
    const bet = g.current.activeBet;
    if (bet) deltaBalanceRef.current(bet.amount); // refund
    g.current.activeBet = null;
    setActiveBet(null);
  }, []);

  const manualCashout = useCallback(() => {
    const state = g.current;
    if (!state.activeBet || state.cashedOut || state.phase !== "playing") return;
    const elapsed = (Date.now() - state.startTime) / 1000;
    const m = Math.pow(1.06, elapsed);
    deltaBalanceRef.current(state.activeBet.amount * m);
    state.cashedOut   = true;
    state.cashedOutAt = m;
    setCashedOutAt(m);
    playCrashCashoutSound();
  }, []);

  return (
    <CrashGameContext.Provider value={{
      phase, cooldown, currentMult, history, graphPts,
      activeBet, cashedOutAt,
      placeBet, cancelBet, manualCashout,
    }}>
      {children}
    </CrashGameContext.Provider>
  );
}

export function useCrashGame() {
  const ctx = useContext(CrashGameContext);
  if (!ctx) throw new Error("useCrashGame must be used within CrashGameProvider");
  return ctx;
}
