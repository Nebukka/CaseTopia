import React, { useRef, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { Button } from "./ui/button";
import { LogOut, Gift } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { useLogout } from "@workspace/api-client-react";
import { WalletModal } from "./WalletModal";
import { getTierColor } from "../lib/tierColor";

function useAnimatedBalance(target: number, duration = 450): number {
  const [displayed, setDisplayed] = useState(target);
  const displayedRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (displayedRef.current === target) return;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    const from = displayedRef.current;

    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      displayedRef.current = current;
      setDisplayed(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return displayed;
}

interface NavbarProps {
  sidebarOpen?: boolean;
}

export function Navbar({ sidebarOpen = true }: NavbarProps) {
  const { user, logout } = useAuth();
  const { formatBalance, iconSrc, label, cycleCurrency } = useCurrency();
  const [, setLocation] = useLocation();
  const logoutMutation = useLogout();
  const [walletOpen, setWalletOpen] = useState(false);

  const rawBalance = user?.balance ?? 0;
  const animatedBalance = useAnimatedBalance(rawBalance);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
        setLocation("/");
      }
    });
  };

  return (
    <nav
      className={`h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 fixed top-0 right-0 z-40 flex items-center px-3 sm:px-6 transition-all duration-300 ${sidebarOpen ? "lg:left-72 left-0" : "left-0"}`}
    >
      {/* Left — logo */}
      <div className="flex-1 flex items-center">
        <Link href="/" className="text-2xl sm:text-3xl tracking-tight" style={{ fontFamily: "'Chango', cursive" }}>
          <span className="text-primary" style={{ textShadow: "0 0 6px rgba(168,85,247,0.18), 0 0 14px rgba(155,89,182,0.08)" }}>Case</span><span style={{ color: "#f472b6", textShadow: "0 0 6px rgba(244,114,182,0.18), 0 0 14px rgba(236,72,153,0.08)" }}>Topia</span>
        </Link>
      </div>

      {/* Center — balance */}
      <div className="flex items-center gap-2">
        {user && (
          <>
            <div className="bg-card border border-border px-2 sm:px-4 py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 font-bold text-xs sm:text-sm" style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', fontFamily: "'Open Sans', sans-serif" }}>
              <span className="hidden sm:inline">{formatBalance(animatedBalance)}</span>
              <span className="sm:hidden">{formatBalance(animatedBalance).split(" ")[0]}</span>
              <button
                onClick={cycleCurrency}
                title={`Switch currency (currently ${label})`}
                className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
              >
                <img
                  src={iconSrc}
                  alt={label}
                  width={16}
                  height={16}
                  style={{ imageRendering: "pixelated", display: "inline-block" }}
                />
              </button>
            </div>
            {/* Wallet + button */}
            <button
              onClick={() => setWalletOpen(true)}
              title="Wallet"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-primary flex items-center justify-center text-white font-bold hover:bg-primary/80 active:scale-95 transition-all shadow-md shadow-primary/30"
              style={{ fontSize: "22px", lineHeight: 1, paddingBottom: "1px" }}
            >
              +
            </button>
          </>
        )}
      </div>

      <WalletModal open={walletOpen} onOpenChange={setWalletOpen} />

      {/* Right — profile / auth */}
      <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4">
        {user ? (
          <>
            <Link href="/daily" title="Daily Case" className="hidden sm:flex items-center justify-center w-9 h-9 rounded-md hover:bg-card border border-transparent hover:border-border transition-colors text-yellow-400">
              <Gift className="w-5 h-5" />
            </Link>
            <Link href="/profile" className="flex items-center gap-2 hover:bg-card px-2 sm:px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-border">
              <div
                className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-visible${(user.level ?? 1) >= 150 ? " rainbow-avatar-glow" : (user.level ?? 1) >= 100 ? " avatar-tier-glow" : ""}`}
                style={{ "--glow-color": getTierColor(user.level ?? 1) } as React.CSSProperties}
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden${(user.level ?? 1) >= 150 ? " rainbow-avatar-border" : ""}`}
                  style={(user.level ?? 1) >= 150 ? { borderWidth: "2px" } : { border: `2px solid ${getTierColor(user.level ?? 1)}` }}
                >
                  <UserAvatar avatar={user.avatar} size={32} />
                </div>
                <span
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center border border-background${(user.level ?? 1) >= 150 ? " rainbow-level-badge" : ""}`}
                  style={(user.level ?? 1) >= 150 ? {} : { background: getTierColor(user.level ?? 1), color: "#fff" }}
                >
                  {user.level ?? 1}
                </span>
              </div>
              <span className="hidden sm:block font-semibold text-sm">{user.username}</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive w-8 h-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button variant="ghost" className="font-semibold text-sm px-3">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="font-semibold bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-3">Register</Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
