import React, { useState, useRef } from "react";
import { WonPopup } from "../components/WonPopup";
import { Layout } from "../components/Layout";
import { useGetCases, openCase, useCreateCommunityCase, useDeleteCommunityCase } from "@workspace/api-client-react";
import type { Case, CaseItem } from "@workspace/api-client-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { useToast } from "../hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Package, Plus, Trash2, Users, Lock, Star, ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, TrendingUp, Layers, Bomb, Activity, Search, ArrowUpDown } from "lucide-react";
import { Link } from "wouter";
import caseBattleSrc from "@assets/casebattle_1775523643333.png";
import chestSrc from "@assets/treasure_chest_1775532728745.webp";
import legendaryOrbSrc from "@assets/legendary_orb_1775536735371.webp";
import bonusOrbIconSrc from "@assets/legendary_orb_1775538080736.webp";
import purpleOrbBaseSrc from "@assets/legendary_orb_1775539381857.webp";
import { GemIcon } from "../components/GemIcon";
import { useCurrency } from "../contexts/CurrencyContext";
import { ITEMS_CATALOG, rarityFromChance, type CatalogItem } from "../data/itemsCatalog";

const ITEM_WIDTH = 96;
const ITEM_COUNT = 60;
const WINNING_INDEX = 45;
const REEL_PL = 398;

// Reel background — matches the chat sidebar
const REEL_BG = "hsl(var(--sidebar))";

// Vertical reel config — same container as the single-case reel (168px),
// large items centered with spacing so neighbors peek at top/bottom
function getVConfig(_count: number) {
  const containerH = 168; // matches the single-case horizontal reel height
  const itemH      = 144; // large items — nearly full-height, same visual weight
  const gap        = 6;   // tight spacing between items
  const step       = itemH + gap;                         // 150px
  const paddingTop = Math.round((containerH - itemH) / 2); // 12px — centers item in container
  return { containerH, itemH, gap, step, paddingTop };
}

const CHEST_COLORS = [
  { label: "Original",  hex: "#7B4A1E" },
  { label: "Red",       hex: "#DC2626" },
  { label: "Orange",    hex: "#EA580C" },
  { label: "Amber",     hex: "#D97706" },
  { label: "Lime",      hex: "#65A30D" },
  { label: "Emerald",   hex: "#059669" },
  { label: "Teal",      hex: "#0D9488" },
  { label: "Sky",       hex: "#0284C7" },
  { label: "Blue",      hex: "#2563EB" },
  { label: "Violet",    hex: "#7C3AED" },
  { label: "Purple",    hex: "#9333EA" },
  { label: "Fuchsia",   hex: "#C026D3" },
  { label: "Pink",      hex: "#DB2777" },
  { label: "Rose",      hex: "#E11D48" },
  { label: "Slate",     hex: "#475569" },
  { label: "Yellow",   hex: "#EAB308" },
  { label: "Cyan",     hex: "#06B6D4" },
  { label: "Forest",   hex: "#15803D" },
  { label: "Indigo",   hex: "#4338CA" },
  { label: "Salmon",   hex: "#F97C6E" },
] as const;

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h / 6) * 360;
}
const CHEST_BASE_HUE = 30; // natural brown hue of the chest image

function CaseLogo({ imageUrl, size = 56 }: { imageUrl?: string; size?: number }) {
  if (imageUrl?.startsWith("chest:")) {
    const rest = imageUrl.slice(6);
    const pipeIdx = rest.indexOf("|");
    const color = pipeIdx === -1 ? rest : rest.slice(0, pipeIdx);
    const featuredUrl = pipeIdx === -1 ? null : rest.slice(pipeIdx + 1);
    const rotation = hexToHue(color) - CHEST_BASE_HUE;
    const itemSize = Math.round(size * 0.58);
    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <img
          src={chestSrc}
          alt="case logo"
          style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", filter: `hue-rotate(${rotation}deg) saturate(1.6)` }}
        />
        {featuredUrl && (
          <img
            src={featuredUrl}
            alt="featured item"
            style={{
              position: "absolute",
              bottom: "-14%",
              right: "-14%",
              width: itemSize,
              height: itemSize,
              objectFit: "contain",
              imageRendering: "pixelated",
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.95))",
            }}
          />
        )}
      </div>
    );
  }
  return <Package style={{ width: size, height: size }} className="text-primary" />;
}

const RARITY_COLORS: Record<string, string> = {
  common:   "border-gray-500   bg-gray-500/10   text-gray-300",
  uncommon: "border-blue-400   bg-blue-400/10   text-blue-300",
  rare:     "border-green-500 bg-green-500/10 text-green-300",
  epic:     "border-purple-500 bg-purple-500/10 text-purple-300",
  mythic:   "border-red-500    bg-red-500/10    text-red-300",
  legendary:"border-yellow-400 bg-yellow-400/10 text-yellow-300",
  divine:   "border-white      bg-white/10      text-white",
};

const RARITY_BORDER: Record<string, string> = {
  common:   "border-gray-500",
  uncommon: "border-blue-400",
  rare:     "border-green-500",
  epic:     "border-purple-500",
  mythic:   "border-red-500",
  legendary:"border-yellow-400",
  divine:   "border-white",
};

const RARITY_GLOW: Record<string, string> = {
  common:   "shadow-[0_0_12px_rgba(158,158,158,0.5)]",
  uncommon: "shadow-[0_0_14px_rgba(33,150,243,0.6)]",
  rare:     "shadow-[0_0_18px_rgba(34,197,94,0.7)]",
  epic:     "shadow-[0_0_18px_rgba(156,39,176,0.7)]",
  mythic:   "shadow-[0_0_24px_rgba(220,38,38,0.8)]",
  legendary:"shadow-[0_0_24px_rgba(255,215,0,0.85)]",
  divine:   "shadow-[0_0_30px_rgba(255,255,255,0.9)]",
};

const RARITY_HEX: Record<string, string> = {
  common:    "#9e9e9e",
  uncommon:  "#42a5f5",
  rare:      "#22c55e",
  epic:      "#ab47bc",
  mythic:    "#ef5350",
  legendary: "#fdd835",
  divine:    "#ffffff",
};

function getRarityLabel(rarity: string) {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function ItemThumbnail({ item, size = "md" }: { item: CaseItem | CatalogItem; size?: "sm" | "md" | "lg" }) {
  const px = size === "sm" ? 32 : size === "lg" ? 64 : 40;
  const dim = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-16 h-16" : "w-10 h-10";
  const color = (item as any).color ?? "#555";
  if (item.imageUrl?.startsWith("chest:")) {
    return <CaseLogo imageUrl={item.imageUrl} size={px} />;
  }
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.name}
        className={`${dim} object-contain flex-shrink-0`}
        style={{ imageRendering: "pixelated" }}
      />
    );
  }
  return (
    <div className={`${dim} rounded flex-shrink-0`} style={{ backgroundColor: color, opacity: 0.85 }} />
  );
}

const GOLD_ORB_THRESHOLD = 3;    // ≤3% → gold bonus
const PURPLE_ORB_THRESHOLD = 0.1; // ≤0.1% → purple ultra bonus

// Gold orb — shown in filler when a ≤3% item is won
const ORB_PLACEHOLDER_ITEM: CaseItem = {
  id: "__orb__",
  name: "???",
  imageUrl: bonusOrbIconSrc,
  rarity: "legendary",
  value: 0,
  chance: 0,
  color: "#fbbf24",
};

// Purple orb — shown in filler when a ≤0.1% item is won
const PURPLE_ORB_PLACEHOLDER_ITEM: CaseItem = {
  id: "__purple_orb__",
  name: "???",
  imageUrl: purpleOrbBaseSrc,
  rarity: "legendary",
  value: 0,
  chance: 0,
  color: "#a855f7",
};

// Chest placeholder — shown in filler when a nested case item is won
const NESTED_CASE_PLACEHOLDER_ITEM: CaseItem = {
  id: "__nested_case__",
  name: "Case!",
  imageUrl: chestSrc,
  rarity: "legendary",
  value: 0,
  chance: 0,
  color: "#ffa726",
};

const STAR_PARTICLES = [
  { top: "-18%", left: "5%",   delay: "0s",    duration: "2.6s", size: 10 },
  { top: "-20%", left: "72%",  delay: "0.7s",  duration: "3.0s", size: 8  },
  { top: "18%",  left: "-16%", delay: "0.3s",  duration: "2.8s", size: 9  },
  { top: "18%",  left: "105%", delay: "1.1s",  duration: "2.5s", size: 11 },
  { top: "68%",  left: "-14%", delay: "1.5s",  duration: "3.1s", size: 8  },
  { top: "65%",  left: "100%", delay: "0.5s",  duration: "2.7s", size: 10 },
] as const;

function ItemBox({ item, highlighted = false, showPrice = true }: { item: CaseItem; highlighted?: boolean; showPrice?: boolean }) {
  const { formatBalance } = useCurrency();
  const rarity = rarityFromChance(item.chance);
  const border = RARITY_BORDER[rarity] ?? "border-border";
  const hex = RARITY_HEX[rarity] ?? "#888";
  const glowStrength = highlighted ? "0 0 14px" : "0 0 6px";
  return (
    <div className={`w-[92px] flex-shrink-0 flex flex-col items-center justify-center p-2 bg-card/90 rounded-md border-b-4 ${border} transition-all`}>
      <div
        className="w-12 h-12 flex items-center justify-center mb-1.5"
        style={{ filter: `drop-shadow(${glowStrength} ${hex}${highlighted ? "ee" : "bb"})` }}
      >
        <ItemThumbnail item={item} size="md" />
      </div>
      <div className="text-[10px] text-center font-bold truncate w-full text-foreground leading-tight">{item.name}</div>
      {showPrice && (
        <div className="text-[10px] text-muted-foreground flex items-center gap-0.5">{formatBalance(item.value)} <GemIcon size={9} /></div>
      )}
    </div>
  );
}

function VerticalItemBox({ item }: { item: CaseItem }) {
  const { formatBalance } = useCurrency();
  const rarity = rarityFromChance(item.chance);
  const hex = RARITY_HEX[rarity] ?? "#888";
  return (
    <div
      className="flex items-center gap-2.5 px-2.5 bg-card/90 rounded-md flex-shrink-0"
      style={{ height: 80, border: `2px solid ${hex}44` }}
    >
      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ filter: `drop-shadow(0 0 5px ${hex}99)` }}>
        <ItemThumbnail item={item} size="md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold truncate text-foreground leading-tight">{item.name}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">{formatBalance(item.value)} <GemIcon size={8} /></div>
      </div>
    </div>
  );
}

