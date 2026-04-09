import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { UserAvatar } from "./UserAvatar";
import { TrendingUp, TrendingDown, Calendar, Flame, Gift, CheckCircle, DollarSign, VolumeX } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import dlIconSrc from "@assets/dl_1775559163522.webp";
import wlIconSrc from "@assets/world_lock_1775531433328.webp";
import bglIconSrc from "@assets/blue_gem_lock_1775531441876.webp";
import { getTierColor } from "../lib/tierColor";

const CURRENCIES = [
  { id: "WL", label: "WL", icon: wlIconSrc, rate: 0.01 },
  { id: "DL", label: "DL", icon: dlIconSrc, rate: 1 },
  { id: "BGL", label: "BGL", icon: bglIconSrc, rate: 100 },
] as const;

type CurrencyId = "WL" | "DL" | "BGL";

interface PublicUser {
  id: string;
  username: string;
  avatar: string | null;
  level: number;
  balance: number;
  netProfit: number | null;
  totalWagered: number;
  allTimeLow: number | null;
  allTimeHigh: number | null;
  createdAt: string;
}

interface UserProfileModalProps {
  userId: string | null;
  onClose: () => void;
}

function StatCard({
  icon,
  label,
  value,
  color,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-4 bg-background/60 border border-border/50">
      <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
        <p className={`text-lg font-bold flex items-center gap-1 ${valueColor ?? ""}`}>{value}</p>
      </div>
    </div>
  );
}

function fmtDL(val: number | null | undefined): React.ReactNode {
  if (val == null) return "—";
  return (
    <>
      {parseFloat(val.toFixed(2)).toLocaleString()}
      <img src={dlIconSrc} alt="DL" className="w-4 h-4 inline-block" style={{ imageRendering: "pixelated" }} />
    </>
  );
}

