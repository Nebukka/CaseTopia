import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { BottomNav } from "./BottomNav";
import { Footer } from "./Footer";
import { MessageSquare } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground dark">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />

      {/* Backdrop — covers everything including BottomNav when chat is open on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Reopen button — only on desktop (mobile uses BottomNav chat button) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="hidden sm:flex fixed left-0 top-1/2 -translate-y-1/2 z-[200] bg-card border border-border border-l-0 rounded-r-lg px-2 py-4 flex-col items-center gap-1 hover:bg-primary/20 hover:border-primary/50 transition-all group shadow-lg"
          title="Open chat"
        >
          <MessageSquare className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      )}

      <Navbar sidebarOpen={sidebarOpen} />
      <main
        className={`pt-16 min-h-[100dvh] transition-all duration-300 flex flex-col ${
          sidebarOpen ? "lg:pl-72" : "pl-0"
        }`}
        style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <div className="p-3 sm:p-6 flex-1">
          {children}
        </div>
        <Footer />
      </main>

      <BottomNav sidebarOpen={sidebarOpen} onChatOpen={() => setSidebarOpen((v) => !v)} />
    </div>
  );
}