/* Reel-only item box — no background, no text, just image + rarity bottom bar */
function ReelItemBox({ item, highlighted = false, rowHeight = 148 }: { item: CaseItem; highlighted?: boolean; rowHeight?: number }) {
  const rarity = rarityFromChance(item.chance);
  const hex = RARITY_HEX[rarity] ?? "#888";
  const imgSize = rowHeight >= 130 ? "md" : "sm";
  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-center relative"
      style={{ width: 96, height: rowHeight }}
    >
      <div className="flex-1 w-full flex items-center justify-center" style={{ filter: `drop-shadow(0 0 8px ${hex}99)` }}>
        <ItemThumbnail item={item} size={imgSize} />
      </div>
      <div style={{ height: 3, width: "100%", backgroundColor: hex, opacity: 0.85, flexShrink: 0 }} />
    </div>
  );
}

/* Total won overlay for multi-case opens */
function TotalWonOverlay({ total, fmt }: { total: number; fmt: (n: number) => string }) {
  const [phase, setPhase] = React.useState<"enter" | "visible" | "leave" | "hidden">("enter");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    setPhase("enter");
    timerRef.current = setTimeout(() => {
      setPhase("leave");
      leaveTimerRef.current = setTimeout(() => setPhase("hidden"), 250);
    }, 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, [total]);

  if (phase === "hidden") return null;

  const animation =
    phase === "enter"
      ? "wonPopupIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both"
      : phase === "leave"
      ? "wonPopupOut 0.2s cubic-bezier(0.55,0,1,0.45) both"
      : "none";

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 102 }}
    >
      <style>{`
        @keyframes wonPopupIn { from { opacity:0; transform:scale(0.3); } to { opacity:1; transform:scale(1); } }
        @keyframes wonPopupOut { from { opacity:1; transform:scale(1); } to { opacity:0; transform:scale(0.2); } }
      `}</style>
      <div
        className="flex flex-col items-center gap-3 rounded-2xl px-10 py-6"
        style={{
          background: "linear-gradient(145deg, rgba(0,0,0,0.92), rgba(0,0,0,0.78))",
          border: "2px solid rgba(168,85,247,0.4)",
          boxShadow: "0 0 28px rgba(168,85,247,0.3), 0 8px 32px rgba(0,0,0,0.7)",
          backdropFilter: "blur(10px)",
          minWidth: 220,
          animation,
        }}
      >
        <p className="text-[15px] font-bold uppercase tracking-widest text-green-400 leading-none">Total Won</p>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-white">{fmt(total)}</span>
          <GemIcon size={22} />
        </div>
      </div>
    </div>
  );
}

/* Vertical reel-only item — no text, just image */
function VerticalReelItemBox({ item, height = 108 }: { item: CaseItem; height?: number }) {
  const rarity = rarityFromChance(item.chance);
  const hex = RARITY_HEX[rarity] ?? "#888";
  return (
    <div className="flex-shrink-0" style={{ height, width: "100%", position: "relative" }}>
      {/* Top separator line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.10)", zIndex: 2 }} />
      {/* Grey card */}
      <div
        className="flex items-center justify-center"
        style={{
          height: "100%",
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          borderLeft: `3px solid ${hex}`,
          borderRight: `3px solid ${hex}`,
        }}
      >
        <div style={{ filter: `drop-shadow(0 0 8px ${hex}bb)` }}>
          <ItemThumbnail item={item} size="md" />
        </div>
      </div>
      {/* Bottom separator line */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.10)", zIndex: 2 }} />
    </div>
  );
}

type ModalMode = "info" | "opening" | "bonus_orb" | "bonus_spin" | "bonus_case" | "result";

interface DraftItem {
  catalogItem: CatalogItem;
  chance: number;
}

