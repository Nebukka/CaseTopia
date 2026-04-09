// Wager thresholds anchored at every 10th level.
// Intermediate levels are linearly interpolated between milestones.

const MILESTONES: [number, number][] = [
  [1,   0],
  [10,  1_000],
  [20,  6_000],
  [30,  20_000],
  [40,  50_000],
  [50,  100_000],
  [60,  200_000],
  [70,  350_000],
  [80,  500_000],
  [90,  700_000],
  [100, 1_000_000],
  [110, 1_500_000],
  [120, 2_500_000],
  [130, 5_000_000],
  [140, 7_500_000],
  [150, 10_000_000],
];

function computeThreshold(level: number): number {
  for (let i = 0; i < MILESTONES.length - 1; i++) {
    const [l0, w0] = MILESTONES[i];
    const [l1, w1] = MILESTONES[i + 1];
    if (level >= l0 && level <= l1) {
      const t = (level - l0) / (l1 - l0);
      return Math.floor(w0 + t * (w1 - w0));
    }
  }
  return 10_000_000;
}

export const LEVEL_THRESHOLDS: number[] = [
  0, // level 0 placeholder
  ...Array.from({ length: 150 }, (_, i) => computeThreshold(i + 1)),
];

export function getLevelForWagered(totalWagered: number): number {
  let level = 1;
  for (let i = 1; i <= 150; i++) {
    if (totalWagered >= LEVEL_THRESHOLDS[i]) level = i;
    else break;
  }
  return Math.min(level, 150);
}

export function getProgressPercent(totalWagered: number, level: number): number {
  if (level >= 150) return 100;
  const current = LEVEL_THRESHOLDS[level];
  const next = LEVEL_THRESHOLDS[level + 1];
  if (!next || next <= current) return 100;
  return Math.min(100, Math.floor(((totalWagered - current) / (next - current)) * 100));
}

export interface TierInfo {
  tier: number;
  requiredLevel: number;
  label: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  dailyMin: number;
  dailyMax: number;
  linkedCaseName?: string;
}

export const TIERS: TierInfo[] = [
  { tier: 1,  requiredLevel: 10,  label: "Tier 1",  color: "#94a3b8", gradientFrom: "#334155", gradientTo: "#475569", dailyMin: 1,       dailyMax: 5,       linkedCaseName: "Tier 1" },
  { tier: 2,  requiredLevel: 20,  label: "Tier 2",  color: "#4ade80", gradientFrom: "#14532d", gradientTo: "#166534", dailyMin: 3,       dailyMax: 12,      linkedCaseName: "Tier 2" },
  { tier: 3,  requiredLevel: 30,  label: "Tier 3",  color: "#22d3ee", gradientFrom: "#164e63", gradientTo: "#155e75", dailyMin: 8,       dailyMax: 30,      linkedCaseName: "Tier 3" },
  { tier: 4,  requiredLevel: 40,  label: "Tier 4",  color: "#60a5fa", gradientFrom: "#1e3a8a", gradientTo: "#1e40af", dailyMin: 20,      dailyMax: 75,      linkedCaseName: "Tier 4" },
  { tier: 5,  requiredLevel: 50,  label: "Tier 5",  color: "#a78bfa", gradientFrom: "#3b0764", gradientTo: "#4c1d95", dailyMin: 50,      dailyMax: 200      },
  { tier: 6,  requiredLevel: 60,  label: "Tier 6",  color: "#f472b6", gradientFrom: "#500724", gradientTo: "#831843", dailyMin: 120,     dailyMax: 500      },
  { tier: 7,  requiredLevel: 70,  label: "Tier 7",  color: "#fb923c", gradientFrom: "#431407", gradientTo: "#7c2d12", dailyMin: 300,     dailyMax: 1200     },
  { tier: 8,  requiredLevel: 80,  label: "Tier 8",  color: "#fbbf24", gradientFrom: "#451a03", gradientTo: "#78350f", dailyMin: 750,     dailyMax: 3000     },
  { tier: 9,  requiredLevel: 90,  label: "Tier 9",  color: "#f87171", gradientFrom: "#450a0a", gradientTo: "#7f1d1d", dailyMin: 2000,    dailyMax: 8000     },
  { tier: 10, requiredLevel: 100, label: "Tier 10", color: "#e11d48", gradientFrom: "#4c0519", gradientTo: "#881337", dailyMin: 5000,    dailyMax: 20000    },
  { tier: 11, requiredLevel: 110, label: "Tier 11", color: "#c084fc", gradientFrom: "#2e1065", gradientTo: "#3b0764", dailyMin: 12000,   dailyMax: 50000    },
  { tier: 12, requiredLevel: 120, label: "Tier 12", color: "#67e8f9", gradientFrom: "#083344", gradientTo: "#164e63", dailyMin: 30000,   dailyMax: 120000   },
  { tier: 13, requiredLevel: 130, label: "Tier 13", color: "#fde68a", gradientFrom: "#422006", gradientTo: "#713f12", dailyMin: 75000,   dailyMax: 300000   },
  { tier: 14, requiredLevel: 140, label: "Tier 14", color: "#f9a8d4", gradientFrom: "#4a044e", gradientTo: "#6b21a8", dailyMin: 200000,  dailyMax: 800000   },
  { tier: 15, requiredLevel: 150, label: "Tier 15", color: "#ffffff", gradientFrom: "#0f0f1a", gradientTo: "#1e1e3a", dailyMin: 500000,  dailyMax: 2000000  },
];

