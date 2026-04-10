import crypto from "crypto";
import { db, providerGamesTable, importJobsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const PP_SECRET_KEY  = process.env.PP_SECRET_KEY  || "";
const PP_PROVIDER_ID = process.env.PP_PROVIDER_ID || "";
const PP_GAME_SERVER = process.env.PP_GAME_SERVER  || "gs2c.pragmaticplaylive.net";

// ── Static catalog (always available, no API key needed) ──────────────────────
interface CatalogGame {
  symbol: string;
  name: string;
  volatility: string;
  lines?: number;
  ways?: number;
  description: string;
}

const STATIC_CATALOG: CatalogGame[] = [
  { symbol: "vs20fruitsw",       name: "Sweet Bonanza",              volatility: "high",      lines: 20,     description: "Load up on sugar in Sweet Bonanza, the 6×5, pays anywhere, tumbling videoslot." },
  { symbol: "vs20sbn1000",       name: "Sweet Bonanza 1000",         volatility: "very-high", ways: 20736,   description: "Super-charged Sweet Bonanza with max win of up to 25,000x and 1000x multiplier bombs." },
  { symbol: "vs20olympgate",     name: "Gates of Olympus",           volatility: "very-high", ways: 20736,   description: "Summon the power of Zeus in Gates of Olympus, a cluster pays tumbling slot." },
  { symbol: "vs20olympgate1000", name: "Gates of Olympus 1000",      volatility: "very-high", ways: 20736,   description: "The ultimate Gates of Olympus experience, featuring 1000x multipliers." },
  { symbol: "vs9doghouse",       name: "The Dog House",              volatility: "high",      lines: 20,     description: "Join the gang in Dog House, the 5×3, 20 lines videoslot with stacked WILDS." },
  { symbol: "vs9dogswaysx",      name: "The Dog House Megaways",     volatility: "very-high", ways: 117649,  description: "The iconic Dog House with up to 117,649 Megaways and sticky wilds with multipliers." },
  { symbol: "vs10bbb",           name: "Big Bass Bonanza",           volatility: "high",      lines: 10,     description: "Reel up the biggest wins in Big Bass Bonanza with the Fisherman WILD." },
  { symbol: "vs12bbb",           name: "Bigger Bass Bonanza",        volatility: "very-high", lines: 12,     description: "Cast your net for a colossal catch in Bigger Bass Bonanza." },
  { symbol: "vswaystbbb",        name: "Big Bass Bonanza Megaways",  volatility: "very-high", ways: 46656,   description: "Big Bass Bonanza with Megaways and Fishing Free Spins stacked with Wilds." },
  { symbol: "vs20starlight",     name: "Starlight Princess",         volatility: "very-high", ways: 4096,    description: "Journey into the magical realm of the Starlight Princess with multiplier wilds." },
  { symbol: "vs20starlight1000", name: "Starlight Princess 1000",    volatility: "very-high", ways: 4096,    description: "Starlight Princess with turbo-charged 1000x multipliers for wins up to 50,000x." },
  { symbol: "vs20wildwest",      name: "Wild West Gold",             volatility: "high",      lines: 40,     description: "Ride to riches in Wild West Gold with 4×5, 40 lines and Wild multipliers up to 5x." },
  { symbol: "vs20sugarrush",     name: "Sugar Rush",                 volatility: "low",       lines: 20,     description: "Get your sweet tooth ready in Sugar Rush with cluster pays and cascades." },
  { symbol: "vs20sugarrush1000", name: "Sugar Rush 1000",            volatility: "very-high", lines: 20,     description: "Sugar Rush with 1000x multipliers turning sweet spins into astronomical wins." },
  { symbol: "vs20fruitparty",    name: "Fruit Party",                volatility: "very-high", lines: 20,     description: "Mix up juicy wins in Fruit Party, the cluster pay videoslot." },
  { symbol: "vs20fruitparty2",   name: "Fruit Party 2",              volatility: "very-high", lines: 20,     description: "The party continues in Fruit Party 2 with bigger clusters and explosive potential." },
  { symbol: "vswaysftitans",     name: "Power of Thor Megaways",     volatility: "very-high", ways: 117649,  description: "Prove yourself worthy in Power of Thor Megaways, 117,649 ways to win." },
];

// ── PP API helper ─────────────────────────────────────────────────────────────
function ppHash(params: Record<string, string | number>): string {
  const sorted = Object.keys(params).sort();
  const str = sorted.map(k => `${k}=${params[k]}`).join("&") + PP_SECRET_KEY;
  return crypto.createHash("md5").update(str).digest("hex");
}

interface PPGameEntry {
  gameID: string;
  gameName: string;
  typeDescription: string;
  hasDemo: string;
}

async function fetchPPGameList(): Promise<PPGameEntry[]> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = { providerId: PP_PROVIDER_ID, timestamp };
  const hash = ppHash(params);

  const body = new URLSearchParams({
    ...params,
    hash,
  });

  const url = `https://${PP_GAME_SERVER}/IntegrationService/v3/http/CasinoGameAPI/getCasinoGames`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`PP API error: ${res.status} ${res.statusText}`);
  const data = await res.json() as { error: string; description?: string; gameList?: PPGameEntry[] };
  if (data.error !== "0") throw new Error(`PP API returned error: ${data.description || data.error}`);
  return data.gameList || [];
}