export function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const { user: me, token, deltaBalance } = useAuth();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tipCurrency, setTipCurrency] = useState<CurrencyId>("DL");
  const [tipAmount, setTipAmount] = useState("");
  const [tipping, setTipping] = useState(false);
  const [tipError, setTipError] = useState<string | null>(null);
  const [tipSuccess, setTipSuccess] = useState<string | null>(null);

  const [showMuteInput, setShowMuteInput] = useState(false);
  const [muteMinutes, setMuteMinutes] = useState("");
  const [muting, setMuting] = useState(false);
  const [muteError, setMuteError] = useState<string | null>(null);
  const [muteSuccess, setMuteSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setUser(null);
      return;
    }
    setLoading(true);
    setError(null);
    setTipAmount("");
    setTipCurrency("DL");
    setTipError(null);
    setTipSuccess(null);
    setShowMuteInput(false);
    setMuteMinutes("");
    setMuteError(null);
    setMuteSuccess(null);
    fetch(`/api/users/${userId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load profile.");
        setLoading(false);
      });
  }, [userId]);

  const canTip = !!me && !!token && user && me.id !== user.id;
  const isOwner = me?.username?.toLowerCase() === "cylax";
  const canMute = isOwner && !!token && user && me?.id !== user.id;
  const selectedCurrency = CURRENCIES.find((c) => c.id === tipCurrency)!;

  const handleMute = async () => {
    if (!canMute || !user) return;
    const mins = parseFloat(muteMinutes);
    if (!mins || mins <= 0 || !isFinite(mins)) {
      setMuteError("Enter a valid duration in minutes.");
      return;
    }
    setMuting(true);
    setMuteError(null);
    setMuteSuccess(null);
    try {
      const res = await fetch(`/api/users/${user.id}/mute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ minutes: mins }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMuteError(data.error ?? "Mute failed.");
      } else {
        setMuteSuccess(`${user.username} muted for ${mins} minute${mins !== 1 ? "s" : ""}.`);
        setShowMuteInput(false);
        setMuteMinutes("");
      }
    } catch {
      setMuteError("Network error. Try again.");
    } finally {
      setMuting(false);
    }
  };

  const handleTip = async () => {
    if (!canTip || !user) return;
    const amount = parseFloat(tipAmount);
    if (!amount || amount <= 0) {
      setTipError("Enter a valid amount.");
      return;
    }
    const amountInDL = amount * selectedCurrency.rate;
    if (amountInDL > (me?.balance ?? 0)) {
      setTipError("Insufficient balance.");
      return;
    }
    setTipping(true);
    setTipError(null);
    setTipSuccess(null);
    try {
      const res = await fetch(`/api/users/${user.id}/tip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, currency: tipCurrency }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTipError(data.error ?? "Tip failed.");
      } else {
        deltaBalance(-amountInDL);
        setTipSuccess(`Sent ${amount} ${tipCurrency} to ${user.username}!`);
        setTipAmount("");
      }
    } catch {
      setTipError("Network error. Try again.");
    } finally {
      setTipping(false);
    }
  };

  const open = !!userId;
  const netProfitPositive = (user?.netProfit ?? 0) >= 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-border bg-card">
        <DialogTitle className="sr-only">{user?.username ?? "User"} Profile</DialogTitle>
        <DialogDescription className="sr-only">Public profile for {user?.username ?? "this user"}</DialogDescription>

        {loading && (
          <div className="p-10 flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        )}
        {error && (
          <div className="p-10 flex items-center justify-center text-red-400 text-sm">{error}</div>
        )}

        {user && !loading && (
          <>
            <div className="relative bg-gradient-to-b from-primary/20 to-transparent pt-8 pb-4 px-6 flex flex-col items-center gap-3">
              <div className="relative">
                <div
                  className={`w-32 h-32 rounded-full border-4${user.level >= 150 ? " rainbow-avatar-border rainbow-avatar-glow" : user.level >= 90 ? " avatar-tier-glow" : ""}`}
                  style={user.level < 150 ? { borderColor: getTierColor(user.level), "--glow-color": getTierColor(user.level) } as React.CSSProperties : undefined}
                >
                  <div className="w-full h-full rounded-full overflow-hidden">
                    <UserAvatar avatar={user.avatar} size={128} />
                  </div>
                </div>
                <div
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs font-black px-3 py-1 rounded-full border-2 border-background whitespace-nowrap shadow${user.level >= 150 ? " rainbow-level-badge" : ""}`}
                  style={user.level < 150 ? { background: getTierColor(user.level), color: "#fff" } : undefined}
                >
                  LVL {user.level}
                </div>
              </div>
              <div className="mt-2 text-center">
                <h2 className="text-2xl font-bold tracking-tight">{user.username}</h2>
                {user.username === "Cylax" && (
                  <span
                    className="text-xs font-black"
                    style={{ color: "#f472b6", textShadow: "0 0 8px #f472b6" }}
                  >
                    OWNER
                  </span>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center mt-1">
                  <Calendar className="w-3 h-3" />
                  Joined {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-2.5">
              <StatCard
                icon={<DollarSign className="w-5 h-5" />}
                label="Net Profit"
                value={
                  user.netProfit != null
                    ? <>{user.netProfit >= 0 ? "+" : ""}{fmtDL(user.netProfit)}</>
                    : "—"
                }
                color={netProfitPositive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}
                valueColor={user.netProfit != null ? (netProfitPositive ? "text-green-400" : "text-red-400") : undefined}
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="All-Time High"
                value={fmtDL(user.allTimeHigh)}
                color="bg-green-500/10 text-green-400"
              />
              <StatCard
                icon={<TrendingDown className="w-5 h-5" />}
                label="All-Time Low"
                value={fmtDL(user.allTimeLow)}
                color="bg-red-500/10 text-red-400"
              />
              <StatCard
                icon={<Flame className="w-5 h-5" />}
                label="Total Wagered"
                value={fmtDL(user.totalWagered)}
                color="bg-orange-500/10 text-orange-400"
              />

              {canTip && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5" /> Tip {user.username}
                  </p>

                  {tipSuccess ? (
                    <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      {tipSuccess}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-1.5">
                        {CURRENCIES.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { setTipCurrency(c.id); setTipAmount(""); setTipError(null); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-bold transition-all ${
                              tipCurrency === c.id
                                ? "border-primary bg-primary/20 text-primary"
                                : "border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            <img
                              src={c.icon}
                              alt={c.label}
                              className="w-4 h-4 object-contain"
                              style={{ imageRendering: "pixelated" }}
                            />
                            {c.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <img
                            src={selectedCurrency.icon}
                            alt={selectedCurrency.label}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 object-contain pointer-events-none"
                            style={{ imageRendering: "pixelated" }}
                          />
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder={`Amount in ${tipCurrency}`}
                            value={tipAmount}
                            onChange={(e) => {
                              setTipAmount(e.target.value);
                              setTipError(null);
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") handleTip(); }}
                            className="pl-8 h-9 text-sm bg-background/60"
                            disabled={tipping}
                          />
                        </div>
                        <Button
                          size="sm"
                          className="h-9 px-4 shrink-0"
                          onClick={handleTip}
                          disabled={tipping || !tipAmount}
                        >
                          {tipping ? "…" : "Send"}
                        </Button>
                      </div>

                      {tipAmount && parseFloat(tipAmount) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          = {(parseFloat(tipAmount) * selectedCurrency.rate).toFixed(4)} DL
                        </p>
                      )}

                      {tipError && (
                        <p className="text-xs text-red-400">{tipError}</p>
                      )}
                    </>
                  )}
                </div>
              )}
              {canMute && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <VolumeX className="w-3.5 h-3.5 text-destructive" /> Mute {user.username}
                  </p>

                  {muteSuccess ? (
                    <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                      <VolumeX className="w-4 h-4" />
                      {muteSuccess}
                    </div>
                  ) : !showMuteInput ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 h-9 px-4"
                      onClick={() => { setShowMuteInput(true); setMuteError(null); }}
                    >
                      <VolumeX className="w-4 h-4 mr-1.5" /> Mute
                    </Button>
                  ) : (
                    <>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Duration in minutes"
                          value={muteMinutes}
                          onChange={(e) => { setMuteMinutes(e.target.value); setMuteError(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleMute(); if (e.key === "Escape") setShowMuteInput(false); }}
                          className="h-9 text-sm bg-background/60"
                          disabled={muting}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-9 px-3 shrink-0 bg-destructive hover:bg-destructive/90 text-white"
                          onClick={handleMute}
                          disabled={muting || !muteMinutes}
                        >
                          {muting ? "…" : "Confirm"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 px-2 shrink-0"
                          onClick={() => { setShowMuteInput(false); setMuteError(null); setMuteMinutes(""); }}
                          disabled={muting}
                        >
                          ✕
                        </Button>
                      </div>
                      {muteError && <p className="text-xs text-red-400">{muteError}</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
