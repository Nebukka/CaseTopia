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
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [caseToAdd, setCaseToAdd] = useState<string>("");
  const [gameMode, setGameMode] = useState<string>("1v1");
  const [battleType, setBattleType] = useState<string>("normal");
  const [isModifyMode, setIsModifyMode] = useState(false);
  const [showCasePicker, setShowCasePicker] = useState(false);

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
    createMutation.mutate({ data: { caseIds: selectedCases.map(Number), gameMode, battleType } as any }, {
      onSuccess: (result: any) => {
        setCreateDialogOpen(false);
        setSelectedCases([]);
        setCaseToAdd("");
        setBattleType("normal");
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
            handleCreate={handleCreate}
            createPending={createMutation.isPending}
            isModifyMode={isModifyMode}
            user={user}
            onBack={() => { setCreateDialogOpen(false); setSelectedCases([]); setBattleType("normal"); setIsModifyMode(false); setCaseToAdd(""); }}
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 flex-shrink-0"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Battle</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading battles...</div>
            ) : (
              <>
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
  { value: "normal",   label: "Normal",   desc: "Highest total wins",         color: "violet",  border: "border-primary/60  bg-primary/10  text-primary"  },
  { value: "shared",   label: "Shared",   desc: "Prize split equally",        color: "cyan",    border: "border-cyan-500/60 bg-cyan-500/10 text-cyan-300" },
  { value: "top_pull", label: "Top Pull", desc: "Best single item wins",       color: "yellow",  border: "border-yellow-500/60 bg-yellow-500/10 text-yellow-300" },
  { value: "terminal", label: "Terminal", desc: "Last case decides the winner", color: "orange",  border: "border-orange-500/60 bg-orange-500/10 text-orange-300" },
];

const CREATE_GAME_MODES = [
  { value: "1v1",     label: "1v1",     players: 2, desc: "2 players" },
  { value: "1v1v1",   label: "1v1v1",   players: 3, desc: "3 players" },
  { value: "1v1v1v1", label: "1v1v1v1", players: 4, desc: "4-way FFA" },
  { value: "2v2",     label: "2v2",     players: 4, desc: "2 teams" },
  { value: "2v2v2",   label: "2v2v2",   players: 6, desc: "3 teams" },
];

function CreateBattleView({
  cases, selectedCases, setSelectedCases,
  battleType, setBattleType,
  gameMode, setGameMode,
  handleCreate, createPending, isModifyMode, user, onBack
}: {
  cases: any[];
  selectedCases: string[];
  setSelectedCases: React.Dispatch<React.SetStateAction<string[]>>;
  battleType: string;
  setBattleType: (t: string) => void;
  gameMode: string;
  setGameMode: (m: string) => void;
  handleCreate: () => void;
  createPending: boolean;
  isModifyMode: boolean;
  user: any;
  onBack: () => void;
}) {
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [caseSearch, setCaseSearch] = useState("");
  const [caseCategory, setCaseCategory] = useState<"original" | "community" | "favourite">("original");
  const [pendingCase, setPendingCase] = useState<any>(null);
  const [pendingQty, setPendingQty] = useState(1);
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold">{isModifyMode ? "Modify Battle" : "Create case battle"}</h1>
        <div className="text-sm text-muted-foreground flex items-center gap-1.5">
          Cost: <span className="font-bold text-primary">{formatBalance(totalCost)}</span> <GemIcon size={13} />
        </div>
      </div>

      {/* Cases area */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground font-medium">
            {selectedCases.length === 0 ? "No cases selected" : `${selectedCases.length} case${selectedCases.length !== 1 ? "s" : ""} selected`}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {(() => {
            const grouped: { cid: string; count: number }[] = [];
            for (const cid of selectedCases) {
              const existing = grouped.find((g) => g.cid === cid);
              if (existing) { existing.count++; } else { grouped.push({ cid, count: 1 }); }
            }
            return grouped.map(({ cid, count }) => {
              const c = cases.find((x: any) => String(x.id) === String(cid));
              return (
                <div
                  key={cid}
                  className="relative group w-28 h-28 flex flex-col items-center justify-center bg-card border border-border rounded-xl overflow-hidden transition-all hover:border-primary/40"
                >
                  {/* Count badge */}
                  {count > 1 && (
                    <div className="absolute top-1 left-1 min-w-[20px] h-5 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center z-10">
                      ×{count}
                    </div>
                  )}
                  <div className="w-14 h-14 flex items-center justify-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Swords className="w-6 h-6 text-primary/60" />
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-center px-1 leading-tight truncate w-full text-center">{c?.name ?? cid}</div>
                  <div className="text-xs text-primary flex items-center gap-0.5">{formatBalance((c?.price ?? 0) * count)} <GemIcon size={9} /></div>
                  {/* Controls on hover */}
                  <div className="absolute inset-0 hidden group-hover:flex items-end justify-between p-1 bg-black/10">
                    {/* Remove one */}
                    <button
                      onClick={() => setSelectedCases((prev) => {
                        const idx = prev.lastIndexOf(cid);
                        return idx !== -1 ? prev.filter((_, i) => i !== idx) : prev;
                      })}
                      className="w-6 h-6 rounded-full bg-muted/90 text-foreground flex items-center justify-center text-sm font-bold hover:bg-muted leading-none"
                      title="Remove one"
                    >
                      −
                    </button>
                    {/* Remove all */}
                    <button
                      onClick={() => setSelectedCases((prev) => prev.filter((id) => id !== cid))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center text-xs"
                      title="Remove all"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            });
          })()}

          {/* ADD CASE tile */}
          <button
            onClick={() => setShowCasePicker(true)}
            className="w-28 h-28 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border hover:border-primary/60 rounded-xl transition-all text-muted-foreground hover:text-primary group"
          >
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide">Add Case</span>
          </button>
        </div>
      </div>

      {/* Case picker overlay */}
      {showCasePicker && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setShowCasePicker(false); setPendingCase(null); setPendingQty(1); }}
        >
          <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Select Case</h3>
              <button
                onClick={() => { setShowCasePicker(false); setPendingCase(null); setPendingQty(1); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category tabs */}
            <div className="p-3 border-b border-border grid grid-cols-3 gap-2">
              <button
                onClick={() => { setCaseCategory("original"); setCaseSearch(""); setPendingCase(null); setPendingQty(1); }}
                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border transition-all ${caseCategory === "original" ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"}`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-sm"><Lock className="w-3.5 h-3.5" /> Original</div>
                <div className="text-xs opacity-70 mt-0.5">CaseTopia cases</div>
              </button>
              <button
                onClick={() => { setCaseCategory("community"); setCaseSearch(""); setPendingCase(null); setPendingQty(1); }}
                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border transition-all ${caseCategory === "community" ? "border-green-500 bg-green-500/15 text-green-400" : "border-border bg-background/40 text-muted-foreground hover:border-green-500/40"}`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-sm"><Users className="w-3.5 h-3.5" /> Community</div>
                <div className="text-xs opacity-70 mt-0.5">Player-made</div>
              </button>
              <button
                onClick={() => { setCaseCategory("favourite"); setCaseSearch(""); setPendingCase(null); setPendingQty(1); }}
                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border transition-all ${caseCategory === "favourite" ? "border-yellow-400 bg-yellow-400/15 text-yellow-400" : "border-border bg-background/40 text-muted-foreground hover:border-yellow-400/40"}`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-sm"><Star className="w-3.5 h-3.5" /> Favourite</div>
                <div className="text-xs opacity-70 mt-0.5">Your starred</div>
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2.5 border-b border-border">
              <input
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
                placeholder={`Search ${caseCategory} cases...`}
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Case list */}
            <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
              {filteredCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {caseCategory === "favourite" ? "No favourited cases yet — star some from the Cases page" : "No cases found"}
                </div>
              ) : (
                filteredCases.map((c: any) => {
                  const isSelected = pendingCase?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setPendingCase(c); setPendingQty(1); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left border ${
                        isSelected
                          ? "border-primary bg-primary/15"
                          : "border-transparent hover:bg-primary/10"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-1.5">
                          {c.name}
                          {favouriteIds.has(String(c.id)) && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.items?.length ?? 0} items{c.createdByName ? ` · by ${c.createdByName}` : ""}</div>
                      </div>
                      <div className="text-primary font-mono text-sm font-bold flex items-center gap-1">{formatBalance(c.price ?? 0)} <GemIcon size={11} /></div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Staging footer — shown when a case is selected */}
            {pendingCase && (
              <div className="border-t border-border p-4 flex items-center gap-3 bg-background/60">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{pendingCase.name}</div>
                  <div className="text-xs text-primary flex items-center gap-1">
                    {formatBalance(pendingCase.price * pendingQty)} <GemIcon size={9} /> total
                  </div>
                </div>
                {/* Quantity controls */}
                <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-2 py-1">
                  <button
                    onClick={() => setPendingQty((q) => Math.max(1, q - 1))}
                    className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-bold text-lg leading-none"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{pendingQty}</span>
                  <button
                    onClick={() => setPendingQty((q) => Math.min(20, q + 1))}
                    className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-bold text-lg leading-none"
                  >
                    +
                  </button>
                </div>
                {/* Add button */}
                <button
                  onClick={() => {
                    const toAdd = Array(pendingQty).fill(String(pendingCase.id));
                    setSelectedCases((prev) => [...prev, ...toAdd]);
                    setShowCasePicker(false);
                    setCaseSearch("");
                    setPendingCase(null);
                    setPendingQty(1);
                  }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors flex-shrink-0"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Type section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CREATE_BATTLE_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setBattleType(type.value)}
              className={`p-4 rounded-xl border-2 flex flex-col gap-2 text-left transition-all ${
                battleType === type.value
                  ? type.border
                  : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <div className="font-bold text-sm">{type.label}</div>
              <div className="text-xs opacity-75 leading-snug">{type.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Format</h2>
        <div className="flex flex-wrap gap-2">
          {CREATE_GAME_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setGameMode(mode.value)}
              className={`px-4 py-2 rounded-lg border font-bold text-sm transition-all ${
                gameMode === mode.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {mode.label}
              <span className="block text-xs font-normal opacity-60">{mode.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Create button */}
      <div className="pt-2 flex items-center gap-4">
        <Button
          onClick={handleCreate}
          disabled={selectedCases.length === 0 || createPending || !user}
          className="bg-primary hover:bg-primary/90 font-bold px-8"
        >
          {createPending ? "Creating..." : isModifyMode ? "Create Modified Battle" : "Create Battle"}
        </Button>
        {!user && <span className="text-xs text-muted-foreground">You must be logged in</span>}
        {selectedCases.length === 0 && user && <span className="text-xs text-muted-foreground">Add at least one case</span>}
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
                "bg-primary/20 text-primary border-primary/40"
              }`}>
                {battle.battleType === "shared" ? "SHARED" : battle.battleType === "top_pull" ? "TOP PULL" : battle.battleType === "terminal" ? "TERMINAL" : battle.battleType.toUpperCase()}
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