// ── Importer ─────────────────────────────────────────────────────────────────
export interface ImportResult {
  provider: string;
  source: "api" | "catalog";
  imported: number;
  updated: number;
  error?: string;
}

async function upsertGame(game: {
  symbol: string;
  provider: string;
  name: string;
  gameType: string;
  volatility?: string | null;
  lines?: number | null;
  ways?: number | null;
  description?: string | null;
  demoAvailable: boolean;
}) {
  const existing = await db
    .select({ id: providerGamesTable.id })
    .from(providerGamesTable)
    .where(and(eq(providerGamesTable.symbol, game.symbol), eq(providerGamesTable.provider, game.provider)))
    .limit(1);

  if (existing.length) {
    await db
      .update(providerGamesTable)
      .set({ ...game, updatedAt: new Date() })
      .where(eq(providerGamesTable.id, existing[0].id));
    return "updated";
  } else {
    await db.insert(providerGamesTable).values({ ...game, importedAt: new Date(), updatedAt: new Date() });
    return "inserted";
  }
}

export async function runPPImport(): Promise<ImportResult> {
  const result: ImportResult = { provider: "pragmaticplay", source: "catalog", imported: 0, updated: 0 };

  // Try live PP API first if credentials are present
  if (PP_PROVIDER_ID && PP_SECRET_KEY) {
    try {
      const games = await fetchPPGameList();
      result.source = "api";

      // Build lookup from static catalog for enrichment
      const enrichment = new Map(STATIC_CATALOG.map(g => [g.symbol, g]));

      for (const g of games) {
        const enrich = enrichment.get(g.gameID);
        const op = await upsertGame({
          symbol: g.gameID,
          provider: "pragmaticplay",
          name: g.gameName,
          gameType: g.typeDescription?.toLowerCase().includes("live") ? "live" : "slot",
          volatility: enrich?.volatility ?? null,
          lines: enrich?.lines ?? null,
          ways: enrich?.ways ?? null,
          description: enrich?.description ?? null,
          demoAvailable: g.hasDemo === "1",
        });
        if (op === "inserted") result.imported++;
        else result.updated++;
      }
      return result;
    } catch (err: any) {
      result.error = `PP API failed (${err.message}), falling back to static catalog`;
    }
  }

  // Fallback: seed from static catalog
  result.source = "catalog";
  for (const g of STATIC_CATALOG) {
    const op = await upsertGame({
      symbol: g.symbol,
      provider: "pragmaticplay",
      name: g.name,
      gameType: "slot",
      volatility: g.volatility,
      lines: g.lines ?? null,
      ways: g.ways ?? null,
      description: g.description,
      demoAvailable: true,
    });
    if (op === "inserted") result.imported++;
    else result.updated++;
  }
  return result;
}

// ── Job runner (records to DB) ────────────────────────────────────────────────
export async function runImportJob(provider: string = "pragmaticplay"): Promise<ImportResult> {
  const [job] = await db
    .insert(importJobsTable)
    .values({ provider, status: "running", startedAt: new Date() })
    .returning();

  let result: ImportResult;
  try {
    if (provider === "pragmaticplay") {
      result = await runPPImport();
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
    await db
      .update(importJobsTable)
      .set({ status: "done", gamesImported: result.imported, gamesUpdated: result.updated, finishedAt: new Date() })
      .where(eq(importJobsTable.id, job.id));
  } catch (err: any) {
    result = { provider, source: "catalog", imported: 0, updated: 0, error: err.message };
    await db
      .update(importJobsTable)
      .set({ status: "failed", error: err.message, finishedAt: new Date() })
      .where(eq(importJobsTable.id, job.id));
  }
  return result;
}
