export interface CasinoGame {
  symbol: string;
  provider: "bgaming";
  name: string;
  volatility: "low" | "medium" | "high" | "very-high" | "variable";
  lines?: number;
  ways?: number;
  description: string;
  gradient: string;
  emoji: string;
}

export const CASINO_GAMES: CasinoGame[] = [
  {
    symbol: "elvis-frog-in-vegas",
    provider: "bgaming",
    name: "Elvis Frog in Vegas",
    volatility: "very-high",
    lines: 25,
    description: "Shake, rattle and roll with Elvis Frog! Neon Vegas vibes, 25 paylines, free spins with expanding symbols and a rockstar jackpot of up to 5,000x.",
    gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    emoji: "🐸",
  },
  {
    symbol: "book-of-cats",
    provider: "bgaming",
    name: "Book of Cats",
    volatility: "high",
    lines: 10,
    description: "Ancient Egypt meets feline mysticism. 10 paylines, expanding scatter symbol in Free Spins and wins up to 10,000x your bet.",
    gradient: "linear-gradient(135deg, #1a0533 0%, #6b21a8 60%, #c084fc 100%)",
    emoji: "🐱",
  },
  {
    symbol: "aztec-magic-deluxe",
    provider: "bgaming",
    name: "Aztec Magic Deluxe",
    volatility: "very-high",
    lines: 10,
    description: "The upgraded Aztec experience — same ancient reels with a Deluxe twist: higher multipliers, stacked wilds and monumental pays up to 10,000x.",
    gradient: "linear-gradient(135deg, #7c3c00 0%, #d4a017 60%, #ffe066 100%)",
    emoji: "🗿",
  },
  {
    symbol: "lucky-blue",
    provider: "bgaming",
    name: "Lucky Blue",
    volatility: "high",
    lines: 10,
    description: "Dive into oceanic fortune with Lucky Blue. 10 paylines, free spins with sticky wilds and shimmering underwater wins up to 10,000x.",
    gradient: "linear-gradient(135deg, #0077b6 0%, #00b4d8 50%, #90e0ef 100%)",
    emoji: "🐬",
  },
  {
    symbol: "wild-cash-x9999",
    provider: "bgaming",
    name: "Wild Cash x9999",
    volatility: "very-high",
    lines: 20,
    description: "Wild Cash is back with a turbo-charged x9999 top multiplier. Cash bag symbols, sticky wilds in Free Spins and explosive win potential.",
    gradient: "linear-gradient(135deg, #064e3b 0%, #10b981 60%, #a7f3d0 100%)",
    emoji: "💰",
  },
  {
    symbol: "candy-boom",
    provider: "bgaming",
    name: "Candy Boom",
    volatility: "medium",
    lines: 20,
    description: "A sugary explosion of color and wins! Candy Boom packs 20 paylines with cluster-style bonus rounds and cascading candy combos.",
    gradient: "linear-gradient(135deg, #be185d 0%, #ec4899 50%, #fbcfe8 100%)",
    emoji: "🍡",
  },
  {
    symbol: "aztec-magic",
    provider: "bgaming",
    name: "Aztec Magic",
    volatility: "high",
    lines: 10,
    description: "Uncover the Aztec treasures in this classic 5×3 slot. 10 paylines, expanding symbols and free spins with wins up to 10,000x.",
    gradient: "linear-gradient(135deg, #92400e 0%, #f59e0b 50%, #fde68a 100%)",
    emoji: "🌞",
  },
  {
    symbol: "book-of-lucky",
    provider: "bgaming",
    name: "Book of Lucky",
    volatility: "high",
    lines: 10,
    description: "The luck of the Irish shines in Book of Lucky — a classic book-style slot with 10 paylines, expanding symbols and free spins.",
    gradient: "linear-gradient(135deg, #14532d 0%, #22c55e 50%, #86efac 100%)",
    emoji: "🍀",
  },
  {
    symbol: "lucky-blue-x2",
    provider: "bgaming",
    name: "Lucky Blue X2",
    volatility: "very-high",
    lines: 10,
    description: "The oceanic sequel with doubled power — X2 multipliers on every spin turn the deep blue into a sea of massive wins.",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 50%, #93c5fd 100%)",
    emoji: "🌊",
  },
  {
    symbol: "dragon-pearls",
    provider: "bgaming",
    name: "Dragon Pearls",
    volatility: "medium",
    lines: 10,
    description: "Ancient Chinese mythology meets 5-reel slot action. Collect dragon pearls to unlock free spins and breathe fire into your balance.",
    gradient: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #fca5a5 100%)",
    emoji: "🐲",
  },
  {
    symbol: "wolf-treasure",
    provider: "bgaming",
    name: "Wolf Treasure",
    volatility: "high",
    lines: 25,
    description: "Hunt for riches under the northern sky. 25 paylines, moonlit free spins with wild multipliers and a howling jackpot potential.",
    gradient: "linear-gradient(135deg, #0f172a 0%, #334155 60%, #7dd3fc 100%)",
    emoji: "🐺",
  },
  {
    symbol: "hot-triple-sevens",
    provider: "bgaming",
    name: "Hot Triple Sevens",
    volatility: "high",
    lines: 5,
    description: "A retro fruit machine reborn — classic symbols, 5 paylines and triple 7 jackpot multipliers for fans of old-school slot action.",
    gradient: "linear-gradient(135deg, #7c0000 0%, #dc2626 50%, #fbbf24 100%)",
    emoji: "7️⃣",
  },
  {
    symbol: "aztec-clusters",
    provider: "bgaming",
    name: "Aztec Clusters",
    volatility: "very-high",
    ways: 65536,
    description: "Cluster pays meets Aztec gold — 65,536 ways to win on a 8×8 grid with cascading wins, multipliers and monumental jackpots.",
    gradient: "linear-gradient(135deg, #451a03 0%, #b45309 50%, #fde68a 100%)",
    emoji: "🏺",
  },
  {
    symbol: "penalty-shoot-out",
    provider: "bgaming",
    name: "Penalty Shoot-Out",
    volatility: "variable",
    description: "Step up to the spot and pick your corner! An instant win penalty kick game where each shot decides your multiplier win.",
    gradient: "linear-gradient(135deg, #14532d 0%, #166534 50%, #4ade80 100%)",
    emoji: "⚽",
  },
];

export function getGameBySymbol(symbol: string): CasinoGame | undefined {
  return CASINO_GAMES.find(g => g.symbol === symbol);
}

export function getDemoUrl(game: CasinoGame): string {
  if (game.provider === "bgaming") {
    return `https://demo.bgaming.com/games/${game.symbol}?currency=USD`;
  }
  return "";
}

export function getVolatilityColor(v: string): string {
  switch (v) {
    case "low": return "text-green-400 bg-green-400/10";
    case "medium": return "text-yellow-400 bg-yellow-400/10";
    case "high": return "text-orange-400 bg-orange-400/10";
    case "very-high": return "text-red-400 bg-red-400/10";
    case "variable": return "text-blue-400 bg-blue-400/10";
    default: return "text-muted-foreground bg-muted";
  }
}
