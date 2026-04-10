import React, { useState } from "react";
import { Link } from "wouter";
import { Layout } from "../components/Layout";
import { CASINO_GAMES, getVolatilityColor } from "../data/casinoGames";

export default function SlotsLobby() {
  const [filter, setFilter] = useState<"all" | "high" | "very-high" | "low" | "medium" | "variable">("all");

  const filtered = filter === "all"
    ? CASINO_GAMES
    : CASINO_GAMES.filter(g => g.volatility === filter);

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Slots</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {CASINO_GAMES.length} games · BGaming
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "low", "medium", "high", "very-high", "variable"] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                  filter === v
                    ? "bg-primary text-white border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {v === "all" ? "All" : v.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(game => (
            <Link key={game.symbol} href={`/slots/${game.symbol}`}>
              <div
                className="group relative aspect-[3/4] rounded-xl overflow-hidden border border-border hover:border-primary transition-all cursor-pointer"
                style={{ background: game.gradient }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-50 group-hover:opacity-70 transition-opacity select-none">
                  <span className="text-5xl">{game.emoji}</span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

                <div className="absolute top-2 right-2 z-20">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${getVolatilityColor(game.volatility)}`}>
                    {game.volatility === "very-high" ? "Very High" : game.volatility.charAt(0).toUpperCase() + game.volatility.slice(1)}
                  </span>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                  <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{game.name}</h3>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    {game.ways ? `${game.ways.toLocaleString()} ways` : game.lines ? `${game.lines} lines` : "Instant Win"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
