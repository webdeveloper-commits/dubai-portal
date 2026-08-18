"use client";
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type Currency = "AED" | "USD" | "EUR" | "GBP";

const RATES: Record<Currency, number> = {
  AED: 1,
  USD: 0.2723,
  EUR: 0.2498,
  GBP: 0.2110,
};

const SYMBOLS: Record<Currency, string> = {
  AED: "AED ",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

interface CurrencyCtx {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (aed: number) => string;
}

const CurrencyContext = createContext<CurrencyCtx>({
  currency: "AED",
  setCurrency: () => {},
  formatPrice: (n) => `AED ${n}`,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("AED");

  const formatPrice = (aed: number): string => {
    const amount = aed * RATES[currency];
    const sym = SYMBOLS[currency];
    if (amount >= 1_000_000) {
      const val = amount / 1_000_000;
      return `${sym}${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
    }
    if (amount >= 1_000) return `${sym}${(amount / 1_000).toFixed(0)}K`;
    return `${sym}${Math.round(amount)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
