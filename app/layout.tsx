import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import Navbar from "@/app/components/Navbar";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body style={{ fontFamily: "var(--font-montserrat), sans-serif", background: "#f9f9f9", color: "#192537" }}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}