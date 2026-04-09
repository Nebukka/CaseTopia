import React, { useEffect, useRef, useState } from "react";
import { rarityFromChance } from "../data/itemsCatalog";
import dlSrc from "@assets/dl_1775514218033.webp";

const RARITY_HEX: Record<string, string> = {
  common:    "#9e9e9e",
  uncommon:  "#42a5f5",
  rare:      "#22c55e",
  epic:      "#ab47bc",
  mythic:    "#ef5350",
  legendary: "#ffd700",
  divine:    "#ffffff",
};

interface WonItem {
  name: string;
  value: number;
  chance: number;
}

interface Props {
  wonItem: WonItem;
  disappearAfterMs?: number;
  active?: boolean;
}

export function WonPopup({ wonItem, disappearAfterMs = 8000, active = true }: Props) {
  const [phase, setPhase] = useState<"enter" | "visible" | "leave" | "hidden">("hidden");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rarity = rarityFromChance(wonItem.chance);
  const color = RARITY_HEX[rarity] ?? "#fff";

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
  };

  const startLeave = () => {
    clearTimers();
    setPhase("leave");
    leaveTimerRef.current = setTimeout(() => setPhase("hidden"), 250);
  };

  useEffect(() => {
    if (!active) {
      startLeave();
      return;
    }
    clearTimers();
    setPhase("enter");
    timerRef.current = setTimeout(() => {
      startLeave();
    }, disappearAfterMs);
    return clearTimers;
  }, [wonItem, active, disappearAfterMs]);

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
      style={{ zIndex: 101 }}
    >
      <style>{`
        @keyframes wonPopupIn {
          from { opacity: 0; transform: scale(0.3); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes wonPopupOut {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.2); }
        }
      `}</style>
      <div
        className="flex flex-col items-center gap-3 rounded-2xl px-8 py-5"
        style={{
          background: "linear-gradient(145deg, rgba(0,0,0,0.92), rgba(0,0,0,0.78))",
          border: `2px solid ${color}55`,
          boxShadow: `0 0 28px ${color}44, 0 6px 32px rgba(0,0,0,0.7)`,
          backdropFilter: "blur(10px)",
          minWidth: 200,
          animation,
        }}
      >
        <p className="text-[15px] font-bold uppercase tracking-widest text-green-400 leading-none">You Won</p>
        <p className="text-[20px] font-black text-white text-center leading-tight max-w-[180px] truncate">{wonItem.name}</p>
        <div className="flex items-center gap-2" style={{ color }}>
          <span className="text-xl font-black">+{wonItem.value.toLocaleString()}</span>
          <img src={dlSrc} alt="DL" width={20} height={20} style={{ imageRendering: "pixelated" }} />
        </div>
      </div>
    </div>
  );
}
