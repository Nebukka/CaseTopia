import React, { useEffect, useState, useRef } from "react";
import heroCharSrc from "@assets/set_1775523134325.png";
import caseBattleSrc from "@assets/casebattle_1775523643333.png";
import treasureChestSrc from "@assets/treasure_chest_1775523748232.webp";
import blueGemLockSrc from "@assets/blue_gem_lock_1775524290398.webp";
import raceCharSrc from "@assets/set_(1)_1775524992049.png";
import raceChar2Src from "@assets/set_(2)_1775525312705.png";
import raceChar3Src from "@assets/set_(3)_1775525462665.png";
import { Layout } from "../components/Layout";
import { Link } from "wouter";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { GemIcon } from "../components/GemIcon";
import { Card, CardContent } from "../components/ui/card";
import { Trophy, Gift, Users, Coins, Box, Swords, TrendingUp, Target, Zap, Crosshair, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UserAvatar } from "../components/UserAvatar";
import { UserProfileModal } from "../components/UserProfileModal";
import { RakebackModal } from "../components/RakebackModal";
import { getTierColor } from "../lib/tierColor";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

const GAME_COLORS: Record<string, string> = {
  crash: "#ef4444",
  limbo: "#8b5cf6",
  mines: "#f59e0b",
  tower: "#10b981",
  cases: "#3b82f6",
};

const GAME_LABELS: Record<string, string> = {
  crash: "Crash",
  limbo: "Limbo",
  mines: "Mines",
  tower: "Tower",
  cases: "Cases",
};

interface RecentBet {
  id: string;
  userId: string;
  username: string;
  game: string;
  amount: number;
  profit: number;
  multiplier: number | null;
  detail: string | null;
  createdAt: string;
  avatar: string | null;
  level: number;
}

interface DailyRaceEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  level: number;
  wagered: number;
  prize: number;
}

interface DailyRaceData {
  leaders: DailyRaceEntry[];
  endsAt: string;
}

