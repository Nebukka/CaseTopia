import React, { useState, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CrashGameProvider } from "./contexts/CrashGameContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { SSEProvider } from "./contexts/SSEContext";
import { useNotifications } from "./hooks/use-notifications";
import { TipNotification } from "./components/TipNotification";
import { MentionNotification } from "./components/MentionNotification";
import { LevelUpCelebration } from "./components/LevelUpCelebration";
import NotFound from "@/pages/not-found";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Limbo from "./pages/Limbo";
import Cases from "./pages/Cases";
import Battles from "./pages/Battles";
import Crash from "./pages/Crash";
import Mines from "./pages/Mines";
import Tower from "./pages/Cross";
import DailyClaim from "./pages/DailyClaim";
import SweetBonanza from "./pages/SweetBonanzaGame";
import SweetBonanza1000 from "./pages/SweetBonanza1000";
import GatesOfOlympus from "./pages/GatesOfOlympus";

const queryClient = new QueryClient();

interface PopupNotif {
  id: number;
  type: "tip" | "mention";
  message: string;
}

function NotificationPoller({
  onTip,
  onMention,
}: {
  onTip: (msg: string) => void;
  onMention: (msg: string) => void;
}) {
  useNotifications({ onTip, onMention });
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/cases" component={Cases} />
      <Route path="/battles" component={Battles} />
      <Route path="/crash" component={Crash} />
      <Route path="/limbo" component={Limbo} />
      <Route path="/mines" component={Mines} />
      <Route path="/tower" component={Tower} />
      <Route path="/daily" component={DailyClaim} />
      <Route path="/sweet-bonanza" component={SweetBonanza} />
      <Route path="/sweet-bonanza-1000" component={SweetBonanza1000} />
      <Route path="/gates-of-olympus" component={GatesOfOlympus} />
      <Route path="/profile" component={Profile} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const [popups, setPopups] = useState<PopupNotif[]>([]);
  const { levelUpEvent, clearLevelUp } = useAuth();

  const addPopup = useCallback((type: "tip" | "mention", message: string) => {
    setPopups((prev) => [...prev, { id: Date.now() + Math.random(), type, message }]);
  }, []);

  const dismissPopup = useCallback((id: number) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleTip = useCallback((msg: string) => addPopup("tip", msg), [addPopup]);
  const handleMention = useCallback((msg: string) => addPopup("mention", msg), [addPopup]);

  return (
    <SSEProvider>
      <CurrencyProvider>
        <CrashGameProvider>
          <TooltipProvider>
            <NotificationPoller onTip={handleTip} onMention={handleMention} />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />

            {levelUpEvent !== null && (
              <LevelUpCelebration newLevel={levelUpEvent} onDone={clearLevelUp} />
            )}

            {popups.map((p, i) => {
              const bottomOffset = 24 + i * 112;
              const style = { bottom: bottomOffset, right: 24, position: "fixed" as const };
              return p.type === "tip" ? (
                <div key={p.id} style={style} className="z-[9999] w-80">
                  <TipNotification message={p.message} onDismiss={() => dismissPopup(p.id)} />
                </div>
              ) : (
                <div key={p.id} style={style} className="z-[9999] w-80">
                  <MentionNotification message={p.message} onDismiss={() => dismissPopup(p.id)} />
                </div>
              );
            })}
          </TooltipProvider>
        </CrashGameProvider>
      </CurrencyProvider>
    </SSEProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
