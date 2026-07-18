import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
import { Montserrat } from "next/font/google";
import "./globals.css";
import Navbar from "@/app/components/Navbar";
import TrackingInit from "@/app/components/TrackingInit";
import { supabase } from "@/lib/supabase";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Elysian Realty Dubai | Luxury Real Estate in Dubai",
    template: "%s | Elysian Realty Dubai",
  },
  description:
    "Discover premium off-plan and ready properties in Dubai. Elysian Realty connects you with the finest luxury apartments, villas, and penthouses.",
  keywords: ["Dubai real estate", "luxury properties Dubai", "off-plan Dubai", "buy apartment Dubai"],
  metadataBase: new URL("https://elysianrealtydubai.ae"),
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { data } = await supabase
    .from("developers")
    .select("name,slug")
    .eq("published", true)
    .order("name", { ascending: true });

  const developers = (data ?? []) as { name: string; slug: string }[];

  return (
    <html lang="en" className={montserrat.variable}>
      <body style={{ fontFamily: "var(--font-montserrat), sans-serif", background: "#f9f9f9", color: "#192537" }}>
        <TrackingInit />
        <Navbar developers={developers} />
        {children}
      </body>
    </html>
  );
}