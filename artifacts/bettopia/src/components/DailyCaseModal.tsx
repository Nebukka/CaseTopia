import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Clock } from "lucide-react";
import { rarityFromChance } from "../data/itemsCatalog";
import dlSrc from "@assets/dl_1775514218033.webp";
import goldOrbSrc from "@assets/legendary_orb_1775538080736.webp";
import purpleOrbSrc from "@assets/legendary_orb_1775539381857.webp";

interface CaseItem {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
  value: number;
  chance: number;
  color: string;
}

// Reset at 12:00 UTC+3 = 09:00 UTC
function getNextResetMs(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(9, 0, 0, 0);
  if (now >= next) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

function useCountdown(): string {
  const [ms, setMs] = useState(getNextResetMs);
  useEffect(() => {
    const id = setInterval(() => setMs(getNextResetMs()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const RARITY_HEX: Record<string, string> = {
  common:    "#9e9e9e",
  uncommon:  "#42a5f5",
  rare:      "#22c55e",
  epic:      "#ab47bc",
  mythic:    "#ef5350",
  legendary: "#ffd700",
  divine:    "#ffffff",
};


const GOLD_ORB_THRESHOLD = 3;
const PURPLE_ORB_THRESHOLD = 0.1;

const GOLD_ORB_ITEM: CaseItem = { id: "__orb__", name: "???", imageUrl: goldOrbSrc, rarity: "legendary", value: 0, chance: 0, color: "#ffd700" };
const PURPLE_ORB_ITEM: CaseItem = { id: "__purple_orb__", name: "???", imageUrl: purpleOrbSrc, rarity: "divine", value: 0, chance: 0, color: "#a855f7" };

const ITEM_W = 92;
const ITEM_GAP = 0;
const ITEM_STEP = ITEM_W + ITEM_GAP;
const REEL_COUNT = 50;
const WINNING_IDX = 38;

function weightedRandom(items: CaseItem[]): CaseItem {
  const total = items.reduce((s, i) => s + i.chance, 0);
  let rand = Math.random() * total;
  for (const item of items) {
    rand -= item.chance;
    if (rand <= 0) return item;
  }
  return items[items.length - 1];
}

function ItemThumb({ item, size = 40 }: { item: CaseItem; size?: number }) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.name}
        style={{ width: size, height: size, objectFit: "contain", imageRendering: "pixelated", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 4, backgroundColor: item.color ?? "#555", opacity: 0.85, flexShrink: 0 }} />
  );
}

function ReelItem({ item }: { item: CaseItem }) {
  const rarity = rarityFromChance(item.chance);
  const hex = RARITY_HEX[rarity] ?? "#888";
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-center relative"
      style={{ width: ITEM_W, height: ITEM_W + 8 }}
    >
      <div className="flex-1 w-full flex items-center justify-center" style={{ filter: `drop-shadow(0 0 8px ${hex}99)` }}>
        <ItemThumb item={item} size={52} />
      </div>
      <div style={{ height: 3, width: "100%", backgroundColor: hex, opacity: 0.85, flexShrink: 0 }} />
    </div>
  );
}

interface Props {
  tierNum: number;
  tierLabel: string;
  tierColor: string;
  caseId: number;
  claimed?: boolean;
  locked?: boolean;
  requiredLevel?: number;
  token: string;
  onDone: (wonItem: CaseItem, newBalance: number) => void;
  onClose: () => void;
}

type Phase = "loading" | "ready" | "spinning" | "bonus_orb" | "bonus_spin" | "result";

export function DailyCaseModal({ tierNum, tierLabel, tierColor, caseId, claimed = false, locked = false, requiredLevel, token, onDone, onClose }: Props) {
  const countdown = useCountdown();
  const [phase, setPhase] = useState<Phase>("loading");
  const [isDemo, setIsDemo] = useState(false);
  const [caseData, setCaseData] = useState<{ name: string; imageUrl: string; items: CaseItem[] } | null>(null);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [previewItems, setPreviewItems] = useState<CaseItem[]>([]);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [sortOrder, setSortOrder] = useState<"price_desc" | "price_asc">("price_desc");
  const [error, setError] = useState<string | null>(null);

  const reelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Audio ──────────────────────────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTickTime = useRef<number>(0);
  const tickRafRef = useRef<number | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
  };

  const playTick = () => {
    const now = performance.now();
    if (now - lastTickTime.current < 60) return;
    lastTickTime.current = now;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    const sr = ctx.sampleRate;
    const snapLen = Math.floor(sr * 0.008);
    const snapBuf = ctx.createBuffer(1, snapLen, sr);
    const sd = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i++) sd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / snapLen, 3);
    const snap = ctx.createBufferSource();
    snap.buffer = snapBuf;
    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = "bandpass"; snapFilter.frequency.value = 3200; snapFilter.Q.value = 0.8;
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.25, t);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);
    snap.connect(snapFilter); snapFilter.connect(snapGain); snapGain.connect(master);
    snap.start(t);
    const fund = ctx.createOscillator();
    fund.type = "sine";
    fund.frequency.setValueAtTime(260, t);
    fund.frequency.exponentialRampToValueAtTime(120, t + 0.045);
    const fundGain = ctx.createGain();
    fundGain.gain.setValueAtTime(0, t);
    fundGain.gain.linearRampToValueAtTime(0.5, t + 0.002);
    fundGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    fund.connect(fundGain); fundGain.connect(master);
    fund.start(t); fund.stop(t + 0.08);
    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.setValueAtTime(520, t);
    harm.frequency.exponentialRampToValueAtTime(240, t + 0.03);
    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0, t);
    harmGain.gain.linearRampToValueAtTime(0.18, t + 0.002);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    harm.connect(harmGain); harmGain.connect(master);
    harm.start(t); harm.stop(t + 0.05);
  };

  const playStopClick = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    const sr = ctx.sampleRate;
    const master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(ctx.destination);
    const transientLen = Math.floor(sr * 0.010);
    const transientBuf = ctx.createBuffer(1, transientLen, sr);
    const td = transientBuf.getChannelData(0);
    for (let i = 0; i < transientLen; i++) td[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / transientLen, 2);
    const transient = ctx.createBufferSource();
    transient.buffer = transientBuf;
    const tf = ctx.createBiquadFilter();
    tf.type = "bandpass"; tf.frequency.value = 3800; tf.Q.value = 0.8;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.45, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.010);
    transient.connect(tf); tf.connect(tg); tg.connect(master);
    transient.start(t);
    const thud = ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(300, t);
    thud.frequency.exponentialRampToValueAtTime(75, t + 0.10);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0, t);
    thudGain.gain.linearRampToValueAtTime(0.9, t + 0.003);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    thud.connect(thudGain); thudGain.connect(master);
    thud.start(t); thud.stop(t + 0.18);
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 640;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, t);
    shimmerGain.gain.linearRampToValueAtTime(0.14, t + 0.003);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    shimmer.connect(shimmerGain); shimmerGain.connect(master);
    shimmer.start(t); shimmer.stop(t + 0.11);
  };

  const playBonusSwoosh = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    const dur = 1.5;
    const sr = ctx.sampleRate;
    const bufLen = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, bufLen, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 3;
    lp.frequency.setValueAtTime(80, t);
    lp.frequency.exponentialRampToValueAtTime(7000, t + 0.65);
    lp.frequency.exponentialRampToValueAtTime(1800, t + dur);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.08, t + 0.12);
    noiseGain.gain.linearRampToValueAtTime(0.10, t + 0.55);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noiseSrc.connect(lp); lp.connect(noiseGain); noiseGain.connect(ctx.destination);
    noiseSrc.start(t); noiseSrc.stop(t + dur);
    const sweep = ctx.createOscillator();
    sweep.type = "sawtooth";
    sweep.frequency.setValueAtTime(60, t);
    sweep.frequency.exponentialRampToValueAtTime(900, t + 0.7);
    sweep.frequency.exponentialRampToValueAtTime(350, t + dur);
    const sweepFilter = ctx.createBiquadFilter();
    sweepFilter.type = "lowpass";
    sweepFilter.frequency.setValueAtTime(150, t);
    sweepFilter.frequency.exponentialRampToValueAtTime(3500, t + 0.7);
    sweepFilter.frequency.exponentialRampToValueAtTime(800, t + dur);
    const sweepGain = ctx.createGain();
    sweepGain.gain.setValueAtTime(0, t);
    sweepGain.gain.linearRampToValueAtTime(0.05, t + 0.06);
    sweepGain.gain.linearRampToValueAtTime(0.07, t + 0.5);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    sweep.connect(sweepFilter); sweepFilter.connect(sweepGain); sweepGain.connect(ctx.destination);
    sweep.start(t); sweep.stop(t + dur);
    [392, 523, 659, 784, 1047].forEach((freq, i) => {
      const sp = ctx.createOscillator();
      sp.type = "sine";
      sp.frequency.value = freq;
      const spGain = ctx.createGain();
      const onset = 0.55 + i * 0.07;
      spGain.gain.setValueAtTime(0, t + onset);
      spGain.gain.linearRampToValueAtTime(0.03, t + onset + 0.04);
      spGain.gain.exponentialRampToValueAtTime(0.0001, t + onset + 0.45);
      sp.connect(spGain); spGain.connect(ctx.destination);
      sp.start(t + onset); sp.stop(t + onset + 0.5);
    });
  };

  const startTickMonitor = (el: HTMLElement) => {
    if (tickRafRef.current !== null) cancelAnimationFrame(tickRafRef.current);
    let lastIdx = -1;
    const loop = () => {
      const mat = window.getComputedStyle(el).transform;
      if (mat && mat !== "none") {
        const vals = mat.match(/matrix.*\((.+)\)/)?.[1].split(",");
        const pos = vals ? Math.abs(parseFloat(vals[4]) || 0) : 0;
        const idx = Math.floor(pos / ITEM_STEP);
        if (idx !== lastIdx && idx > 0) { lastIdx = idx; playTick(); }
      }
      tickRafRef.current = requestAnimationFrame(loop);
    };
    tickRafRef.current = requestAnimationFrame(loop);
  };

  const stopTickMonitor = () => {
    if (tickRafRef.current !== null) { cancelAnimationFrame(tickRafRef.current); tickRafRef.current = null; }
  };

  // Cleanup audio RAF on unmount
  useEffect(() => () => { stopTickMonitor(); }, []);

  // Fetch case data
  useEffect(() => {
    fetch(`/api/cases/${caseId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setCaseData(data);
        setPreviewItems(Array.from({ length: 11 }, () => { const it = weightedRandom(data.items); return it.chance <= PURPLE_ORB_THRESHOLD ? PURPLE_ORB_ITEM : it.chance <= GOLD_ORB_THRESHOLD ? GOLD_ORB_ITEM : it; }));
        setPhase("ready");
      })
      .catch(() => setError("Failed to load case"));
  }, [caseId, token]);

  const buildReel = (items: CaseItem[], winItem: CaseItem): CaseItem[] => {
    const reel: CaseItem[] = Array.from({ length: REEL_COUNT }, () => {
      const item = weightedRandom(items);
      if (item.chance <= PURPLE_ORB_THRESHOLD) return PURPLE_ORB_ITEM;
      if (item.chance <= GOLD_ORB_THRESHOLD) return GOLD_ORB_ITEM;
      return item;
    });
    // Inject orb placeholder at winning index too when applicable
    if (winItem.chance <= PURPLE_ORB_THRESHOLD) reel[WINNING_IDX] = PURPLE_ORB_ITEM;
    else if (winItem.chance <= GOLD_ORB_THRESHOLD) reel[WINNING_IDX] = GOLD_ORB_ITEM;
    else reel[WINNING_IDX] = winItem;
    return reel;
  };

  const runSpinAnimation = (winItem: CaseItem, items: CaseItem[], demo: boolean, onResult?: () => void) => {
    const reel = buildReel(items, winItem);
    setReelItems(reel);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = reelRef.current;
        const container = containerRef.current;
        if (!el || !container) return;

        const containerW = container.clientWidth;
        const centerOffset = ITEM_STEP + WINNING_IDX * ITEM_STEP + ITEM_W / 2 - containerW / 2;
        const randomOffset = Math.floor(Math.random() * 40) - 20;
        const targetOffset = centerOffset + randomOffset;

        el.style.transition = "none";
        el.style.transform = "translateX(0px)";
        void el.offsetWidth;
        el.style.transition = "transform 4500ms cubic-bezier(0.12, 1, 0.4, 1)";
        el.style.transform = `translateX(-${targetOffset}px)`;

        startTickMonitor(el);

        setTimeout(() => {
          stopTickMonitor();
          playStopClick();
          el.style.transition = "transform 300ms cubic-bezier(0.25, 0, 0, 1)";
          el.style.transform = `translateX(-${centerOffset}px)`;
        }, 4550);

        setTimeout(() => {
          const isOrbItem = winItem.chance <= GOLD_ORB_THRESHOLD;

          if (isOrbItem) {
            // Play swoosh + show orb briefly (no text, no banner)
            playBonusSwoosh();
            setPhase("bonus_orb");

            // After 900ms kick off the bonus spin (gives time to see the orb pop-in)
            setTimeout(() => {
              const pool = items.filter((i) => i.chance <= GOLD_ORB_THRESHOLD);
              const usePool = pool.length > 0 ? pool : items;

              const bonusWinItem = demo ? weightedRandom(usePool) : winItem;

              const bonusReel: CaseItem[] = Array.from({ length: REEL_COUNT }, () =>
                usePool[Math.floor(Math.random() * usePool.length)]
              );
              bonusReel[WINNING_IDX] = bonusWinItem;
              setReelItems(bonusReel);
              setPhase("bonus_spin");

              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  if (!el) return;
                  const bonusDuration = 4000;
                  const bonusCenterOffset = ITEM_STEP + WINNING_IDX * ITEM_STEP + ITEM_W / 2 - containerW / 2;
                  const bonusRandomOffset = Math.floor(Math.random() * 40) - 20;

                  el.style.transition = "none";
                  el.style.transform = "translateX(0px)";
                  void el.offsetWidth;
                  el.style.transition = `transform ${bonusDuration}ms cubic-bezier(0.08, 0.82, 0.15, 1)`;
                  el.style.transform = `translateX(-${bonusCenterOffset + bonusRandomOffset}px)`;

                  startTickMonitor(el);

                  setTimeout(() => {
                    stopTickMonitor();
                    playStopClick();
                    el.style.transition = "transform 300ms cubic-bezier(0.25, 0, 0, 1)";
                    el.style.transform = `translateX(-${bonusCenterOffset}px)`;
                  }, bonusDuration + 50);

                  setTimeout(() => {
                    setWonItem(bonusWinItem);
                    setPhase("result");
                    onResult?.();
                  }, bonusDuration + 400);
                });
              });
            }, 900);

          } else {
            setWonItem(winItem);
            setPhase("result");
            onResult?.();
          }
        }, 4900);
      });
    });
  };

  const startDemoSpin = () => {
    if (!caseData || phase !== "ready") return;
    initAudio();
    setIsDemo(true);
    setPhase("spinning");
    setError(null);

    const winItem = weightedRandom(caseData.items);
    runSpinAnimation(winItem, caseData.items, true);
  };

  const resetToReady = () => {
    setWonItem(null);
    setIsDemo(false);
    setPhase("ready");
    setPreviewItems(
      Array.from({ length: 11 }, () => {
        const it = weightedRandom(caseData!.items);
        return it.chance <= PURPLE_ORB_THRESHOLD ? PURPLE_ORB_ITEM : it.chance <= GOLD_ORB_THRESHOLD ? GOLD_ORB_ITEM : it;
      })
    );
  };

  const startSpin = async () => {
    if (!caseData || phase !== "ready") return;
    initAudio();
    setIsDemo(false);
    setPhase("spinning");
    setError(null);

    let result: { item: CaseItem; newBalance: number } | null = null;
    try {
      const res = await fetch("/api/daily/open-tier-case", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier: tierNum }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to open"); setPhase("ready"); return; }
      result = data;
    } catch {
      setError("Failed to open case");
      setPhase("ready");
      return;
    }

    runSpinAnimation(result!.item, caseData.items, false, () => {
      onDone(result!.item, result!.newBalance);
    });
  };

  const sortedItems = caseData
    ? [...caseData.items].sort((a, b) =>
        sortOrder === "price_desc" ? b.value - a.value : a.value - b.value
      )
    : [];

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && phase !== "spinning" && phase !== "bonus_orb" && phase !== "bonus_spin") onClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0f0f1a, #1a1a2e)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold" style={{ color: tierColor }}>
              {tierLabel} — Daily Case
            </p>
            <h2 className="text-lg font-black text-white leading-tight">{caseData?.name ?? "Loading…"}</h2>
          </div>
          {phase !== "spinning" && phase !== "bonus_orb" && phase !== "bonus_spin" && (
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Reel area */}
        <div className="shrink-0 py-4 px-0 relative" style={{ background: "hsl(var(--sidebar))" }}>
          {/* Center marker — hidden on result */}
          <div className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center${phase === "result" ? " opacity-0" : ""}`}>
            <div className="w-0.5 h-full" style={{ background: `linear-gradient(to bottom, ${tierColor}cc, ${tierColor}44)` }} />
            <div
              className="absolute top-2 w-0 h-0"
              style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: `10px solid ${tierColor}`, filter: `drop-shadow(0 0 4px ${tierColor})` }}
            />
            <div
              className="absolute bottom-2 w-0 h-0"
              style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: `10px solid ${tierColor}`, filter: `drop-shadow(0 0 4px ${tierColor})` }}
            />
          </div>

          <div
            ref={containerRef}
            className="overflow-hidden mx-0"
            style={{ height: ITEM_W + 30 }}
          >
            {phase === "loading" && (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}

            {(phase === "ready") && previewItems.length > 0 && (
              <div className="flex items-center h-full">
                {previewItems.map((item, i) => (
                  <ReelItem key={i} item={item} />
                ))}
              </div>
            )}

            {(phase === "spinning" || phase === "bonus_orb" || phase === "bonus_spin") && (
              <div
                ref={reelRef}
                className="flex items-center will-change-transform"
                style={{ paddingLeft: ITEM_STEP, paddingRight: ITEM_STEP * 3 }}
              >
                {reelItems.map((item, i) => (
                  <ReelItem key={i} item={item} />
                ))}
              </div>
            )}

            {phase === "result" && wonItem && (
              <motion.div
                key="daily-result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
                className="h-full flex flex-col items-center justify-center gap-2"
              >
                <motion.div
                  initial={{ scale: 0.72, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.06 }}
                  style={{ filter: `drop-shadow(0 0 16px ${RARITY_HEX[rarityFromChance(wonItem.chance)] ?? "#888"}aa)` }}
                >
                  <ItemThumb item={wonItem} size={62} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.14 }}
                  className="text-center"
                >
                  <p className="text-sm font-semibold text-white/90 leading-tight">{wonItem.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                    {wonItem.value}
                    <img src={dlSrc} alt="DL" style={{ width: 14, height: 14, objectFit: "contain", imageRendering: "pixelated" }} />
                  </p>
                </motion.div>
              </motion.div>
            )}
          </div>

          {/* Orb pop-up overlay during bonus_orb phase */}
          {phase === "bonus_orb" && (
            <div
              className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(1px)" }}
            >
              <style>{`
                @keyframes orbPopIn {
                  0%   { transform: scale(0.4); opacity: 0; }
                  60%  { transform: scale(1.15); opacity: 1; }
                  100% { transform: scale(1); opacity: 1; }
                }
                @keyframes orbPulseGlow {
                  0%, 100% { filter: drop-shadow(0 0 18px rgba(251,191,36,0.9)) drop-shadow(0 0 36px rgba(251,191,36,0.5)); }
                  50%       { filter: drop-shadow(0 0 28px rgba(251,191,36,1))   drop-shadow(0 0 56px rgba(251,191,36,0.7)); }
                }
              `}</style>
              <img
                src={goldOrbSrc}
                alt="Orb"
                style={{
                  width: 96,
                  height: 96,
                  objectFit: "contain",
                  imageRendering: "pixelated",
                  animation: "orbPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards, orbPulseGlow 0.8s ease-in-out infinite",
                }}
              />
            </div>
          )}

        </div>

        {/* Action area — fixed height so no layout shift between phases */}
        <div className="shrink-0 px-5 py-4" style={{ minHeight: 70 }}>
          {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

          {phase === "ready" && claimed && (
            <div className="flex flex-col gap-2 w-full">
              <div className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2.5">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="text-center">
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none">Opens in</p>
                  <p className="text-base font-black tabular-nums" style={{ color: tierColor }}>{countdown}</p>
                </div>
              </div>
              <button
                onClick={startDemoSpin}
                className="w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
              >
                🎲 Demo Spin
              </button>
            </div>
          )}

          {phase === "ready" && !claimed && locked && (
            <div className="flex flex-col gap-2 w-full">
              <div className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2.5 text-sm font-black text-gray-400 uppercase tracking-wide">
                🔒 Reach Level {requiredLevel} to Open
              </div>
              <button
                onClick={startDemoSpin}
                className="w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
              >
                🎲 Demo Spin
              </button>
            </div>
          )}

          {phase === "ready" && !claimed && !locked && (
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={startSpin}
                className="w-full py-3 rounded-xl font-black text-sm text-white transition-all active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${tierColor}, ${tierColor}88)`,
                  boxShadow: `0 4px 16px ${tierColor}44`,
                }}
              >
                OPEN CASE
              </button>
              <button
                onClick={startDemoSpin}
                className="w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
              >
                🎲 Demo Spin
              </button>
            </div>
          )}

          {(phase === "spinning" || phase === "bonus_orb" || phase === "bonus_spin") && (
            <div className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              {isDemo ? "Demo spinning…" : "Spinning…"}
            </div>
          )}

          {phase === "result" && !isDemo && (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-black text-sm text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 4px 16px rgba(168,85,247,0.35)" }}
            >
              COLLECT & CLOSE
            </button>
          )}

          {phase === "result" && isDemo && (
            <div className="flex flex-col gap-2 w-full">
              <div className="w-full py-2 rounded-lg bg-white/5 border border-white/10 text-center">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Demo — No reward earned</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={resetToReady}
                  className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
                >
                  🎲 Spin Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl font-black text-sm text-white transition-all active:scale-95"
                  style={{ background: "linear-gradient(135deg, #374151, #4b5563)" }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Case contents */}
        {caseData && (
          <div className="overflow-y-auto px-5 pb-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-black text-white">Case Contents</p>
              <button
                onClick={() => setSortOrder((s) => s === "price_desc" ? "price_asc" : "price_desc")}
                className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors"
              >
                {sortOrder === "price_desc" ? "Highest price" : "Lowest price"} ▾
              </button>
            </div>
            <div className="space-y-1">
              {sortedItems.map((item) => {
                const rarity = rarityFromChance(item.chance);
                const hex = RARITY_HEX[rarity] ?? "#888";
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border-l-4 transition-colors hover:bg-white/5"
                    style={{ borderColor: hex, background: `${hex}0a` }}
                  >
                    <ItemThumb item={item} size={32} />
                    <span className="flex-1 text-sm font-semibold text-white truncate">{item.name}</span>
                    <div className="flex items-center gap-1 text-sm font-bold" style={{ color: hex }}>
                      {item.value.toLocaleString()}
                      <img src={dlSrc} alt="DL" width={12} height={12} style={{ imageRendering: "pixelated" }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-14 text-right">{item.chance < 0.01 ? item.chance.toFixed(4).replace(/\.?0+$/, "") : parseFloat(item.chance.toFixed(2))}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