function formatCountdown(endsAt: string): string {
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}H ${String(m).padStart(2, "0")}M ${String(s).padStart(2, "0")}S`;
}

const RANK_COLORS: Record<number, string> = { 1: "#f59e0b", 2: "#94a3b8", 3: "#cd7f32" };
const RANK_BG: Record<number, string> = { 1: "rgba(245,158,11,0.08)", 2: "rgba(148,163,184,0.06)", 3: "rgba(205,127,50,0.06)" };
const RACE_PRIZES = [300, 200, 100, 75, 75, 50, 50, 50, 50, 50];

function CloudsWithLightning() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        setActiveIdx(Math.floor(Math.random() * 3));
        setTimeout(() => { setActiveIdx(null); schedule(); }, 420);
      }, 800 + Math.random() * 2000);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);

  const boltStyle = (idx: number) => ({
    opacity: activeIdx === idx ? 1 : 0,
    transition: activeIdx === idx ? "opacity 0ms" : "opacity 380ms ease-out",
  });

  const floatAnim = (dur: string, vals: string) => (
    <animateTransform attributeName="transform" type="translate"
      values={vals} dur={dur} repeatCount="indefinite"
      calcMode="spline"
      keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" />
  );

  return (
    <div className="absolute inset-x-0 top-0 h-36 pointer-events-none z-[5] overflow-hidden">
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.13), transparent 65%)",
        opacity: activeIdx !== null ? 1 : 0,
        transition: activeIdx !== null ? "opacity 0ms" : "opacity 500ms ease-out",
      }} />
      {/*
        Clouds use a metaball technique:
          1. Overlapping ellipses (large radii, centered just above y=0)
          2. Heavy Gaussian blur merges them into one fluffy blob
          3. Alpha-matrix threshold sharpens back to a soft edge
        Result: naturally rounded cumulus shapes with no sharp points.
        Clouds are positioned so their centres are at y≈0–(-30),
        meaning only the bottom ~half pokes into the banner; the rest
        is clipped by the SVG viewport (and the parent overflow-hidden).
      */}
      <svg width="100%" height="100%" viewBox="0 0 1000 144"
           preserveAspectRatio="xMidYMid slice" overflow="hidden">
        <defs>
          {/*
            Main cloud filter:
              1. Gaussian blur merges overlapping ellipses into one smooth blob
              2. feColorMatrix threshold sharpens to a rounded metaball edge
          */}
          <filter id="mb" x="-40%" y="-90%" width="180%" height="280%"
                  colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="14" result="b" />
            {/* threshold ≈ 0.41 → clean rounded metaball edges, no displacement */}
            <feColorMatrix in="b" type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
          </filter>
          {/* Softer filter for the bright highlight layer on each cloud */}
          <filter id="mb-hi" x="-50%" y="-110%" width="200%" height="300%"
                  colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feColorMatrix in="b" type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
          </filter>
          {/* Soft drop-shadow blur for the shadow ellipse under each cloud */}
          <filter id="c-shad" x="-60%" y="-60%" width="220%" height="300%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id="bolt-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/*
            Body gradient — stormy cumulus tones:
              bright silver-blue at the illuminated tops (y=-90, hidden above SVG)
              → mid blue-grey in the lit body
              → deep slate at the shadowed underside (y=60, visible base)
          */}
          <linearGradient id="cg" x1="0" y1="-90" x2="0" y2="60"
                          gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#deeef8" />
            <stop offset="30%"  stopColor="#8aaec6" />
            <stop offset="65%"  stopColor="#425e72" />
            <stop offset="100%" stopColor="#18282e" />
          </linearGradient>
          {/*
            Highlight gradient — bright rim light on the upper curve of each bump.
            Fades to transparent at y=0 (the banner top edge).
          */}
          <linearGradient id="cg-hi" x1="0" y1="-90" x2="0" y2="5"
                          gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#f0f8ff" />
            <stop offset="100%" stopColor="#c8e2f0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ── LEFT CLOUD — small ── */}
        <g>
          {/* faint drop shadow cast below the cloud base */}
          <ellipse cx="100" cy="40" rx="98" ry="10"
            fill="#0a1520" opacity="0.22" filter="url(#c-shad)" />
          {/* body */}
          <g filter="url(#mb)">
            <ellipse cx="32"  cy="10"  rx="30" ry="28" fill="url(#cg)" />
            <ellipse cx="80"  cy="-2"  rx="38" ry="36" fill="url(#cg)" />
            <ellipse cx="132" cy="8"   rx="34" ry="32" fill="url(#cg)" />
            <ellipse cx="178" cy="13"  rx="28" ry="26" fill="url(#cg)" />
            <ellipse cx="58"  cy="-26" rx="26" ry="24" fill="url(#cg)" />
            <ellipse cx="106" cy="-38" rx="30" ry="28" fill="url(#cg)" />
            <ellipse cx="155" cy="-18" rx="24" ry="22" fill="url(#cg)" />
          </g>
          {/* bright rim highlights on the upper bumps */}
          <g filter="url(#mb-hi)" opacity="0.44">
            <ellipse cx="80"  cy="-4"  rx="28" ry="26" fill="url(#cg-hi)" />
            <ellipse cx="58"  cy="-28" rx="20" ry="18" fill="url(#cg-hi)" />
            <ellipse cx="106" cy="-40" rx="24" ry="22" fill="url(#cg-hi)" />
            <ellipse cx="155" cy="-20" rx="19" ry="17" fill="url(#cg-hi)" />
          </g>
          {floatAnim("9s", "0,0; 0,-4; 0,-1; 0,-5; 0,-1; 0,0")}
        </g>

        {/* ── CENTER CLOUD — largest ── */}
        <g>
          <ellipse cx="455" cy="64" rx="148" ry="13"
            fill="#0a1520" opacity="0.22" filter="url(#c-shad)" />
          <g filter="url(#mb)">
            <ellipse cx="348" cy="8"   rx="52" ry="50" fill="url(#cg)" />
            <ellipse cx="418" cy="-8"  rx="64" ry="62" fill="url(#cg)" />
            <ellipse cx="494" cy="4"   rx="58" ry="56" fill="url(#cg)" />
            <ellipse cx="562" cy="12"  rx="50" ry="48" fill="url(#cg)" />
            <ellipse cx="384" cy="-46" rx="44" ry="42" fill="url(#cg)" />
            <ellipse cx="454" cy="-64" rx="52" ry="50" fill="url(#cg)" />
            <ellipse cx="524" cy="-38" rx="42" ry="40" fill="url(#cg)" />
          </g>
          <g filter="url(#mb-hi)" opacity="0.40">
            <ellipse cx="418" cy="-10" rx="52" ry="48" fill="url(#cg-hi)" />
            <ellipse cx="384" cy="-48" rx="36" ry="34" fill="url(#cg-hi)" />
            <ellipse cx="454" cy="-66" rx="44" ry="42" fill="url(#cg-hi)" />
            <ellipse cx="524" cy="-40" rx="34" ry="32" fill="url(#cg-hi)" />
          </g>
          {floatAnim("12s", "0,-2; 0,-8; 0,-3; 0,-9; 0,-2; 0,-2")}
        </g>

        {/* ── RIGHT CLOUD — medium ── */}
        <g>
          <ellipse cx="820" cy="52" rx="122" ry="11"
            fill="#0a1520" opacity="0.22" filter="url(#c-shad)" />
          <g filter="url(#mb)">
            <ellipse cx="730" cy="6"   rx="40" ry="38" fill="url(#cg)" />
            <ellipse cx="790" cy="-6"  rx="50" ry="48" fill="url(#cg)" />
            <ellipse cx="852" cy="2"   rx="46" ry="44" fill="url(#cg)" />
            <ellipse cx="910" cy="9"   rx="38" ry="36" fill="url(#cg)" />
            <ellipse cx="762" cy="-34" rx="33" ry="31" fill="url(#cg)" />
            <ellipse cx="820" cy="-48" rx="40" ry="38" fill="url(#cg)" />
            <ellipse cx="878" cy="-26" rx="30" ry="28" fill="url(#cg)" />
          </g>
          <g filter="url(#mb-hi)" opacity="0.40">
            <ellipse cx="790" cy="-8"  rx="40" ry="38" fill="url(#cg-hi)" />
            <ellipse cx="762" cy="-36" rx="26" ry="24" fill="url(#cg-hi)" />
            <ellipse cx="820" cy="-50" rx="33" ry="31" fill="url(#cg-hi)" />
            <ellipse cx="878" cy="-28" rx="25" ry="23" fill="url(#cg-hi)" />
          </g>
          {floatAnim("7s", "0,-1; 0,-6; 0,-2; 0,-5; 0,0; 0,-1")}
        </g>

        {/* Bolt 0 — left cloud, small base ~y=38 */}
        <g style={boltStyle(0)}>
          <path d="M 100,36 L 85,62 L 97,62 L 80,94"  stroke="#c084fc" strokeWidth="2.8" fill="none" filter="url(#bolt-glow)" />
          <path d="M 100,36 L 85,62 L 97,62 L 80,94"  stroke="#ede9fe" strokeWidth="1.1" fill="none" opacity="0.78" />
          <path d="M 85,62 L 72,80"                   stroke="#a855f7" strokeWidth="1.6" fill="none" opacity="0.52" filter="url(#bolt-glow)" />
        </g>

        {/* Bolt 1 — center cloud, large base ~y=58 */}
        <g style={boltStyle(1)}>
          <path d="M 450,56 L 432,88 L 446,88 L 424,124" stroke="#c084fc" strokeWidth="2.8" fill="none" filter="url(#bolt-glow)" />
          <path d="M 450,56 L 432,88 L 446,88 L 424,124" stroke="#ede9fe" strokeWidth="1.1" fill="none" opacity="0.78" />
          <path d="M 446,88 L 461,108"                   stroke="#a855f7" strokeWidth="1.6" fill="none" opacity="0.52" filter="url(#bolt-glow)" />
        </g>

        {/* Bolt 2 — right cloud, medium base ~y=48 */}
        <g style={boltStyle(2)}>
          <path d="M 818,46 L 802,74 L 814,74 L 796,108" stroke="#c084fc" strokeWidth="2.8" fill="none" filter="url(#bolt-glow)" />
          <path d="M 818,46 L 802,74 L 814,74 L 796,108" stroke="#ede9fe" strokeWidth="1.1" fill="none" opacity="0.78" />
          <path d="M 802,74 L 788,92"                    stroke="#a855f7" strokeWidth="1.6" fill="none" opacity="0.52" filter="url(#bolt-glow)" />
        </g>
      </svg>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { formatBalance } = useCurrency();
  const [recentBets, setRecentBets] = useState<RecentBet[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [raceData, setRaceData] = useState<DailyRaceData | null>(null);
  const [countdown, setCountdown] = useState("");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showRakeback, setShowRakeback] = useState(false);

  const fetchBets = async () => {
    try {
      const res = await fetch("/api/bets/recent");
      if (res.ok) {
        const data = await res.json();
        setRecentBets(data);
      }
    } catch {}
  };

  const fetchRace = async () => {
    try {
      const res = await fetch("/api/leaderboard/daily-race");
      if (res.ok) {
        const data: DailyRaceData = await res.json();
        setRaceData(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchBets();
    pollRef.current = setInterval(fetchBets, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    fetchRace();
    const raceInterval = setInterval(fetchRace, 30000);
    return () => clearInterval(raceInterval);
  }, []);

  useEffect(() => {
    if (!raceData) return;
    const tick = () => setCountdown(formatCountdown(raceData.endsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [raceData?.endsAt]);

  return (
    <>
    <Layout>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/20 to-purple-900/20 border border-primary/20 p-12 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

          <CloudsWithLightning />

          {/* Smoke blobs */}
          <div className="smoke-blob-1 absolute -left-16 top-1/4 w-80 h-56 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,1) 0%, rgba(109,40,217,0.65) 50%, transparent 75%)", filter: "blur(24px)" }} />
          <div className="smoke-blob-2 absolute right-1/4 -bottom-10 w-96 h-64 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(168,85,247,0.95) 0%, rgba(139,92,246,0.55) 55%, transparent 80%)", filter: "blur(28px)" }} />
          <div className="smoke-blob-3 absolute right-8 top-4 w-64 h-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(192,132,252,0.9) 0%, rgba(168,85,247,0.5) 55%, transparent 80%)", filter: "blur(24px)" }} />
          <div className="smoke-blob-4 absolute left-1/3 top-0 w-72 h-44 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(109,40,217,0.85) 0%, rgba(88,28,135,0.5) 55%, transparent 80%)", filter: "blur(32px)" }} />
          <div className="smoke-blob-5 absolute left-1/2 bottom-0 w-60 h-40 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(167,139,250,0.85) 0%, rgba(139,92,246,0.45) 60%, transparent 80%)", filter: "blur(22px)" }} />

          <div className="relative z-10 space-y-6 max-w-2xl">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white" style={{ textShadow: "0 4px 24px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.9)" }}>
              WELCOME TO{" "}
              <span style={{ fontFamily: "'Chango', cursive", fontSize: "1.15em", textShadow: "0 0 12px rgba(168,85,247,0.4), 0 0 28px rgba(168,85,247,0.18)" }}>
                <span className="text-primary">Case</span><span style={{ color: "#f472b6" }}>Topia</span>
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              The premium Growtopia gaming platform. Play original games, open cases, and win massive prizes.
            </p>
            <div className="flex gap-4 justify-center md:justify-start">
              {user ? (
                <div className="text-2xl md:text-3xl font-bold text-white">
                  Hi, <span className="text-primary">{user.username}</span>! 👋
                </div>
              ) : (
                <Link href="/register">
                  <Button size="lg" className="text-lg px-8 h-14 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(155,89,182,0.5)]">
                    Register Now
                  </Button>
                </Link>
              )}
            </div>
          </div>
          
          <div className="relative z-10 hidden md:block">
            <div className="w-56 h-56 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/15 rounded-full blur-3xl" />
              <motion.img
                src={heroCharSrc}
                alt="Hero Character"
                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(100,60,200,0.6)]"
                style={{ imageRendering: "pixelated" }}
                animate={{ y: [0, -18, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="text-primary" /> Check this out
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              className="bg-card/50 hover:bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
              onClick={() => {
                const el = document.getElementById("daily-race");
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 72;
                  window.scrollTo({ top, behavior: "smooth" });
                }
              }}
            >
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="p-4 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Daily Race</h3>
                  <p className="text-sm text-muted-foreground mt-1">Join our daily race, players with highest total wagers win</p>
                  {countdown && (
                    <p className="text-xs font-bold text-yellow-400 mt-2">Ends in {countdown}</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card
              className="bg-card/50 hover:bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
              onClick={() => setShowRakeback(true)}
            >
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="p-4 bg-blue-500/10 rounded-full text-blue-500 group-hover:scale-110 transition-transform">
                  <Coins className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Claim Rakeback</h3>
                  <p className="text-sm text-muted-foreground mt-1">Wager and get a part of your net losses back monthly</p>
                </div>
              </CardContent>
            </Card>

            <Link href="/daily" className="h-full">
              <Card className="bg-card/50 hover:bg-card border-border hover:border-primary/50 transition-all cursor-pointer group h-full">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4 h-full">
                  <div className="p-4 bg-green-500/10 rounded-full text-green-500 group-hover:scale-110 transition-transform">
                    <Gift className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Daily Bonus</h3>
                    <p className="text-sm text-muted-foreground mt-1">Earn free rewards daily! Come back every 24h</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="bg-card/50 hover:bg-card border-border hover:border-primary/50 transition-all cursor-pointer group">
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="p-4 bg-orange-500/10 rounded-full text-orange-500 group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Be an Affiliate</h3>
                  <p className="text-sm text-muted-foreground mt-1">Earn a part of your affiliate's wagers forever</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Games */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">
            Original Games
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

            {/* Case Battles */}
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

            {/* Cases */}
            <Link href="/cases">
              <div className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border hover:border-primary transition-all cursor-pointer bg-card">
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <img src={treasureChestSrc} alt="Cases" className="w-full h-full object-contain opacity-60 group-hover:opacity-90 transition-opacity" style={{ imageRendering: "pixelated" }} />
                </div>
                <div className="absolute bottom-4 left-4 z-20">
                  <h3 className="text-xl font-bold group-hover:text-primary transition-colors">Cases</h3>
                </div>
              </div>
            </Link>

            {/* Mines */}
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

            {/* Crash */}
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

            {/* Limbo */}
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

            {/* Tower */}
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

        {/* Daily Race */}
        <div id="daily-race" className="space-y-0 rounded-2xl border border-yellow-500/20">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-[#0d0820] via-[#120d2a] to-[#0d0820] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-yellow-500/10 overflow-hidden">
            <div className="flex flex-col gap-1 relative z-10">
              <span className="text-xs font-bold text-yellow-400/70 tracking-widest uppercase">
                ENDS IN {countdown || "…"}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white flex items-center gap-2 leading-none">
                <span className="text-yellow-400">10</span>
                <img src={blueGemLockSrc} alt="gem lock" className="w-9 h-9 object-contain" style={{ imageRendering: "pixelated" }} />
                <span className="tracking-tight">DAILY RACE</span>
              </h2>
              <p className="text-xs text-muted-foreground/60 mt-1">Top 10 players with the highest total wagers win prizes every 24 hours</p>
            </div>
            {/* Race character 2 — left of char 1 */}
            <div className="absolute top-0 h-full w-36 overflow-hidden pointer-events-none hidden sm:block" style={{ right: "calc(27% + 9rem)" }}>
              <img
                src={raceChar2Src}
                alt="race character 2"
                style={{
                  imageRendering: "pixelated",
                  position: "absolute",
                  width: 160,
                  bottom: "-30%",
                  right: 0,
                }}
              />
            </div>
            {/* Race character 3 — right of char 1 */}
            <div className="absolute top-0 h-full w-36 overflow-hidden pointer-events-none hidden sm:block" style={{ right: "calc(27% - 9rem)" }}>
              <img
                src={raceChar3Src}
                alt="race character 3"
                style={{
                  imageRendering: "pixelated",
                  position: "absolute",
                  width: 160,
                  bottom: "-42%",
                  right: 0,
                }}
              />
            </div>
            {/* Race character 1 */}
            <div className="absolute right-[27%] top-0 h-full w-36 overflow-hidden pointer-events-none hidden sm:block">
              <img
                src={raceCharSrc}
                alt="race character"
                style={{
                  imageRendering: "pixelated",
                  position: "absolute",
                  width: 160,
                  bottom: "-30%",
                  right: 0,
                }}
              />
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[60px_1fr_1fr_1fr] gap-0 text-[11px] uppercase tracking-wider font-bold text-muted-foreground/40 px-6 py-3 bg-background/60 border-b border-border/20">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Wagered</span>
            <span className="text-right">Prize</span>
          </div>

          {/* Rows — always 10 slots */}
          <div className="bg-card/20 divide-y divide-border/10">
            {!raceData && (
              <div className="flex items-center justify-center py-12 text-muted-foreground/30 text-sm">Loading race…</div>
            )}
            {raceData && Array.from({ length: 10 }, (_, i) => {
              const rank = i + 1;
              const entry = raceData.leaders.find(l => l.rank === rank) ?? null;
              const rankColor = RANK_COLORS[rank];
              const rowBg = RANK_BG[rank];
              const prize = RACE_PRIZES[i];
              return (
                <div
                  key={rank}
                  className="grid grid-cols-[56px_1fr_1fr_1fr] gap-0 items-center px-6 py-3 hover:bg-white/[0.02] transition-colors"
                  style={rowBg ? { background: rowBg } : undefined}
                >
                  <span className="font-extrabold text-sm" style={{ color: rankColor ?? "#9ca3af" }}>
                    #{rank}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    {entry ? (
                      <>
                        <button
                          onClick={() => setProfileUserId(entry.userId)}
                          className={`relative w-7 h-7 rounded-full overflow-visible flex-shrink-0 hover:opacity-80 transition-opacity${entry.level >= 150 ? " rainbow-avatar-glow" : entry.level >= 100 ? " avatar-tier-glow" : ""}`}
                          style={{ "--glow-color": getTierColor(entry.level) } as React.CSSProperties}
                        >
                          <div
                            className={`w-7 h-7 rounded-full overflow-hidden border-2${entry.level >= 150 ? " rainbow-avatar-border" : ""}`}
                            style={entry.level >= 150 ? { borderWidth: "2px" } : { borderColor: getTierColor(entry.level) }}
                          >
                            <UserAvatar avatar={entry.avatar} size={28} />
                          </div>
                          <span
                            className={`absolute -bottom-1 -right-1 text-[8px] font-black rounded-full px-0.5 leading-[12px] min-w-[13px] text-center${entry.level >= 150 ? " rainbow-level-badge" : ""}`}
                            style={entry.level >= 150 ? { color: "#fff" } : { background: getTierColor(entry.level), color: "#fff" }}
                          >
                            {entry.level}
                          </span>
                        </button>
                        <button
                          onClick={() => setProfileUserId(entry.userId)}
                          className="font-semibold truncate text-sm text-left hover:underline hover:text-primary transition-colors"
                        >
                          {entry.username}
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-7 h-7 rounded-full flex-shrink-0 border border-dashed border-border/30"
                          style={{ backgroundColor: "transparent" }}
                        />
                        <span className="text-sm text-muted-foreground/30 italic">—</span>
                      </>
                    )}
                  </div>
                  <div className="text-right text-sm font-semibold text-muted-foreground flex items-center justify-end gap-1">
                    {entry ? (
                      <>
                        {formatBalance(entry.wagered)}
                        <GemIcon size={16} />
                      </>
                    ) : (
                      <span className="text-muted-foreground/20">—</span>
                    )}
                  </div>
                  <div className="text-right font-bold text-sm flex items-center justify-end gap-1" style={{ color: entry ? (rankColor ?? "#9ca3af") : "#4b5563" }}>
                    +{formatBalance(prize)}
                    <GemIcon size={16} className={entry ? "" : "opacity-30"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Bets */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <History className="text-primary" /> Recent Bets
          </h2>

          <div className="rounded-xl border border-border/40 bg-card/30">
            <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr] gap-0 text-[11px] uppercase tracking-wider font-bold text-muted-foreground/50 border-b border-border/30 px-4 py-2 bg-background/40">
              <span>Player</span>
              <span>Game</span>
              <span className="hidden sm:block">Detail</span>
              <span className="text-right">Bet</span>
              <span className="text-right">Profit</span>
            </div>

            {recentBets.length === 0 && (
              <div className="flex items-center justify-center py-12 text-muted-foreground/30 text-sm">
                No bets yet — play a game to see them here!
              </div>
            )}

            <div className="divide-y divide-border/20">
              <AnimatePresence initial={false}>
                {recentBets.slice(0, 25).map((bet) => {
                  const color = GAME_COLORS[bet.game] ?? "#888";
                  const won = bet.profit >= 0;
                  return (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr] gap-0 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          className={`relative w-6 h-6 rounded-full overflow-visible flex-shrink-0 hover:opacity-80 transition-opacity${bet.level >= 150 ? " rainbow-avatar-glow" : bet.level >= 100 ? " avatar-tier-glow" : ""}`}
                          style={{ "--glow-color": getTierColor(bet.level) } as React.CSSProperties}
                          onClick={() => setProfileUserId(bet.userId)}
                        >
                          <div
                            className={`w-6 h-6 rounded-full overflow-hidden border-2${bet.level >= 150 ? " rainbow-avatar-border" : ""}`}
                            style={bet.level >= 150 ? { borderWidth: "2px" } : { borderColor: getTierColor(bet.level) }}
                          >
                            <UserAvatar avatar={bet.avatar} size={24} />
                          </div>
                          <span
                            className={`absolute -bottom-1 -right-1 text-[7px] font-black rounded-full px-0.5 leading-[11px] min-w-[12px] text-center${bet.level >= 150 ? " rainbow-level-badge" : ""}`}
                            style={bet.level >= 150 ? { color: "#fff" } : { background: getTierColor(bet.level), color: "#fff" }}
                          >
                            {bet.level}
                          </span>
                        </button>
                        <button
                          className="font-semibold truncate text-left hover:underline hover:text-primary transition-colors"
                          onClick={() => setProfileUserId(bet.userId)}
                        >
                          {bet.username}
                        </button>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ backgroundColor: color + "22", color }}>
                          {GAME_LABELS[bet.game] ?? bet.game}
                        </span>
                      </div>
                      <div className="hidden sm:block text-xs text-muted-foreground/60 truncate pr-4">{bet.detail ?? "—"}</div>
                      <div className="text-right text-xs font-semibold text-muted-foreground flex items-center justify-end gap-0.5">
                        {formatBalance(bet.amount)} <GemIcon size={14} />
                      </div>
                      <div className={`text-right text-sm font-bold flex items-center justify-end gap-0.5 ${won ? "text-green-400" : "text-red-400"}`}>
                        {won ? "+" : ""}{formatBalance(bet.profit)} <GemIcon size={14} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>
    </Layout>
    {profileUserId && (
      <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
    )}
    <RakebackModal open={showRakeback} onClose={() => setShowRakeback(false)} />
    </>
  );
}
