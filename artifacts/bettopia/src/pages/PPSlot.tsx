import React from "react";
import { Link } from "wouter";
import { Layout } from "../components/Layout";
import { getGameBySymbol, getDemoUrl, getVolatilityColor } from "../data/casinoGames";

interface SlotGameProps {
  params: { symbol: string };
}

export default function SlotGame({ params }: SlotGameProps) {
  const { symbol } = params;
  const game = getGameBySymbol(symbol);
  const demoUrl = game ? getDemoUrl(game) : "";

  const volColor = game ? getVolatilityColor(game.volatility) : "";

  if (!game) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-60 gap-3">
          <p className="text-muted-foreground">Game not found: {symbol}</p>
          <Link href="/slots">
            <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold">Back to Slots</button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-col gap-1">
            <Link href="/slots">
              <span className="text-muted-foreground hover:text-foreground text-sm cursor-pointer">← All Slots</span>
            </Link>
            <h1 className="text-2xl font-bold">{game.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>BGaming · Slot</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${volColor}`}>
                {game.volatility.replace("-", " ")} volatility
              </span>
              {game.ways && <span>{game.ways.toLocaleString()} ways</span>}
              {game.lines && <span>{game.lines} lines</span>}
              <span className="text-yellow-400">Demo</span>
            </div>
          </div>
        </div>

        <div
          className="w-full rounded-xl overflow-hidden border border-border bg-black"
          style={{ height: "calc(100vh - 210px)", minHeight: 520 }}
        >
          {demoUrl ? (
            <iframe
              key={demoUrl}
              src={demoUrl}
              title={game.name}
              className="w-full h-full"
              allow="fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Demo not available
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
