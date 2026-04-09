import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Package, Crown, Eye, Bot, Loader2, LogOut, Volume2, VolumeX } from "lucide-react";
import { GemIcon } from "./GemIcon";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BattleItem {
  id: string;
  name: string;
  color: string;
  value: number;
  rarity: string;
  imageUrl?: string;
}

interface BattlePlayer {
  userId: string;
  username: string;
  teamIndex: number;
  slotIndex: number;
  items: BattleItem[];
  totalValue: number;
  isBot?: boolean;
}

interface BattleRound {
  roundNumber: number;
  caseId: number;
  results: { userId: string | number; item: BattleItem }[];
}

interface CaseData {
  id: string;
  name: string;
  price: number;
  items: (BattleItem & { chance: number })[];
}

interface BattleResult {
  id: string;
  status: string;
  gameMode: string;
  battleType?: string;
  isShared?: boolean;
  maxPlayers: number;
  isDraw?: boolean;
  winnerId?: string;
  winnerTeamIndex?: number;
  players: BattlePlayer[];
  cases: CaseData[];
  rounds: BattleRound[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAM_COLORS = [
  { border: "border-blue-500",  bg: "bg-blue-500/10",  text: "text-blue-400",  glow: "shadow-[0_0_18px_rgba(59,130,246,0.5)]",  hex: "#3B82F6" },
  { border: "border-red-500",   bg: "bg-red-500/10",   text: "text-red-400",   glow: "shadow-[0_0_18px_rgba(239,68,68,0.5)]",   hex: "#EF4444" },
  { border: "border-green-500", bg: "bg-green-500/10", text: "text-green-400", glow: "shadow-[0_0_18px_rgba(34,197,94,0.5)]",   hex: "#22C55E" },
];

const RARITY_COLOR: Record<string, string> = {
  common:    "#9E9E9E",
  uncommon:  "#2196F3",
  rare:      "#4CAF50",
  epic:      "#9C27B0",
  legendary: "#FF9800",
  mythic:    "#FFD700",
  divine:    "#FFFFFF",
};

// Reel matches Cases.tsx exactly
const REEL_BG     = "hsl(var(--sidebar))";
const REEL_H      = 168;   // container height
const ITEM_H      = 144;   // same as getVConfig() in Cases.tsx
const ITEM_GAP    = 6;
const STEP        = ITEM_H + ITEM_GAP;              // 150px per item
const PADDING_TOP = Math.round((REEL_H - ITEM_H) / 2); // 12px
const ITEM_COUNT  = 60;
const WINNING_IDX = 45;
const LINE_COLOR  = "#a78bfa";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNumTeams(gameMode: string): number {
  return ({ "1v1": 2, "1v1v1": 3, "2v2": 2, "2v2v2": 3, "3v3": 2 } as any)[gameMode] ?? 2;
}

function buildStrip(caseItems: BattleItem[], result: BattleItem): BattleItem[] {
  const pool = caseItems.length > 0 ? caseItems : [result];
  const strip: BattleItem[] = [];
  for (let i = 0; i < ITEM_COUNT; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  strip[WINNING_IDX] = result;
  return strip;
}

// ─── Currency display ─────────────────────────────────────────────────────────

function ValDisplay({ value, size = 11 }: { value: number; size?: number }) {
  let n: number, unit: string;
  if (value >= 100)    { n = +(value / 100).toFixed(2); unit = "BGL"; }
  else if (value >= 1) { n = +value.toFixed(2);          unit = "DL";  }
  else                 { n = Math.round(value * 100);    unit = "WL";  }
  return (
    <span className="flex items-center gap-0.5 font-bold tabular-nums">
      {n.toLocaleString()}
      {unit === "BGL" ? <span className="text-yellow-400 font-black" style={{ fontSize: size }}>BGL</span>
       : unit === "WL"  ? <span className="text-blue-400 font-bold"    style={{ fontSize: size }}>WL</span>
       : <GemIcon size={size} />}
    </span>
  );
}

// ─── Audio — exact copy from Cases.tsx ───────────────────────────────────────

function createAudioCtx(): AudioContext | null {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}

function playTick(ctx: AudioContext, muted: boolean) {
  if (muted) return;
  const t = ctx.currentTime;
  const master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  const sr = ctx.sampleRate;
  const snapLen = Math.floor(sr * 0.008);
  const snapBuf = ctx.createBuffer(1, snapLen, sr);
  const sd = snapBuf.getChannelData(0);
  for (let i = 0; i < snapLen; i++) sd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / snapLen, 3);
  const snap = ctx.createBufferSource(); snap.buffer = snapBuf;
  const sf = ctx.createBiquadFilter(); sf.type = "bandpass"; sf.frequency.value = 3200; sf.Q.value = 0.8;
  const sg = ctx.createGain(); sg.gain.setValueAtTime(0.25, t); sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);
  snap.connect(sf); sf.connect(sg); sg.connect(master); snap.start(t);
  const fund = ctx.createOscillator(); fund.type = "sine";
  fund.frequency.setValueAtTime(260, t); fund.frequency.exponentialRampToValueAtTime(120, t + 0.045);
  const fg = ctx.createGain(); fg.gain.setValueAtTime(0, t); fg.gain.linearRampToValueAtTime(0.5, t + 0.002); fg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  fund.connect(fg); fg.connect(master); fund.start(t); fund.stop(t + 0.08);
  const harm = ctx.createOscillator(); harm.type = "sine";
  harm.frequency.setValueAtTime(520, t); harm.frequency.exponentialRampToValueAtTime(240, t + 0.03);
  const hg = ctx.createGain(); hg.gain.setValueAtTime(0, t); hg.gain.linearRampToValueAtTime(0.18, t + 0.002); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  harm.connect(hg); hg.connect(master); harm.start(t); harm.stop(t + 0.05);
}

function playStopClick(ctx: AudioContext, muted: boolean) {
  if (muted) return;
  const t = ctx.currentTime; const sr = ctx.sampleRate;
  const master = ctx.createGain(); master.gain.value = 0.75; master.connect(ctx.destination);
  const tLen = Math.floor(sr * 0.010); const tBuf = ctx.createBuffer(1, tLen, sr);
  const td = tBuf.getChannelData(0);
  for (let i = 0; i < tLen; i++) td[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / tLen, 2);
  const tr = ctx.createBufferSource(); tr.buffer = tBuf;
  const tf = ctx.createBiquadFilter(); tf.type = "bandpass"; tf.frequency.value = 3800; tf.Q.value = 0.8;
  const tg = ctx.createGain(); tg.gain.setValueAtTime(0.45, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.010);
  tr.connect(tf); tf.connect(tg); tg.connect(master); tr.start(t);
  const thud = ctx.createOscillator(); thud.type = "sine";
  thud.frequency.setValueAtTime(300, t); thud.frequency.exponentialRampToValueAtTime(75, t + 0.10);
  const thg = ctx.createGain(); thg.gain.setValueAtTime(0, t); thg.gain.linearRampToValueAtTime(0.9, t + 0.003); thg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  thud.connect(thg); thg.connect(master); thud.start(t); thud.stop(t + 0.18);
  const sh = ctx.createOscillator(); sh.type = "sine"; sh.frequency.value = 640;
  const shg = ctx.createGain(); shg.gain.setValueAtTime(0, t); shg.gain.linearRampToValueAtTime(0.14, t + 0.003); shg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  sh.connect(shg); shg.connect(master); sh.start(t); sh.stop(t + 0.11);
}

function playWinSound(ctx: AudioContext, muted: boolean) {
  if (muted) return;
  const t = ctx.currentTime; const sr = ctx.sampleRate;
  const cLen = Math.floor(sr * 0.018); const cBuf = ctx.createBuffer(1, cLen, sr);
  const cd = cBuf.getChannelData(0);
  for (let i = 0; i < cLen; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cLen, 1.5);
  const cs = ctx.createBufferSource(); cs.buffer = cBuf;
  const cbp = ctx.createBiquadFilter(); cbp.type = "bandpass"; cbp.frequency.value = 5000; cbp.Q.value = 0.6;
  const cg = ctx.createGain(); cg.gain.setValueAtTime(0.35, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
  cs.connect(cbp); cbp.connect(cg); cg.connect(ctx.destination); cs.start(t);
  [311, 415, 523, 622, 784].forEach((freq, i) => {
    const sp = ctx.createOscillator(); sp.type = "sine"; sp.frequency.value = freq;
    const sg = ctx.createGain(); const onset = 0.05 + i * 0.07;
    sg.gain.setValueAtTime(0, t + onset); sg.gain.linearRampToValueAtTime(0.06, t + onset + 0.02); sg.gain.exponentialRampToValueAtTime(0.0001, t + onset + 0.5);
    sp.connect(sg); sg.connect(ctx.destination); sp.start(t + onset); sp.stop(t + onset + 0.55);
  });
}

// ─── Vertical Reel Item — exact clone of VerticalReelItemBox from Cases.tsx ──

function VertReelItem({ item }: { item: BattleItem }) {
  const hex = RARITY_COLOR[item.rarity] ?? "#888";
  const imgSz = 60; // same visual weight as "md" size in Cases
  return (
    <div className="flex-shrink-0" style={{ height: ITEM_H, width: "100%", position: "relative" }}>
      {/* Top separator */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.10)", zIndex: 2 }} />
      {/* Card — left/right 3px rarity border, grey bg — EXACTLY as Cases.tsx */}
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
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name}
              style={{ width: imgSz, height: imgSz, objectFit: "contain", imageRendering: "pixelated" }} />
          ) : (
            <div style={{ width: imgSz * 0.6, height: imgSz * 0.6, backgroundColor: hex, borderRadius: 4 }} />
          )}
        </div>
      </div>
      {/* Bottom separator */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.10)", zIndex: 2 }} />
    </div>
  );
}

