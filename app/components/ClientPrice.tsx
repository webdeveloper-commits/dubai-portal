"use client";
import { useCurrency } from "@/app/contexts/CurrencyContext";

export function ClientPrice({ aed, style }: { aed: number; style?: React.CSSProperties }) {
  const { formatPrice } = useCurrency();
  return <span style={style}>{formatPrice(aed)}</span>;
}
