export function getTierColor(level: number): string {
  if (level >= 150) return "#ffffff";
  if (level >= 140) return "#f9a8d4";
  if (level >= 130) return "#fde68a";
  if (level >= 120) return "#67e8f9";
  if (level >= 110) return "#c084fc";
  if (level >= 100) return "#e11d48";
  if (level >= 90)  return "#f87171";
  if (level >= 80)  return "#fbbf24";
  if (level >= 70)  return "#fb923c";
  if (level >= 60)  return "#f472b6";
  if (level >= 50)  return "#a78bfa";
  if (level >= 40)  return "#60a5fa";
  if (level >= 30)  return "#22d3ee";
  if (level >= 20)  return "#4ade80";
  if (level >= 10)  return "#94a3b8";
  return "#374151";
}
