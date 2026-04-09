import { useCurrency } from "../contexts/CurrencyContext";

interface GemIconProps {
  className?: string;
  size?: number;
}

export function GemIcon({ className = "", size = 16 }: GemIconProps) {
  const { iconSrc, label } = useCurrency();
  return (
    <img
      src={iconSrc}
      alt={label}
      width={size}
      height={size}
      className={`inline-block object-contain align-middle flex-shrink-0 ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
