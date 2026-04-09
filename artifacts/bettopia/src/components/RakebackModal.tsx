import React, { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import dlSrc from "@assets/dl_1775514218033.webp";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../contexts/AuthContext";

interface RakebackStatus {
  rakebackBalance: number;
  totalRakebackClaimed: number;
}

interface RakebackModalProps {
  open: boolean;
  onClose: () => void;
  onClaimed?: () => void;
}

const DL = ({ size = 13 }: { size?: number }) => (
  <img
    src={dlSrc}
    alt="DL"
    width={size}
    height={size}
    style={{ imageRendering: "pixelated", display: "inline-block", verticalAlign: "middle" }}
  />
);

const BASE_URL = import.meta.env.BASE_URL ?? "/";

export function RakebackModal({ open, onClose, onClaimed }: RakebackModalProps) {
  const { user, token, updateUser } = useAuth();
  const [status, setStatus] = useState<RakebackStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    fetch(`${BASE_URL}api/daily/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setStatus({
          rakebackBalance: data.rakebackBalance ?? 0,
          totalRakebackClaimed: data.totalRakebackClaimed ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, token]);

  async function handleClaim() {
    setClaiming(true);
    try {
      const res = await fetch(`${BASE_URL}api/rakeback/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error || "Could not claim rakeback", variant: "destructive" });
      } else {
        toast({
          title: "Rakeback claimed!",
          description: (
            <span className="flex items-center gap-1">
              +{data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              <DL size={12} />
            </span>
          ) as any,
        });
        updateUser({ balance: data.newBalance });
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                rakebackBalance: 0,
                totalRakebackClaimed: prev.totalRakebackClaimed + data.amount,
              }
            : prev
        );
        onClaimed?.();
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  }

  if (!open) return null;

  const userLevel = (user as any)?.level ?? 1;
  const gameTier = Math.floor(userLevel / 10);
  const percent = gameTier <= 1 ? 5 : Math.min(10, 5 + (gameTier - 1));
  const exampleBet = 150;
  // Example using Crash (4% house edge): bet × edge × rakeback%
  const exampleReturn = parseFloat((exampleBet * 0.04 * percent / 100).toFixed(4));
  const canClaim = (status?.rakebackBalance ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
        style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 font-bold text-lg">
            <RefreshCw className="w-5 h-5 text-primary" />
            Rakeback
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Info box */}
          <div
            className="rounded-lg p-4 text-sm leading-relaxed"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="font-semibold text-base mb-2">Rakeback Information</p>
            <p className="text-muted-foreground">
              With <span className="text-white font-semibold">rakeback</span>, you earn back{" "}
              <span className="text-white font-semibold">5%</span> of the house edge on every bet you place.
              For example on a bet of <span className="text-white font-semibold">300 <DL /></span> on Mines, you get{" "}
              <span className="text-white font-semibold">0.6 <DL /></span> added to your rakeback balance.
            </p>
            <p className="text-muted-foreground mt-2">
              The default percentage is <span className="text-white font-semibold">5%</span> (tiers 0–1), then increases by 1% per tier up to a maximum of <span className="text-white font-semibold">10%</span> at tier 6.
            </p>
          </div>

          {/* Stat boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-lg p-4 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1">
                Earnings <RefreshCw className="w-3 h-3 opacity-50" />
              </p>
              {loading ? (
                <div className="h-6 w-16 mx-auto rounded bg-white/10 animate-pulse" />
              ) : (
                <p className="text-xl font-bold flex items-center justify-center gap-1">
                  {(status?.rakebackBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  <DL size={15} />
                </p>
              )}
            </div>
            <div
              className="rounded-lg p-4 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1">
                Claimed Earnings <span className="opacity-50">✓</span>
              </p>
              {loading ? (
                <div className="h-6 w-20 mx-auto rounded bg-white/10 animate-pulse" />
              ) : (
                <p className="text-xl font-bold flex items-center justify-center gap-1">
                  {(status?.totalRakebackClaimed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  <DL size={15} />
                </p>
              )}
            </div>
          </div>

          {/* Current rakeback % */}
          <p className="text-sm text-muted-foreground">
            Your rakeback percentage:{" "}
            <span className="font-bold text-white">{loading ? "…" : `${percent}%`}</span>
          </p>
        </div>

        {/* Claim button footer */}
        <div
          className="px-5 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
        >
          <Button
            className="w-full font-semibold"
            disabled={!canClaim || claiming || loading}
            onClick={handleClaim}
          >
            {claiming ? "Claiming…" : canClaim ? "Claim Earnings" : "No Earnings to Claim"}
          </Button>
        </div>
      </div>
    </div>
  );
}
