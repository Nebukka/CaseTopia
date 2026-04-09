import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Wallet, Loader2, CheckCircle2, Copy, Clock, AlertCircle } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../contexts/AuthContext";
import dlSrc from "@assets/dl_1775514218033.webp";

type Tab = "deposit" | "withdraw";
type DepositStep = "form" | "loading" | "waiting_bot" | "bot_ready" | "expired";
type WithdrawStep = "form" | "loading" | "done";

const STORAGE_KEY = "bettopia_deposit_session";

interface DepositSession {
  txId: number;
  worldName: string;
  expiresAt: string;
  growId: string;
}

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function loadSession(): DepositSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s: DepositSession = JSON.parse(raw);
    if (new Date(s.expiresAt) <= new Date()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function saveSession(s: DepositSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) { setRemaining(0); return; }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, ms));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

function formatCountdown(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { user, token, updateUser } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("deposit");

  const [growId, setGrowId] = useState("");
  const [depositStep, setDepositStep] = useState<DepositStep>("form");
  const [depositSession, setDepositSession] = useState<DepositSession | null>(null);
  const [depositBot, setDepositBot] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [wGrowId, setWGrowId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>("form");

  const remaining = useCountdown(depositSession?.expiresAt ?? null);

  // Restore session from localStorage on mount / open
  useEffect(() => {
    if (open) {
      const s = loadSession();
      if (s) {
        setDepositSession(s);
        setDepositStep("waiting_bot");
        startPolling(s.txId);
      }
    }
  }, [open]);

  // Auto-expire when countdown hits 0
  useEffect(() => {
    if (depositSession && remaining === 0) {
      stopPolling();
      clearSession();
      setDepositStep("expired");
    }
  }, [remaining, depositSession]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const resetDeposit = () => {
    stopPolling();
    clearSession();
    setGrowId("");
    setDepositStep("form");
    setDepositSession(null);
    setDepositBot(null);
  };

  const resetWithdraw = () => { setWGrowId(""); setWithdrawAmount(""); setWithdrawStep("form"); };

  useEffect(() => () => stopPolling(), []);

  const startPolling = (txId: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/wallet/deposit-status/${txId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "completed") {
          stopPolling();
          clearSession();
          updateUser({ balance: undefined });
          setDepositStep("bot_ready");
        } else if (data.botGrowId) {
          setDepositBot(data.botGrowId);
          setDepositStep("bot_ready");
          stopPolling();
        }
      } catch {}
    }, 3000);
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    resetWithdraw();
  };

  const handleDeposit = async () => {
    if (!growId.trim()) {
      toast({ title: "Enter your GrowID", variant: "destructive" });
      return;
    }
    setDepositStep("loading");
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ growId: growId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      const session: DepositSession = {
        txId: data.transactionId,
        worldName: data.worldName,
        expiresAt: data.expiresAt,
        growId: growId.trim(),
      };
      saveSession(session);
      setDepositSession(session);
      setDepositStep("waiting_bot");
      startPolling(data.transactionId);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDepositStep("form");
    }
  };

  const handleWithdraw = async () => {
    if (!wGrowId.trim()) {
      toast({ title: "Enter your GrowID", variant: "destructive" });
      return;
    }
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (amt > 2000) {
      toast({ title: "Maximum withdrawal is 2,000 DL at a time", variant: "destructive" });
      return;
    }
    if (user && amt > (user.balance ?? 0)) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    setWithdrawStep("loading");
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ growId: wGrowId.trim(), amountDl: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (typeof data.newBalance === "number") updateUser({ balance: data.newBalance });
      setWithdrawStep("done");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setWithdrawStep("form");
    }
  };

  const copyWorld = () => {
    if (!depositSession) return;
    navigator.clipboard.writeText(depositSession.worldName).then(() =>
      toast({ title: "Copied!", description: depositSession.worldName })
    );
  };

  const isExpiringSoon = remaining > 0 && remaining < 30_000;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopPolling(); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-border bg-[#1a1a2e]" style={{ zIndex: 9999 }}>
        <div className="px-6 pt-5 pb-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white mb-4">
            <Wallet className="w-5 h-5 text-primary" />
            Wallet
          </DialogTitle>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#12122a] rounded-lg p-1 mb-5">
            {(["deposit", "withdraw"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`flex-1 py-2 rounded-md text-sm font-bold transition-all capitalize ${
                  tab === t
                    ? "bg-primary text-white shadow"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* DEPOSIT */}
          {tab === "deposit" && (
            <div className="space-y-4 pb-6">
              {depositStep === "form" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Grow ID</label>
                    <Input
                      value={growId}
                      onChange={(e) => setGrowId(e.target.value)}
                      placeholder="YourGrowID"
                      className="bg-[#12122a] border-border text-white"
                      onKeyDown={(e) => e.key === "Enter" && handleDeposit()}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-0.5 text-primary shrink-0">ℹ</span>
                    You will be given a world name, join it and{" "}
                    <span className="text-primary font-bold">TRADE</span>&nbsp;the bot.
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Max deposit at once is <span className="font-bold text-white">3,000</span>{" "}
                    <img src={dlSrc} alt="DL" width={14} height={14} style={{ imageRendering: "pixelated", display: "inline-block" }} />
                  </p>
                  <Button onClick={handleDeposit} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2.5">
                    DEPOSIT
                  </Button>
                </>
              )}

              {depositStep === "loading" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-white font-semibold">Loading deposit world…</p>
                  <p className="text-xs text-muted-foreground">Setting up your personal deposit world</p>
                </div>
              )}

              {(depositStep === "waiting_bot" || depositStep === "bot_ready") && depositSession && (
                <div className="space-y-4">
                  {/* Countdown timer */}
                  {remaining > 0 && (
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                      isExpiringSoon
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-[#12122a] border-border"
                    }`}>
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 shrink-0 ${isExpiringSoon ? "text-red-400 animate-pulse" : "text-yellow-400"}`} />
                        <span className={`text-sm font-semibold ${isExpiringSoon ? "text-red-400" : "text-yellow-400"}`}>
                          {depositStep === "bot_ready" ? "Trade window" : "Session expires in"}
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-lg ${isExpiringSoon ? "text-red-400" : "text-white"}`}>
                        {formatCountdown(remaining)}
                      </span>
                    </div>
                  )}

                  {depositStep === "waiting_bot" && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin shrink-0" />
                      <span className="text-yellow-400 text-sm font-semibold">Waiting for bot to join world…</span>
                    </div>
                  )}

                  {depositStep === "bot_ready" && (
                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                      <span className="text-green-400 text-sm font-semibold">Bot is in the world!</span>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Your deposit world</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-[#12122a] border border-border rounded-md px-3 py-2 font-mono font-bold text-primary text-sm tracking-widest">
                        {depositSession.worldName}
                      </div>
                      <Button variant="outline" size="icon" onClick={copyWorld} className="shrink-0 border-border">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {depositBot && (
                    <div className="bg-[#12122a] border border-border rounded-md px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Trade with: </span>
                      <span className="font-bold text-white">{depositBot}</span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Go to <span className="font-bold text-primary">{depositSession.worldName}</span> in Growtopia
                    {depositBot ? <>, find <span className="font-bold text-white">{depositBot}</span>,</> : " and wait for the bot,"}{" "}
                    then <span className="font-bold text-white">TRADE</span> it your items.
                  </p>

                  <Button variant="outline" onClick={resetDeposit} className="w-full border-border text-muted-foreground">
                    Cancel
                  </Button>
                </div>
              )}

              {depositStep === "expired" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-red-400 text-sm font-semibold">Deposit session expired</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your 2-minute deposit window has passed. Start a new deposit to try again.
                  </p>
                  <Button onClick={resetDeposit} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2.5">
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* WITHDRAW */}
          {tab === "withdraw" && (
            <div className="space-y-4 pb-6">
              {withdrawStep === "form" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Grow ID</label>
                    <Input
                      value={wGrowId}
                      onChange={(e) => setWGrowId(e.target.value)}
                      placeholder="YourGrowID"
                      className="bg-[#12122a] border-border text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Amount (DL)</label>
                    <Input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0"
                      min={1}
                      max={2000}
                      className="bg-[#12122a] border-border text-white"
                      onKeyDown={(e) => e.key === "Enter" && handleWithdraw()}
                    />
                    {user && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: <span className="text-white font-semibold">{user.balance?.toLocaleString(undefined, { maximumFractionDigits: 2 })} DL</span>
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-0.5 text-primary shrink-0">ℹ</span>
                    The Growtopia bot will deliver your winnings to your GrowID in-game.
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Max withdrawal at once is <span className="font-bold text-white">2,000</span>{" "}
                    <img src={dlSrc} alt="DL" width={14} height={14} style={{ imageRendering: "pixelated", display: "inline-block" }} />
                  </p>
                  <Button onClick={handleWithdraw} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2.5">
                    WITHDRAW
                  </Button>
                </>
              )}

              {withdrawStep === "loading" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-white font-semibold">Processing withdrawal…</p>
                  <p className="text-xs text-muted-foreground">The bot is preparing your items</p>
                </div>
              )}

              {withdrawStep === "done" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-green-400 text-sm font-semibold">Withdrawal submitted!</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The Growtopia bot will trade{" "}
                    <span className="text-white font-bold">{parseFloat(withdrawAmount).toLocaleString()} DL</span> worth of items to{" "}
                    <span className="text-primary font-bold">{wGrowId}</span> shortly.
                  </p>
                  <Button variant="outline" onClick={resetWithdraw} className="w-full border-border text-muted-foreground">
                    New Withdrawal
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