export function getTierForLevel(level: number): TierInfo | null {
  const tiers = TIERS.filter((t) => level >= t.requiredLevel);
  return tiers.length ? tiers[tiers.length - 1] : null;
}

export function getUnlockedTiers(level: number): TierInfo[] {
  return TIERS.filter((t) => level >= t.requiredLevel);
}

// ── Monthly Rakeback ─────────────────────────────────────────────────────────
// Tiered rakeback based on monthly wagered volume.
// Percentage is applied to the player's net losses for the month.

export interface RakebackTier {
  label: string;
  minWagered: number;
  percent: number;
  color: string;
}

export const RAKEBACK_TIERS: RakebackTier[] = [
  { label: "None",     minWagered: 0,         percent: 0,  color: "#4b5563" },
  { label: "Bronze",   minWagered: 1_000,     percent: 5,  color: "#cd7f32" },
  { label: "Silver",   minWagered: 10_000,    percent: 10, color: "#94a3b8" },
  { label: "Gold",     minWagered: 50_000,    percent: 15, color: "#eab308" },
  { label: "Platinum", minWagered: 200_000,   percent: 20, color: "#67e8f9" },
  { label: "Diamond",  minWagered: 1_000_000, percent: 25, color: "#a855f7" },
];

export function getRakebackTier(monthlyWagered: number): RakebackTier {
  const matching = RAKEBACK_TIERS.filter((t) => monthlyWagered >= t.minWagered);
  return matching[matching.length - 1] ?? RAKEBACK_TIERS[0];
}

export function getNextRakebackTier(monthlyWagered: number): RakebackTier | null {
  return RAKEBACK_TIERS.find((t) => t.minWagered > monthlyWagered) ?? null;
}

// Instant rakeback: 5% at tiers 0-1, +1% per tier from tier 2, max 10% at tier 6+
// Game tier = floor(level / 10)
export function getInstantRakebackPercent(level: number): number {
  const gameTier = Math.floor(level / 10);
  if (gameTier <= 1) return 5;
  return Math.min(10, 5 + (gameTier - 1));
}

// House edge per game type (%)
export const HOUSE_EDGE: Record<string, number> = {
  crash: 1,
  limbo: 1,
  mines: 4,
  tower: 4,
  cases: 6,
};

export function canClaimMonthlyRakeback(lastClaim: Date | null): boolean {
  if (!lastClaim) return true;
  const now = new Date();
  return (
    lastClaim.getMonth() !== now.getMonth() ||
    lastClaim.getFullYear() !== now.getFullYear()
  );
}

// Legacy shims — kept for any code that still imports these
export function getRakebackPercent(totalLoss: number): number {
  return totalLoss >= 1 ? 10 : 0;
}
export function getRakebackLabel(totalLoss: number): string {
  return totalLoss >= 1 ? "10% Rakeback" : "No Rakeback";
}
