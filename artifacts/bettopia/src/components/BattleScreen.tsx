import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Package, Crown, Bot, Loader2, LogOut, Volume2, VolumeX, Copy, Pencil, Share2, Eye } from "lucide-react";
import { GemIcon } from "./GemIcon";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import bigOrbSrc from "@assets/legendary_orb_1775536735371.webp";
import orbPlaceholderSrc from "@assets/legendary_orb_1775538080736.webp";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BattleItem {
  id: string; name: string; color: string;
  value: number; rarity: string; imageUrl?: string;
}
interface CaseItem extends BattleItem { chance: number; }
interface BattlePlayer {
  userId: string; username: string; teamIndex: number; slotIndex: number;
  items: BattleItem[]; totalValue: number; isBot?: boolean;
}
interface BattleRound {
  roundNumber: number; caseId: number;
  results: { userId: string | number; item: BattleItem }[];
}
interface CaseData { id: string; name: string; price: number; imageUrl?: string; items: CaseItem[]; }
interface BattleResult {
  id: string; status: string; gameMode: string; battleType?: string;
  isShared?: boolean; maxPlayers: number; isDraw?: boolean;
  winnerId?: string; winnerTeamIndex?: number;
  players: BattlePlayer[]; cases: CaseData[]; rounds: BattleRound[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TEAM_COLORS = [
  { border:"border-blue-500",  bg:"bg-blue-500/10",  text:"text-blue-400",  hex:"#3B82F6", dimBg:"rgba(59,130,246,0.08)" },
  { border:"border-red-500",   bg:"bg-red-500/10",   text:"text-red-400",   hex:"#EF4444", dimBg:"rgba(239,68,68,0.08)" },
  { border:"border-green-500", bg:"bg-green-500/10", text:"text-green-400", hex:"#22C55E", dimBg:"rgba(34,197,94,0.08)" },
  { border:"border-yellow-500",bg:"bg-yellow-500/10",text:"text-yellow-400",hex:"#EAB308", dimBg:"rgba(234,179,8,0.08)" },
  { border:"border-pink-500",  bg:"bg-pink-500/10",  text:"text-pink-400",  hex:"#EC4899", dimBg:"rgba(236,72,153,0.08)" },
  { border:"border-cyan-500",  bg:"bg-cyan-500/10",  text:"text-cyan-400",  hex:"#06B6D4", dimBg:"rgba(6,182,212,0.08)" },
];
const RARITY_COLOR: Record<string, string> = {
  common:"#9E9E9E", uncommon:"#2196F3", rare:"#4CAF50",
  epic:"#9C27B0", legendary:"#FF9800", mythic:"#FFD700", divine:"#FFFFFF",
};
const VERT_ITEM_H  = 160;
const REEL_BG      = "hsl(var(--sidebar))";
const ITEM_COUNT   = 60;
const WINNING_IDX  = 45;
const ORB_THRESHOLD = 3;
const ORB_ITEM: BattleItem = { id:"__orb__", name:"???", color:"#fbbf24", value:0, rarity:"__orb__", imageUrl:orbPlaceholderSrc };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getNumTeams(gm: string) { return gm.split("v").filter(Boolean).length; }
function getPlayersPerTeam(gm: string) { return parseInt(gm.split("v")[0],10)||1; }

function buildStrip(caseItems: CaseItem[], result: BattleItem, resultIsRare: boolean): BattleItem[] {
  const pool = caseItems.length>0 ? caseItems : [{ ...result, chance:100 } as CaseItem];
  const strip = Array.from({length:ITEM_COUNT},()=>{ const item=pool[Math.floor(Math.random()*pool.length)]; return item.chance<=ORB_THRESHOLD?ORB_ITEM:item; });
  strip[WINNING_IDX] = resultIsRare ? ORB_ITEM : result;
  return strip;
}

// ─── Currency ──────────────────────────────────────────────────────────────────

function Val({ value, size=11 }: { value:number; size?:number }) {
  let n:number, unit:string;
  if (value>=100)    { n=+(value/100).toFixed(2); unit="BGL"; }
  else if (value>=1) { n=+value.toFixed(2);        unit="DL"; }
  else               { n=Math.round(value*100);    unit="WL"; }
  return (
    <span className="flex items-center gap-0.5 font-bold tabular-nums">
      {n.toLocaleString()}
      {unit==="BGL"?<span className="text-yellow-400 font-black" style={{fontSize:size}}>BGL</span>
      :unit==="WL"?<span className="text-blue-400 font-bold" style={{fontSize:size}}>WL</span>
      :<GemIcon size={size}/>}
    </span>
  );
}

// ─── Audio ─────────────────────────────────────────────────────────────────────

function mkCtx(): AudioContext|null { try { return new (window.AudioContext||(window as any).webkitAudioContext)(); } catch { return null; } }

function playTick(ctx:AudioContext, muted:boolean) {
  if(muted) return; const t=ctx.currentTime, m=ctx.createGain(); m.gain.value=0.55; m.connect(ctx.destination);
  const sr=ctx.sampleRate, sL=Math.floor(sr*0.008), sB=ctx.createBuffer(1,sL,sr), sd=sB.getChannelData(0);
  for(let i=0;i<sL;i++) sd[i]=(Math.random()*2-1)*Math.pow(1-i/sL,3);
  const sn=ctx.createBufferSource(); sn.buffer=sB; const sf=ctx.createBiquadFilter(); sf.type="bandpass"; sf.frequency.value=3200; sf.Q.value=0.8;
  const sg=ctx.createGain(); sg.gain.setValueAtTime(0.25,t); sg.gain.exponentialRampToValueAtTime(0.0001,t+0.008);
  sn.connect(sf); sf.connect(sg); sg.connect(m); sn.start(t);
  const f=ctx.createOscillator(); f.type="sine"; f.frequency.setValueAtTime(260,t); f.frequency.exponentialRampToValueAtTime(120,t+0.045);
  const fg=ctx.createGain(); fg.gain.setValueAtTime(0,t); fg.gain.linearRampToValueAtTime(0.5,t+0.002); fg.gain.exponentialRampToValueAtTime(0.0001,t+0.07);
  f.connect(fg); fg.connect(m); f.start(t); f.stop(t+0.08);
}
function playStop(ctx:AudioContext, muted:boolean) {
  if(muted) return; const t=ctx.currentTime, sr=ctx.sampleRate, m=ctx.createGain(); m.gain.value=0.75; m.connect(ctx.destination);
  const tL=Math.floor(sr*0.010), tB=ctx.createBuffer(1,tL,sr), td=tB.getChannelData(0); for(let i=0;i<tL;i++) td[i]=(Math.random()*2-1)*Math.pow(1-i/tL,2);
  const tr=ctx.createBufferSource(); tr.buffer=tB; const tf=ctx.createBiquadFilter(); tf.type="bandpass"; tf.frequency.value=3800; tf.Q.value=0.8;
  const tg=ctx.createGain(); tg.gain.setValueAtTime(0.45,t); tg.gain.exponentialRampToValueAtTime(0.0001,t+0.010);
  tr.connect(tf); tf.connect(tg); tg.connect(m); tr.start(t);
  const th=ctx.createOscillator(); th.type="sine"; th.frequency.setValueAtTime(300,t); th.frequency.exponentialRampToValueAtTime(75,t+0.10);
  const thg=ctx.createGain(); thg.gain.setValueAtTime(0,t); thg.gain.linearRampToValueAtTime(0.9,t+0.003); thg.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
  th.connect(thg); thg.connect(m); th.start(t); th.stop(t+0.18);
}
function playSwoosh(ctx:AudioContext, muted:boolean) {
  if(muted) return; const t=ctx.currentTime, dur=1.5, sr=ctx.sampleRate, bL=Math.floor(sr*dur);
  const buf=ctx.createBuffer(1,bL,sr), d=buf.getChannelData(0); for(let i=0;i<bL;i++) d[i]=Math.random()*2-1;
  const ns=ctx.createBufferSource(); ns.buffer=buf; const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.Q.value=3;
  lp.frequency.setValueAtTime(80,t); lp.frequency.exponentialRampToValueAtTime(7000,t+0.65); lp.frequency.exponentialRampToValueAtTime(1800,t+dur);
  const ng=ctx.createGain(); ng.gain.setValueAtTime(0,t); ng.gain.linearRampToValueAtTime(0.08,t+0.12); ng.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  ns.connect(lp); lp.connect(ng); ng.connect(ctx.destination); ns.start(t); ns.stop(t+dur);
  [392,523,659,784,1047].forEach((freq,i)=>{
    const sp=ctx.createOscillator(); sp.type="sine"; sp.frequency.value=freq;
    const sg=ctx.createGain(), on=0.55+i*0.07;
    sg.gain.setValueAtTime(0,t+on); sg.gain.linearRampToValueAtTime(0.03,t+on+0.04); sg.gain.exponentialRampToValueAtTime(0.0001,t+on+0.45);
    sp.connect(sg); sg.connect(ctx.destination); sp.start(t+on); sp.stop(t+on+0.5);
  });
}
function playWin(ctx:AudioContext, muted:boolean) {
  if(muted) return; const t=ctx.currentTime;
  [311,415,523,622,784].forEach((freq,i)=>{
    const sp=ctx.createOscillator(); sp.type="sine"; sp.frequency.value=freq;
    const sg=ctx.createGain(), on=0.05+i*0.07;
    sg.gain.setValueAtTime(0,t+on); sg.gain.linearRampToValueAtTime(0.06,t+on+0.02); sg.gain.exponentialRampToValueAtTime(0.0001,t+on+0.5);
    sp.connect(sg); sg.connect(ctx.destination); sp.start(t+on); sp.stop(t+on+0.55);
  });
}

// ─── VertReelItem — Cases.tsx VerticalReelItemBox exact clone ─────────────────

function VertReelItem({ item }: { item:BattleItem }) {
  const isOrb=item.id==="__orb__"; const hex=isOrb?"#fbbf24":(RARITY_COLOR[item.rarity]??"#888");
  return (
    <div className="flex-shrink-0 flex items-center justify-center" style={{height:VERT_ITEM_H,width:"100%"}}>
      <div style={{filter:`drop-shadow(0 0 10px ${hex}aa)`}}>
        {item.imageUrl
          ?<img src={item.imageUrl} alt={item.name} style={{width:52,height:52,objectFit:"contain",imageRendering:isOrb?"auto":"pixelated"}}/>
          :<div style={{width:44,height:44,backgroundColor:hex,borderRadius:8}}/>}
      </div>
    </div>
  );
}

// ─── VertReelColumn — animation-only, no triangles ────────────────────────────

interface ColProps {
  caseItems:CaseItem[]; result:BattleItem; resultChance?:number;
  audioCtx:AudioContext|null; mutedRef:React.MutableRefObject<boolean>;
  onBonusStart?:()=>void; onBonusEnd?:()=>void; onDone?:()=>void;
}

function VertReelColumn({ caseItems, result, resultChance, audioCtx, mutedRef, onBonusStart, onBonusEnd, onDone }: ColProps) {
  const rare = resultChance!==undefined && resultChance<=ORB_THRESHOLD;
  const mainStrip = useMemo(()=>buildStrip(caseItems,result,rare),[]);
  const [strip, setStrip]     = useState<BattleItem[]>(mainStrip);
  const [orbShow, setOrbShow] = useState(false);
  const [bonusLbl, setBonusLbl] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number>(0);
  const allRafs  = useRef<number[]>([]);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastIdx  = useRef(-1);

  const later = (fn:()=>void, ms:number) => { const id=setTimeout(fn,ms); timers.current.push(id); return id; };
  const startTick = (el:HTMLDivElement) => {
    cancelAnimationFrame(rafRef.current); lastIdx.current=-1;
    const loop = ()=>{
      const mat=window.getComputedStyle(el).transform;
      if(mat&&mat!=="none"){
        const vals=mat.match(/matrix.*\((.+)\)/)?.[1].split(",");
        const rawY=vals?Math.abs(parseFloat(vals[5]??"0")):0;
        const idx=Math.floor(rawY/VERT_ITEM_H);
        if(idx!==lastIdx.current&&idx>0&&audioCtx){lastIdx.current=idx;playTick(audioCtx,mutedRef.current);}
      }
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
  };
  const stopTick = ()=>cancelAnimationFrame(rafRef.current);

  useEffect(()=>{
    const el=stripRef.current; if(!el) return;
    const DUR=2200, OFF=Math.floor(Math.random()*60)-30, target=WINNING_IDX*VERT_ITEM_H+OFF;
    el.style.transition="none"; el.style.transform="translateY(0)";
    const r1=requestAnimationFrame(()=>{ allRafs.current.push(r1);
      const r2=requestAnimationFrame(()=>{ allRafs.current.push(r2);
        el.style.transition=`transform ${DUR}ms cubic-bezier(0.08,0.82,0.15,1)`;
        el.style.transform=`translateY(-${target}px)`; startTick(el);
        later(()=>{
          stopTick();
          el.style.transition="transform 300ms cubic-bezier(0.25,0,0,1)";
          el.style.transform=`translateY(-${WINNING_IDX*VERT_ITEM_H}px)`;
          if(audioCtx) playStop(audioCtx,mutedRef.current);
          if(!rare){ later(()=>onDone?.(),320); return; }
          later(()=>{
            setOrbShow(true); if(audioCtx) playSwoosh(audioCtx,mutedRef.current); onBonusStart?.();
            const rp=caseItems.filter(ci=>ci.chance<=ORB_THRESHOLD); const pool=rp.length>0?rp:caseItems;
            const bs=Array.from({length:ITEM_COUNT},()=>pool[Math.floor(Math.random()*pool.length)]); bs[WINNING_IDX]=result;
            later(()=>{
              setOrbShow(false); setStrip(bs); setBonusLbl(true);
              el.style.transition="none"; el.style.transform="translateY(0)";
              const BDUR=1800, BOFF=Math.floor(Math.random()*60)-30, bt=WINNING_IDX*VERT_ITEM_H+BOFF;
              const b1=requestAnimationFrame(()=>{ allRafs.current.push(b1);
                const b2=requestAnimationFrame(()=>{ allRafs.current.push(b2);
                  el.style.transition=`transform ${BDUR}ms cubic-bezier(0.08,0.82,0.15,1)`;
                  el.style.transform=`translateY(-${bt}px)`; startTick(el);
                  later(()=>{
                    stopTick();
                    el.style.transition="transform 300ms cubic-bezier(0.25,0,0,1)";
                    el.style.transform=`translateY(-${WINNING_IDX*VERT_ITEM_H}px)`;
                    if(audioCtx) playStop(audioCtx,mutedRef.current);
                    setBonusLbl(false); onBonusEnd?.();
                    later(()=>onDone?.(),320);
                  },BDUR+60);
                });
              });
            },1200);
          },360);
        },DUR+60);
      });
    });
    return ()=>{ allRafs.current.forEach(cancelAnimationFrame); stopTick(); timers.current.forEach(clearTimeout); };
  },[]);

  return (
    <div style={{position:"relative",height:VERT_ITEM_H,overflow:"hidden",background:REEL_BG}}>
      <div ref={stripRef} style={{display:"flex",flexDirection:"column"}}>
        {strip.map((item,i)=><VertReelItem key={i} item={item}/>)}
      </div>
      <AnimatePresence>
        {orbShow&&(
          <motion.div key="orb" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}}
            style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(1px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:20}}>
            <motion.img src={bigOrbSrc} alt="Orb"
              initial={{scale:0.4,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:"spring",stiffness:260,damping:18,delay:0.05}}
              style={{width:80,height:80,objectFit:"contain",imageRendering:"pixelated",filter:"drop-shadow(0 0 20px rgba(251,191,36,0.9)) drop-shadow(0 0 40px rgba(251,191,36,0.5))"}}/>
          </motion.div>
        )}
      </AnimatePresence>
      {bonusLbl&&<div style={{position:"absolute",bottom:6,left:0,right:0,textAlign:"center",zIndex:15,pointerEvents:"none"}}><span style={{fontSize:9,fontWeight:900,color:"#fbbf24",letterSpacing:"0.1em",textTransform:"uppercase",textShadow:"0 0 8px rgba(251,191,36,0.7)"}}>BONUS!</span></div>}
    </div>
  );
}

