import React from "react";
import { Link } from "wouter";

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/80 mt-8">
      {/* Main footer content */}
      <div className="px-6 py-10 flex flex-col gap-10 sm:flex-row sm:gap-8 justify-between max-w-6xl mx-auto w-full">
        {/* Left — logo + tagline + discord */}
        <div className="flex flex-col gap-4 max-w-xs">
          <Link href="/" className="text-3xl tracking-tight" style={{ fontFamily: "'Chango', cursive" }}>
            <span className="text-primary" style={{ textShadow: "0 0 6px rgba(168,85,247,0.18)" }}>Case</span>
            <span style={{ color: "#f472b6", textShadow: "0 0 6px rgba(244,114,182,0.18)" }}>Topia</span>
          </Link>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Provably fair games, highest rewards and highest RTP.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <a
              href="https://discord.gg/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-[#5865F2] transition-colors"
              title="Discord"
            >
              <DiscordIcon />
            </a>
          </div>
        </div>

        {/* Right — link columns */}
        <div className="flex gap-10 sm:gap-16 flex-wrap">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-foreground mb-1">Support</p>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact us</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Email us</a>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-foreground mb-1">Rewards</p>
            <Link href="/race" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Race</Link>
            <Link href="/daily" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Rewards</Link>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Challenges</a>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-foreground mb-1">Policies</p>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/50 px-6 py-4 max-w-6xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground/60">
        <p>CaseTopia is not connected with, endorsed by, or linked to any video game platforms.</p>
        <div className="flex items-center gap-3">
          <a href="#" className="hover:text-muted-foreground transition-colors">Terms of Service</a>
          <span>·</span>
          <a href="#" className="hover:text-muted-foreground transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="#" className="hover:text-muted-foreground transition-colors">FAQ</a>
        </div>
      </div>
    </footer>
  );
}
