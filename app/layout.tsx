import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
import { Montserrat } from "next/font/google";
import "./globals.css";
import Navbar from "@/app/components/Navbar";
import TrackingInit from "@/app/components/TrackingInit";
import ClientProviders from "@/app/components/ClientProviders";
import { supabase } from "@/lib/supabase";
import Footer from "@/app/components/Footer";
import { Disclaimer, CookieBanner, FloatingContact } from "@/app/components/GlobalExtras";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Offplan Search UAE | Dubai Off-Plan Properties 2025–2026",
    template: "%s | Offplan Search UAE",
  },
  description:
    "Search off-plan and new-launch properties in Dubai. Compare prices, payment plans and handover dates from top developers — free expert advice.",
  keywords: ["off-plan properties Dubai", "Dubai new launch projects", "buy off-plan Dubai", "Dubai real estate 2025", "Dubai property investment"],
  metadataBase: new URL("https://offplansearchuae.com"),
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { data, error: devErr } = await supabase
    .from("developers")
    .select("name,slug")
    .eq("show_in_menu", true)
    .order("name", { ascending: true });

  if (devErr) console.error("[layout] developers query error:", devErr.message);

  const developers = (data ?? []) as { name: string; slug: string }[];

  return (
    <html lang="en" className={montserrat.variable}>
      <body style={{ fontFamily: "var(--font-montserrat), sans-serif", background: "#f9f9f9", color: "#192537" }}>
        <ClientProviders>
          <TrackingInit />
          <Navbar developers={developers} />
          {children}
          <Footer />
          <Disclaimer />
          <CookieBanner />
          <FloatingContact />
        </ClientProviders>
      </body>
    </html>
  );
}