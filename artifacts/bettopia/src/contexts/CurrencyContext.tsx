import React, { createContext, useContext, useState, useCallback } from "react";
import wlSrc from "@assets/world_lock_1775531433328.webp";
import bglSrc from "@assets/blue_gem_lock_1775531441876.webp";
import dlSrc from "@assets/dl_1775514218033.webp";

export type Currency = "dl" | "wl" | "bgl";

const CYCLE: Currency[] = ["dl", "wl", "bgl"];

// 1 DL = 100 WL,  1 BGL = 100 DL
const DL_PER_UNIT: Record<Currency, number> = {
  dl:  1,
  wl:  1 / 100,   // 1 WL = 0.01 DL
  bgl: 100,        // 1 BGL = 100 DL
};

const DISPLAY_PER_DL: Record<Currency, number> = {
  dl:  1,
  wl:  100,        // 1 DL = 100 WL
  bgl: 1 / 100,    // 1 DL = 0.01 BGL
};

export const CURRENCY_ICON: Record<Currency, string> = {
  dl:  dlSrc,
  wl:  wlSrc,
  bgl: bglSrc,
};

export const CURRENCY_LABEL: Record<Currency, string> = {
  dl:  "DL",
  wl:  "WL",
  bgl: "BGL",
};

interface CurrencyContextValue {
  currency: Currency;
  cycleCurrency: () => void;
  /** Convert a DL amount to the display currency */
  dlToDisplay: (dl: number) => number;
  /** Convert a display-currency amount to DL */
  displayToDl: (display: number) => number;
  /** Format a DL amount as a display string */
  formatBalance: (dl: number) => string;
  iconSrc: string;
  label: string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("dl");

  const cycleCurrency = useCallback(() => {
    setCurrency(cur => CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]);
  }, []);

  const dlToDisplay = useCallback((dl: number) => {
    return dl * DISPLAY_PER_DL[currency];
  }, [currency]);

  const displayToDl = useCallback((display: number) => {
    return display * DL_PER_UNIT[currency];
  }, [currency]);

  const formatBalance = useCallback((dl: number) => {
    const v = dl * DISPLAY_PER_DL[currency];
    if (v === 0) return "0";

    if (currency === "wl") {
      // WL values are usually whole numbers; show 1 dp for sub-1 values
      return v >= 1 ? Math.round(v).toLocaleString() : parseFloat(v.toFixed(1)).toLocaleString();
    }

    if (currency === "bgl") {
      if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
      // For sub-1 BGL values (e.g. 0.001), toLocaleString rounds to 0 — use toFixed with enough precision
      const decimals = Math.ceil(-Math.log10(Math.abs(v))) + 1;
      // Trim trailing zeros but keep at least the significant digits
      return v.toFixed(decimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    }

    // DL: up to 2 decimal places
    return parseFloat(v.toFixed(2)).toLocaleString();
  }, [currency]);

  return (
    <CurrencyContext.Provider value={{
      currency,
      cycleCurrency,
      dlToDisplay,
      displayToDl,
      formatBalance,
      iconSrc: CURRENCY_ICON[currency],
      label: CURRENCY_LABEL[currency],
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be inside CurrencyProvider");
  return ctx;
}
