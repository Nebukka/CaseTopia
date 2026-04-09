import { Link } from "wouter";
import caseBattleSrc from "@assets/casebattle_1775523643333.png";
import treasureChestSrc from "@assets/treasure_chest_1775523748232.webp";

type Game = "crash" | "limbo" | "mines" | "tower" | "cases" | "battles";

interface GameDef {
  id: Game;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const GAMES: GameDef[] = [
  {
    id: "battles",
    label: "Case Battles",
    path: "/battles",
    icon: (
      <img
        src={caseBattleSrc}
        alt="Case Battles"
        className="w-full h-full object-contain"
        style={{ mixBlendMode: "screen" }}
      />
    ),
  },
  {
    id: "cases",
    label: "Cases",
    path: "/cases",
    icon: (
      <img
        src={treasureChestSrc}
        alt="Cases"
        className="w-full h-full object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    ),
  },
  {
    id: "crash",
    label: "Crash",
    path: "/crash",
    icon: (
      <svg viewBox="0 0 100 60" className="w-full h-full" fill="none">
        <polyline
          points="0,55 20,45 40,30 55,35 65,10 80,5 100,2"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="55" y="28" fill="currentColor" fontSize="13" fontWeight="bold" fontFamily="monospace">
          1000x
        </text>
      </svg>
    ),
  },
  {
    id: "limbo",
    label: "Limbo",
    path: "/limbo",
    icon: (
      <div className="flex flex-col items-center justify-center leading-none">
        <div className="text-3xl font-black font-mono">700x</div>
        <div className="text-[10px] font-bold mt-0.5 tracking-widest">TARGET</div>
      </div>
    ),
  },
  {
    id: "mines",
    label: "Mines",
    path: "/mines",
    icon: (
      <div className="grid grid-cols-5 gap-0.5 w-full">
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded-[2px] ${
              [2, 8, 12, 18, 22].includes(i) ? "bg-primary" : "bg-current"
            }`}
          />
        ))}
      </div>
    ),
  },
  {
    id: "tower",
    label: "Tower",
    path: "/tower",
    icon: (
      <div className="grid grid-cols-3 gap-1 w-3/4">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded-[3px] ${
              [9, 10, 11].includes(i) ? "bg-primary" : "bg-current"
            }`}
          />
        ))}
      </div>
    ),
  },
];

export function TrySomethingElse({ current }: { current: Game }) {
  const others = GAMES.filter((g) => g.id !== current);
  return (
    <div className="mt-8 px-4 pb-8">
      <p className="text-sm font-semibold text-muted-foreground mb-4 text-center tracking-wide uppercase">
        Try something else?
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        {others.map((game) => (
          <Link key={game.id} href={game.path}>
            <div className="group relative w-32 aspect-[4/3] rounded-xl overflow-hidden border border-border hover:border-primary transition-all cursor-pointer bg-card">
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
              <div className="absolute inset-0 flex items-center justify-center z-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity text-foreground">
                {game.icon}
              </div>
              <div className="absolute bottom-2 left-3 z-20">
                <span className="text-sm font-bold group-hover:text-primary transition-colors">
                  {game.label}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
