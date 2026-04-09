import React from "react";

interface TierChestIconProps {
  color: string;
  tier: number;
  size?: number;
}

export function TierChestIcon({ color, tier, size = 96 }: TierChestIconProps) {
  const id = `ct${tier}`;
  const isRainbow = tier === 15;
  const tc = isRainbow ? "rainbow-chest-tint" : undefined;

  // Base dark wood that gets tinted by the tier color
  const baseDark  = "#0C0806";
  const baseMid   = "#18100A";
  const goldLight = "#E8C850";
  const goldMid   = "#C8A030";
  const goldDark  = "#8A6A18";
  const ironDark  = "#1A1410";

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* ── Tier-color tinted wood gradients ── */}
        <linearGradient id={`${id}-fg`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={baseMid} />
          <stop offset="100%" stopColor={baseDark} />
        </linearGradient>
        <linearGradient id={`${id}-lg`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={baseMid} />
          <stop offset="100%" stopColor={baseDark} />
        </linearGradient>
        <linearGradient id={`${id}-band`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={goldLight} />
          <stop offset="50%"  stopColor={goldMid} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
        <linearGradient id={`${id}-lock`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#EDD060" />
          <stop offset="100%" stopColor="#A07820" />
        </linearGradient>
        {/* Clip text to lid face */}
        <clipPath id={`${id}-lc`}>
          <polygon points="22,51 86,51 82,21 18,21" />
        </clipPath>
        <filter id={`${id}-gl`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id={`${id}-sg`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── GROUND SHADOW ── */}
      <ellipse cx="50" cy="97" rx="36" ry="4" fill="#000" opacity="0.28" />

      {/* ── INTERIOR ── */}
      <polygon points="8,58 72,58 88,50 24,50" fill={baseDark} />
      <polygon points="8,58 72,58 88,50 24,50" fill={color} opacity="0.25" className={tc} />
      <ellipse cx="48" cy="54" rx="27" ry="6" fill={color} opacity="0.6"
        filter={`url(#${id}-gl)`} className={tc} />

      {/* ── RIGHT SIDE ── */}
      {/* base wood */}
      <polygon points="72,58 88,50 88,83 72,91" fill={baseDark} />
      {/* tier color tint (darkest side, less color) */}
      <polygon points="72,58 88,50 88,83 72,91" fill={color} opacity="0.22" className={tc} />
      {/* plank lines */}
      <polygon points="72,65 88,57 88,59 72,67" fill="#000" opacity="0.30" />
      <polygon points="72,73 88,65 88,67 72,75" fill="#000" opacity="0.30" />
      <polygon points="72,81 88,73 88,75 72,83" fill="#000" opacity="0.30" />
      {/* right-side band */}
      <polygon points="72,69 88,61 88,65 72,73" fill={`url(#${id}-band)`} opacity="0.75" />
      <polygon points="72,69 88,61 88,62" fill="#fff" opacity="0.15" />
      {/* corner iron */}
      <polygon points="72,58 80,54 80,60 72,64" fill={ironDark} />
      <polygon points="72,84 80,80 80,86 72,90" fill={ironDark} />
      <line x1="72" y1="58" x2="72" y2="91" stroke="#fff" strokeWidth="0.5" opacity="0.10" />

      {/* ── FRONT FACE ── */}
      {/* base dark wood */}
      <polygon points="8,58 72,58 72,91 8,91" fill={`url(#${id}-fg)`} />
      {/* tier color overlay (brightest face) */}
      <polygon points="8,58 72,58 72,91 8,91" fill={color} opacity="0.45" className={tc} />
      {/* plank separation lines */}
      {([63.5,69.2,75.0,80.8,86.5] as number[]).map((y,i) => (
        <rect key={i} x="8" y={y} width="64" height="1.2" fill="#000" opacity="0.22" />
      ))}
      {/* plank sheen highlights */}
      {([60.5,66.0,71.8,77.5,83.2] as number[]).map((y,i) => (
        <rect key={i} x="8" y={y} width="64" height="0.5" fill="#fff" opacity="0.07" />
      ))}
      {/* left-edge light */}
      <polygon points="8,58 13,58 13,91 8,91" fill="#fff" opacity="0.11" />
      {/* top bevel */}
      <rect x="8" y="58" width="64" height="2" fill="#fff" opacity="0.13" />
      {/* bottom shadow */}
      <rect x="8" y="89" width="64" height="2" fill="#000" opacity="0.18" />

      {/* Front metal band */}
      <rect x="8"  y="70" width="64" height="6"   fill={`url(#${id}-band)`} />
      <rect x="8"  y="70" width="64" height="1.5" fill="#fff" opacity="0.20" />
      <rect x="8"  y="74.5" width="64" height="1.5" fill="#000" opacity="0.22" />
      {([13,21,30,40,50,59,67] as number[]).map((x,i) => (
        <g key={i}>
          <circle cx={x} cy="73" r="1.7" fill={goldDark} />
          <circle cx={x} cy="73" r="1.0" fill={goldLight} opacity="0.85" />
        </g>
      ))}

      {/* Corner iron brackets — front */}
      {([[8,58],[65,58],[8,84],[65,84]] as [number,number][]).map(([bx,by],i) => (
        <g key={i}>
          <rect x={bx} y={by} width="7" height="7" fill={ironDark} />
          <rect x={bx} y={by} width="7" height="1.5" fill="#fff" opacity="0.16" />
          <rect x={bx} y={by} width="1.5" height="7" fill="#fff" opacity="0.10" />
        </g>
      ))}

      {/* ── LOCK ── */}
      <rect x="32" y="60" width="20" height="15" rx="2.5" fill={`url(#${id}-lock)`} />
      <rect x="33.5" y="61.5" width="17" height="12" rx="2" fill={goldLight} opacity="0.35" />
      <rect x="32" y="73" width="20" height="2" rx="1" fill="#000" opacity="0.22" />
      {/* shackle */}
      <path d="M37.5,60.5 Q42,53 46.5,60.5"
        fill="none" stroke={`url(#${id}-lock)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M37.5,60.5 Q42,53 46.5,60.5"
        fill="none" stroke={goldLight} strokeWidth="1" strokeLinecap="round" opacity="0.45" />
      {/* keyhole */}
      <circle cx="42" cy="67" r="2.8" fill="#1A0E02" />
      <circle cx="42" cy="65.8" r="1.6" fill="#0E0801" />
      <polygon points="40.8,67.5 43.2,67.5 42.9,72 41.1,72" fill="#1A0E02" />

      {/* ── LID OUTER FRAME ── */}
      <polygon points="22,51 88,51 88,54 22,54" fill="#0A0604" opacity="0.65" />
      {/* lid right face */}
      <polygon points="88,51 92,48 88,18 84,21" fill={baseDark} />
      <polygon points="88,51 92,48 88,18 84,21" fill={color} opacity="0.18" className={tc} />
      <polygon points="88,36 92,33 92,35 88,38" fill="#000" opacity="0.22" />
      {/* lid outer shell */}
      <polygon points="18,52 88,52 84,19 14,19" fill={baseDark} />

      {/* ── LID INNER FACE ── */}
      <polygon points="22,51 86,51 82,22 18,22" fill={`url(#${id}-lg)`} />
      {/* tier color overlay on lid (mid brightness) */}
      <polygon points="22,51 86,51 82,22 18,22" fill={color} opacity="0.40" className={tc} />
      {/* plank lines */}
      {([44,38,32,27] as number[]).map((y,i) => (
        <polygon key={i}
          points={`18,${y} 86,${y-0.5} 86,${y+1.2} 18,${y+1.2}`}
          fill="#000" opacity="0.20"
        />
      ))}
      {/* left-edge highlight */}
      <polygon points="18,22 23,22 27,51 22,51" fill="#fff" opacity="0.11" />
      {/* top bevel */}
      <polygon points="18,22 82,22 82,24 18,24" fill="#fff" opacity="0.16" />

      {/* Text plaque — full-width band across the lid at text height */}
      {/* Lid left edge at y=33: ~19.4, at y=40: ~19.97 ≈ 19-20 */}
      {/* Lid right edge at y=33: ~83.6, at y=40: ~84.97 ≈ 84-85 */}
      <polygon points="18,33 84,33 85,40 17,40" fill={`url(#${id}-band)`} opacity="0.95" />
      <polygon points="18,33 84,33 84,34.5 18,34.5" fill="#fff" opacity="0.22" />
      <polygon points="18,38.5 84,38.5 85,40 17,40" fill="#000" opacity="0.20" />
      {/* rivets */}
      <circle cx="23" cy="36.5" r="1.6" fill={goldLight} opacity="0.85" />
      <circle cx="79" cy="36.5" r="1.6" fill={goldLight} opacity="0.85" />

      {/* Hinges */}
      {([28,74] as number[]).map((x,i) => (
        <g key={i}>
          <rect x={x} y="47" width="11" height="7" rx="1.5" fill={`url(#${id}-lock)`} />
          <rect x={x} y="47" width="11" height="2" rx="1" fill={goldLight} opacity="0.40" />
          <rect x={x} y="52" width="11" height="2" rx="1" fill="#000" opacity="0.20" />
        </g>
      ))}

      {/* ── TEXT on lid (clipped + perspective-squished) ── */}
      <g clipPath={`url(#${id}-lc)`}>
        {/* drop shadow copy */}
        <g transform="translate(53,37.5) rotate(-2) scale(1,0.70)">
          <text x="1" y="1" textAnchor="middle" dominantBaseline="middle"
            fontFamily="'Chango', cursive" fontSize="8" letterSpacing="0.1"
            fill="#000" opacity="0.55">CaseTopia</text>
        </g>
        {/* main text */}
        <g transform="translate(53,36.5) rotate(-2) scale(1,0.70)">
          <text x="0" y="0" textAnchor="middle" dominantBaseline="middle"
            fontFamily="'Chango', cursive" fontSize="8" letterSpacing="0.1">
            <tspan fill="#ffffff">Case</tspan>
            <tspan fill={color} className={tc}>Topia</tspan>
          </text>
        </g>
      </g>

      {/* ── OPENING GLOW ── */}
      <ellipse cx="50" cy="52.5" rx="30" ry="4.5"
        fill={color} opacity="0.65" filter={`url(#${id}-sg)`} className={tc} />
    </svg>
  );
}
