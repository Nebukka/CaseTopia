import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowLeft, Lock, CheckCircle2, Loader2, TrendingDown, Gift, Zap, HelpCircle, X } from "lucide-react";
import dlSrc from "@assets/dl_1775514218033.webp";
import silverIdolSrc from "@assets/silver_idol_1775658647125.webp";
import dragonHandSrc from "@assets/dragon_hand_1775658807287.webp";
import whiteCrystSrc from "@assets/white_cryst_1775658843136.webp";
import thingamabobSrc from "@assets/tbob_1775731468700.webp";
import emeraldPickaxeSrc from "@assets/e_pick_1775672616663.webp";
import cosmicCapeSrc from "@assets/cosmic_cape_1775660413681.webp";
import starseedSrc from "@assets/starseed_1775660468302.webp";
import toxicWasteSrc from "@assets/toxic_waste_1775542150980.webp";
import luckyCloverkSrc from "@assets/lucky_c_1775660495173.webp";
import crystalCapeSrc from "@assets/crystal_cape_1775675062169.webp";
import freezeWandSrc from "@assets/freeze_wand_1775675096185.webp";
import iceHorseTier3Src from "@assets/ice_horse_1775675123402.webp";
import blueGemLockTier4Src from "@assets/blue_gem_lock_1775525781696.webp";
import wingsOfDaidalosSrc from "@assets/wings_of_daidalos_1775542424005.webp";
import winterFluSrc from "@assets/winter_flu_1775673772603.webp";
import { TierChestIcon } from "../components/TierChestIcon";
import { DailyCaseModal } from "../components/DailyCaseModal";
import { Layout } from "../components/Layout";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TierStatus {
  tier: number;
  requiredLevel: number;
  label: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  dailyMin: number;
  dailyMax: number;
  unlocked: boolean;
  claimed: boolean;
  linkedCaseId?: number;
}

interface RakebackTier {
  label: string;
  minWagered: number;
  percent: number;
  color: string;
}

interface MonthlyStatus {
  monthlyWagered: number;
  monthlyNetLoss: number;
  currentTier: RakebackTier;
  nextTier: RakebackTier | null;
  rakebackAmount: number;
  canClaim: boolean;
}

interface StatusData {
  level: number;
  progress: number;
  totalWagered: number;
  nextThreshold: number | null;
  tiers: TierStatus[];
  monthly: MonthlyStatus;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDl(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  if (v % 1 !== 0) return v.toFixed(1);
  return String(v);
}

// Reset is at 12:00 UTC+3 = 09:00 UTC every day
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

function fmtWagered(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.floor(v));
}


// ─── Tier Case Card ────────────────────────────────────────────────────────────
// Sparkle positions around the chest (relative to center of the image area)
const STAR_CONFIGS = [
  { top: "8%",  left: "10%",  delay: "0s",    dur: "2.1s", size: 5 },
  { top: "5%",  right: "12%", delay: "0.7s",  dur: "1.8s", size: 4 },
  { top: "35%", left: "4%",   delay: "1.2s",  dur: "2.4s", size: 6 },
  { top: "35%", right: "5%",  delay: "0.3s",  dur: "1.9s", size: 5 },
  { top: "70%", left: "8%",   delay: "1.6s",  dur: "2.2s", size: 4 },
  { top: "70%", right: "9%",  delay: "0.9s",  dur: "2.0s", size: 6 },
  { top: "15%", left: "38%",  delay: "0.5s",  dur: "1.7s", size: 3 },
  { top: "80%", left: "42%",  delay: "1.4s",  dur: "2.3s", size: 4 },
];

const SMOKE_CONFIGS = [
  { left: "30%", delay: "0s",   dur: "3s",   size: 18 },
  { left: "50%", delay: "1s",   dur: "3.5s", size: 22 },
  { left: "65%", delay: "0.5s", dur: "2.8s", size: 16 },
];

