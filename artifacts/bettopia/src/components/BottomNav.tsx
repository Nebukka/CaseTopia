import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Package, TrendingUp, Bomb, Swords, MessageSquare, X, Grid3x3, Gift } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/cases", label: "Cases", icon: Package },
  { href: "/crash", label: "Crash", icon: TrendingUp },
  { href: "/mines", label: "Mines", icon: Bomb },
  { href: "/battles", label: "Battles", icon: Swords },
  { href: "/tower", label: "Tower", icon: Grid3x3 },
  { href: "/daily", label: "Daily", icon: Gift },
];

interface BottomNavProps {
  sidebarOpen?: boolean;
  onChatOpen?: () => void;
}

export function BottomNav({ sidebarOpen = false, onChatOpen }: BottomNavProps) {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border flex lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Chat button */}
      <button
        onClick={onChatOpen}
        className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-w-0 ${
          sidebarOpen ? "text-primary" : "text-muted-foreground"
        }`}
        aria-label={sidebarOpen ? "Close chat" : "Open chat"}
      >
        {sidebarOpen ? (
          <X className="w-5 h-5 flex-shrink-0" />
        ) : (
          <MessageSquare className="w-5 h-5 flex-shrink-0" />
        )}
        <span className="text-[9px] font-medium">Chat</span>
      </button>

      {/* Page links */}
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = location === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-w-0 ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-[9px] font-medium truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
