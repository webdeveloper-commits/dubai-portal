"use client";
import type { ReactNode } from "react";
import { CurrencyProvider } from "@/app/contexts/CurrencyContext";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <CurrencyProvider>{children}</CurrencyProvider>;
}