// ─── SharedReelBar — shared triangles + lozenge separators (Cases.tsx exact) ──

interface ReelEntry {
  key:string; caseItems:CaseItem[]; result:BattleItem; resultChance?:number;
  audioCtx:AudioContext|null; mutedRef:React.MutableRefObject<boolean>;
  isMaster:boolean; onBonusStart?:()=>void; onBonusEnd?:()=>void; onDone?:()=>void;
}

function SharedReelBar({ columns, triColor }: { columns:ReelEntry[]; triColor:string }) {
  return (
    <div style={{position:"relative",height:VERT_ITEM_H}}>
      <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:0,height:0,borderTop:"12px solid transparent",borderBottom:"12px solid transparent",borderLeft:`14px solid ${triColor}`,zIndex:200,pointerEvents:"none"}}/>
      <div style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",width:0,height:0,borderTop:"12px solid transparent",borderBottom:"12px solid transparent",borderRight:`14px solid ${triColor}`,zIndex:200,pointerEvents:"none"}}/>
      <div style={{display:"flex",height:"100%"}}>
        {columns.map((col,idx)=>(
          <React.Fragment key={col.key}>
            {idx>0&&(
              <div style={{width:28,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:10,position:"relative"}}>
                <div style={{width:22,height:12,background:triColor,clipPath:"polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"}}/>
              </div>
            )}
            <div style={{flex:1,minWidth:0,position:"relative",overflow:"visible"}}>
              <VertReelColumn
                caseItems={col.caseItems} result={col.result} resultChance={col.resultChance}
                audioCtx={col.audioCtx} mutedRef={col.mutedRef}
                onBonusStart={col.isMaster?col.onBonusStart:undefined}
                onBonusEnd={col.isMaster?col.onBonusEnd:undefined}
                onDone={col.isMaster?col.onDone:undefined}/>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Large item card (playing + done states) ───────────────────────────────────

function BigItemCard({ item, chance, dimmed=false }: { item:BattleItem; chance?:number; dimmed?:boolean }) {
  const c=RARITY_COLOR[item.rarity]??"#888";
  return (
    <div className={`flex flex-col items-center rounded-lg border overflow-hidden transition-all ${dimmed?"opacity-40":""}`}
      style={{background:`${c}0d`,borderColor:`${c}44`,minHeight:96}}>
      <div className="flex-1 flex items-center justify-center p-2">
        {item.imageUrl
          ?<img src={item.imageUrl} alt={item.name} style={{width:44,height:44,objectFit:"contain",imageRendering:"pixelated",filter:`drop-shadow(0 0 6px ${c}88)`}}/>
          :<div style={{width:36,height:36,backgroundColor:c,borderRadius:6}}/>}
      </div>
      <div className="w-full px-1.5 pb-1.5 text-center">
        <div className="text-[9px] font-semibold truncate leading-tight" style={{color:c}}>{item.name}</div>
        <div className="text-[9px] text-muted-foreground/70 flex items-center justify-center gap-0.5 mt-0.5"><Val value={item.value} size={8}/></div>
        {chance!=null&&<div className="text-[7px] text-muted-foreground/30 mt-0.5">{chance.toFixed(2)}%</div>}
      </div>
      <div style={{height:3,width:"100%",backgroundColor:c,opacity:0.7}}/>
    </div>
  );
}

// ─── BattleScreen ──────────────────────────────────────────────────────────────

interface Props {
  battle: BattleResult;
  currentUserId?: number;
  isCreator?: boolean;
  onAddBot?: (id:string)=>Promise<BattleResult|void>;
  onLeave?: (id:string)=>Promise<void>;
  onCopyBattle?: (battle:BattleResult)=>void;
  onModifyBattle?: (battle:BattleResult)=>void;
  onClose: ()=>void;
}

export function BattleScreen({ battle:initialBattle, currentUserId, isCreator=false, onAddBot, onLeave, onCopyBattle, onModifyBattle, onClose }: Props) {
  const [liveBattle, setLiveBattle]       = useState<BattleResult>(initialBattle);
  const [animBattle, setAnimBattle]       = useState<BattleResult|null>(initialBattle.status==="completed"?initialBattle:null);
  const [phase, setPhase]                 = useState<"waiting"|"countdown"|"playing"|"tiebreaker_pending"|"tiebreaker"|"done">(
    initialBattle.status==="completed"?"countdown":"waiting");
  const [countdown, setCountdown]         = useState(3);
  const [currentRound, setCurrentRound]   = useState(0);
  const [spinDone, setSpinDone]           = useState(false);
  const [revealedRounds, setRevealedRounds] = useState(0);
  const [showWinner, setShowWinner]       = useState(false);
  const [bonusActive, setBonusActive]     = useState(false);
  const [addingBot, setAddingBot]         = useState(false);
  const [leaving, setLeaving]             = useState(false);
  const [leaveConfirm, setLeaveConfirm]   = useState(false);
  const [muted, setMuted]                 = useState(false);
  const [copied, setCopied]               = useState(false);

  const timerRef    = useRef<ReturnType<typeof setTimeout>|null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval>|null>(null);
  const audioCtxRef = useRef<AudioContext|null>(null);
  const mutedRef    = useRef(false);

  const initAudio = useCallback(()=>{
    if(!audioCtxRef.current) audioCtxRef.current=mkCtx();
    if(audioCtxRef.current?.state==="suspended") audioCtxRef.current.resume();
  },[]);

  const toggleMute = useCallback(()=>{ mutedRef.current=!mutedRef.current; setMuted(mutedRef.current); },[]);

  const tick = useCallback((fn:()=>void,ms:number)=>{
    if(timerRef.current) clearTimeout(timerRef.current); timerRef.current=setTimeout(fn,ms);
  },[]);

  // Poll waiting
  useEffect(()=>{
    if(phase!=="waiting") return;
    pollRef.current=setInterval(async()=>{
      try{
        const res=await fetch(`/api/battles/${liveBattle.id}`);
        if(res.ok){
          const data:BattleResult=await res.json(); setLiveBattle(data);
          if(data.status==="completed"){ setAnimBattle(data); setPhase("countdown"); if(pollRef.current)clearInterval(pollRef.current); }
        }
      }catch{}
    },1500);
    return ()=>{ if(pollRef.current)clearInterval(pollRef.current); };
  },[phase,liveBattle.id]);

  // Countdown
  useEffect(()=>{
    if(phase!=="countdown") return;
    if(countdown<=0){setPhase("playing");return;}
    tick(()=>setCountdown(c=>c-1),900);
    return ()=>{ if(timerRef.current)clearTimeout(timerRef.current); };
  },[phase,countdown]);

  // Round completion check
  useEffect(()=>{
    if(phase!=="playing"||!animBattle) return;
    if(currentRound>=(animBattle.rounds?.length??0)){
      if(animBattle.isDraw){tick(()=>setPhase("tiebreaker_pending"),800);}
      else{tick(()=>{setShowWinner(true);setPhase("done");if(audioCtxRef.current)playWin(audioCtxRef.current,mutedRef.current);},1000);}
    }
  },[phase,currentRound,animBattle]);

  useEffect(()=>{ if(phase!=="tiebreaker_pending")return; const t=setTimeout(()=>setPhase("tiebreaker"),500); return()=>clearTimeout(t); },[phase]);

  const handleDone = useCallback(()=>{
    if(phase==="tiebreaker"){
      tick(()=>{setShowWinner(true);setPhase("done");if(audioCtxRef.current)playWin(audioCtxRef.current,mutedRef.current);},400);
      return;
    }
    setSpinDone(true); setRevealedRounds(r=>r+1);
    tick(()=>{ setSpinDone(false); setCurrentRound(r=>r+1); },900);
  },[phase,tick]);

  const handleAddBot = useCallback(async()=>{
    if(!onAddBot||addingBot)return; initAudio(); setAddingBot(true);
    try{
      const r=await onAddBot(liveBattle.id);
      if(r){ setLiveBattle(r as BattleResult); if((r as BattleResult).status==="completed"){setAnimBattle(r as BattleResult);setPhase("countdown");} }
    }finally{setAddingBot(false);}
  },[onAddBot,addingBot,liveBattle.id,initAudio]);

  const handleLeave = useCallback(async()=>{
    if(!onLeave||leaving)return; setLeaving(true);
    try{await onLeave(liveBattle.id);onClose();}
    finally{setLeaving(false);setLeaveConfirm(false);}
  },[onLeave,leaving,liveBattle.id,onClose]);

  const handleShare = useCallback(()=>{
    navigator.clipboard.writeText(window.location.href).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1800);}).catch(()=>{});
  },[]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const battle=animBattle??liveBattle;
  const players=battle.players;
  const rounds=animBattle?.rounds??[];
  const totalRounds=rounds.length;
  const winnerTeamIndex=battle.winnerTeamIndex;
  const gameMode=liveBattle.gameMode||"1v1";
  const battleType=liveBattle.battleType??(liveBattle.isShared?"shared":"normal");
  const maxPlayers=liveBattle.maxPlayers;
  const numTeams=getNumTeams(gameMode);
  const playersPerTeam=getPlayersPerTeam(gameMode);

  const sortedPlayers=useMemo(()=>[...players].sort((a,b)=>(a.slotIndex??0)-(b.slotIndex??0)),[players]);
  const teamIndices=useMemo(()=>[...new Set(sortedPlayers.map(p=>p.teamIndex))].sort(),[sortedPlayers]);

  const currentRoundData=(phase==="tiebreaker"||phase==="tiebreaker_pending")?rounds[rounds.length-1]??null:rounds[currentRound]??null;
  const caseForRound=(phase==="tiebreaker"||phase==="tiebreaker_pending")
    ?(animBattle?.cases?.[rounds.length-1]??animBattle?.cases?.[0])
    :(animBattle?.cases?.[currentRound]??animBattle?.cases?.[0]);
  const caseItemsForRound:CaseItem[]=(caseForRound?.items??[]) as CaseItem[];

  const occupiedSlots=useMemo(()=>{ const m=new Map<number,BattlePlayer>(); for(const p of liveBattle.players)m.set(p.slotIndex??0,p); return m; },[liveBattle.players]);
  const totalPrize=useMemo(()=>(liveBattle.cases??[]).reduce((s,c)=>s+(c.price??0),0)*maxPlayers,[liveBattle.cases,maxPlayers]);

  // Team running totals (during playing)
  const teamTotals=useMemo(()=>{
    const t:Record<number,number>={};
    for(const ti of teamIndices) t[ti]=0;
    for(const round of rounds.slice(0,revealedRounds)){
      for(const res of round.results){
        const p=sortedPlayers.find(pl=>String(pl.userId)===String(res.userId));
        if(p!=null) t[p.teamIndex]=(t[p.teamIndex]??0)+res.item.value;
      }
    }
    return t;
  },[revealedRounds,rounds,sortedPlayers,teamIndices]);

  const triColor=bonusActive?"#fbbf24":"#a78bfa";

  const getPlayerRoundItem=useCallback((player:BattlePlayer,roundIdx:number)=>{
    const round=rounds[roundIdx]; if(!round) return null;
    const res=round.results.find(r=>String(r.userId)===String(player.userId)); if(!res) return null;
    const ci=animBattle?.cases?.[roundIdx]?.items.find(c=>c.id===res.item.id||(c.name===res.item.name&&c.value===res.item.value));
    return{item:res.item,chance:(ci as any)?.chance};
  },[rounds,animBattle]);

  const reelEntries=useMemo(():ReelEntry[]=>{
    if(!animBattle||!currentRoundData) return [];
    return sortedPlayers.map((player,idx)=>{
      const result=currentRoundData.results.find(r=>String(r.userId)===String(player.userId))?.item??null;
      if(!result) return null;
      const ci=caseItemsForRound.find(c=>c.id===result.id||(c.name===result.name&&c.value===result.value));
      return{
        key:`${player.userId}-${currentRound}`,
        caseItems:caseItemsForRound,result,resultChance:(ci as any)?.chance,
        audioCtx:idx===0?audioCtxRef.current:null,
        mutedRef,isMaster:idx===0,
        onBonusStart:idx===0?()=>setBonusActive(true):undefined,
        onBonusEnd:idx===0?()=>setBonusActive(false):undefined,
        onDone:idx===0?handleDone:undefined,
      };
    }).filter(Boolean) as ReelEntry[];
  },[animBattle,currentRoundData,sortedPlayers,caseItemsForRound,currentRound,handleDone]);

  const isPlaying=phase==="playing"||phase==="tiebreaker"||phase==="tiebreaker_pending";

  return (
    <div className="flex flex-col bg-background border border-border/20 rounded-xl overflow-hidden" onClick={initAudio}>

      {/* ── Sub-toolbar: ← BACK | VIEW CASES | SHARE LINK | mute ─── */}
      <div className="flex items-center gap-1 px-3 h-10 border-b border-border/20 bg-card/60 flex-shrink-0">
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-semibold px-2 h-7 rounded-md hover:bg-white/5 transition-colors flex-shrink-0">
          <ArrowLeft className="w-3.5 h-3.5"/>BACK
        </button>
        <div className="w-px h-4 bg-border/40 mx-0.5"/>
        {/* View cases */}
        <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground font-semibold px-2 h-7 rounded-md hover:bg-white/5 transition-colors">
          <Package className="w-3 h-3"/>
          VIEW CASES ({liveBattle.cases?.length??0})
        </button>
        <div className="w-px h-4 bg-border/40 mx-0.5"/>
        {/* Share link */}
        <button onClick={handleShare}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground font-semibold px-2 h-7 rounded-md hover:bg-white/5 transition-colors">
          <Share2 className="w-3 h-3"/>
          {copied?"COPIED!":"SHARE LINK"}
        </button>
        <div className="flex-1"/>
        <button onClick={e=>{e.stopPropagation();toggleMute();initAudio();}}
          className="w-7 h-7 rounded-md border border-border/30 bg-background/40 flex items-center justify-center hover:border-primary/50 transition-all flex-shrink-0">
          {muted?<VolumeX className="w-3.5 h-3.5 text-muted-foreground"/>:<Volume2 className="w-3.5 h-3.5"/>}
        </button>
      </div>

      {/* ── Info bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/10 bg-card/30 flex-shrink-0 flex-wrap">
        {/* Mode badge */}
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-bold">{gameMode}</Badge>
          {battleType!=="normal"&&(
            <Badge className={`text-[10px] h-5 px-1.5 font-bold border ${
              battleType==="shared"?"bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
              :battleType==="top_pull"?"bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
              :battleType==="crazy"?"bg-purple-500/20 text-purple-300 border-purple-500/40"
              :"bg-orange-500/20 text-orange-300 border-orange-500/40"}`}>
              {battleType==="shared"?"SHARED":battleType==="top_pull"?"TOP":battleType==="crazy"?"🃏 CRAZY":"TERMINAL"}
            </Badge>
          )}
        </div>
        {/* Case thumbnail row */}
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {liveBattle.cases?.map((c,i)=>{
            const active=isPlaying&&i===(phase==="tiebreaker"?rounds.length-1:currentRound);
            return (
              <div key={c.id} className={`flex-shrink-0 w-7 h-7 rounded border flex items-center justify-center transition-all ${active?"border-primary bg-primary/15":"border-border/30 bg-background/30"}`}>
                {c.imageUrl
                  ?<img src={c.imageUrl} alt={c.name} style={{width:20,height:20,objectFit:"contain",imageRendering:"pixelated"}}/>
                  :<Package className="w-3 h-3 text-muted-foreground/40"/>}
              </div>
            );
          })}
        </div>
        {/* Right: prize + round */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-bold text-foreground flex items-center gap-0.5"><Val value={totalPrize} size={11}/></span>
          {isPlaying&&totalRounds>0&&(
            <span className="text-[10px] text-muted-foreground">
              Round <span className="text-foreground font-bold">{Math.min(currentRound+1,totalRounds)}</span>/{totalRounds}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Eye className="w-3 h-3"/>0</span>
        </div>
      </div>

      {/* ── COUNTDOWN overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {phase==="countdown"&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
            <AnimatePresence mode="wait">
              <motion.div key={countdown}
                initial={{scale:2.5,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.5,opacity:0}} transition={{duration:0.5}}
                className="text-8xl font-black text-primary drop-shadow-[0_0_60px_rgba(139,92,246,0.9)]">
                {countdown===0?"GO!":countdown}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── WAITING LOBBY ──────────────────────────────────────────── */}
      {phase==="waiting"&&(
        <div className="flex flex-col">
          {/* Team slot grid — always render ALL teams based on gameMode */}
          <div className="flex min-h-[220px]">
            {Array.from({length:numTeams},(_,teamIdx)=>teamIdx).map((teamIdx,ti)=>{
              const tc=TEAM_COLORS[teamIdx%TEAM_COLORS.length]??TEAM_COLORS[0];
              const ppTeam=playersPerTeam;
              const teamSlots=Array.from({length:ppTeam},(_,pi)=>teamIdx*ppTeam+pi);
              return (
                <React.Fragment key={teamIdx}>
                  {ti>0&&(
                    <div className="flex-shrink-0 w-12 flex items-center justify-center border-x border-border/20 bg-background/20">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-px h-8 bg-border/30"/>
                        <span className="text-xs font-black text-muted-foreground/40">VS</span>
                        <div className="w-px h-8 bg-border/30"/>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 flex flex-col" style={{background:tc.dimBg}}>
                    {/* Team header */}
                    <div className={`px-3 py-1.5 border-b border-border/10 flex items-center gap-2`}>
                      <div className={`w-2 h-2 rounded-full border-2 ${tc.border}`} style={{backgroundColor:tc.hex+"66"}}/>
                      <span className={`text-[10px] font-black uppercase tracking-wide ${tc.text}`}>Team {ti+1}</span>
                    </div>
                    {/* Slots row */}
                    <div className="flex flex-1 gap-3 p-4">
                      {teamSlots.map(slotIdx=>{
                        const player=occupiedSlots.get(slotIdx);
                        const isSelf=player&&String(player.userId)===String(currentUserId);
                        return (
                          <div key={slotIdx} className={`flex-1 flex flex-col items-center gap-2 rounded-xl border-2 p-3 min-w-0 transition-all ${
                            player?`${tc.border} ${tc.bg}`:"border-dashed border-border/30 bg-background/20"}`}>
                            {/* Avatar */}
                            <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center font-black text-2xl flex-shrink-0 ${
                              player?`${tc.border} ${tc.bg} ${tc.text}`:"border-border/30 text-muted-foreground/20 bg-background/10"}`}>
                              {player?player.username.charAt(0).toUpperCase():"+"}
                            </div>
                            {/* Name */}
                            <div className={`text-sm font-bold truncate w-full text-center ${player?tc.text:"text-muted-foreground/40"}`}>
                              {player?player.username:"WAITING"}
                            </div>
                            {player?.isBot&&<Badge variant="outline" className={`text-[9px] ${tc.text} border-current gap-0.5 h-4 px-1`}><Bot className="w-2.5 h-2.5"/>Bot</Badge>}
                            {/* Action button */}
                            {isSelf?(
                              <button onClick={()=>setLeaveConfirm(true)} className="text-[10px] font-bold px-3 py-1 rounded bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors">LEAVE</button>
                            ):!player&&isCreator?(
                              <Button size="sm" onClick={handleAddBot} disabled={addingBot}
                                className="text-[10px] h-6 px-2 bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30">
                                {addingBot?<Loader2 className="w-3 h-3 animate-spin"/>:<Bot className="w-3 h-3"/>}
                                CALL BOT
                              </Button>
                            ):!player?(
                              <span className="text-[10px] text-muted-foreground/30">CALL BOT</span>
                            ):null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Player status row */}
          <div className="flex border-t border-border/20">
            {sortedPlayers.map((player,pi)=>{
              const tc=TEAM_COLORS[player.teamIndex%TEAM_COLORS.length]??TEAM_COLORS[0];
              const prevTeam=pi>0?sortedPlayers[pi-1].teamIndex:-1;
              return (
                <React.Fragment key={player.userId}>
                  {pi>0&&player.teamIndex!==prevTeam&&<div className="flex-shrink-0 w-12 border-x border-border/20"/>}
                  <div className={`flex-1 flex items-center gap-1.5 px-2 py-2 border-r border-border/10 ${tc.bg}`}>
                    <div className={`w-5 h-5 rounded-full border ${tc.border} ${tc.bg} flex items-center justify-center font-bold text-[10px] ${tc.text} flex-shrink-0`}>
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={`text-[10px] font-bold truncate ${tc.text}`}>{player.username}</span>
                    {!player.isBot&&<span className="ml-auto text-green-400 text-[9px]">✓</span>}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Leave confirm */}
          {leaveConfirm&&(
            <div className="border-t border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-red-400">{isCreator?"Cancel and refund everyone?":"Leave and get refunded?"}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={()=>setLeaveConfirm(false)} disabled={leaving}>Stay</Button>
                <Button size="sm" onClick={handleLeave} disabled={leaving} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
                  {leaving?<Loader2 className="w-3 h-3 animate-spin"/>:<LogOut className="w-3 h-3"/>}
                  {isCreator?"Cancel":"Leave"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PLAYING + DONE ──────────────────────────────────────────── */}
      {(isPlaying||phase==="done")&&animBattle&&(
        <div className="flex flex-col">

          {/* DRAW banner */}
          <AnimatePresence>
            {(phase==="tiebreaker"||phase==="tiebreaker_pending")&&!showWinner&&(
              <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2 flex items-center justify-center gap-3">
                <span className="text-lg">🤝</span>
                <span className="text-base font-black text-yellow-400">DRAW!</span>
                <span className="text-xs font-bold text-muted-foreground animate-pulse">Tiebreaker spin...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── DONE STATE: Team totals + buttons + item grid ──────── */}
          {phase==="done"&&showWinner ? (
            <>
              {/* Team totals row */}
              <div className="flex border-b border-border/20 relative">
                {teamIndices.map((teamIdx,ti)=>{
                  const tc=TEAM_COLORS[teamIdx%TEAM_COLORS.length]??TEAM_COLORS[0];
                  const isWinTeam=winnerTeamIndex!==undefined&&teamIdx===winnerTeamIndex;
                  const isLoseTeam=winnerTeamIndex!==undefined&&!isWinTeam;
                  const total=teamTotals[teamIdx]??0;
                  const prevTeam=ti>0?teamIndices[ti-1]:-1;
                  return (
                    <React.Fragment key={teamIdx}>
                      {ti>0&&<div className="flex-shrink-0 w-12 border-x border-border/20 bg-background/20"/>}
                      <div className={`flex-1 flex flex-col items-center justify-center py-5 gap-1 ${isWinTeam?tc.bg:""} ${isLoseTeam?"opacity-60":""}`}>
                        <div className={`text-3xl font-black flex items-center gap-1 ${
                          battleType==="shared"?"text-cyan-300":isWinTeam?"text-green-400":winnerTeamIndex!==undefined?"text-red-400":"text-foreground"}`}>
                          <Val value={total} size={22}/>
                        </div>
                        {isWinTeam&&<div className="flex items-center gap-1 text-yellow-400 text-xs font-bold"><Crown className="w-3.5 h-3.5 fill-yellow-400"/>Winner</div>}
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Center overlay: Copy + Modify buttons */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none z-10">
                  <div className="flex items-center gap-2 pointer-events-auto">
                    {onCopyBattle&&(
                      <Button size="sm" onClick={()=>onCopyBattle(animBattle)}
                        className="gap-1.5 bg-primary hover:bg-primary/90 text-xs font-bold shadow-lg">
                        <Copy className="w-3 h-3"/>COPY BATTLE <Val value={totalPrize} size={10}/>
                      </Button>
                    )}
                  </div>
                  {onModifyBattle&&isCreator&&(
                    <button onClick={()=>onModifyBattle(animBattle)} className="pointer-events-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-semibold">
                      <Pencil className="w-3 h-3"/>Modify Battle
                    </button>
                  )}
                </div>
              </div>

              {/* Player name row */}
              <div className="flex border-b border-border/20 bg-card/20">
                {sortedPlayers.map((player,pi)=>{
                  const tc=TEAM_COLORS[player.teamIndex%TEAM_COLORS.length]??TEAM_COLORS[0];
                  const isWinner=winnerTeamIndex!==undefined&&player.teamIndex===winnerTeamIndex;
                  const isLoser=winnerTeamIndex!==undefined&&!isWinner;
                  const prevTeam=pi>0?sortedPlayers[pi-1].teamIndex:-1;
                  return (
                    <React.Fragment key={player.userId}>
                      {pi>0&&player.teamIndex!==prevTeam&&<div className="flex-shrink-0 w-12 border-x border-border/20 bg-background/20"/>}
                      <div className={`flex-1 flex flex-col items-center py-2 px-1 border-r border-border/10 min-w-0 ${isLoser?"opacity-40":""} ${isWinner?tc.bg:""}`}>
                        <div className={`w-7 h-7 rounded-full border-2 ${tc.border} ${tc.bg} flex items-center justify-center font-black text-sm ${tc.text} mb-0.5`}>
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                        <div className={`text-[9px] font-bold truncate w-full text-center ${tc.text}`}>{player.username}</div>
                        <div className="text-[9px] text-muted-foreground"><Val value={player.totalValue} size={8}/></div>
                        {isWinner&&<Crown className="w-3 h-3 text-yellow-400 fill-yellow-400 mt-0.5"/>}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Item grid — each row = one round, each column = one player */}
              <div className="overflow-auto" style={{maxHeight:320}}>
                {rounds.map((_,ri)=>(
                  <div key={ri} className="flex border-b border-border/10">
                    {sortedPlayers.map((player,pi)=>{
                      const ri2=getPlayerRoundItem(player,ri);
                      const isWinner=winnerTeamIndex!==undefined&&player.teamIndex===winnerTeamIndex;
                      const isLoser=winnerTeamIndex!==undefined&&!isWinner;
                      const prevTeam=pi>0?sortedPlayers[pi-1].teamIndex:-1;
                      return (
                        <React.Fragment key={player.userId}>
                          {pi>0&&player.teamIndex!==prevTeam&&<div className="flex-shrink-0 w-12 border-x border-border/20 bg-background/20"/>}
                          <div className="flex-1 p-1.5 border-r border-border/10 min-w-0">
                            {ri2?<BigItemCard item={ri2.item} chance={ri2.chance} dimmed={isLoser}/>:<div className="h-[96px]"/>}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Close button */}
              <div className="border-t border-border/20 bg-card/20 px-4 py-3 flex justify-end">
                <Button size="sm" variant="outline" onClick={onClose} className="text-xs">Close</Button>
              </div>
            </>
          ) : (
            // ── PLAYING STATE: player headers + reel + item history ─

            <>
              {/* Round progress */}
              {totalRounds>0&&(
                <div className="flex items-center justify-center gap-1.5 py-1.5 border-b border-border/10 bg-background/10">
                  {rounds.map((_,i)=>(
                    <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                      i<revealedRounds?"bg-primary":i===currentRound&&!spinDone?"bg-primary/50 animate-pulse":"bg-border/30"}`}/>
                  ))}
                </div>
              )}

              {/* Player headers */}
              <div className="flex border-b border-border/10">
                {sortedPlayers.map((player,pi)=>{
                  const tc=TEAM_COLORS[player.teamIndex%TEAM_COLORS.length]??TEAM_COLORS[0];
                  const prevTeam=pi>0?sortedPlayers[pi-1].teamIndex:-1;
                  return (
                    <React.Fragment key={player.userId}>
                      {pi>0&&player.teamIndex!==prevTeam&&(
                        <div className="flex-shrink-0 w-12 flex items-center justify-center border-x border-border/20 bg-background/20">
                          <span className="text-[9px] font-black text-muted-foreground/30 [writing-mode:vertical-lr]">VS</span>
                        </div>
                      )}
                      <div className={`flex-1 flex items-center justify-between gap-1 px-2 py-1.5 border-r border-border/10 min-w-0 ${tc.bg}`}>
                        <div className="flex items-center gap-1 min-w-0">
                          <div className={`w-4 h-4 rounded-full border ${tc.border} ${tc.bg} flex-shrink-0 flex items-center justify-center font-black text-[9px] ${tc.text}`}>
                            {player.username.charAt(0).toUpperCase()}
                          </div>
                          <span className={`text-[10px] font-bold truncate ${tc.text}`}>{player.username}</span>
                          {player.isBot&&<Bot className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0"/>}
                        </div>
                        <span className="text-[9px] flex-shrink-0 text-foreground font-bold"><Val value={teamTotals[player.teamIndex]??0} size={8}/></span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Shared reel bar (Cases.tsx exact: shared triangles + lozenge separators) */}
              {reelEntries.length>0?(
                <SharedReelBar
                  key={phase==="tiebreaker"?currentRound+1000:currentRound}
                  columns={reelEntries} triColor={triColor}/>
              ):(
                <div style={{position:"relative",height:VERT_ITEM_H,background:REEL_BG,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:0,height:0,borderTop:"12px solid transparent",borderBottom:"12px solid transparent",borderLeft:`14px solid ${triColor}40`,zIndex:100}}/>
                  <div style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",width:0,height:0,borderTop:"12px solid transparent",borderBottom:"12px solid transparent",borderRight:`14px solid ${triColor}40`,zIndex:100}}/>
                  <Package className="w-8 h-8 text-muted-foreground/20"/>
                </div>
              )}

              {/* Item labels row */}
              <div className="flex border-b border-border/10">
                {sortedPlayers.map((player,pi)=>{
                  const roundResult=currentRoundData?.results.find(r=>String(r.userId)===String(player.userId))?.item??null;
                  const rc=roundResult?(RARITY_COLOR[roundResult.rarity]??"#888"):undefined;
                  const prevTeam=pi>0?sortedPlayers[pi-1].teamIndex:-1;
                  return (
                    <React.Fragment key={player.userId}>
                      {pi>0&&player.teamIndex!==prevTeam&&<div className="flex-shrink-0 w-12 border-x border-border/20 bg-background/20"/>}
                      <div className="flex-1 h-8 flex flex-col items-center justify-center border-r border-border/10 bg-background/20 min-w-0 px-1">
                        {spinDone&&roundResult?(
                          <>
                            <div className="text-[9px] font-bold truncate w-full text-center" style={{color:rc}}>{roundResult.name}</div>
                            <div className="text-[8px] text-muted-foreground/60"><Val value={roundResult.value} size={8}/></div>
                          </>
                        ):<div className="text-[9px] text-muted-foreground/20">—</div>}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Item history — large cards, round rows */}
              <div className="overflow-auto" style={{maxHeight:280}}>
                {revealedRounds===0?(
                  <div className="flex items-center justify-center py-8 text-muted-foreground/20 text-sm">Items will appear here...</div>
                ):(
                  rounds.slice(0,revealedRounds).map((_,ri)=>{
                    const roundIdx=revealedRounds-1-ri;
                    return (
                      <div key={roundIdx} className="flex border-b border-border/10">
                        {sortedPlayers.map((player,pi)=>{
                          const ri2=getPlayerRoundItem(player,roundIdx);
                          const prevTeam=pi>0?sortedPlayers[pi-1].teamIndex:-1;
                          return (
                            <React.Fragment key={player.userId}>
                              {pi>0&&player.teamIndex!==prevTeam&&<div className="flex-shrink-0 w-12 border-x border-border/20 bg-background/20"/>}
                              <div className="flex-1 p-1.5 border-r border-border/10 min-w-0">
                                {ri2?<BigItemCard item={ri2.item} chance={ri2.chance}/>:<div className="h-[96px]"/>}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