function TierCard({
  tier,
  onClaim,
  onOpenCase,
  claiming,
}: {
  tier: TierStatus;
  onClaim: (t: number) => void;
  onOpenCase: (t: TierStatus) => void;
  claiming: boolean;
}) {
  const epic = tier.tier >= 10; // tiers 10-15 get particle effects
  const isRainbow = tier.tier === 15;
  const isLinked = !!tier.linkedCaseId;
  const countdown = useCountdown();

  return (
    <div
      onClick={isLinked ? () => onOpenCase(tier) : undefined}
      className={`relative rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden${isRainbow && tier.unlocked && !tier.claimed ? " rainbow-border-anim" : ""}${isLinked ? " cursor-pointer hover:brightness-110 active:scale-[0.97]" : ""}`}
      style={{
        background: `linear-gradient(145deg, ${tier.gradientFrom}ee, ${tier.gradientTo}ff)`,
        ...(isRainbow && tier.unlocked
          ? { borderColor: tier.claimed ? "#374151" : undefined }
          : {
              borderColor: tier.unlocked ? tier.color : "#1f2937",
              boxShadow: tier.unlocked && !tier.claimed
                ? `0 0 20px ${tier.color}55, inset 0 1px 0 ${tier.color}33`
                : "none",
            }),
        opacity: tier.unlocked ? 1 : 0.5,
      }}
    >
      {/* Vivid colour wash overlay for extra saturation */}
      {tier.unlocked && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 40%, ${tier.color}22 0%, transparent 70%)` }}
        />
      )}

      {/* ── Epic particle layer (tiers 10-15) ─────────────────────────── */}
      {epic && tier.unlocked && !tier.claimed && (
        <>
          {/* Glow orb behind chest */}
          <div
            className={`absolute pointer-events-none${isRainbow ? " rainbow-hue" : ""}`}
            style={{
              top: "12%", left: "50%", transform: "translateX(-50%)",
              width: 72, height: 72,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${isRainbow ? "#e879f9" : tier.color}cc 0%, ${isRainbow ? "#e879f9" : tier.color}22 60%, transparent 100%)`,
              filter: "blur(10px)",
              animation: "chest-glow-orb 2.5s ease-in-out infinite",
            }}
          />

          {/* Sparkle stars */}
          {STAR_CONFIGS.map((s, i) => (
            <div
              key={i}
              className={`absolute pointer-events-none${isRainbow ? " rainbow-hue" : ""}`}
              style={{
                top: s.top,
                left: (s as any).left,
                right: (s as any).right,
                width: s.size, height: s.size,
                borderRadius: "50%",
                background: i % 2 === 0 ? (isRainbow ? "#e879f9" : tier.color) : "#ffffff",
                boxShadow: `0 0 ${s.size * 2}px ${i % 2 === 0 ? (isRainbow ? "#e879f9" : tier.color) : "#ffffff"}`,
                animation: `star-sparkle ${s.dur} ${s.delay} ease-in-out infinite, star-float ${s.dur} ${s.delay} ease-in-out infinite`,
              }}
            />
          ))}

          {/* Smoke wisps */}
          {SMOKE_CONFIGS.map((sm, i) => (
            <div
              key={i}
              className={`absolute pointer-events-none${isRainbow ? " rainbow-hue" : ""}`}
              style={{
                bottom: "28%", left: sm.left,
                width: sm.size, height: sm.size,
                borderRadius: "50%",
                background: `${isRainbow ? "#e879f9" : tier.color}55`,
                filter: "blur(6px)",
                animation: `chest-smoke ${sm.dur} ${sm.delay} ease-out infinite`,
              }}
            />
          ))}
        </>
      )}

      {/* Tier number badge */}
      <div
        className={`absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded-md z-10${isRainbow && tier.unlocked ? " rainbow-hue" : ""}`}
        style={isRainbow && tier.unlocked
          ? { background: "#e879f944", color: "#e879f9", border: "1px solid #e879f988" }
          : { background: `${tier.color}44`, color: tier.color, border: `1px solid ${tier.color}88` }}
      >
        {tier.label}
      </div>

      {/* Chest image area */}
      <div className="relative flex flex-1 items-center justify-center pt-6 pb-2 px-3">
        <div
          className={`relative flex items-center justify-center z-10 w-28 h-28`}
          style={{
            filter: !tier.unlocked
              ? "grayscale(0.9) brightness(0.35)"
              : tier.claimed
              ? "brightness(0.5) saturate(0.4)"
              : `saturate(1.4) brightness(1.1)`,
          }}
        >
          {true ? (
            <TierChestIcon color={tier.color} tier={tier.tier} size={112} />
          ) : (
            <img
              src={`/chests/tier${tier.tier}.png`}
              alt={tier.label}
              className="w-full h-full object-contain"
              style={{
                mixBlendMode: tier.tier >= 13 ? "lighten" : "normal",
                filter: tier.unlocked && !tier.claimed
                  ? `drop-shadow(0 0 8px ${isRainbow ? "#e879f9cc" : `${tier.color}cc`}) drop-shadow(0 0 16px ${isRainbow ? "#e879f966" : `${tier.color}66`})`
                  : "none",
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextSibling as HTMLElement).style.display = "flex";
              }}
            />
          )}

          {/* Featured items for Tier 1 */}
          {tier.tier === 1 && (
            <>
              <img
                src={thingamabobSrc}
                alt="Thingamabob"
                className="absolute pointer-events-none"
                style={{
                  width: 34,
                  height: 34,
                  top: -14,
                  left: "50%",
                  transform: "translateX(-50%)",
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #94a3b8cc) drop-shadow(0 0 12px #94a3b866)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
              <img
                src={dragonHandSrc}
                alt="Dragon Hand"
                className="absolute pointer-events-none"
                style={{
                  width: 36,
                  height: 36,
                  bottom: -10,
                  left: -14,
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #94a3b8cc) drop-shadow(0 0 12px #94a3b866)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
              <img
                src={silverIdolSrc}
                alt="Silver Idol"
                className="absolute pointer-events-none"
                style={{
                  width: 36,
                  height: 36,
                  bottom: -10,
                  right: -14,
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #94a3b8cc) drop-shadow(0 0 12px #94a3b866)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
            </>
          )}
          {/* Featured items for Tier 2 */}
          {tier.tier === 2 && (
            <>
              <img
                src={emeraldPickaxeSrc}
                alt="Emerald Pickaxe"
                className="absolute pointer-events-none"
                style={{
                  width: 34,
                  height: 34,
                  top: -14,
                  left: "50%",
                  transform: "translateX(-50%) rotate(18deg)",
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #4ade80cc) drop-shadow(0 0 12px #4ade8066)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
              <img
                src={cosmicCapeSrc}
                alt="Cosmic Cape"
                className="absolute pointer-events-none"
                style={{
                  width: 36,
                  height: 36,
                  bottom: -10,
                  left: -14,
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #4ade80cc) drop-shadow(0 0 12px #4ade8066)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
              <img
                src={toxicWasteSrc}
                alt="Toxic Waste"
                className="absolute pointer-events-none"
                style={{
                  width: 36,
                  height: 36,
                  bottom: -10,
                  right: -14,
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #4ade80cc) drop-shadow(0 0 12px #4ade8066)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
            </>
          )}

          {/* Featured items for Tier 3 */}
          {tier.tier === 3 && (
            <>
              <img
                src={iceHorseTier3Src}
                alt="Ice Horse"
                className="absolute pointer-events-none"
                style={{
                  width: 34,
                  height: 34,
                  top: -14,
                  left: "50%",
                  transform: "translateX(-50%) rotate(18deg)",
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #67e8f9cc) drop-shadow(0 0 12px #67e8f966)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
              <img
                src={crystalCapeSrc}
                alt="Crystal Cape"
                className="absolute pointer-events-none"
                style={{
                  width: 36,
                  height: 36,
                  bottom: -10,
                  left: -14,
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #67e8f9cc) drop-shadow(0 0 12px #67e8f966)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
              <img
                src={freezeWandSrc}
                alt="Freeze Wand"
                className="absolute pointer-events-none"
                style={{
                  width: 36,
                  height: 36,
                  bottom: -10,
                  right: -14,
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #67e8f9cc) drop-shadow(0 0 12px #67e8f966)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
            </>
          )}

          {/* Featured items for Tier 4 */}
          {tier.tier === 4 && (
            <>
              <img
                src={winterFluSrc}
                alt="Winter Flu Vaccine"
                className="absolute pointer-events-none"
                style={{
                  width: 34,
                  height: 34,
                  top: -14,
                  left: "50%",
                  transform: "translateX(-50%) rotate(18deg)",
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #60a5facc) drop-shadow(0 0 12px #60a5fa66)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
              <img
                src={wingsOfDaidalosSrc}
                alt="Wings Of Daidalos"
                className="absolute pointer-events-none"
                style={{
                  width: 36,
                  height: 36,
                  bottom: -10,
                  left: -14,
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #60a5facc) drop-shadow(0 0 12px #60a5fa66)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
              <img
                src={blueGemLockTier4Src}
                alt="Blue Gem Lock"
                className="absolute pointer-events-none"
                style={{
                  width: 36,
                  height: 36,
                  bottom: -10,
                  right: -14,
                  imageRendering: "pixelated",
                  filter: tier.unlocked && !tier.claimed
                    ? "drop-shadow(0 0 6px #60a5facc) drop-shadow(0 0 12px #60a5fa66)"
                    : "grayscale(1) brightness(0.4)",
                  zIndex: 20,
                }}
              />
            </>
          )}

          {/* Fallback icon if image fails */}
          <div
            className="absolute inset-0 items-center justify-center rounded-xl hidden"
            style={{ background: `${tier.color}22`, border: `1.5px solid ${tier.color}55` }}
          >
            {tier.claimed ? (
              <CheckCircle2 className="w-7 h-7" style={{ color: tier.color }} />
            ) : tier.unlocked ? (
              <Gift className="w-7 h-7" style={{ color: tier.color }} />
            ) : (
              <Lock className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>

        {tier.claimed && (
          <div className="absolute top-1 right-1 z-20">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
        )}
        {!tier.unlocked && (
          <div className="absolute inset-0 flex items-end justify-center pb-1 z-20">
            <Lock className="w-4 h-4 text-gray-500" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto px-2 pb-3 pt-1 z-10 relative">
        {!tier.unlocked ? (
          <p className="text-center text-[10px] text-gray-500 font-semibold">
            Requires Level {tier.requiredLevel}
          </p>
        ) : tier.claimed ? (
          <div className="text-center bg-black/30 rounded-lg py-1 px-1">
            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-0.5">Opens in</p>
            <p className="text-[10px] font-black tabular-nums" style={{ color: tier.color, letterSpacing: "0.05em" }}>{countdown}</p>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); tier.linkedCaseId ? onOpenCase(tier) : onClaim(tier.tier); }}
            disabled={claiming}
            className={`w-full text-[11px] font-black py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50${isRainbow ? " rainbow-btn" : ""}`}
            style={isRainbow ? { color: "#fff" } : {
              background: `linear-gradient(135deg, ${tier.color}, ${tier.color}99)`,
              color: "#fff",
              boxShadow: `0 2px 10px ${tier.color}66`,
            }}
          >
            {claiming ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "OPEN"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DailyClaim() {
  const { user, token, updateUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingTier, setClaimingTier] = useState<number | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimingMonthly, setClaimingMonthly] = useState(false);
  const [caseTierOpen, setCaseTierOpen] = useState<TierStatus | null>(null);
  const [showRakebackInfo, setShowRakebackInfo] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/daily/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleClaimTier = async (tierNum: number) => {
    if (!token || claimingTier !== null) return;
    setClaimingTier(tierNum);
    try {
      const res = await fetch("/api/daily/claim-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier: tierNum }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error, variant: "destructive" }); return; }
      updateUser({ balance: data.newBalance });
      toast({ title: `+${fmtDl(data.reward)} DL from Tier ${data.tier}!` });
      await fetchStatus();
    } finally { setClaimingTier(null); }
  };

  const handleOpenCase = (tier: TierStatus) => {
    setCaseTierOpen(tier);
  };

  const handleCaseModalDone = (wonItem: { name: string; value: number }, newBalance: number) => {
    updateUser({ balance: newBalance });
    toast({ title: `Won ${wonItem.name} (+${fmtDl(wonItem.value)} DL)!` });
    fetchStatus();
  };

  const handleClaimAll = async () => {
    if (!token || claimingAll) return;
    setClaimingAll(true);
    try {
      const res = await fetch("/api/daily/claim-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error, variant: "destructive" }); return; }
      updateUser({ balance: data.newBalance });
      toast({ title: `+${fmtDl(data.totalReward)} DL claimed from ${data.claims.length} case${data.claims.length !== 1 ? "s" : ""}!` });
      await fetchStatus();
    } finally { setClaimingAll(false); }
  };

  const handleClaimMonthly = async () => {
    if (!token || claimingMonthly) return;
    setClaimingMonthly(true);
    try {
      const res = await fetch("/api/daily/claim-monthly", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error, variant: "destructive" }); return; }
      updateUser({ balance: data.newBalance });
      toast({ title: `+${fmtDl(data.amount)} DL ${data.tierLabel} rakeback (${data.percent}%)!` });
      await fetchStatus();
    } finally { setClaimingMonthly(false); }
  };

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Please log in to claim rewards.</p>
        </div>
      </Layout>
    );
  }

  if (loading || !status) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const { tiers, monthly } = status;
  const availableCount = tiers.filter((t) => t.unlocked && !t.claimed).length;
  const rakebackColor = monthly.currentTier?.color ?? "#4b5563";

  return (
    <Layout>
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-white hover:bg-card border border-transparent hover:border-border transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold text-white">Rewards</h1>
      </div>

      {/* Level Progress */}
      <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-base font-black border-2 shrink-0"
          style={{ borderColor: "#a78bfa", color: "#a78bfa", background: "#a78bfa18" }}
        >
          {status.level}
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-white">Level {status.level}</span>
            {status.nextThreshold && (
              <span>{fmtWagered(status.totalWagered)} / {fmtWagered(status.nextThreshold)} DL wagered</span>
            )}
            {!status.nextThreshold && <span className="text-yellow-400 font-bold">MAX LEVEL</span>}
          </div>
          <div className="h-2 bg-[#12122a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${status.progress}%`, background: "linear-gradient(90deg, #a78bfa, #7c3aed)" }}
            />
          </div>
          {status.nextThreshold && (
            <p className="text-[10px] text-muted-foreground">
              {fmtWagered(status.nextThreshold - status.totalWagered)} DL more to reach Level {status.level + 1}
            </p>
          )}
        </div>
      </div>

      {/* Monthly Rakeback */}
      {monthly.currentTier && (() => {
        const ct = monthly.currentTier;
        const nt = monthly.nextTier;
        const wagered = monthly.monthlyWagered;
        const claimable = monthly.canClaim && monthly.rakebackAmount > 0;
        // Progress to next tier
        const progressPct = nt
          ? Math.min(100, Math.round(((wagered - ct.minWagered) / (nt.minWagered - ct.minWagered)) * 100))
          : 100;
        const dlToNextTier = nt ? Math.max(0, nt.minWagered - wagered) : 0;

        return (
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{
              background: `linear-gradient(135deg, #0f0f1a 0%, ${ct.color}14 100%)`,
              borderColor: `${ct.color}40`,
              boxShadow: claimable ? `0 0 28px ${ct.color}28` : "none",
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ct.color}20`, border: `1.5px solid ${ct.color}50` }}>
                  <TrendingDown className="w-6 h-6" style={{ color: ct.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-black text-base uppercase tracking-wide text-white">Monthly Rakeback</p>
                    <button
                      onClick={() => setShowRakebackInfo(true)}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-white transition-colors shrink-0"
                      title="How does rakeback work?"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Resets 1st of each month</p>
                </div>
              </div>
              {/* Tier badge */}
              <span className="text-sm font-black px-3 py-1 rounded-full shrink-0" style={{ background: `${ct.color}22`, color: ct.color, border: `1px solid ${ct.color}44` }}>
                {ct.label}{ct.percent > 0 ? ` · ${ct.percent}%` : ""}
              </span>
            </div>

            {/* Tier progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Monthly wagered: <span className="font-bold text-white">{fmtWagered(wagered)} DL</span></span>
                {nt
                  ? <span>Next: <span className="font-semibold" style={{ color: nt.color }}>{nt.label} ({nt.percent}%)</span> — {fmtWagered(dlToNextTier)} DL more</span>
                  : <span className="font-bold" style={{ color: ct.color }}>Max tier reached 🏆</span>
                }
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: nt
                      ? `linear-gradient(90deg, ${ct.color}, ${nt.color})`
                      : ct.color,
                  }}
                />
              </div>
              {/* Tier ladder */}
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {[
                  { label: "Bronze", minWagered: 1000, percent: 5, color: "#cd7f32" },
                  { label: "Silver", minWagered: 10000, percent: 10, color: "#94a3b8" },
                  { label: "Gold", minWagered: 50000, percent: 15, color: "#eab308" },
                  { label: "Platinum", minWagered: 200000, percent: 20, color: "#67e8f9" },
                  { label: "Diamond", minWagered: 1000000, percent: 25, color: "#a855f7" },
                ].map((t) => {
                  const active = wagered >= t.minWagered;
                  return (
                    <span
                      key={t.label}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: active ? `${t.color}28` : "rgba(255,255,255,0.04)",
                        color: active ? t.color : "#4b5563",
                        border: `1px solid ${active ? t.color + "50" : "transparent"}`,
                      }}
                      title={`≥ ${fmtWagered(t.minWagered)} DL wagered`}
                    >
                      {t.label} {t.percent}%
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Net loss + rakeback row */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/8">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Net loss this month:
                  <span className="font-bold text-white ml-1">{fmtWagered(monthly.monthlyNetLoss)} DL</span>
                </p>
                {ct.percent > 0 && monthly.monthlyNetLoss > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Rakeback ({ct.percent}%):
                    <span className="font-black ml-1 inline-flex items-center gap-0.5" style={{ color: ct.color }}>
                      +{fmtDl(monthly.rakebackAmount)}
                      <img src={dlSrc} alt="DL" width={11} height={11} style={{ imageRendering: "pixelated", display: "inline-block" }} />
                    </span>
                  </p>
                ) : ct.percent === 0 ? (
                  <p className="text-xs text-muted-foreground">Wager ≥ 1,000 DL this month to unlock rakeback</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No net losses this month — keep playing!</p>
                )}
              </div>
              <button
                onClick={handleClaimMonthly}
                disabled={!claimable || claimingMonthly}
                className="shrink-0 px-5 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: claimable ? `linear-gradient(135deg, ${ct.color}, ${ct.color}99)` : "#1f2937",
                  color: "#fff",
                  boxShadow: claimable ? `0 4px 12px ${ct.color}44` : "none",
                }}
              >
                {claimingMonthly ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : monthly.canClaim ? (
                  "CLAIM"
                ) : (
                  "CLAIMED"
                )}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Rakeback Info Modal */}
      {showRakebackInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowRakebackInfo(false)}
        >
          <div
            className="relative max-w-sm w-full rounded-2xl border border-white/10 p-6 space-y-4"
            style={{ background: "#0f0f1a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-lg text-white uppercase tracking-wide">How Rakeback Works</p>
                <p className="text-xs text-muted-foreground mt-0.5">Earn back a % of your net losses every month</p>
              </div>
              <button onClick={() => setShowRakebackInfo(false)} className="text-muted-foreground hover:text-white transition-colors shrink-0 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Your <span className="text-white font-semibold">rakeback tier</span> is determined by how much you wager each calendar month. The higher your tier, the higher the % you get back.</p>
              <p>At the end of each month, you can <span className="text-white font-semibold">claim your rakeback</span> — it's calculated as a percentage of your <span className="text-white font-semibold">net losses</span> (total losses minus total wins).</p>
              <p className="text-xs">Rakeback resets on the 1st of each month. Unclaimed rakeback is <span className="text-white">forfeited</span> at reset.</p>
            </div>

            {/* Tier table */}
            <div className="rounded-xl border border-white/8 overflow-hidden">
              <div className="grid grid-cols-3 text-[10px] font-bold text-muted-foreground uppercase px-3 py-2 bg-white/5">
                <span>Tier</span>
                <span>Monthly Wagered</span>
                <span className="text-right">Rakeback</span>
              </div>
              {[
                { label: "None",     minWagered: 0,         percent: 0,  color: "#4b5563" },
                { label: "Bronze",   minWagered: 1_000,     percent: 5,  color: "#cd7f32" },
                { label: "Silver",   minWagered: 10_000,    percent: 10, color: "#94a3b8" },
                { label: "Gold",     minWagered: 50_000,    percent: 15, color: "#eab308" },
                { label: "Platinum", minWagered: 200_000,   percent: 20, color: "#67e8f9" },
                { label: "Diamond",  minWagered: 1_000_000, percent: 25, color: "#a855f7" },
              ].map((t, i) => (
                <div key={t.label} className={`grid grid-cols-3 px-3 py-2 text-xs ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                  <span className="font-bold" style={{ color: t.color }}>{t.label}</span>
                  <span className="text-muted-foreground inline-flex items-center gap-0.5">
                    {t.minWagered === 0 ? "< 1,000" : `≥ ${t.minWagered.toLocaleString()}`}
                    <img src={dlSrc} alt="DL" width={10} height={10} style={{ imageRendering: "pixelated", display: "inline-block" }} />
                  </span>
                  <span className="text-right font-bold" style={{ color: t.percent > 0 ? t.color : "#4b5563" }}>{t.percent > 0 ? `${t.percent}%` : "—"}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowRakebackInfo(false)}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Open All button */}
      {availableCount > 0 && (
        <button
          onClick={handleClaimAll}
          disabled={claimingAll}
          className="w-full py-3 rounded-xl font-black text-white text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            boxShadow: "0 4px 16px rgba(168,85,247,0.35)",
          }}
        >
          {claimingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Zap className="w-4 h-4" />
              OPEN ALL AVAILABLE CASES ({availableCount})
            </>
          )}
        </button>
      )}

      {/* Tier Cases Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {tiers.map((tier) => (
          <TierCard
            key={tier.tier}
            tier={tier}
            onClaim={handleClaimTier}
            onOpenCase={handleOpenCase}
            claiming={claimingTier === tier.tier}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pb-4 flex flex-wrap items-center justify-center gap-x-1">
        <span>Daily cases reset daily at 12 PM UTC+3. Level up by wagering more</span>
        <img src={dlSrc} alt="DL" width={12} height={12} style={{ imageRendering: "pixelated", display: "inline" }} />
        <span>to unlock higher tiers. Monthly rakeback resets on the 1st of each month.</span>
      </p>

      {/* Daily case-opening modal for linked cases */}
      {caseTierOpen && caseTierOpen.linkedCaseId && token && (
        <DailyCaseModal
          tierNum={caseTierOpen.tier}
          tierLabel={caseTierOpen.label}
          tierColor={caseTierOpen.color}
          caseId={caseTierOpen.linkedCaseId}
          claimed={caseTierOpen.claimed}
          locked={!caseTierOpen.unlocked}
          requiredLevel={caseTierOpen.requiredLevel}
          token={token}
          onDone={handleCaseModalDone}
          onClose={() => setCaseTierOpen(null)}
        />
      )}
    </div>
    </Layout>
  );
}