export default function Cases() {
  const { data: cases = [], isLoading, refetch: refetchCases } = useGetCases();
  const { user, refreshUser, updateUser, deltaBalance } = useAuth();
  const { formatBalance, label } = useCurrency();
  const { toast } = useToast();
  const fmt = (dl: number) => formatBalance(dl);
  const createMutation = useCreateCommunityCase();
  const deleteMutation = useDeleteCommunityCase();

  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("info");
  const [wonItems, setWonItems] = useState<CaseItem[]>([]);
  const [reelItemsPerReel, setReelItemsPerReel] = useState<CaseItem[][]>([]);
  const [bonusReelIndices, setBonusReelIndices] = useState<Set<number>>(new Set());
  const [purpleBonusReelIndices, setPurpleBonusReelIndices] = useState<Set<number>>(new Set());
  const [nestedCaseBonusReelIndices, setNestedCaseBonusReelIndices] = useState<Set<number>>(new Set());
  const [bonusCaseInfo, setBonusCaseInfo] = useState<{ name: string; imageUrl: string } | null>(null);
  const [isDemoSpin, setIsDemoSpin] = useState(false);
  const [staticReel, setStaticReel] = useState<CaseItem[]>([]);
  const [fastMode, setFastMode] = useState(false);
  const [openCount, setOpenCount] = useState(1);
  const [sortOrder, setSortOrder] = useState<"price_desc" | "price_asc" | "chance_desc" | "chance_asc">("price_desc");
  const [catalogSort, setCatalogSort] = useState<"price_desc" | "price_asc">("price_desc");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [createTab, setCreateTab] = useState<"catalog" | "settings">("catalog");
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Audio engine ─────────────────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickRafIds = useRef<Set<number>>(new Set());
  const lastTickTime = useRef<number>(0);

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

    // ── Master output gain (controls overall level) ───────────────────────
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    // ── Noise transient — gives the crisp attack "snap" ──────────────────
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

    // ── Fundamental tone — warm body of the click ─────────────────────────
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

    // ── Second harmonic — adds richness and presence ──────────────────────
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

  const playLightningStrike = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    const sr = ctx.sampleRate;

    // ── Sharp crack — short high-freq noise burst ─────────────────────────
    const crackLen = Math.floor(sr * 0.018);
    const crackBuf = ctx.createBuffer(1, crackLen, sr);
    const cd = crackBuf.getChannelData(0);
    for (let i = 0; i < crackLen; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 1.5);
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = crackBuf;
    const crackBp = ctx.createBiquadFilter();
    crackBp.type = "bandpass"; crackBp.frequency.value = 5000; crackBp.Q.value = 0.6;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.35, t);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    crackSrc.connect(crackBp); crackBp.connect(crackGain); crackGain.connect(ctx.destination);
    crackSrc.start(t);

    // ── Electric zap — sawtooth sweep downward ────────────────────────────
    const zap = ctx.createOscillator();
    zap.type = "sawtooth";
    zap.frequency.setValueAtTime(2800, t + 0.005);
    zap.frequency.exponentialRampToValueAtTime(80, t + 0.18);
    const zapLp = ctx.createBiquadFilter();
    zapLp.type = "lowpass";
    zapLp.frequency.setValueAtTime(6000, t);
    zapLp.frequency.exponentialRampToValueAtTime(300, t + 0.18);
    const zapGain = ctx.createGain();
    zapGain.gain.setValueAtTime(0, t);
    zapGain.gain.linearRampToValueAtTime(0.18, t + 0.007);
    zapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    zap.connect(zapLp); zapLp.connect(zapGain); zapGain.connect(ctx.destination);
    zap.start(t); zap.stop(t + 0.22);

    // ── Secondary crackle at 80ms ─────────────────────────────────────────
    const crackLen2 = Math.floor(sr * 0.012);
    const crackBuf2 = ctx.createBuffer(1, crackLen2, sr);
    const cd2 = crackBuf2.getChannelData(0);
    for (let i = 0; i < crackLen2; i++) cd2[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen2, 2);
    const crackSrc2 = ctx.createBufferSource();
    crackSrc2.buffer = crackBuf2;
    const crackBp2 = ctx.createBiquadFilter();
    crackBp2.type = "bandpass"; crackBp2.frequency.value = 3500; crackBp2.Q.value = 0.7;
    const crackGain2 = ctx.createGain();
    const t2 = t + 0.08;
    crackGain2.gain.setValueAtTime(0.2, t2);
    crackGain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.012);
    crackSrc2.connect(crackBp2); crackBp2.connect(crackGain2); crackGain2.connect(ctx.destination);
    crackSrc2.start(t2);

    // ── Low rumble tail — deep impact body ────────────────────────────────
    const rumble = ctx.createOscillator();
    rumble.type = "sine";
    rumble.frequency.setValueAtTime(55, t + 0.01);
    rumble.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, t);
    rumbleGain.gain.linearRampToValueAtTime(0.12, t + 0.015);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    rumble.connect(rumbleGain); rumbleGain.connect(ctx.destination);
    rumble.start(t); rumble.stop(t + 0.65);

    // ── Purple shimmer cascade ────────────────────────────────────────────
    [311, 415, 523, 622].forEach((freq, i) => {
      const sp = ctx.createOscillator();
      sp.type = "sine";
      sp.frequency.value = freq;
      const spGain = ctx.createGain();
      const onset = 0.05 + i * 0.04;
      spGain.gain.setValueAtTime(0, t + onset);
      spGain.gain.linearRampToValueAtTime(0.04, t + onset + 0.02);
      spGain.gain.exponentialRampToValueAtTime(0.0001, t + onset + 0.35);
      sp.connect(spGain); spGain.connect(ctx.destination);
      sp.start(t + onset); sp.stop(t + onset + 0.4);
    });
  };

  const playBonusSwoosh = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    const dur = 1.5;
    const sr = ctx.sampleRate;

    // ── Whoosh noise layer — filtered white noise sweeping up ──────────────
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

    // ── Rising sawtooth sweep — gives the "whoosh" tonal body ─────────────
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

    // ── Sparkle cascade — ascending golden shimmer notes ──────────────────
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

  const playStopClick = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    const sr = ctx.sampleRate;
    const master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(ctx.destination);
    // Sharp transient — crisp attack snap
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
    // Deep thud — fundamental tone dropping
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
    // Metallic shimmer — brief high harmonic ring
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

  const stopTickMonitors = () => {
    tickRafIds.current.forEach((id) => cancelAnimationFrame(id));
    tickRafIds.current.clear();
  };

  const startTickMonitor = (el: HTMLElement, isVertical = false) => {
    const ITEM_STEP = isVertical ? getVConfig(openCount).step : (ITEM_WIDTH + 8);
    let lastIdx = -1;
    const loop = () => {
      const mat = window.getComputedStyle(el).transform;
      if (mat && mat !== "none") {
        const vals = mat.match(/matrix.*\((.+)\)/)?.[1].split(",");
        const pos = isVertical
          ? (vals ? Math.abs(parseFloat(vals[5]) || 0) : 0)
          : (vals ? Math.abs(parseFloat(vals[4]) || 0) : 0);
        const idx = Math.floor(pos / ITEM_STEP);
        if (idx !== lastIdx && idx > 0) { lastIdx = idx; playTick(); }
      }
      tickRafIds.current.add(requestAnimationFrame(loop));
    };
    tickRafIds.current.add(requestAnimationFrame(loop));
  };
  // ─────────────────────────────────────────────────────────────────────────

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMyCases, setShowMyCases] = useState(false);
  const [communitySearch, setCommunitySearch] = useState("");
  const [showFavourites, setShowFavourites] = useState(false);
  const [caseName, setCaseName] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [chestColor, setChestColor] = useState<string | null>(null);
  const [featuredItemUrl, setFeaturedItemUrl] = useState<string | null>(null);

  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("bettopia_fav_cases");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const toggleFavourite = (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) { next.delete(caseId); } else { next.add(caseId); }
      try { localStorage.setItem("bettopia_fav_cases", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const [officialSortDir, setOfficialSortDir] = useState<"asc" | "desc">("asc");
  const [officialExpanded, setOfficialExpanded] = useState(false);
  const OFFICIAL_PREVIEW_COUNT = 5;

  const bettopiacases = (cases as any[])
    .filter((c) => !c.isCommunity)
    .slice()
    .sort((a, b) => officialSortDir === "asc" ? a.price - b.price : b.price - a.price);
  const communityCases = (cases as any[]).filter((c) => c.isCommunity);
  const myCases = communityCases.filter((c: any) => user && Number(c.createdById) === Number(user.id));
  const filteredCommunityCases = communitySearch.trim()
    ? communityCases.filter((c: any) => c.name.toLowerCase().includes(communitySearch.toLowerCase()))
    : communityCases;

  const handleDeleteCase = (c: any) => {
    deleteMutation.mutate({ id: String(c.id) }, {
      onSuccess: () => {
        toast({ title: "Case deleted", description: `"${c.name}" has been removed.` });
        refetchCases();
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "Unknown error";
        toast({ title: "Failed to delete", description: msg, variant: "destructive" });
      },
    });
  };

  const handleCaseClick = (c: Case) => {
    setSelectedCase(c);
    setModalMode("info");
    setWonItems([]);
    if (c.items?.length) {
      setStaticReel(Array.from({ length: 11 }, () => { const it = weightedRandom(c.items); return it.chance <= PURPLE_ORB_THRESHOLD ? PURPLE_ORB_PLACEHOLDER_ITEM : it.chance <= GOLD_ORB_THRESHOLD ? ORB_PLACEHOLDER_ITEM : it; }));
    }
  };

  const resetReels = () => {
    reelRefs.current.forEach((ref) => {
      if (ref) { ref.style.transition = "none"; ref.style.transform = "none"; }
    });
    reelRefs.current = [];
  };

  // Flush stale reel items & refs when the user switches count while not spinning
  React.useEffect(() => {
    if (!isSpinning) {
      setReelItemsPerReel([]);
      reelRefs.current.forEach((ref) => {
        if (ref) { ref.style.transition = "none"; ref.style.transform = "none"; }
      });
      reelRefs.current = [];
    }
  }, [openCount]);

  const startOpening = (c: Case) => {
    initAudio();
    if (!user) {
      toast({ title: "Login required", variant: "destructive" });
      return;
    }
    if ((user.balance ?? 0) < c.price * openCount) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    // If case items aren't loaded yet, fall back to info view
    if (!c.items || c.items.length === 0) {
      handleCaseClick(c);
      return;
    }

    // Navigate to the case detail page and immediately begin spinning
    resetReels();
    setSelectedCase(c);
    setWonItems([]);
    if (c.items?.length) {
      setStaticReel(Array.from({ length: 11 }, () => { const it = weightedRandom(c.items); return it.chance <= PURPLE_ORB_THRESHOLD ? PURPLE_ORB_PLACEHOLDER_ITEM : it.chance <= GOLD_ORB_THRESHOLD ? ORB_PLACEHOLDER_ITEM : it; }));
    }

    // Build filler from full pool — ≤0.1% → purple orb, ≤3% (incl. nested case) → gold orb, else real item
    const perReel: CaseItem[][] = Array.from({ length: openCount }, () => {
      const items: CaseItem[] = [];
      for (let i = 0; i < ITEM_COUNT; i++) {
        const item = weightedRandom(c.items);
        items.push(item.chance <= PURPLE_ORB_THRESHOLD ? PURPLE_ORB_PLACEHOLDER_ITEM : item.chance <= GOLD_ORB_THRESHOLD || (item as any).nestedCaseId ? ORB_PLACEHOLDER_ITEM : item);
      }
      return items;
    });
    setReelItemsPerReel(perReel);
    setModalMode("opening");

    const duration = fastMode ? 2000 : 4000;

    // Single batched API call — avoids rate limits from parallel requests
    openCase(c.id, { body: JSON.stringify({ count: openCount }) } as any)
      .then((result: any) => {
        deltaBalance(-(c.price * openCount));
        const wonItemsList: CaseItem[] = result.items as CaseItem[];
        runReelAnimation(c, perReel, wonItemsList, duration, false);
      })
      .catch((err: any) => {
        setModalMode("info");
        const msg = err?.data?.error || err?.message || "Unknown error";
        toast({ title: "Error opening case", description: msg, variant: "destructive" });
      });
  };

  // Shared reel animation runner used by both real opens and demo spins
  const runReelAnimation = (c: Case, perReel: CaseItem[][], wonItemsList: CaseItem[], duration: number, isDemo: boolean) => {
    const isVertical = perReel.length > 1; // horizontal for 1 case, vertical columns for 2-4

    // Inject item at WINNING_INDEX — nested case shows chest, purple orb for ≤0.1%, gold orb for ≤3%, real item otherwise
    const updated = perReel.map((items, idx) => {
      const newItems = [...items];
      const won = wonItemsList[idx];
      newItems[WINNING_INDEX] = won.chance <= PURPLE_ORB_THRESHOLD
        ? PURPLE_ORB_PLACEHOLDER_ITEM
        : won.chance <= GOLD_ORB_THRESHOLD || (won as any).nestedCaseId
          ? ORB_PLACEHOLDER_ITEM
          : won;
      return newItems;
    });
    setReelItemsPerReel(updated);

    setTimeout(() => {
      updated.forEach((_, idx) => {
        const ref = reelRefs.current[idx];
        if (ref) {
          const randomOffset = isVertical ? (Math.floor(Math.random() * 60) - 30) : (Math.floor(Math.random() * 40) - 20);
          if (isVertical) {
            const targetScroll = WINNING_INDEX * getVConfig(openCount).step + randomOffset;
            ref.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.82, 0.15, 1)`;
            ref.style.transform = `translateY(-${targetScroll}px)`;
            startTickMonitor(ref, true);
          } else {
            const targetScroll = WINNING_INDEX * ITEM_WIDTH + randomOffset;
            ref.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.82, 0.15, 1)`;
            ref.style.transform = `translateX(-${targetScroll}px)`;
            startTickMonitor(ref, false);
          }
        }
      });
    }, 50);

    // Snap winning item to exact center after spin animation completes
    setTimeout(() => {
      reelRefs.current.forEach((ref) => {
        if (ref) {
          if (isVertical) {
            const snapScroll = WINNING_INDEX * getVConfig(openCount).step;
            ref.style.transition = "transform 300ms cubic-bezier(0.25, 0, 0, 1)";
            ref.style.transform = `translateY(-${snapScroll}px)`;
          } else {
            ref.style.transition = "transform 300ms cubic-bezier(0.25, 0, 0, 1)";
            ref.style.transform = `translateX(-${WINNING_INDEX * ITEM_WIDTH}px)`;
          }
        }
      });
    }, duration + 60);

    setTimeout(() => {
      stopTickMonitors();

      // ── Classify which reels triggered an orb bonus ──
      const purpleIndices = new Set<number>(
        wonItemsList.reduce<number[]>((acc, item, idx) => { if (item.chance <= PURPLE_ORB_THRESHOLD) acc.push(idx); return acc; }, [])
      );
      const goldIndices = new Set<number>(
        wonItemsList.reduce<number[]>((acc, item, idx) => { if (item.chance > PURPLE_ORB_THRESHOLD && item.chance <= GOLD_ORB_THRESHOLD) acc.push(idx); return acc; }, [])
      );
      const allBonusIndices = new Set([...purpleIndices, ...goldIndices]);
      // Bonus spin pools — rarePool includes nested case items so chest can land in bonus spin
      const ultraRarePool = c.items.filter((item) => item.chance <= PURPLE_ORB_THRESHOLD);
      const rarePool = c.items.filter((item) => item.chance > PURPLE_ORB_THRESHOLD && item.chance <= GOLD_ORB_THRESHOLD);

      if (allBonusIndices.size > 0 && (rarePool.length > 0 || ultraRarePool.length > 0)) {
        // ── BONUS ROUND — show orb, then spin Summer Case ≤3% items ──
        const frozenReel = updated.map((items, idx) => {
          if (allBonusIndices.has(idx)) return items;
          const newItems = [...items];
          newItems[WINNING_INDEX] = wonItemsList[idx];
          return newItems;
        });
        setReelItemsPerReel(frozenReel);
        setBonusReelIndices(goldIndices);
        setPurpleBonusReelIndices(purpleIndices);
        setNestedCaseBonusReelIndices(new Set());

        if (purpleIndices.size > 0) playLightningStrike();
        playBonusSwoosh();
        setModalMode("bonus_orb");

        setTimeout(() => {
          reelRefs.current.forEach((ref, idx) => {
            if (ref && allBonusIndices.has(idx)) {
              ref.style.transition = "none";
              ref.style.transform = "translateX(0)";
            }
          });

          const bonusDuration = fastMode ? 2000 : 4000;
          // Pick final winning items from the pool now, place at WINNING_INDEX
          const finalWonItems = [...wonItemsList];
          const bonusPerReel: CaseItem[][] = frozenReel.map((items, idx) => {
            if (!allBonusIndices.has(idx)) return items;
            const pool = purpleIndices.has(idx)
              ? (ultraRarePool.length ? ultraRarePool : c.items)
              : (rarePool.length ? rarePool : c.items);
            const uniformPick = () => pool[Math.floor(Math.random() * pool.length)];
            const bonusItems: CaseItem[] = Array.from({ length: ITEM_COUNT }, uniformPick);
            // For real spins, use the server-determined item so recent bets matches what the user sees.
            // For demo spins, randomly pick from the pool since there's no server result.
            const finalWon = isDemo ? weightedRandom(pool) : wonItemsList[idx];
            finalWonItems[idx] = finalWon;
            bonusItems[WINNING_INDEX] = finalWon;
            return bonusItems;
          });
          setReelItemsPerReel(bonusPerReel);
          setModalMode("bonus_spin");

          setTimeout(() => {
            bonusPerReel.forEach((_, idx) => {
              if (!allBonusIndices.has(idx)) return;
              const ref = reelRefs.current[idx];
              if (ref) {
                const randomOffset = isVertical ? (Math.floor(Math.random() * 60) - 30) : (Math.floor(Math.random() * 40) - 20);
                if (isVertical) {
                  const targetScroll = WINNING_INDEX * getVConfig(openCount).step + randomOffset;
                  ref.style.transition = `transform ${bonusDuration}ms cubic-bezier(0.08, 0.82, 0.15, 1)`;
                  ref.style.transform = `translateY(-${targetScroll}px)`;
                  startTickMonitor(ref, true);
                } else {
                  const targetScroll = WINNING_INDEX * ITEM_WIDTH + randomOffset;
                  ref.style.transition = `transform ${bonusDuration}ms cubic-bezier(0.08, 0.82, 0.15, 1)`;
                  ref.style.transform = `translateX(-${targetScroll}px)`;
                  startTickMonitor(ref, false);
                }
              }
            });
          }, 50);

          // Snap bonus reels to exact center after bonus spin completes
          setTimeout(() => {
            reelRefs.current.forEach((ref, idx) => {
              if (ref && allBonusIndices.has(idx)) {
                if (isVertical) {
                  const snapScroll = WINNING_INDEX * getVConfig(openCount).step;
                  ref.style.transition = "transform 300ms cubic-bezier(0.25, 0, 0, 1)";
                  ref.style.transform = `translateY(-${snapScroll}px)`;
                } else {
                  ref.style.transition = "transform 300ms cubic-bezier(0.25, 0, 0, 1)";
                  ref.style.transform = `translateX(-${WINNING_INDEX * ITEM_WIDTH}px)`;
                }
              }
            });
          }, bonusDuration + 60);

          setTimeout(() => {
            stopTickMonitors();
            // ── Check if the bonus spin landed on a nested case → trigger nested spin ──
            const nestedResultIndices = finalWonItems.reduce<number[]>((acc, item, idx) => {
              if (allBonusIndices.has(idx) && (item as any).nestedCaseId) acc.push(idx);
              return acc;
            }, []);

            if (nestedResultIndices.length > 0) {
              // Bonus spin won a nested case — show "Bonus Case!" screen then spin
              playBonusSwoosh();

              // Gather nested case display info from the first nested result
              const firstNestedCaseId = (finalWonItems[nestedResultIndices[0]] as any).nestedCaseId;
              const firstNestedCase = (cases as any[]).find((nc: any) => String(nc.id) === String(firstNestedCaseId));
              setBonusCaseInfo(firstNestedCase ? { name: firstNestedCase.name, imageUrl: firstNestedCase.imageUrl } : null);
              setBonusReelIndices(new Set());
              setPurpleBonusReelIndices(new Set());
              setNestedCaseBonusReelIndices(new Set(nestedResultIndices));
              setModalMode("bonus_case");

              const nestedFinalWonItems = [...finalWonItems];
              const nestedPerReel = bonusPerReel.map((items, idx) => {
                if (!nestedResultIndices.includes(idx)) return items;
                const nestedCaseId = (finalWonItems[idx] as any).nestedCaseId;
                const nestedCase = (cases as any[]).find((nc: any) => String(nc.id) === String(nestedCaseId));
                const nestedPool = nestedCase?.items?.length ? nestedCase.items : c.items;
                const finalNestedWon = weightedRandom(nestedPool);
                nestedFinalWonItems[idx] = finalNestedWon;
                const uniformNestedPick = () => nestedPool[Math.floor(Math.random() * nestedPool.length)];
                const nestedItems: CaseItem[] = Array.from({ length: ITEM_COUNT }, uniformNestedPick);
                nestedItems[WINNING_INDEX] = finalNestedWon;
                return nestedItems;
              });

              setTimeout(() => {
                // Reset nested reels to start position
                reelRefs.current.forEach((ref, idx) => {
                  if (ref && nestedResultIndices.includes(idx)) {
                    ref.style.transition = "none";
                    ref.style.transform = isVertical ? "translateY(0)" : "translateX(0)";
                  }
                });
                setReelItemsPerReel(nestedPerReel);
                setModalMode("bonus_spin");
              }, 2000);

              const BONUS_CASE_DELAY = 2000;
              setTimeout(() => {
                nestedResultIndices.forEach(idx => {
                  const ref = reelRefs.current[idx];
                  if (ref) {
                    const randomOffset = isVertical ? (Math.floor(Math.random() * 60) - 30) : (Math.floor(Math.random() * 40) - 20);
                    if (isVertical) {
                      const targetScroll = WINNING_INDEX * getVConfig(openCount).step + randomOffset;
                      ref.style.transition = `transform ${bonusDuration}ms cubic-bezier(0.08, 0.82, 0.15, 1)`;
                      ref.style.transform = `translateY(-${targetScroll}px)`;
                      startTickMonitor(ref, true);
                    } else {
                      const targetScroll = WINNING_INDEX * ITEM_WIDTH + randomOffset;
                      ref.style.transition = `transform ${bonusDuration}ms cubic-bezier(0.08, 0.82, 0.15, 1)`;
                      ref.style.transform = `translateX(-${targetScroll}px)`;
                      startTickMonitor(ref, false);
                    }
                  }
                });
              }, BONUS_CASE_DELAY + 50);

              setTimeout(() => {
                nestedResultIndices.forEach(idx => {
                  const ref = reelRefs.current[idx];
                  if (ref) {
                    if (isVertical) {
                      ref.style.transition = "transform 300ms cubic-bezier(0.25, 0, 0, 1)";
                      ref.style.transform = `translateY(-${WINNING_INDEX * getVConfig(openCount).step}px)`;
                    } else {
                      ref.style.transition = "transform 300ms cubic-bezier(0.25, 0, 0, 1)";
                      ref.style.transform = `translateX(-${WINNING_INDEX * ITEM_WIDTH}px)`;
                    }
                  }
                });
              }, BONUS_CASE_DELAY + bonusDuration + 60);

              setTimeout(() => {
                stopTickMonitors();
                playStopClick();
                setIsDemoSpin(isDemo);
                setWonItems(nestedFinalWonItems);
                if (!isDemo) deltaBalance(nestedFinalWonItems.reduce((s, it) => s + (it.value ?? 0), 0));
                setModalMode("result");
                setBonusReelIndices(new Set());
                setPurpleBonusReelIndices(new Set());
                setNestedCaseBonusReelIndices(new Set());
                setBonusCaseInfo(null);
                if (!isDemo) refreshUser();
              }, BONUS_CASE_DELAY + bonusDuration + 400);

            } else {
              playStopClick();
              setIsDemoSpin(isDemo);
              setWonItems(finalWonItems);
              if (!isDemo) deltaBalance(finalWonItems.reduce((s, it) => s + (it.value ?? 0), 0));
              setModalMode("result");
              setBonusReelIndices(new Set());
              setPurpleBonusReelIndices(new Set());
              setNestedCaseBonusReelIndices(new Set());
              if (!isDemo) refreshUser();
            }
          }, bonusDuration + 400);
        }, 2200);
        // ─────────────────────────────────────────────────────────────────────
      } else {
        playStopClick();
        setIsDemoSpin(isDemo);
        setWonItems(wonItemsList);
        if (!isDemo) deltaBalance(wonItemsList.reduce((s, it) => s + (it.value ?? 0), 0));
        setModalMode("result");
        if (!isDemo) refreshUser();
      }
    }, duration + 400);
  };

  const startDemoSpin = (c: Case) => {
    initAudio();
    if (!c.items || c.items.length === 0) { handleCaseClick(c); return; }
    resetReels();
    setSelectedCase(c);
    setWonItems([]);
    if (c.items?.length) {
      setStaticReel(Array.from({ length: 11 }, () => { const it = weightedRandom(c.items); return it.chance <= PURPLE_ORB_THRESHOLD ? PURPLE_ORB_PLACEHOLDER_ITEM : it.chance <= GOLD_ORB_THRESHOLD ? ORB_PLACEHOLDER_ITEM : it; }));
    }
    const perReel: CaseItem[][] = Array.from({ length: openCount }, () => {
      const items: CaseItem[] = [];
      for (let i = 0; i < ITEM_COUNT; i++) {
        const item = weightedRandom(c.items);
        items.push(item.chance <= PURPLE_ORB_THRESHOLD ? PURPLE_ORB_PLACEHOLDER_ITEM : item.chance <= GOLD_ORB_THRESHOLD || (item as any).nestedCaseId ? ORB_PLACEHOLDER_ITEM : item);
      }
      return items;
    });
    setReelItemsPerReel(perReel);
    setModalMode("opening");
    const duration = fastMode ? 2000 : 4000;
    // Pick items locally using the case's weighted distribution — no API call
    const wonItemsList: CaseItem[] = Array.from({ length: openCount }, () => weightedRandom(c.items));
    runReelAnimation(c, perReel, wonItemsList, duration, true);
  };

  const handleOpen = () => {
    if (!selectedCase) return;
    startOpening(selectedCase);
  };

  const handleDemoSpin = () => {
    if (!selectedCase) return;
    startDemoSpin(selectedCase);
  };

  const isSpinning = modalMode === "opening" || modalMode === "bonus_orb" || modalMode === "bonus_spin" || modalMode === "bonus_case";

  const closeModal = () => {
    if (isSpinning) return;
    stopTickMonitors();
    setSelectedCase(null);
    setWonItems([]);
    setModalMode("info");
    setBonusReelIndices(new Set());
    setPurpleBonusReelIndices(new Set());
    setNestedCaseBonusReelIndices(new Set());
    setIsDemoSpin(false);
    resetReels();
  };

  const handleOpenAgain = () => {
    if (!selectedCase) return;
    stopTickMonitors();
    setWonItems([]);
    setModalMode("info");
    setIsDemoSpin(false);
    resetReels();
    if (selectedCase.items?.length) {
      setStaticReel(Array.from({ length: 11 }, () => { const it = weightedRandom(selectedCase.items); return it.chance <= PURPLE_ORB_THRESHOLD ? PURPLE_ORB_PLACEHOLDER_ITEM : it.chance <= GOLD_ORB_THRESHOLD ? ORB_PLACEHOLDER_ITEM : it; }));
    }
  };

  const totalChance = draftItems.reduce((s, i) => s + i.chance, 0);
  const expectedValue = draftItems.reduce((s, i) => s + i.catalogItem.value * (i.chance / 100), 0);
  const estimatedPrice = parseFloat((expectedValue / 0.94).toFixed(4));

  const addDraftItem = (cat: CatalogItem) => {
    setDraftItems((prev) => {
      const existing = prev.find((d) => d.catalogItem.id === cat.id);
      if (existing) {
        return prev.map((d) => d.catalogItem.id === cat.id ? { ...d, chance: Math.min(100, d.chance + 10) } : d);
      }
      return [...prev, { catalogItem: cat, chance: 10 }];
    });
  };

  const removeDraftItem = (id: string) => {
    const removing = draftItems.find((d) => d.catalogItem.id === id);
    if (removing && featuredItemUrl === removing.catalogItem.imageUrl) {
      setFeaturedItemUrl(null);
    }
    setDraftItems((prev) => prev.filter((d) => d.catalogItem.id !== id));
  };

  const updateChance = (id: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    setDraftItems((prev) => prev.map((d) => d.catalogItem.id === id ? { ...d, chance: Math.max(0, Math.min(100, num)) } : d));
  };

  const handleCreateCase = () => {
    if (!user) { toast({ title: "Login required", variant: "destructive" }); return; }
    if (!chestColor) { toast({ title: "Choose a chest colour", description: "A logo colour is required to create a case.", variant: "destructive" }); return; }
    if (caseName.trim().length < 2) { toast({ title: "Name must be at least 2 characters", variant: "destructive" }); return; }
    if (draftItems.length < 2) { toast({ title: "Add at least 2 items", variant: "destructive" }); return; }
    if (Math.abs(totalChance - 100) > 0.0001) { toast({ title: `Drop rates must sum to exactly 100% (currently ${totalChance.toFixed(4)}%)`, variant: "destructive" }); return; }

    const items = draftItems.map((d) => ({
      id: d.catalogItem.id,
      name: d.catalogItem.name,
      imageUrl: d.catalogItem.imageUrl,
      rarity: rarityFromChance(d.chance),
      value: d.catalogItem.value,
      chance: d.chance,
      color: d.catalogItem.color,
    }));

    const imageUrl = featuredItemUrl ? `chest:${chestColor}|${featuredItemUrl}` : `chest:${chestColor}`;
    createMutation.mutate({ name: caseName.trim(), items, imageUrl }, {
      onSuccess: () => {
        toast({ title: "Case created!", description: `"${caseName.trim()}" is now live in Community Cases.` });
        setShowCreateDialog(false);
        setCaseName("");
        setDraftItems([]);
        setChestColor(null);
        setFeaturedItemUrl(null);
        refetchCases();
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "Unknown error";
        toast({ title: "Failed to create case", description: msg, variant: "destructive" });
      },
    });
  };

  const openCreateDialog = () => {
    if (!user) { toast({ title: "Login to create a case", variant: "destructive" }); return; }
    setShowCreateDialog(true);
  };

  const CaseGrid = ({ caseList }: { caseList: any[] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
      {caseList.map((c) => {
        const isFav = favouriteIds.has(String(c.id));
        return (
          <Card
            key={c.id}
            className="bg-card/80 border-border hover:border-primary/60 transition-all cursor-pointer group flex flex-col relative"
            onClick={() => handleCaseClick(c)}
          >
            {/* Favourite star — top-left corner */}
            <button
              onClick={(e) => toggleFavourite(String(c.id), e)}
              className={`absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                isFav
                  ? "text-yellow-400 hover:text-yellow-300"
                  : "text-muted-foreground/30 hover:text-yellow-400 opacity-0 group-hover:opacity-100"
              }`}
              title={isFav ? "Remove from favourites" : "Add to favourites"}
            >
              <Star className={`w-4 h-4 ${isFav ? "fill-yellow-400" : ""}`} />
            </button>

            <CardHeader className="text-center pb-1 px-2 sm:px-6">
              <CardTitle className="text-sm sm:text-base leading-tight">{c.name}</CardTitle>
              {c.isCommunity && c.createdByName && (
                <p className="text-xs text-muted-foreground">by {c.createdByName}</p>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center p-2 sm:p-4">
              <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 group-hover:border-primary/50 transition-all drop-shadow-[0_0_20px_rgba(139,92,246,0.35)]">
                <CaseLogo imageUrl={(c as any).imageUrl} size={44} />
              </div>
            </CardContent>
            <CardFooter className="pt-1 sm:pt-2 px-2 sm:px-6 pb-3 sm:pb-6 flex justify-center">
              <Button
                className="w-full bg-primary/20 hover:bg-primary text-primary-foreground font-bold border border-primary/50 transition-all text-xs sm:text-sm h-8 sm:h-10"
                onClick={(e) => { e.stopPropagation(); startOpening(c); }}
              >
                Open {fmt(c.price)} <GemIcon size={10} />
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );

  const Dialogs = (
    <>
      {/* Create Case Dialog — full screen */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setCaseName(""); setDraftItems([]); setChestColor(null); setFeaturedItemUrl(null); } }}>
        <DialogContent className="inset-0 translate-x-0 translate-y-0 left-0 top-0 max-w-none w-screen h-screen rounded-none border-0 p-0 bg-background flex flex-col overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-border bg-card/60 flex-shrink-0">
            <DialogTitle className="text-xl sm:text-2xl font-bold">Create a Case</DialogTitle>
            {/* Mobile tab switcher */}
            <div className="flex md:hidden rounded-lg border border-border overflow-hidden text-sm font-semibold">
              <button
                onClick={() => setCreateTab("catalog")}
                className={`px-4 py-1.5 transition-colors ${createTab === "catalog" ? "bg-primary text-white" : "bg-background text-muted-foreground"}`}
              >
                Catalog
              </button>
              <button
                onClick={() => setCreateTab("settings")}
                className={`px-4 py-1.5 transition-colors ${createTab === "settings" ? "bg-primary text-white" : "bg-background text-muted-foreground"}`}
              >
                Settings
              </button>
            </div>
          </div>

          {/* Body: side-by-side on desktop, tabbed on mobile */}
          <div className="flex flex-1 overflow-hidden">

            {/* ── Left / Settings panel ── visible always on md+, or when tab=settings on mobile */}
            <div className={`${createTab === "settings" ? "flex" : "hidden"} md:flex w-full md:w-1/2 flex-shrink-0 md:border-r border-border flex-col overflow-y-auto`}>
              <div className="p-4 sm:p-8 space-y-6 flex-1">

                {/* Case Logo */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">Case Logo <span className="text-red-400">*</span></label>
                  <div className="flex items-start gap-5">
                    <div className={`rounded-xl border-2 p-3 flex items-center justify-center transition-all ${chestColor ? "border-primary bg-primary/10" : "border-dashed border-border bg-background/40"}`} style={{ width: 96, height: 96, flexShrink: 0 }}>
                      {chestColor ? (
                        <CaseLogo imageUrl={featuredItemUrl ? `chest:${chestColor}|${featuredItemUrl}` : `chest:${chestColor}`} size={68} />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-center">
                          <img src={chestSrc} alt="chest" style={{ width: 50, height: 50, objectFit: "contain", imageRendering: "pixelated", opacity: 0.35 }} />
                          <span className="text-[10px] text-muted-foreground leading-tight">Pick a colour</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-2">Choose a colour for the case (required):</p>
                      <div className="grid grid-cols-5 gap-2">
                        {CHEST_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            title={c.label}
                            onClick={() => setChestColor(c.hex)}
                            className={`rounded-lg border-2 transition-all flex flex-col items-center gap-1.5 py-2 px-1.5 text-[11px] font-medium ${chestColor === c.hex ? "border-white scale-105 shadow-lg" : "border-transparent hover:border-white/40"}`}
                          >
                            <CaseLogo imageUrl={`chest:${c.hex}`} size={44} />
                            <span className="text-muted-foreground">{c.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {!chestColor && (
                    <p className="text-xs text-red-400 font-medium">You must choose a chest colour to create a case.</p>
                  )}

                  {/* Featured item picker */}
                  <div className="space-y-2 pt-1">
                    <label className="text-sm font-medium text-muted-foreground">
                      Featured Item <span className="text-xs text-muted-foreground/60">— shown in front of the chest (optional)</span>
                    </label>
                    {draftItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 italic">Add items from the catalog, then pick one to feature here.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {draftItems.map((d) => {
                          const isSelected = featuredItemUrl === d.catalogItem.imageUrl;
                          return (
                            <button
                              key={d.catalogItem.id}
                              onClick={() => setFeaturedItemUrl(isSelected ? null : d.catalogItem.imageUrl)}
                              title={d.catalogItem.name}
                              className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${isSelected ? "border-primary bg-primary/20 scale-105 shadow-lg" : "border-border hover:border-primary/50 bg-background/60"}`}
                            >
                              <img src={d.catalogItem.imageUrl} alt={d.catalogItem.name} style={{ width: 36, height: 36, objectFit: "contain", imageRendering: "pixelated" }} />
                              <span className="text-[10px] text-muted-foreground max-w-[52px] truncate">{d.catalogItem.name.split(" ")[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Case Name */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">Case Name</label>
                  <input type="text" value={caseName} onChange={(e) => setCaseName(e.target.value)} placeholder="e.g. My Awesome Case" maxLength={40} className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>

                {/* Items in Case */}
                {draftItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-muted-foreground">Items in Case</label>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${Math.abs(totalChance - 100) <= 0.0001 ? "bg-green-500/15 border-green-500/40 text-green-400" : totalChance > 100 ? "bg-red-500/15 border-red-500/40 text-red-400" : "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"}`}>{totalChance.toFixed(4)}% / 100%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-border/40 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-200 ${Math.abs(totalChance - 100) <= 0.0001 ? "bg-green-500" : totalChance > 100 ? "bg-red-500" : "bg-yellow-500"}`} style={{ width: `${Math.min(100, totalChance)}%` }} />
                    </div>
                    <div className="space-y-2">
                      {draftItems.map((d) => (
                        <div key={d.catalogItem.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/60">
                          <img src={d.catalogItem.imageUrl} alt={d.catalogItem.name} className="w-9 h-9 object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate">{d.catalogItem.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-0.5">{fmt(d.catalogItem.value)} <GemIcon size={9} /></div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={0} max={100} step={0.1} value={d.chance} onChange={(e) => updateChance(d.catalogItem.id, e.target.value)} className="w-20 rounded border border-border bg-background px-2 py-1 text-sm text-center text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                          <button onClick={() => removeDraftItem(d.catalogItem.id)} className="text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Estimated price */}
                {draftItems.length >= 2 && (
                  <div className="rounded-lg border border-border bg-background/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated Case Price</span>
                    <span className="font-bold text-primary flex items-center gap-1">{fmt(estimatedPrice)} <GemIcon size={13} /></span>
                  </div>
                )}
              </div>

              {/* Sticky footer */}
              <div className="p-4 sm:p-8 pt-0 space-y-2 flex-shrink-0">
                <Button onClick={handleCreateCase} disabled={createMutation.isPending || !chestColor || !caseName.trim() || draftItems.length < 2 || Math.abs(totalChance - 100) > 0.0001} className="w-full bg-primary hover:bg-primary/90 font-bold py-5 text-base">
                  {createMutation.isPending ? "Creating..." : "Create Case"}
                </Button>
                {draftItems.length >= 2 && Math.abs(totalChance - 100) > 0.0001 && (
                  <p className={`text-center text-xs font-semibold ${totalChance > 100 ? "text-red-400" : "text-yellow-400"}`}>
                    {totalChance > 100 ? `Over by ${(totalChance - 100).toFixed(4)}% — reduce some drop rates` : `${(100 - totalChance).toFixed(4)}% remaining — must total exactly 100%`}
                  </p>
                )}
              </div>
            </div>

            {/* ── Right / Catalog panel ── visible always on md+, or when tab=catalog on mobile */}
            <div className={`${createTab === "catalog" ? "flex" : "hidden"} md:flex flex-1 flex-col overflow-hidden`}>
              <div className="flex flex-col gap-2 px-4 sm:px-8 py-4 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Item Catalog — click to add</span>
                  <button
                    onClick={() => setCatalogSort((s) => s === "price_desc" ? "price_asc" : "price_desc")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background hover:border-primary/60 hover:bg-primary/10 transition-all text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Price: {catalogSort === "price_desc" ? "High → Low" : "Low → High"}
                  </button>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-1.5">
                  {[...ITEMS_CATALOG].filter((cat) => cat.name.toLowerCase().includes(catalogSearch.toLowerCase())).sort((a, b) => catalogSort === "price_desc" ? b.value - a.value : a.value - b.value).map((cat) => {
                    const isSelected = draftItems.some((d) => d.catalogItem.id === cat.id);
                    return (
                    <button
                      key={cat.id}
                      onClick={() => isSelected ? removeDraftItem(cat.id) : addDraftItem(cat)}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all group ${isSelected ? "border-primary bg-primary/20 ring-1 ring-primary/40" : "border-border bg-card hover:border-primary/60 hover:bg-primary/10"}`}
                    >
                      <div className="w-full flex items-center justify-center" style={{ height: 36 }}>
                        <img src={cat.imageUrl} alt={cat.name} style={{ width: 32, height: 32, objectFit: "contain", imageRendering: "pixelated" }} />
                      </div>
                      <div className="w-full text-center space-y-0">
                        <div className="text-[9px] font-bold text-foreground truncate leading-tight">{cat.name}</div>
                        <div className="text-[9px] font-semibold text-muted-foreground flex items-center justify-center gap-0.5">{fmt(cat.value)} <GemIcon size={8} /></div>
                      </div>
                    </button>
                  );
                  })}
                </div>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Favourites Dialog */}
      <Dialog open={showFavourites} onOpenChange={setShowFavourites}>
        <DialogContent className="max-w-lg bg-card border-border overflow-y-auto max-h-[80vh]">
          <DialogTitle className="text-xl font-bold flex items-center gap-2"><Star className="w-5 h-5 fill-yellow-400 text-yellow-400" /> Favourite Cases</DialogTitle>
          <div className="pt-2 space-y-3">
            {favouriteIds.size === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Star className="w-10 h-10 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground">No favourites yet.</p>
                <p className="text-xs text-muted-foreground/60">Click the star on any case card to save it here.</p>
              </div>
            ) : (
              (cases as any[]).filter((c) => favouriteIds.has(String(c.id))).map((c: any) => (
                <div key={c.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/60 hover:border-yellow-400/40 transition-all cursor-pointer" onClick={() => { setShowFavourites(false); handleCaseClick(c); }}>
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 flex-shrink-0"><CaseLogo imageUrl={c.imageUrl} size={36} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">{fmt(c.price)} <GemIcon size={10} /> · {c.items?.length ?? 0} items {c.isCommunity && <span className="ml-1 text-green-400">Community</span>}</div>
                  </div>
                  <button onClick={(e) => toggleFavourite(String(c.id), e)} className="p-2 rounded-md text-yellow-400 hover:text-muted-foreground hover:bg-muted/20 transition-colors"><Star className="w-4 h-4 fill-yellow-400" /></button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* My Cases Dialog */}
      <Dialog open={showMyCases} onOpenChange={setShowMyCases}>
        <DialogContent className="max-w-lg bg-card border-border overflow-y-auto max-h-[80vh]">
          <DialogTitle className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> My Cases</DialogTitle>
          <div className="pt-2 space-y-3">
            {myCases.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">You haven't created any cases yet.</p>
            ) : (
              myCases.map((c: any) => (
                <div key={c.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/60 hover:border-primary/40 transition-all">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 flex-shrink-0"><CaseLogo imageUrl={c.imageUrl} size={36} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">{fmt(c.price)} <GemIcon size={10} /> · {(c.openCount ?? 0).toLocaleString()} {(c.openCount ?? 0) === 1 ? "time opened" : "times opened"}</div>
                  </div>
                  <button onClick={() => handleDeleteCase(c)} disabled={deleteMutation.isPending} className="p-2 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  if (selectedCase) {
    return (
      <Layout>
        {Dialogs}
        {/* ── Case Detail ── */}
        <div className="-mx-3 sm:-mx-6 -mt-3 sm:-mt-6 flex flex-col min-h-[calc(100vh-4rem)]">

          {/* ── Back → case info → reel/strip → controls → contents ── */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Back button */}
            <div className="px-3 sm:px-6 pt-3 sm:pt-5 pb-2">
              <button
                onClick={closeModal}
                disabled={isSpinning}
                className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-white transition-colors disabled:opacity-40"
              >
                <ArrowLeft className="w-4 h-4" /> BACK
              </button>
            </div>

            {/* Case icon + name + price */}
            <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-6 pb-3 sm:pb-5">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <CaseLogo imageUrl={(selectedCase as any)?.imageUrl} size={36} />
              </div>
              <div>
                <div className="font-bold text-xl leading-tight flex items-center gap-2">
                  {selectedCase.name}
                  <button
                    onClick={(e) => toggleFavourite(String(selectedCase.id), e)}
                    className={`transition-colors ${favouriteIds.has(String(selectedCase.id)) ? "text-yellow-400" : "text-muted-foreground/30 hover:text-yellow-400"}`}
                  >
                    <Star className={`w-4 h-4 ${favouriteIds.has(String(selectedCase.id)) ? "fill-yellow-400" : ""}`} />
                  </button>
                </div>
                <div className="text-base text-muted-foreground flex items-center gap-1.5 mt-1">
                  {fmt(selectedCase.price)} <GemIcon size={13} />
                </div>
              </div>
            </div>

            {/* Reel — always visible. Static 11-item preview in info/result mode, animated 60-item reel while opening */}
            <div className="border-y border-border/20" style={{ background: REEL_BG }}>
              {modalMode === "info" || (modalMode === "result" && reelItemsPerReel.length === 0) ? (
                openCount === 1 ? (
                /* Single horizontal reel preview */
                <div style={{ position: "relative", height: 168, overflow: "hidden" }}>
                  {/* Left arrow */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 44, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
                    <ChevronLeft style={{ color: "rgba(255,255,255,0.22)", width: 22, height: 22 }} />
                  </div>
                  {/* Right arrow */}
                  <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
                    <ChevronRight style={{ color: "rgba(255,255,255,0.22)", width: 22, height: 22 }} />
                  </div>
                  <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 120, background: `linear-gradient(to right, ${REEL_BG}, transparent)`, zIndex: 1, pointerEvents: "none" }} />
                    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 120, background: `linear-gradient(to left, ${REEL_BG}, transparent)`, zIndex: 1, pointerEvents: "none" }} />
                    <div className="flex gap-0 items-center">
                      {staticReel.map((item, i) => <ReelItemBox key={i} item={item} highlighted={i === 5} rowHeight={168} />)}
                    </div>
                  </div>
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 3, marginLeft: -1, backgroundColor: "#a78bfa", zIndex: 99, pointerEvents: "none" }} />
                </div>
                ) : (
                /* Multi-column vertical static preview — immediately reflects openCount */
                (() => {
                  const vc = getVConfig(openCount);
                  return (
                    <div style={{ display: "flex", gap: 28, justifyContent: "center", padding: "12px 20px" }}>
                      {Array.from({ length: openCount }).map((_, idx) => {
                        const colItems = staticReel.length >= 3
                          ? [
                              staticReel[idx % staticReel.length],
                              staticReel[(idx + openCount) % staticReel.length],
                              staticReel[(idx + openCount * 2) % staticReel.length],
                            ]
                          : staticReel.slice(0, 3);
                        return (
                          <div key={idx} style={{ flex: 1, minWidth: 0, maxWidth: 200 }}>
                            <div style={{ position: "relative", height: vc.containerH, overflow: "hidden", borderRadius: 8, background: REEL_BG }}>
                              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: `linear-gradient(to bottom, ${REEL_BG}, transparent)`, zIndex: 2, pointerEvents: "none" }} />
                              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(to top, ${REEL_BG}, transparent)`, zIndex: 2, pointerEvents: "none" }} />
                              <div style={{ position: "absolute", top: vc.paddingTop - 1, left: 0, right: 0, height: 2, backgroundColor: "#a78bfa", zIndex: 3, pointerEvents: "none", boxShadow: "0 0 8px #a78bfa88" }} />
                              <div style={{ position: "absolute", top: vc.paddingTop + vc.itemH - 1, left: 0, right: 0, height: 2, backgroundColor: "#a78bfa", zIndex: 3, pointerEvents: "none", boxShadow: "0 0 8px #a78bfa88" }} />
                              <div style={{ position: "absolute", top: vc.paddingTop + Math.round(vc.itemH / 2) - 1, left: 0, right: 0, height: 2, backgroundColor: "#a78bfa", zIndex: 99, pointerEvents: "none", boxShadow: "0 0 8px #a78bfa88" }} />
                              <div style={{ display: "flex", flexDirection: "column", gap: vc.gap, paddingTop: vc.paddingTop }}>
                                {colItems.map((item, i) => item && <VerticalReelItemBox key={i} item={item} height={vc.itemH} />)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
                )
              ) : (
                /* Animated reels */
                <>
                  {openCount > 1 ? (
                    /* VERTICAL columns — side by side, each spinning top-to-bottom */
                    (() => {
                      const vc = getVConfig(reelItemsPerReel.length || openCount);
                      return (
                        <div style={{ display: "flex", gap: 28, justifyContent: "center", padding: "12px 20px", position: "relative" }}>
                          {reelItemsPerReel.map((reelItems, idx) => {
                            const isBonus = bonusReelIndices.has(idx);
                            const isPurpleBonus = purpleBonusReelIndices.has(idx);
                            const isNestedCase = nestedCaseBonusReelIndices.has(idx);
                            const lineColor = isPurpleBonus && modalMode === "bonus_spin" ? "#a855f7" : (isBonus || isNestedCase) && modalMode === "bonus_spin" ? "#fbbf24" : "#a78bfa";
                            return (
                              <div key={idx} style={{ flex: 1, minWidth: 0, maxWidth: 200, position: "relative" }}>
                                {modalMode === "bonus_case" && bonusCaseInfo && isNestedCase ? (
                                  <motion.div
                                    key="bonus-case-display"
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: "spring", stiffness: 180, damping: 14 }}
                                    style={{ height: vc.containerH, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "radial-gradient(ellipse at center, rgba(251,191,36,0.18) 0%, transparent 70%)", borderRadius: 8 }}
                                  >
                                    <div style={{ width: 60, height: 60 }}>
                                      <CaseLogo imageUrl={bonusCaseInfo.imageUrl} size={60} />
                                    </div>
                                  </motion.div>
                                ) : (
                                  <div style={{ position: "relative", height: vc.containerH, overflow: "hidden", borderRadius: 8, background: REEL_BG }}>
                                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: `linear-gradient(to bottom, ${REEL_BG}, transparent)`, zIndex: 2, pointerEvents: "none" }} />
                                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(to top, ${REEL_BG}, transparent)`, zIndex: 2, pointerEvents: "none" }} />
                                    <div style={{ position: "absolute", top: vc.paddingTop - 1, left: 0, right: 0, height: 2, backgroundColor: lineColor, zIndex: 3, pointerEvents: "none", boxShadow: `0 0 8px ${lineColor}88` }} />
                                    <div style={{ position: "absolute", top: vc.paddingTop + vc.itemH - 1, left: 0, right: 0, height: 2, backgroundColor: lineColor, zIndex: 3, pointerEvents: "none", boxShadow: `0 0 8px ${lineColor}88` }} />
                                    <div style={{ position: "absolute", top: vc.paddingTop + Math.round(vc.itemH / 2) - 1, left: 0, right: 0, height: 2, backgroundColor: lineColor, zIndex: 99, pointerEvents: "none", boxShadow: `0 0 8px ${lineColor}88` }} />
                                    <div
                                      ref={(el) => { reelRefs.current[idx] = el; }}
                                      style={{ display: "flex", flexDirection: "column", gap: vc.gap, paddingTop: vc.paddingTop }}
                                    >
                                      {reelItems.map((item, i) => <VerticalReelItemBox key={i} item={item} height={vc.itemH} />)}
                                    </div>
                                    {/* Orb overlay — reel stays blurred behind, orb pops on top */}
                                    {modalMode === "bonus_orb" && (isBonus || isNestedCase || isPurpleBonus) && (
                                      <motion.div
                                        key={`orb-overlay-col-${idx}`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2 }}
                                        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(1px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, borderRadius: 8 }}
                                      >
                                        {isPurpleBonus ? (
                                          <motion.img
                                            key="purple-orb-col"
                                            src={purpleOrbBaseSrc}
                                            alt="Ultra Bonus Orb"
                                            initial={{ scale: 0.4, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
                                            style={{ width: 60, height: 60, objectFit: "contain", imageRendering: "pixelated", filter: "hue-rotate(240deg) saturate(1.8) drop-shadow(0 0 18px rgba(168,85,247,0.95))" }}
                                          />
                                        ) : (
                                          <motion.img
                                            key="gold-orb-col"
                                            src={legendaryOrbSrc}
                                            alt="Bonus Orb"
                                            initial={{ scale: 0.4, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
                                            style={{ width: 60, height: 60, objectFit: "contain", imageRendering: "pixelated", filter: "drop-shadow(0 0 18px rgba(251,191,36,0.9))" }}
                                          />
                                        )}
                                      </motion.div>
                                    )}
                                  </div>
                                )}
                                {modalMode === "bonus_spin" && isPurpleBonus && (
                                  <div className="text-center text-[10px] font-bold animate-pulse mt-1 uppercase" style={{ color: "#c084fc" }}>⚡ Ultra!</div>
                                )}
                                {modalMode === "bonus_spin" && isNestedCase && !isPurpleBonus && (
                                  <div className="text-center text-[10px] font-bold animate-pulse mt-1 uppercase" style={{ color: "#fbbf24" }}>🎁 Super Summer!</div>
                                )}
                              </div>
                            );
                          })}

                          {/* Total won — centered overlay across all columns */}
                          {modalMode === "result" && wonItems.length > 0 && !isDemoSpin && (
                            <TotalWonOverlay total={wonItems.reduce((s, i) => s + i.value, 0)} fmt={fmt} />
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    /* HORIZONTAL reel — single case with left/right arrows */
                    <>
                      {reelItemsPerReel.map((reelItems, idx) => {
                        const isBonus = bonusReelIndices.has(idx);
                        const isPurpleBonus = purpleBonusReelIndices.has(idx);
                        const isNestedCase = nestedCaseBonusReelIndices.has(idx);
                        const lineColor = isPurpleBonus && modalMode === "bonus_spin" ? "#a855f7" : (isBonus || isNestedCase) && modalMode === "bonus_spin" ? "#fbbf24" : "#a78bfa";
                        return (
                          <div key={idx} style={{ position: "relative" }}>
                          <div style={{ position: "relative", height: 168, overflow: "hidden" }}>
                            {modalMode === "bonus_case" && bonusCaseInfo ? (
                              <motion.div
                                key="bonus-case-display"
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: "spring", stiffness: 180, damping: 14 }}
                                style={{ height: 168, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "radial-gradient(ellipse at center, rgba(251,191,36,0.18) 0%, transparent 70%)" }}
                              >
                                <div style={{ width: 80, height: 80 }}>
                                  <CaseLogo imageUrl={bonusCaseInfo.imageUrl} size={80} />
                                </div>
                              </motion.div>
                            ) : (
                              <>
                                {/* Left/right arrows */}
                                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 44, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
                                  <ChevronLeft style={{ color: "rgba(255,255,255,0.22)", width: 22, height: 22 }} />
                                </div>
                                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
                                  <ChevronRight style={{ color: "rgba(255,255,255,0.22)", width: 22, height: 22 }} />
                                </div>
                                {/* Fade gradients */}
                                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 120, background: `linear-gradient(to right, ${REEL_BG}, transparent)`, zIndex: 1, pointerEvents: "none" }} />
                                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 120, background: `linear-gradient(to left, ${REEL_BG}, transparent)`, zIndex: 1, pointerEvents: "none" }} />
                                {/* Center line */}
                                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 3, marginLeft: -1, backgroundColor: lineColor, zIndex: 99, pointerEvents: "none" }} />
                                {/* Reel strip */}
                                <div
                                  ref={(el) => { reelRefs.current[idx] = el; }}
                                  style={{ display: "flex", gap: 0, height: "100%", paddingLeft: "calc(50% - 48px)" }}
                                >
                                  {reelItems.map((item, i) => <ReelItemBox key={i} item={item} rowHeight={168} />)}
                                </div>
                                {/* Orb overlay — blurs reel behind, pops orb on top */}
                                {modalMode === "bonus_orb" && (isBonus || isNestedCase || isPurpleBonus) && (
                                  <motion.div
                                    key={`orb-overlay-${idx}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(1px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}
                                  >
                                    {isPurpleBonus ? (
                                      <motion.img
                                        key="purple-orb"
                                        src={purpleOrbBaseSrc}
                                        alt="Ultra Bonus Orb"
                                        initial={{ scale: 0.4, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
                                        style={{ width: 80, height: 80, objectFit: "contain", imageRendering: "pixelated", filter: "hue-rotate(240deg) saturate(1.8) drop-shadow(0 0 22px rgba(168,85,247,0.95)) drop-shadow(0 0 44px rgba(168,85,247,0.5))" }}
                                      />
                                    ) : (
                                      <motion.img
                                        key="gold-orb"
                                        src={legendaryOrbSrc}
                                        alt="Bonus Orb"
                                        initial={{ scale: 0.4, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
                                        style={{ width: 80, height: 80, objectFit: "contain", imageRendering: "pixelated", filter: "drop-shadow(0 0 20px rgba(251,191,36,0.9)) drop-shadow(0 0 40px rgba(251,191,36,0.5))" }}
                                      />
                                    )}
                                  </motion.div>
                                )}
                              </>
                            )}
                          </div>
                          {wonItems[idx] && (
                            <WonPopup wonItem={wonItems[idx]} active={modalMode === "result"} />
                          )}
                          </div>
                        );
                      })}
                    </>
                  )}
                  {modalMode === "opening" && (
                    <div className="text-center text-xs text-muted-foreground animate-pulse py-2">
                      Opening{openCount > 1 ? ` ${openCount} cases` : ""}...
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Controls bar — count + fast mode + open button ── */}
            <div className="border-b border-border/20 px-4 py-3 bg-card/30">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {/* Count buttons 1-4 */}
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => !isSpinning && setOpenCount(n)}
                    className={`w-10 h-10 rounded-lg font-bold text-base transition-all border flex-shrink-0 ${openCount === n ? "bg-primary border-primary text-white shadow-[0_0_12px_rgba(167,139,250,0.4)]" : "border-white/15 text-muted-foreground hover:border-primary/50 hover:text-white"}`}
                  >
                    {n}
                  </button>
                ))}

                {/* Fast mode */}
                <div className="flex items-center gap-1.5 px-3 border-l border-border/40">
                  <Zap className={`w-4 h-4 flex-shrink-0 ${fastMode ? "text-yellow-400" : "text-muted-foreground"}`} />
                  <button
                    onClick={() => setFastMode(!fastMode)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${fastMode ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${fastMode ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </button>
                </div>

                {/* Open / status button */}
                {!user ? (
                  <div className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-bold">Login to Open</div>
                ) : (user.balance ?? 0) < selectedCase.price * openCount ? (
                  <div className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold">Insufficient balance</div>
                ) : (
                  <button
                    onClick={handleOpen}
                    disabled={isSpinning}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all disabled:opacity-60 shadow-[0_0_16px_rgba(167,139,250,0.3)] flex items-center gap-1.5 flex-shrink-0"
                  >
                    Open{openCount > 1 ? ` ${openCount}×` : ""} {fmt(selectedCase.price * openCount)} <GemIcon size={11} />{fastMode ? " ⚡" : ""}
                  </button>
                )}

                {/* Demo spin */}
                <button
                  onClick={handleDemoSpin}
                  disabled={isSpinning}
                  className="px-4 py-2.5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 font-semibold text-sm transition-all disabled:opacity-60 flex-shrink-0"
                >
                  Demo
                </button>
              </div>
            </div>

            {/* Case contents grid */}
            <div className="px-6 pt-5 pb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base">Case contents</h3>
                  <div className="relative">
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="appearance-none bg-card/60 border border-border rounded-lg px-3 py-1.5 pr-7 text-sm text-foreground focus:outline-none focus:border-primary/60 cursor-pointer">
                      <option value="price_desc">Highest Price</option>
                      <option value="price_asc">Lowest Price</option>
                      <option value="chance_asc">Rarest First</option>
                      <option value="chance_desc">Most Common</option>
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5">
                  {[...selectedCase.items]
                    .sort((a, b) =>
                      sortOrder === "price_desc" ? b.value - a.value :
                      sortOrder === "price_asc"  ? a.value - b.value :
                      sortOrder === "chance_asc" ? a.chance - b.chance :
                      b.chance - a.chance
                    )
                    .map((item) => {
                      const rarity = rarityFromChance(item.chance);
                      const hex = RARITY_HEX[rarity] ?? "#555";
                      const bottomGlow =
                        rarity === "legendary" ? `0 14px 22px -8px ${hex}cc` :
                        rarity === "mythic"    ? `0 12px 18px -8px ${hex}aa` :
                        rarity === "epic"      ? `0 10px 16px -8px ${hex}77` :
                                                 `0 4px 10px -6px ${hex}22`;
                      return (
                        <div
                          key={item.id}
                          className="relative flex flex-col items-center bg-card/60 rounded-xl pt-3 pb-0 px-1.5 overflow-visible hover:bg-card/90 transition-colors"
                          style={{ borderBottom: `3px solid ${hex}`, boxShadow: bottomGlow }}
                        >
                          {/* Rarity stars — mythic/legendary only */}
                          {(rarity === "mythic" || rarity === "legendary") && STAR_PARTICLES.map((p, si) => (
                            <span
                              key={si}
                              style={{
                                position: "absolute",
                                top: p.top,
                                left: p.left,
                                fontSize: p.size,
                                color: hex,
                                textShadow: `0 0 6px ${hex}, 0 0 14px ${hex}99`,
                                animation: `star-twinkle ${p.duration} ease-in-out ${p.delay} infinite`,
                                pointerEvents: "none",
                                zIndex: 10,
                                userSelect: "none",
                                lineHeight: 1,
                              }}
                            >✦</span>
                          ))}
                          <div className="w-14 h-14 flex items-center justify-center mb-2" style={{ filter: `drop-shadow(0 0 10px ${hex}30)` }}>
                            <ItemThumbnail item={item} size="lg" />
                          </div>
                          <div className="text-[22px] font-bold text-center leading-tight mb-1 w-full truncate px-0.5">{item.name}</div>
                          <div className="text-sm font-extrabold text-muted-foreground flex items-center gap-1 mb-0.5">{fmt(item.value)} <GemIcon size={11} /></div>
                          <div className="text-sm font-extrabold mb-2" style={{ color: hex }}>{item.chance}%</div>
                        </div>
                      );
                    })}
                </div>
              </div>

            {/* Game shortcut buttons — same cards as home page, below case contents */}
            <div className="px-6 pt-8 pb-10">
                <h2 className="text-xl font-bold text-white mb-4">Try something else?</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">

                  <Link href="/battles">
                    <div className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border hover:border-primary transition-all cursor-pointer bg-card">
                      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
                      <div className="absolute inset-0 flex items-center justify-center p-6">
                        <img src={caseBattleSrc} alt="Case Battles" className="w-full h-full object-contain opacity-60 group-hover:opacity-90 transition-opacity" style={{ mixBlendMode: "screen" }} />
                      </div>
                      <div className="absolute bottom-4 left-4 z-20">
                        <h3 className="text-xl font-bold group-hover:text-primary transition-colors">Case Battles</h3>
                      </div>
                    </div>
                  </Link>

                  <Link href="/mines">
                    <div className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border hover:border-primary transition-all cursor-pointer bg-card">
                      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
                      <div className="absolute inset-0 flex items-center justify-center z-0 p-6">
                        <div className="grid grid-cols-5 gap-1 w-full opacity-20 group-hover:opacity-40 transition-opacity">
                          {[...Array(25)].map((_, i) => (
                            <div key={i} className={`aspect-square rounded-sm ${[2, 8, 12, 18, 22].includes(i) ? "bg-primary" : "bg-current"}`} />
                          ))}
                        </div>
                      </div>
                      <div className="absolute bottom-4 left-4 z-20">
                        <h3 className="text-xl font-bold group-hover:text-primary transition-colors">Mines</h3>
                      </div>
                    </div>
                  </Link>

                  <Link href="/crash">
                    <div className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border hover:border-primary transition-all cursor-pointer bg-card">
                      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
                      <div className="absolute inset-0 flex items-end justify-start p-6 pb-10 z-0">
                        <svg viewBox="0 0 100 60" className="w-full opacity-20 group-hover:opacity-40 transition-opacity" fill="none">
                          <polyline points="0,55 20,45 40,30 55,35 65,10 80,5 100,2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          <text x="55" y="28" fill="currentColor" fontSize="14" fontWeight="bold" fontFamily="monospace">1000x</text>
                        </svg>
                      </div>
                      <div className="absolute bottom-4 left-4 z-20">
                        <h3 className="text-xl font-bold group-hover:text-primary transition-colors">Crash</h3>
                      </div>
                    </div>
                  </Link>

                  <Link href="/limbo">
                    <div className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border hover:border-primary transition-all cursor-pointer bg-card">
                      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
                      <div className="absolute inset-0 flex items-center justify-center z-0">
                        <div className="text-center opacity-20 group-hover:opacity-40 transition-opacity">
                          <div className="text-5xl font-black font-mono">700x</div>
                          <div className="text-sm font-bold mt-1">TARGET</div>
                        </div>
                      </div>
                      <div className="absolute bottom-4 left-4 z-20">
                        <h3 className="text-xl font-bold group-hover:text-primary transition-colors">Limbo</h3>
                      </div>
                    </div>
                  </Link>

                  <Link href="/tower">
                    <div className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border hover:border-primary transition-all cursor-pointer bg-card">
                      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
                      <div className="absolute inset-0 flex items-center justify-center p-6 z-0">
                        <div className="grid grid-cols-3 gap-1.5 w-3/4 opacity-20 group-hover:opacity-40 transition-opacity">
                          {[...Array(12)].map((_, i) => (
                            <div key={i} className={`aspect-square rounded-md ${[9, 10, 11].includes(i) ? "bg-primary" : "bg-current"}`} />
                          ))}
                        </div>
                      </div>
                      <div className="absolute bottom-4 left-4 z-20">
                        <h3 className="text-xl font-bold group-hover:text-primary transition-colors">Tower</h3>
                      </div>
                    </div>
                  </Link>

                </div>
              </div>
          </div>

        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {Dialogs}
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><Package className="text-primary w-7 h-7 sm:w-8 sm:h-8" /> Cases</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowFavourites(true)} className={`border-border hover:border-yellow-400/60 flex items-center gap-1.5 ${favouriteIds.size > 0 ? "text-yellow-400 border-yellow-400/40" : ""}`}>
              <Star className={`w-4 h-4 flex-shrink-0 ${favouriteIds.size > 0 ? "fill-yellow-400 text-yellow-400" : ""}`} />
              <span className="hidden sm:inline">Favourites</span>
              {favouriteIds.size > 0 && <span className="bg-yellow-400/20 text-yellow-400 text-xs font-bold px-1.5 py-0.5 rounded-full">{favouriteIds.size}</span>}
            </Button>
            {user && (
              <Button variant="outline" size="sm" onClick={() => setShowMyCases(true)} className="border-border hover:border-primary/60 flex items-center gap-1.5">
                <Package className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">My Cases</span>
                {myCases.length > 0 && <span className="bg-primary/20 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">{myCases.length}</span>}
              </Button>
            )}
            <Button size="sm" onClick={openCreateDialog} className="bg-primary hover:bg-primary/90 font-bold flex items-center gap-1.5">
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Create a Case</span>
            </Button>
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:block text-sm text-muted-foreground">Fast Mode</span>
              <button onClick={() => setFastMode(!fastMode)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${fastMode ? "bg-primary" : "bg-muted"}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${fastMode ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </button>
              <Zap className={`w-4 h-4 ${fastMode ? "text-yellow-400" : "text-muted-foreground"}`} />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading cases...</div>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">CaseTopia Cases</h2>
                <div className="h-px flex-1 bg-border" />
                <button
                  onClick={() => setOfficialSortDir(d => d === "asc" ? "desc" : "asc")}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-border bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                >
                  {officialSortDir === "asc" ? "Low → High" : "High → Low"}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={officialSortDir === "desc" ? "rotate-180 transition-transform" : "transition-transform"}>
                    <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <CaseGrid caseList={officialExpanded ? bettopiacases : bettopiacases.slice(0, OFFICIAL_PREVIEW_COUNT)} />
              {bettopiacases.length > OFFICIAL_PREVIEW_COUNT && (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => setOfficialExpanded(v => !v)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl border border-border bg-background/60 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
                  >
                    {officialExpanded ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 7.5L6 4L10 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Show less
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Show more
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-green-400" />
                <h2 className="text-xl font-bold text-foreground">Community Cases</h2>
                <div className="h-px flex-1 bg-border" />
                {communityCases.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={communitySearch}
                      onChange={(e) => setCommunitySearch(e.target.value)}
                      placeholder="Search cases…"
                      className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-green-500/60 w-44"
                    />
                  </div>
                )}
              </div>
              {communityCases.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
                  No community cases yet — <button className="underline text-primary" onClick={openCreateDialog}>be the first to create one!</button>
                </div>
              ) : filteredCommunityCases.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
                  No cases match "<span className="text-foreground">{communitySearch}</span>"
                </div>
              ) : (
                <CaseGrid caseList={filteredCommunityCases} />
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function weightedRandom(items: CaseItem[]): CaseItem {
  const total = items.reduce((s, i) => s + i.chance, 0);
  const rand = Math.random() * total;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.chance;
    if (rand < cumulative) return item;
  }
  return items[items.length - 1];
}