// ─── Vertical Reel — EXACTLY matches Cases.tsx vertical reel ─────────────────

interface VertReelProps {
  caseItems: BattleItem[];
  result: BattleItem;
  spin: boolean;
  audioCtx: AudioContext | null;
  mutedRef: React.MutableRefObject<boolean>;
}

function VertReel({ caseItems, result, spin, audioCtx, mutedRef }: VertReelProps) {
  const strip = useMemo(() => buildStrip(caseItems, result), []);
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastTickIdx = useRef(-1);

  // Start spin — translateY, same as Cases.tsx isVertical branch
  useEffect(() => {
    if (!spin || !stripRef.current) return;
    lastTickIdx.current = -1;
    const randomOffset = Math.floor(Math.random() * 60) - 30;
    const target = WINNING_IDX * STEP + randomOffset;
    stripRef.current.style.transition = `transform 2200ms cubic-bezier(0.08, 0.82, 0.15, 1)`;
    stripRef.current.style.transform = `translateY(-${target}px)`;

    // Tick monitor — reads vals[5] for translateY (matrix col f)
    const el = stripRef.current;
    const loop = () => {
      const mat = window.getComputedStyle(el).transform;
      if (mat && mat !== "none") {
        const vals = mat.match(/matrix.*\((.+)\)/)?.[1].split(",");
        const rawY = vals ? parseFloat(vals[5] ?? "0") : 0;
        const idx = Math.floor(Math.abs(rawY) / STEP);
        if (idx !== lastTickIdx.current && idx > 0 && audioCtx) {
          lastTickIdx.current = idx;
          playTick(audioCtx, mutedRef.current);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spin]);

  // Stop — snap to exact center, play click
  useEffect(() => {
    if (spin || !stripRef.current) return;
    cancelAnimationFrame(rafRef.current);
    if (stripRef.current.style.transform) {
      stripRef.current.style.transition = `transform 300ms cubic-bezier(0.25, 0, 0, 1)`;
      stripRef.current.style.transform = `translateY(-${WINNING_IDX * STEP}px)`;
    }
    if (audioCtx) playStopClick(audioCtx, mutedRef.current);
  }, [spin]);

  return (
    // Container — matches Cases.tsx vertical reel exactly
    <div style={{ position: "relative", height: REEL_H, overflow: "hidden", borderRadius: 8, background: REEL_BG, width: "100%" }}>
      {/* Top gradient — same 60px as Cases.tsx */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: `linear-gradient(to bottom, ${REEL_BG}, transparent)`, zIndex: 2, pointerEvents: "none" }} />
      {/* Bottom gradient */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(to top, ${REEL_BG}, transparent)`, zIndex: 2, pointerEvents: "none" }} />
      {/* Top selector line — at paddingTop - 1 = 11 */}
      <div style={{ position: "absolute", top: PADDING_TOP - 1, left: 0, right: 0, height: 2, backgroundColor: LINE_COLOR, zIndex: 3, pointerEvents: "none", boxShadow: `0 0 8px ${LINE_COLOR}88` }} />
      {/* Bottom selector line — at paddingTop + itemH - 1 = 155 */}
      <div style={{ position: "absolute", top: PADDING_TOP + ITEM_H - 1, left: 0, right: 0, height: 2, backgroundColor: LINE_COLOR, zIndex: 3, pointerEvents: "none", boxShadow: `0 0 8px ${LINE_COLOR}88` }} />
      {/* Middle selector line — at paddingTop + itemH/2 - 1 = 83 (zIndex 99, on top) */}
      <div style={{ position: "absolute", top: PADDING_TOP + Math.round(ITEM_H / 2) - 1, left: 0, right: 0, height: 2, backgroundColor: LINE_COLOR, zIndex: 99, pointerEvents: "none", boxShadow: `0 0 8px ${LINE_COLOR}88` }} />
      {/* Strip — flex column, paddingTop 12 centres item 0 in 168px container */}
      <div
        ref={stripRef}
        style={{ display: "flex", flexDirection: "column", gap: ITEM_GAP, paddingTop: PADDING_TOP, willChange: "transform" }}
      >
        {strip.map((item, i) => <VertReelItem key={i} item={item} />)}
      </div>
    </div>
  );
}

// ─── Player Column ────────────────────────────────────────────────────────────

interface PlayerColProps {
  player: BattlePlayer;
  caseItems: BattleItem[];
  currentRoundResult: BattleItem | null;
  revealedItems: { item: BattleItem; chance?: number }[];
  spinning: boolean;
  isWinner: boolean;
  isLoser: boolean;
  showWinner: boolean;
  round: number;
  audioCtx: AudioContext | null;
  mutedRef: React.MutableRefObject<boolean>;
}

function PlayerColumn({ player, caseItems, currentRoundResult, revealedItems, spinning, isWinner, isLoser, showWinner, round, audioCtx, mutedRef }: PlayerColProps) {
  const tc = TEAM_COLORS[player.teamIndex] ?? TEAM_COLORS[0];
  const rc = currentRoundResult ? (RARITY_COLOR[currentRoundResult.rarity] ?? "#888") : undefined;

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 border-r border-border/10 last:border-r-0 transition-all duration-500 ${
        showWinner && isLoser ? "opacity-30" : ""
      }`}
    >
      {/* Player name + total */}
      <div className={`flex items-center justify-between gap-1 px-2 py-1.5 border-b border-border/10 flex-shrink-0 ${showWinner && isWinner ? tc.bg : ""}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-5 h-5 rounded-full border-2 ${tc.border} ${tc.bg} flex items-center justify-center font-black text-[10px] flex-shrink-0 ${tc.text}`}>
            {player.username.charAt(0).toUpperCase()}
          </div>
          <span className={`text-[11px] font-bold truncate ${tc.text}`}>{player.username}</span>
          {showWinner && isWinner && <Crown className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
          {player.isBot && <Bot className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" />}
        </div>
        <span className="text-[10px] flex-shrink-0 text-muted-foreground"><ValDisplay value={player.totalValue} size={9} /></span>
      </div>

      {/* Reel — REEL_H (168px) tall, matches Cases.tsx vertical reel */}
      <div
        className={`flex-shrink-0 px-2 py-2 transition-all duration-500 ${showWinner && isWinner ? `ring-2 ring-inset ${tc.border} ${tc.glow}` : ""}`}
        style={{ background: REEL_BG }}
      >
        {currentRoundResult ? (
          <VertReel
            key={round}
            caseItems={caseItems}
            result={currentRoundResult}
            spin={spinning}
            audioCtx={audioCtx}
            mutedRef={mutedRef}
          />
        ) : (
          <div className="w-full flex items-center justify-center text-muted-foreground/20" style={{ height: REEL_H, borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
            <Package className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Item just pulled — shown below reel after landing */}
      {!spinning && currentRoundResult && (
        <div className="flex-shrink-0 flex flex-col items-center py-1 border-b border-border/10 bg-background/30">
          <div className="text-[10px] font-bold truncate px-2 text-center leading-tight" style={{ color: rc }}>{currentRoundResult.name}</div>
          <div className="text-[10px] text-muted-foreground/70"><ValDisplay value={currentRoundResult.value} size={9} /></div>
        </div>
      )}

      {/* Item history */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {revealedItems.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/20 text-center py-3">—</div>
        ) : (
          [...revealedItems].reverse().map(({ item, chance }, i) => {
            const c = RARITY_COLOR[item.rarity] ?? "#888";
            return (
              <motion.div
                key={revealedItems.length - 1 - i}
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 border-b border-border/10 px-2 py-1 hover:bg-white/[0.03]"
              >
                <div
                  className="w-7 h-7 flex-shrink-0 rounded-md flex items-center justify-center"
                  style={{ background: `${c}22`, borderLeft: `3px solid ${c}`, borderRight: `3px solid ${c}` }}
                >
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.name} style={{ width: 18, height: 18, objectFit: "contain", imageRendering: "pixelated" }} />
                    : <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: c }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-semibold truncate leading-tight" style={{ color: c }}>{item.name}</div>
                  <div className="text-[9px] text-muted-foreground/70"><ValDisplay value={item.value} size={8} /></div>
                </div>
                {chance != null && <div className="text-[8px] text-muted-foreground/40 flex-shrink-0">{chance.toFixed(2)}%</div>}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Lobby Slot ───────────────────────────────────────────────────────────────

function LobbySlot({ player, teamIndex, isCreator, addingBot, onAddBot }: {
  player?: BattlePlayer; teamIndex: number;
  isCreator: boolean; addingBot: boolean; onAddBot: () => void;
}) {
  const tc = TEAM_COLORS[teamIndex] ?? TEAM_COLORS[0];
  return (
    <div className={`flex flex-col items-center gap-3 flex-1 min-w-0 rounded-xl border-2 p-4 transition-all ${
      !player ? "border-dashed border-border/30 bg-background/20" : `${tc.border} ${tc.bg}`
    }`}>
      {!player ? (
        <>
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-border/30 flex items-center justify-center text-muted-foreground/30 text-2xl font-bold">?</div>
          <div className="text-sm text-muted-foreground/50">Waiting...</div>
          {isCreator && (
            <Button size="sm" variant="outline" onClick={onAddBot} disabled={addingBot}
              className="border-dashed border-border/50 text-muted-foreground gap-1.5 text-xs">
              {addingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              Add Bot
            </Button>
          )}
        </>
      ) : (
        <>
          <div className={`w-14 h-14 rounded-full border-2 ${tc.border} ${tc.bg} flex items-center justify-center font-black text-2xl ${tc.text}`}>
            {player.username.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm font-semibold truncate max-w-full text-center">{player.username}</div>
          {player.isBot
            ? <Badge variant="outline" className={`text-[10px] ${tc.text} border-current gap-1`}><Bot className="w-2.5 h-2.5" />Bot</Badge>
            : <div className="flex items-center gap-1 text-xs text-green-400"><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Ready</div>}
        </>
      )}
    </div>
  );
}

// ─── BattleScreen ─────────────────────────────────────────────────────────────

interface Props {
  battle: BattleResult;
  currentUserId?: number;
  isCreator?: boolean;
  onAddBot?: (id: string) => Promise<BattleResult | void>;
  onLeave?: (id: string) => Promise<void>;
  onCopyBattle?: (battle: BattleResult) => void;
  onModifyBattle?: (battle: BattleResult) => void;
  onClose: () => void;
}

export function BattleScreen({ battle: initialBattle, currentUserId, isCreator = false, onAddBot, onLeave, onCopyBattle, onModifyBattle, onClose }: Props) {
  const [liveBattle, setLiveBattle] = useState<BattleResult>(initialBattle);
  const [animBattle, setAnimBattle] = useState<BattleResult | null>(
    initialBattle.status === "completed" ? initialBattle : null
  );
  const [phase, setPhase] = useState<"waiting" | "countdown" | "playing" | "tiebreaker" | "done">(
    initialBattle.status === "completed" ? "countdown" : "waiting"
  );
  const [countdown, setCountdown] = useState(3);
  const [currentRound, setCurrentRound] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [tiebreakerSpinning, setTiebreakerSpinning] = useState(false);
  const [revealedRounds, setRevealedRounds] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [addingBot, setAddingBot] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [muted, setMuted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx();
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }, []);

  const tick = useCallback((fn: () => void, ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, ms);
  }, []);

  // Poll while waiting
  useEffect(() => {
    if (phase !== "waiting") return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/battles/${liveBattle.id}`);
        if (res.ok) {
          const data: BattleResult = await res.json();
          setLiveBattle(data);
          if (data.status === "completed") {
            setAnimBattle(data); setPhase("countdown");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch { /* ignore */ }
    }, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, liveBattle.id]);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setPhase("playing"); return; }
    tick(() => setCountdown((c) => c - 1), 900);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, countdown]);

  // Play rounds
  useEffect(() => {
    if (phase !== "playing" || !animBattle) return;
    const totalRounds = animBattle.rounds?.length ?? 0;
    if (currentRound >= totalRounds) {
      if (animBattle.isDraw) {
        tick(() => setPhase("tiebreaker"), 800);
      } else {
        tick(() => {
          setShowWinner(true); setPhase("done");
          if (audioCtxRef.current) playWinSound(audioCtxRef.current, mutedRef.current);
        }, 1000);
      }
      return;
    }
    setSpinning(true);
    tick(() => {
      setSpinning(false);
      tick(() => {
        setRevealedRounds((r) => r + 1);
        tick(() => setCurrentRound((r) => r + 1), 700);
      }, 350);
    }, 2400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, currentRound, animBattle]);

  // Tiebreaker
  useEffect(() => {
    if (phase !== "tiebreaker" || !animBattle) return;
    tick(() => {
      setTiebreakerSpinning(true);
      tick(() => {
        setTiebreakerSpinning(false);
        tick(() => {
          setShowWinner(true); setPhase("done");
          if (audioCtxRef.current) playWinSound(audioCtxRef.current, mutedRef.current);
        }, 500);
      }, 2800);
    }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, animBattle]);

  const handleAddBot = useCallback(async () => {
    if (!onAddBot || addingBot) return;
    initAudio();
    setAddingBot(true);
    try {
      const result = await onAddBot(liveBattle.id);
      if (result) {
        setLiveBattle(result as BattleResult);
        if ((result as BattleResult).status === "completed") {
          setAnimBattle(result as BattleResult); setPhase("countdown");
        }
      }
    } finally { setAddingBot(false); }
  }, [onAddBot, addingBot, liveBattle.id, initAudio]);

  const handleLeave = useCallback(async () => {
    if (!onLeave || leaving) return;
    setLeaving(true);
    try { await onLeave(liveBattle.id); onClose(); }
    finally { setLeaving(false); setLeaveConfirm(false); }
  }, [onLeave, leaving, liveBattle.id, onClose]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const battle = animBattle ?? liveBattle;
  const players = battle.players;
  const rounds = animBattle?.rounds ?? [];
  const totalRounds = rounds.length;
  const winnerTeamIndex = battle.winnerTeamIndex;
  const gameMode = liveBattle.gameMode || "1v1";
  const battleType = liveBattle.battleType ?? (liveBattle.isShared ? "shared" : "normal");
  const maxPlayers = liveBattle.maxPlayers;
  const numTeams = getNumTeams(gameMode);
  const currentRoundData = rounds[currentRound] ?? null;
  const tiebreakerRoundData = rounds[rounds.length - 1] ?? null;
  const caseForRound = animBattle?.cases?.[currentRound] ?? animBattle?.cases?.[0];
  const caseItemsForRound: BattleItem[] = caseForRound?.items ?? [];
  const teamIndices = [...new Set(players.map((p) => p.teamIndex))].sort();
  const occupiedSlots = new Map<number, BattlePlayer>();
  for (const p of liveBattle.players) occupiedSlots.set(p.slotIndex ?? 0, p);
  const totalPrize = (liveBattle.cases ?? []).reduce((s, c) => s + (c.price ?? 0), 0) * maxPlayers;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" onClick={initAudio}>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 h-11 border-b border-border/20 bg-card/40">
        <Button variant="ghost" size="sm" onClick={onClose}
          className="gap-1 text-muted-foreground hover:text-foreground text-xs font-bold px-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />Back
        </Button>

        {/* Case chips */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 scrollbar-none">
          {liveBattle.cases?.map((c, i) => {
            const active = phase === "playing" && i === currentRound;
            return (
              <div key={c.id}
                className={`flex-shrink-0 flex items-center gap-1 rounded-md px-1.5 py-0.5 border text-[10px] font-semibold transition-all ${
                  active ? "border-primary bg-primary/15 text-foreground" : "border-border/30 text-muted-foreground/50"
                }`}>
                <Package className={`w-2.5 h-2.5 ${active ? "text-primary" : ""}`} />
                <span className="truncate max-w-[60px]">{c.name}</span>
              </div>
            );
          })}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="w-3 h-3" /><span>0</span></div>
          <Badge variant="outline" className="text-[10px] font-bold h-5 px-1.5">{gameMode}</Badge>
          {battleType !== "normal" && (
            <Badge className={`text-[10px] font-bold h-5 px-1.5 border ${
              battleType === "shared" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
              : battleType === "top_pull" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
              : "bg-orange-500/20 text-orange-300 border-orange-500/40"
            }`}>
              {battleType === "shared" ? "SHARED" : battleType === "top_pull" ? "TOP" : "TERM"}
            </Badge>
          )}
          <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-0.5">
            <ValDisplay value={totalPrize} size={10} />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleMute(); initAudio(); }}
            className="w-7 h-7 rounded-md border border-border/30 bg-background/40 flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 transition-all"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-muted-foreground" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Waiting Lobby ─────────────────────────────────────────────── */}
      {phase === "waiting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-6">
          <div className="text-center">
            <div className="text-xl font-black mb-1">Waiting for players...</div>
            <div className="text-sm text-muted-foreground">
              {isCreator ? "Add bots to fill empty slots, or wait for others." : "Waiting for the host to start."}
            </div>
          </div>
          <div className="flex gap-3 w-full max-w-2xl">
            {Array.from({ length: numTeams }, (_, teamIdx) => {
              const ppTeam = maxPlayers / numTeams;
              return (
                <React.Fragment key={teamIdx}>
                  {teamIdx > 0 && <div className="flex items-center px-1"><div className="text-xl font-black text-muted-foreground/30">VS</div></div>}
                  <div className="flex gap-2 flex-1">
                    {Array.from({ length: ppTeam }, (_, pi) => {
                      const slotIdx = teamIdx * ppTeam + pi;
                      return (
                        <LobbySlot key={slotIdx} teamIndex={teamIdx}
                          player={occupiedSlots.get(slotIdx)} isCreator={isCreator}
                          addingBot={addingBot} onAddBot={handleAddBot} />
                      );
                    })}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          {onLeave && !leaveConfirm && (
            <button onClick={() => setLeaveConfirm(true)}
              className="text-xs text-muted-foreground/40 hover:text-red-400 transition-colors flex items-center gap-1.5 mt-2">
              <LogOut className="w-3.5 h-3.5" />Leave battle
            </button>
          )}
          {onLeave && leaveConfirm && (
            <div className="flex flex-col items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3">
              <div className="text-sm font-semibold text-red-400">
                {isCreator ? "Cancel and refund everyone?" : "Leave and get refunded?"}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setLeaveConfirm(false)} disabled={leaving}>Stay</Button>
                <Button size="sm" onClick={handleLeave} disabled={leaving}
                  className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
                  {leaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  {isCreator ? "Cancel" : "Leave"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Countdown overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "countdown" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <AnimatePresence mode="wait">
              <motion.div key={countdown}
                initial={{ scale: 2.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.5 }}
                className="text-8xl font-black text-primary drop-shadow-[0_0_60px_rgba(139,92,246,0.9)]">
                {countdown === 0 ? "GO!" : countdown}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tiebreaker overlay ────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "tiebreaker" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="flex flex-col items-center gap-2">
              <div className="text-4xl">🤝</div>
              <div className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)]">DRAW!</div>
              <div className="text-sm font-bold text-muted-foreground animate-pulse">Tiebreaker spin...</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Battle animation ──────────────────────────────────────────── */}
      {phase !== "waiting" && animBattle && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Round progress dots */}
          {totalRounds > 0 && (
            <div className="flex-shrink-0 flex items-center justify-center gap-2 py-2 border-b border-border/10">
              {rounds.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i < revealedRounds ? "bg-primary" : i === currentRound && spinning ? "bg-primary/50 animate-pulse" : "bg-border/30"
                }`} />
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">
                Round <span className="text-foreground font-bold">{Math.min(currentRound + 1, totalRounds)}</span>/{totalRounds}
              </span>
            </div>
          )}

          {/* Player columns — reel area */}
          <div className="flex-shrink-0 flex items-stretch border-b border-border/20" style={{ background: REEL_BG }}>
            {(() => {
              // Only the first rendered reel column produces sounds so they don't stack
              let colIdx = 0;
              return teamIndices.map((teamIdx, ti) => {
                const teamPlayers = players.filter((p) => p.teamIndex === teamIdx);
                return (
                  <React.Fragment key={teamIdx}>
                    {ti > 0 && (
                      <div className="flex-shrink-0 flex items-center justify-center border-x border-border/20 bg-background/30" style={{ width: 28 }}>
                        <span className="text-[10px] font-black text-muted-foreground/30 [writing-mode:vertical-lr]">VS</span>
                      </div>
                    )}
                    {teamPlayers.map((player) => {
                      const isAudioCol = colIdx === 0;
                      colIdx++;
                      const isWinner = winnerTeamIndex !== undefined && player.teamIndex === winnerTeamIndex;
                      const isLoser = winnerTeamIndex !== undefined && !isWinner;
                      const roundResult = phase === "tiebreaker"
                        ? tiebreakerRoundData?.results.find((r) => String(r.userId) === String(player.userId))?.item ?? null
                        : currentRoundData?.results.find((r) => String(r.userId) === String(player.userId))?.item ?? null;
                      const revealedItems = rounds.slice(0, revealedRounds).map((r, ri) => {
                        const item = r.results.find((res) => String(res.userId) === String(player.userId))?.item;
                        if (!item) return null;
                        const catalogItem = animBattle.cases?.[ri]?.items.find((ci) => ci.id === item.id || (ci.name === item.name && ci.value === item.value));
                        return { item, chance: catalogItem?.chance };
                      }).filter(Boolean) as { item: BattleItem; chance?: number }[];

                      return (
                        <PlayerColumn
                          key={player.userId}
                          player={player}
                          caseItems={caseItemsForRound}
                          currentRoundResult={roundResult}
                          revealedItems={revealedItems}
                          spinning={(spinning && phase === "playing") || tiebreakerSpinning}
                          isWinner={isWinner}
                          isLoser={isLoser}
                          showWinner={showWinner}
                          round={phase === "tiebreaker" ? currentRound + 1000 : currentRound}
                          audioCtx={isAudioCol ? audioCtxRef.current : null}
                          mutedRef={mutedRef}
                        />
                      );
                    })}
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ── Winner Banner ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showWinner && animBattle && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="flex-shrink-0 border-t border-border bg-card/90 backdrop-blur px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              {battleType === "shared" ? (
                <>
                  <span className="text-lg">🤝</span>
                  <div>
                    <div className="font-bold text-sm text-cyan-300">Everyone shares the prize!</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      Each: <ValDisplay value={Math.floor(totalPrize / Math.max(animBattle.players.filter((p) => !p.isBot).length, 1))} size={11} />
                    </div>
                  </div>
                </>
              ) : winnerTeamIndex !== undefined ? (
                <>
                  <span className="text-lg">🏆</span>
                  {(() => {
                    const wp = animBattle.players.filter((p) => p.teamIndex === winnerTeamIndex);
                    const isMe = wp.some((p) => String(p.userId) === String(currentUserId));
                    const tc = TEAM_COLORS[winnerTeamIndex] ?? TEAM_COLORS[0];
                    return (
                      <div>
                        <div className={`font-bold text-sm ${tc.text}`}>
                          {isMe ? "You win! 🎉" : `${wp.map((p) => p.username).join(" & ")} wins!`}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          Prize: <ValDisplay value={totalPrize} size={11} />
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="font-bold text-sm text-muted-foreground">Battle complete</div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onCopyBattle && (
                <Button size="sm" variant="outline" onClick={() => onCopyBattle(animBattle)} className="text-xs">
                  Replay
                </Button>
              )}
              <Button size="sm" onClick={onClose} className="text-xs bg-primary hover:bg-primary/90">Close</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
