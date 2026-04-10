import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "../components/Layout";
import { useGetBattles, useCreateBattle, useJoinBattle, useGetCases, useAddBot, useLeaveBattle } from "@workspace/api-client-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useToast } from "../hooks/use-toast";
import { Swords, Plus, Users, Radio, Trophy, Eye, X, Copy, ArrowLeft, Star, Lock } from "lucide-react";
import { GemIcon } from "../components/GemIcon";
import { useCurrency } from "../contexts/CurrencyContext";
import { BattleScreen } from "../components/BattleScreen";

export default function Battles() {
  const { data: battles = [], isLoading } = useGetBattles({
    query: {
      refetchInterval: 3000,
      refetchIntervalInBackground: true,
    }
  });
  const { data: cases = [] } = useGetCases();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const { formatBalance } = useCurrency();

  const createMutation = useCreateBattle();
  const joinMutation = useJoinBattle();
  const addBotMutation = useAddBot();
  const leaveBattleMutation = useLeaveBattle();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [battleFilter, setBattleFilter] = useState<"all" | "open" | "running">("all");
  const [battleSort, setBattleSort] = useState<"newest" | "highest" | "lowest">("newest");
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [caseToAdd, setCaseToAdd] = useState<string>("");
  const [gameMode, setGameMode] = useState<string>("1v1");
  const [battleType, setBattleType] = useState<string>("normal");
  const [borrowPercent, setBorrowPercent] = useState<number>(0);
  const [isModifyMode, setIsModifyMode] = useState(false);

  const GAME_MODES = [
    { value: "1v1",   label: "1 vs 1",     players: 2, teams: 2, ppTeam: 1, desc: "2 players, winner takes all" },
    { value: "1v1v1", label: "1 vs 1 vs 1", players: 3, teams: 3, ppTeam: 1, desc: "3 players, FFA" },
    { value: "2v2",   label: "2 vs 2",     players: 4, teams: 2, ppTeam: 2, desc: "2 teams of 2" },
    { value: "2v2v2", label: "2 vs 2 vs 2", players: 6, teams: 3, ppTeam: 2, desc: "3 teams of 2" },
    { value: "3v3",   label: "3 vs 3",     players: 6, teams: 2, ppTeam: 3, desc: "2 teams of 3" },
  ];

  // Battle screen state
  const [activeBattle, setActiveBattle] = useState<any | null>(null);
  const [activeBattleIsCreator, setActiveBattleIsCreator] = useState(false);
  // Viewing a past completed battle
  const [viewingBattle, setViewingBattle] = useState<any | null>(null);
  // Spectating a waiting battle
  const [spectatingBattleId, setSpectatingBattleId] = useState<string | null>(null);

  // The live battle object for the spectator view
  const spectatingBattle = spectatingBattleId
    ? battles.find((b: any) => b.id === spectatingBattleId) ?? null
    : null;

  // Track the moment each battle first appeared as "completed" (client-side timestamp)
  const completionTimesRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const now = Date.now();
    battles.forEach((b: any) => {
      if (b.status === "completed" && !completionTimesRef.current.has(b.id)) {
        completionTimesRef.current.set(b.id, now);
      }
    });
  }, [battles]);

  // Detect if a spectated battle just completed → auto-show the animation
  useEffect(() => {
    if (!spectatingBattleId) return;
    const battle = battles.find((b: any) => b.id === spectatingBattleId);
    if (battle && battle.status === "completed" && battle.rounds?.length > 0) {
      setSpectatingBattleId(null);
      setActiveBattle(battle);
    }
  }, [battles, spectatingBattleId]);

  const handleCreate = () => {
    if (!user) {
      toast({ title: "Login required", description: "You must be logged in to create a battle.", variant: "destructive" });
      return;
    }
    if (selectedCases.length === 0) return;
    createMutation.mutate({ data: { caseIds: selectedCases.map(Number), gameMode, battleType, borrowPercent } as any }, {
      onSuccess: (result: any) => {
        setCreateDialogOpen(false);
        setSelectedCases([]);
        setCaseToAdd("");
        setBattleType("normal");
        setBorrowPercent(0);
        setIsModifyMode(false);
        refreshUser();
        setActiveBattleIsCreator(true);
        setActiveBattle(result);
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "Unknown error";
        toast({ title: "Error creating battle", description: msg, variant: "destructive" });
      }
    });
  };

  const openCopyDialog = (battle: any) => {
    const caseIds = (battle.cases ?? []).map((c: any) => c.id);
    setSelectedCases(caseIds);
    setCaseToAdd("");
    setGameMode(battle.gameMode ?? "1v1");
    setBattleType(battle.battleType ?? "normal");
    setIsModifyMode(false);
    setCreateDialogOpen(true);
  };

  const openModifyDialog = (battle: any) => {
    const caseIds = (battle.cases ?? []).map((c: any) => c.id);
    setSelectedCases(caseIds);
    setCaseToAdd("");
    setGameMode(battle.gameMode ?? "1v1");
    setBattleType(battle.battleType ?? "normal");
    setIsModifyMode(true);
    setCreateDialogOpen(true);
  };

  const handleAddBot = async (id: string) => {
    const result = await addBotMutation.mutateAsync({ id });
    refreshUser();
    return result;
  };

  const handleLeave = async (id: string) => {
    await leaveBattleMutation.mutateAsync({ id });
    refreshUser();
  };

  const handleJoin = (id: string, cost: number) => {
    if (!user) {
      toast({ title: "Login required", description: "You must be logged in to join a battle.", variant: "destructive" });
      return;
    }
    if (user.balance < cost) {
      toast({ title: "Insufficient balance", description: <span className="flex items-center gap-1">You need {formatBalance(cost)} <GemIcon size={14} /> to join.</span>, variant: "destructive" });
      return;
    }
    setSpectatingBattleId(null);
    joinMutation.mutate({ id }, {
      onSuccess: (result: any) => {
        refreshUser();
        setActiveBattleIsCreator(false);
        setActiveBattle(result);
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "Unknown error";
        toast({ title: "Error joining battle", description: msg, variant: "destructive" });
      }
    });
  };

  const recentBattles = battles
    .filter((b: any) => {
      if (b.status !== "completed") return false;
      const completedAt = completionTimesRef.current.get(b.id);
      return completedAt !== undefined && Date.now() - completedAt < 60_000;
    })
    .slice(-8)
    .reverse();

  const getCaseCost = (battle: any): number =>
    battle.cases?.reduce((sum: number, c: any) => sum + (c?.price ?? 0), 0) ?? battle.totalValue;

  return (
    <Layout>
      {/* Active battle screen (created / joined) */}
      {activeBattle && (
        <BattleScreen
          battle={activeBattle}
          currentUserId={user?.id}
          isCreator={activeBattleIsCreator}
          onAddBot={handleAddBot}
          onLeave={handleLeave}
          onCopyBattle={openCopyDialog}
          onModifyBattle={openModifyDialog}
          onClose={() => { setActiveBattle(null); setActiveBattleIsCreator(false); }}
        />
      )}

      {/* Replaying a past completed battle */}
      {viewingBattle && (
        <BattleScreen
          battle={viewingBattle}
          currentUserId={user?.id}
          onCopyBattle={openCopyDialog}
          onModifyBattle={openModifyDialog}
          onClose={() => setViewingBattle(null)}
        />
      )}

      {/* Spectator lobby overlay */}
      <AnimatePresence>
        {spectatingBattle && (
          <SpectatorLobby
            battle={spectatingBattle}
            userId={user?.id}
            joinPending={joinMutation.isPending}
            onJoin={() => handleJoin(spectatingBattle.id, getCaseCost(spectatingBattle))}
            onClose={() => setSpectatingBattleId(null)}
          />
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto space-y-8">
        {createDialogOpen ? (
          <CreateBattleView
            cases={cases}
            selectedCases={selectedCases}
            setSelectedCases={setSelectedCases}
            battleType={battleType}
            setBattleType={setBattleType}
            gameMode={gameMode}
            setGameMode={setGameMode}
            borrowPercent={borrowPercent}
            setBorrowPercent={setBorrowPercent}
            handleCreate={handleCreate}
            createPending={createMutation.isPending}
            isModifyMode={isModifyMode}
            user={user}
            onBack={() => { setCreateDialogOpen(false); setSelectedCases([]); setBattleType("normal"); setBorrowPercent(0); setIsModifyMode(false); setCaseToAdd(""); }}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Swords className="text-primary w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" />
                <h1 className="text-xl sm:text-3xl font-bold truncate">Case Battles</h1>
                <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 px-2 py-1 rounded-full flex-shrink-0">
                  <Radio className="w-3 h-3 text-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs font-semibold">LIVE</span>
                </div>
              </div>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 flex-shrink-0 mt-3 px-5 py-2.5 text-base"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Create Battle</span>
              </Button>
            </div>

            {/* Filter tabs + sort */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Filter tabs */}
              {(() => {
                const openCount = battles.filter((b: any) => b.status === "waiting").length;
                const runningCount = battles.filter((b: any) => b.status === "running").length;
                const allCount = openCount + runningCount;
                const tabs = [
                  { key: "all",     label: "All",     count: allCount },
                  { key: "open",    label: "Open",    count: openCount },
                  { key: "running", label: "Running", count: runningCount },
                ] as const;
                return (
                  <div className="flex gap-1 bg-muted/30 border border-border rounded-xl p-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setBattleFilter(tab.key)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                          battleFilter === tab.key
                            ? "bg-card text-foreground shadow-sm border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                          battleFilter === tab.key ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Sort buttons */}
              <div className="flex gap-1 bg-muted/30 border border-border rounded-xl p-1">
                {([
                  { key: "highest", label: "Highest Price" },
                  { key: "lowest",  label: "Lowest Price"  },
                ] as const).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setBattleSort(battleSort === s.key ? "newest" : s.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      battleSort === s.key
                        ? "bg-card text-foreground shadow-sm border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading battles...</div>
            ) : (
              <>
                {/* Active battles list */}
                {(() => {
                  const activeBattles = battles
                    .filter((b: any) => {
                      if (battleFilter === "open") return b.status === "waiting";
                      if (battleFilter === "running") return b.status === "running";
                      return b.status === "waiting" || b.status === "running";
                    })
                    .sort((a: any, b: any) => {
                      const aVal = getCaseCost(a) * (a.maxPlayers ?? 1);
                      const bVal = getCaseCost(b) * (b.maxPlayers ?? 1);
                      if (battleSort === "highest") return bVal - aVal;
                      if (battleSort === "lowest") return aVal - bVal;
                      return 0;
                    });
                  if (activeBattles.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        {battleFilter === "open" ? "No open battles — create one!" : battleFilter === "running" ? "No battles in progress right now" : "No active battles — create one!"}
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {activeBattles.map((battle: any) => {
                        const cost = getCaseCost(battle);
                        const alreadyJoined = battle.players.some((p: any) => p.userId === String(user?.id));
                        return (
                          <BattleCard
                            key={battle.id}
                            battle={battle}
                            onJoin={() => handleJoin(battle.id, cost)}
                            onSpectate={() => setSpectatingBattleId(battle.id)}
                            joinPending={joinMutation.isPending}
                            alreadyJoined={alreadyJoined}
                            userId={user?.id}
                          />
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Recent results */}
                {recentBattles.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Trophy className="w-4 h-4" /> Recent Results
                    </h2>
                    {recentBattles.map((battle: any) => (
                      <BattleCard
                        key={battle.id}
                        battle={battle}
                        onJoin={() => {}}
                        onSpectate={() => {}}
                        onView={() => {
                          if (battle.status === "completed" && battle.rounds?.length > 0) {
                            setViewingBattle(battle);
                          }
                        }}
                        joinPending={false}
                        alreadyJoined={false}
                        userId={user?.id}
                        readonly
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// ─── Create Battle Full-Page View ────────────────────────────────────────────

const CREATE_BATTLE_TYPES = [
  { value: "normal",   label: "Normal",   icon: "⚔️",  desc: "Highest total wins",          active: "border-primary bg-primary/15 text-primary" },
  { value: "crazy",    label: "Crazy",    icon: "🃏",  desc: "Lowest total wins",            active: "border-purple-500 bg-purple-500/15 text-purple-300" },
  { value: "shared",   label: "Shared",   icon: "🤝",  desc: "Prize split equally",         active: "border-cyan-500 bg-cyan-500/15 text-cyan-300" },
  { value: "top_pull", label: "Top Pull", icon: "🏆",  desc: "Best single item wins",        active: "border-yellow-500 bg-yellow-500/15 text-yellow-300" },
  { value: "terminal", label: "Terminal", icon: "💀",  desc: "Last case decides the winner", active: "border-orange-500 bg-orange-500/15 text-orange-300" },
];

const CREATE_GAME_MODES = [
  { value: "1v1",     label: "1v1",     players: 2 },
  { value: "1v1v1",   label: "1v1v1",   players: 3 },
  { value: "1v1v1v1", label: "1v1v1v1", players: 4 },
  { value: "2v2",     label: "2v2",     players: 4 },
  { value: "2v2v2",   label: "2v2v2",   players: 6 },
  { value: "3v3",     label: "3v3",     players: 6 },
];

function CreateBattleView({
  cases, selectedCases, setSelectedCases,
  battleType, setBattleType,
  gameMode, setGameMode,
  borrowPercent, setBorrowPercent,
  handleCreate, createPending, isModifyMode, user, onBack
}: {
  cases: any[];
  selectedCases: string[];
  setSelectedCases: React.Dispatch<React.SetStateAction<string[]>>;
  battleType: string;
  setBattleType: (t: string) => void;
  gameMode: string;
  setGameMode: (m: string) => void;
  borrowPercent: number;
  setBorrowPercent: (v: number) => void;
  handleCreate: () => void;
  createPending: boolean;
  isModifyMode: boolean;
  user: any;
  onBack: () => void;
}) {
  const [caseSearch, setCaseSearch] = useState("");
  const [caseCategory, setCaseCategory] = useState<"original" | "community" | "favourite">("original");
  const { formatBalance } = useCurrency();

  const favouriteIds = (() => {
    try {
      const stored = localStorage.getItem("bettopia_fav_cases");
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch { return new Set<string>(); }
  })();

  const totalCost = selectedCases.reduce((sum, cid) => {
    const c = cases.find((x: any) => String(x.id) === String(cid));
    return sum + (c?.price ?? 0);
  }, 0);

  const categoryCases = cases.filter((c: any) => {
    if (caseCategory === "original") return !c.isCommunity;
    if (caseCategory === "community") return !!c.isCommunity;
    if (caseCategory === "favourite") return favouriteIds.has(String(c.id));
    return true;
  });

  const filteredCases = categoryCases.filter((c: any) =>
    !caseSearch || c.name.toLowerCase().includes(caseSearch.toLowerCase())
  );

  const playerCount = CREATE_GAME_MODES.find(m => m.value === gameMode)?.players ?? 2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-xl font-bold">{isModifyMode ? "Modify Battle" : "Create Battle"}</h1>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* ── LEFT: Case browser ── */}
        <div className="space-y-4">

          {/* Selected cases row */}
          <div className="bg-card/60 border border-border rounded-2xl p-4 min-h-[120px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Selected Cases</span>
              {selectedCases.length > 0 && (
                <button
                  onClick={() => setSelectedCases([])}
                  className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 min-h-[64px] items-start">
              {selectedCases.length === 0 ? (
                <div className="w-full flex items-center justify-center text-muted-foreground/40 text-sm italic py-4">
                  Click a case below to add it
                </div>
              ) : (() => {
                const grouped: { cid: string; count: number }[] = [];
                for (const cid of selectedCases) {
                  const existing = grouped.find(g => g.cid === cid);
                  if (existing) { existing.count++; } else { grouped.push({ cid, count: 1 }); }
                }
                return grouped.map(({ cid, count }) => {
                  const c = cases.find((x: any) => String(x.id) === String(cid));
                  return (
                    <div key={cid} className="relative group flex items-center gap-2 bg-background/60 border border-border hover:border-primary/40 rounded-xl px-3 py-2 transition-all">
                      <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Swords className="w-3.5 h-3.5 text-primary/70" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate max-w-[90px]">{c?.name ?? cid}</div>
                        <div className="text-xs text-primary flex items-center gap-0.5">{formatBalance((c?.price ?? 0) * count)} <GemIcon size={8} /></div>
                      </div>
                      {count > 1 && (
                        <span className="text-xs font-bold text-muted-foreground">×{count}</span>
                      )}
                      {/* Controls */}
                      <div className="hidden group-hover:flex items-center gap-1 ml-1">
                        <button
                          onClick={() => setSelectedCases(prev => { const idx = prev.lastIndexOf(cid); return idx !== -1 ? prev.filter((_, i) => i !== idx) : prev; })}
                          className="w-5 h-5 rounded bg-muted hover:bg-muted/80 text-xs font-bold flex items-center justify-center leading-none"
                          title="Remove one"
                        >−</button>
                        <button
                          onClick={() => setSelectedCases(prev => [...prev, cid])}
                          className="w-5 h-5 rounded bg-muted hover:bg-muted/80 text-xs font-bold flex items-center justify-center leading-none"
                          title="Add one more"
                        >+</button>
                        <button
                          onClick={() => setSelectedCases(prev => prev.filter(id => id !== cid))}
                          className="w-5 h-5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center"
                          title="Remove all"
                        >×</button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Case browser */}
          <div className="bg-card/60 border border-border rounded-2xl overflow-hidden">
            {/* Category tabs + search */}
            <div className="p-3 border-b border-border flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
                {([
                  { key: "original",  label: "Original",  icon: <Lock className="w-3 h-3" /> },
                  { key: "community", label: "Community",  icon: <Users className="w-3 h-3" /> },
                  { key: "favourite", label: "Starred",    icon: <Star className="w-3 h-3" /> },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setCaseCategory(tab.key); setCaseSearch(""); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      caseCategory === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
              <input
                className="flex-1 min-w-[120px] bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/60"
                placeholder="Search cases..."
                value={caseSearch}
                onChange={e => setCaseSearch(e.target.value)}
              />
            </div>

            {/* Cases grid */}
            <div className="overflow-y-auto max-h-[380px] p-3">
              {filteredCases.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  {caseCategory === "favourite" ? "No starred cases yet" : "No cases found"}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filteredCases.map((c: any) => {
                    const countInBattle = selectedCases.filter(id => id === String(c.id)).length;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCases(prev => [...prev, String(c.id)])}
                        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-left hover:border-primary/60 hover:bg-primary/5 ${
                          countInBattle > 0 ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"
                        }`}
                      >
                        {countInBattle > 0 && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                            {countInBattle}
                          </div>
                        )}
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Swords className="w-5 h-5 text-primary/60" />
                        </div>
                        <div className="text-xs font-semibold text-center leading-tight line-clamp-2 w-full">{c.name}</div>
                        <div className="text-xs text-primary font-bold flex items-center gap-0.5">{formatBalance(c.price ?? 0)} <GemIcon size={8} /></div>
                        {favouriteIds.has(String(c.id)) && (
                          <Star className="absolute top-1.5 left-1.5 w-3 h-3 fill-yellow-400 text-yellow-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Settings panel ── */}
        <div className="space-y-4">

          {/* Player slot preview */}
          <div className="bg-card/60 border border-border rounded-2xl p-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-3">Battle Preview</span>
            {(() => {
              const playersPerTeam = parseInt(gameMode.split("v")[0], 10) || 1;
              const teams: number[][] = [];
              for (let i = 0; i < playerCount; i += playersPerTeam) {
                teams.push(Array.from({ length: playersPerTeam }, (_, j) => i + j + 1));
              }
              return (
                <div className="flex items-center justify-center gap-3 overflow-x-auto">
                  {teams.map((team, ti) => (
                    <React.Fragment key={ti}>
                      {ti > 0 && <span className="text-muted-foreground/40 text-xs font-bold flex-shrink-0">VS</span>}
                      <div className="flex items-end gap-1.5 flex-shrink-0">
                        {team.map((pNum) => (
                          <div key={pNum} className="flex flex-col items-center gap-1">
                            <div className="w-9 h-9 rounded-full border-2 border-dashed border-primary/30 bg-primary/5 flex items-center justify-center">
                              <Users className="w-3.5 h-3.5 text-primary/40" />
                            </div>
                            <span className="text-[10px] text-muted-foreground/50">P{pNum}</span>
                          </div>
                        ))}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Game mode */}
          <div className="bg-card/60 border border-border rounded-2xl p-4 space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Format</span>
            <div className="grid grid-cols-3 gap-1.5">
              {CREATE_GAME_MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setGameMode(mode.value)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all border ${
                    gameMode === mode.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Battle type */}
          <div className="bg-card/60 border border-border rounded-2xl p-4 space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Mode</span>
            <div className="space-y-1.5">
              {CREATE_BATTLE_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setBattleType(type.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                    battleType === type.value ? type.active : "border-border bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <span className="text-base leading-none">{type.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-none mb-0.5">{type.label}</div>
                    <div className="text-xs opacity-65 leading-snug">{type.desc}</div>
                  </div>
                  {battleType === type.value && (
                    <div className="ml-auto w-4 h-4 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-current" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Borrow */}
          <div className="bg-card/60 border border-border rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Borrow</span>
              {borrowPercent > 0 && (
                <span className="text-xs text-orange-300 font-semibold">You receive {100 - borrowPercent}% of winnings</span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 20, 40, 60, 80].map(pct => (
                <button
                  key={pct}
                  onClick={() => setBorrowPercent(pct)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                    borrowPercent === pct
                      ? "border-orange-500 bg-orange-500/15 text-orange-300"
                      : "border-border bg-background/40 text-muted-foreground hover:border-orange-500/40 hover:text-foreground"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            {borrowPercent > 0 && (
              <p className="text-[11px] text-muted-foreground/60 leading-snug">
                Pay {100 - borrowPercent}% upfront. If you win, you only receive {100 - borrowPercent}% of the prize.
              </p>
            )}
          </div>

          {/* Cost + create */}
          <div className="bg-card/60 border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your price</span>
              <div className="flex items-center gap-1.5">
                {borrowPercent > 0 && (
                  <span className="text-xs text-muted-foreground/50 line-through flex items-center gap-0.5">{formatBalance(totalCost)} <GemIcon size={9} /></span>
                )}
                <span className="font-bold text-primary flex items-center gap-1">{formatBalance(Math.floor(totalCost * (1 - borrowPercent / 100)))} <GemIcon size={12} /></span>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={selectedCases.length === 0 || createPending || !user}
              className="w-full bg-primary hover:bg-primary/90 font-bold py-3 text-base"
            >
              {createPending ? "Creating..." : isModifyMode ? "Create Modified Battle" : "Create Battle"}
            </Button>
            {!user && <p className="text-xs text-muted-foreground text-center">You must be logged in</p>}
            {selectedCases.length === 0 && user && <p className="text-xs text-muted-foreground text-center">Add at least one case</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Spectator Lobby ─────────────────────────────────────────────────────────

function SpectatorLobby({ battle, userId, joinPending, onJoin, onClose }: {
  battle: any;
  userId?: number;
  joinPending: boolean;
  onJoin: () => void;
  onClose: () => void;
}) {
  const { formatBalance } = useCurrency();
  const filledSlots = battle.players.length;
  const totalSlots = battle.maxPlayers;
  const alreadyJoined = battle.players.some((p: any) => p.userId === String(userId));
  const prizePool = (battle.totalValue ?? 0) * totalSlots;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-8"
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Eye className="w-4 h-4" />
          <span>Spectating</span>
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Swords className="w-7 h-7 text-primary" />
          Case Battle
          <Swords className="w-7 h-7 text-primary" />
        </h1>
        <div className="text-sm text-muted-foreground">
          {battle.cases?.map((c: any) => c?.name).filter(Boolean).join(" + ") || "Unknown Case"}
        </div>
        <div className="text-primary font-bold text-lg flex items-center gap-1.5">{formatBalance(prizePool)} <GemIcon size={14} /> Prize Pool</div>
      </div>

      {/* Player slots */}
      <div className="flex items-center gap-8 flex-wrap justify-center">
        {Array.from({ length: totalSlots }).map((_: any, i: number) => {
          const player = battle.players[i];
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div className="text-2xl font-bold text-muted-foreground/40">VS</div>
              )}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 w-36 transition-all ${
                  player ? "border-primary/50 bg-primary/5" : "border-dashed border-border/40 bg-background/50"
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${
                  player ? "border-primary bg-primary/10" : "border-border/30 bg-background"
                }`}>
                  {player ? (
                    <span className="text-2xl font-bold text-primary">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <Users className="w-7 h-7 text-muted-foreground/30" />
                  )}
                </div>
                <div className="text-sm font-semibold text-center truncate w-full text-center">
                  {player ? player.username : (
                    <span className="text-muted-foreground/40 italic text-xs">Waiting...</span>
                  )}
                </div>
                {player && (
                  <Badge variant="outline" className="text-xs">Ready</Badge>
                )}
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Status + join */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span>
            {filledSlots} / {totalSlots} players joined — waiting for {totalSlots - filledSlots} more
          </span>
        </div>

        {!alreadyJoined ? (
          <Button
            onClick={onJoin}
            disabled={joinPending}
            className="bg-primary hover:bg-primary/90 font-bold px-10 py-3 text-base"
          >
            {joinPending ? "Joining..." : <>{`Join for ${formatBalance(battle.totalValue ?? 0)} `}<GemIcon size={14} className="-mt-0.5" /></>}
          </Button>
        ) : (
          <div className="text-green-400 text-sm font-semibold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            You're in — battle starts when all players join
          </div>
        )}

        <p className="text-xs text-muted-foreground/50">
          This view auto-updates. The battle animation will play automatically when it starts.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Battle Card ──────────────────────────────────────────────────────────────

function BattleCard({ battle, onJoin, onSpectate, onView, joinPending, alreadyJoined, userId, readonly }: {
  battle: any;
  onJoin: () => void;
  onSpectate: () => void;
  onView?: () => void;
  joinPending: boolean;
  alreadyJoined: boolean;
  userId?: number;
  readonly?: boolean;
}) {
  const { formatBalance } = useCurrency();
  const isWaiting = battle.status === "waiting";
  const isCompleted = battle.status === "completed";
  const isMine = battle.players.some((p: any) => p.userId === String(userId));
  const winner = battle.players.find((p: any) => p.userId === String(battle.winnerId));
  const prizePool = (battle.totalValue ?? 0) * (battle.maxPlayers ?? 1);

  const handleCardClick = () => {
    if (isWaiting) { onSpectate(); return; }
    if (isCompleted && battle.rounds?.length > 0 && onView) { onView(); }
  };

  return (
    <Card
      className="bg-card/80 border-border overflow-hidden transition-all hover:border-primary/40 cursor-pointer"
      onClick={handleCardClick}
    >
      <CardContent className="p-0 flex flex-col md:flex-row items-stretch">
        {/* Left: prize + case */}
        <div className="p-5 md:w-44 text-center flex flex-col items-center justify-center bg-background/50 border-b md:border-b-0 md:border-r border-border gap-1">
          <div className="text-lg font-bold text-primary flex items-center justify-center gap-1">{formatBalance(prizePool)} <GemIcon size={14} /></div>
          <div className="text-xs text-muted-foreground">Prize Pool</div>
          <div className="flex flex-wrap gap-1 justify-center mt-1">
            {battle.gameMode && (
              <Badge variant="outline" className="text-xs font-bold">{battle.gameMode}</Badge>
            )}
            {battle.battleType && battle.battleType !== "normal" && (
              <Badge className={`text-xs font-bold border ${
                battle.battleType === "shared"   ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" :
                battle.battleType === "top_pull" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" :
                battle.battleType === "terminal" ? "bg-orange-500/20 text-orange-300 border-orange-500/40" :
                battle.battleType === "crazy"    ? "bg-purple-500/20 text-purple-300 border-purple-500/40" :
                "bg-primary/20 text-primary border-primary/40"
              }`}>
                {battle.battleType === "shared" ? "SHARED" : battle.battleType === "top_pull" ? "TOP PULL" : battle.battleType === "terminal" ? "TERMINAL" : battle.battleType === "crazy" ? "🃏 CRAZY" : battle.battleType.toUpperCase()}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground/60 mt-1 leading-tight">
            {battle.cases?.map((c: any) => c?.name).filter(Boolean).join(" + ") || "Unknown Case"}
          </div>
          {isWaiting && (
            <div className="text-xs text-primary/60 mt-1 flex items-center gap-1">
              <Eye className="w-3 h-3" /> Spectate
            </div>
          )}
          {isCompleted && battle.rounds?.length > 0 && (
            <div className="text-xs text-primary/60 mt-1 underline underline-offset-2">View Results</div>
          )}
        </div>

        {/* Center: players */}
        <div className="flex-1 p-5 flex items-center justify-center gap-5 flex-wrap">
          {Array.from({ length: battle.maxPlayers }).map((_: any, i: number) => {
            const player = battle.players[i];
            const isWinnerSlot = player && String(player.userId) === String(battle.winnerId);
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all ${
                  isWinnerSlot
                    ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_12px_rgba(255,215,0,0.4)]"
                    : player
                    ? "border-primary/60 bg-primary/10"
                    : "border-dashed border-border/50 bg-background/50"
                }`}>
                  {player ? (
                    <span className={`text-xl font-bold ${isWinnerSlot ? "text-yellow-300" : "text-primary"}`}>
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <Users className="w-5 h-5 text-muted-foreground/30" />
                  )}
                </div>
                <div className="text-xs font-semibold truncate w-16 text-center">
                  {player ? player.username : <span className="text-muted-foreground/40 italic text-xs">Open</span>}
                </div>
                {player && isCompleted && (
                  <div className="text-xs text-muted-foreground flex items-center gap-0.5">{formatBalance(player.totalValue ?? 0)} <GemIcon size={10} /></div>
                )}
                {isWinnerSlot && (
                  <Badge className="text-xs bg-yellow-400/15 text-yellow-300 border-yellow-400/40 px-1.5">🏆 Win</Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: action */}
        <div className="p-5 md:w-40 flex items-center justify-center border-t md:border-t-0 md:border-l border-border bg-background/50">
          {isWaiting && !alreadyJoined && !readonly ? (
            <div className="flex flex-col gap-2 w-full">
              <Button
                onClick={(e) => { e.stopPropagation(); onJoin(); }}
                disabled={joinPending}
                className="w-full bg-primary hover:bg-primary/90 font-bold text-sm"
              >
                {joinPending ? "Joining..." : "Join"}
              </Button>
              <Button
                onClick={(e) => { e.stopPropagation(); onSpectate(); }}
                variant="outline"
                className="w-full text-sm gap-1.5 border-border/60 text-muted-foreground hover:text-foreground"
              >
                <Eye className="w-3.5 h-3.5" /> Watch
              </Button>
            </div>
          ) : isWaiting && alreadyJoined ? (
            <div className="flex flex-col items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-muted-foreground">In battle</span>
            </div>
          ) : isCompleted ? (
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Finished</div>
              {isMine && winner && (
                <div className={`text-xs font-bold ${String(battle.winnerId) === String(userId) ? "text-yellow-400" : "text-muted-foreground"}`}>
                  {String(battle.winnerId) === String(userId) ? "🏆 You won!" : `${winner.username} won`}
                </div>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="text-xs">In Progress</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
