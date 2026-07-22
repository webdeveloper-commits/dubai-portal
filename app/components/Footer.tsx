"use client";
import { useState } from "react";
import { ArrowUp, Phone, Mail, MapPin } from "lucide-react";

const SOCIALS = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/elysianrealestate",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/elysiangroup",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/elysian-real-estate/?viewAsMember=true",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@elysianrealestate_",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" />
      </svg>
    ),
  },
  {
    label: "X / Twitter",
    href: "https://x.com/elysianGroup",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Elysian Website",
    href: "https://elysian.com/",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    label: "Reviews",
    href: "https://elysianrealestatereviews.com/",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
];

type FooterCol = { label: string; href: string };
const footerLinks: Record<string, FooterCol[]> = {
  "Properties": [
    { label: "Apartments for Sale",    href: "/projects?type=Apartment" },
    { label: "Villas for Sale",        href: "/projects?type=Villa" },
    { label: "Penthouses",             href: "/projects?type=Penthouse" },
    { label: "Townhouses",             href: "/projects?type=Townhouse" },
    { label: "Commercial",             href: "/projects?type=Commercial" },
    { label: "Off-Plan Projects",      href: "/projects" },
  ],
  "Communities": [
    { label: "Downtown Dubai",         href: "/projects?area=Downtown+Dubai" },
    { label: "Dubai Marina",           href: "/projects?area=Dubai+Marina" },
    { label: "Palm Jumeirah",          href: "/projects?area=Palm+Jumeirah" },
    { label: "Business Bay",           href: "/projects?area=Business+Bay" },
    { label: "JVC",                    href: "/projects?area=JVC" },
    { label: "Dubai Creek Harbour",    href: "/projects?area=Dubai+Creek+Harbour" },
  ],
  "Developers": [
    { label: "Emaar Properties",       href: "/developers/emaar-properties" },
    { label: "Damac Properties",       href: "/developers/damac-properties" },
    { label: "Nakheel",                href: "/developers/nakheel" },
    { label: "Meraas",                 href: "/developers/meraas" },
    { label: "Sobha Realty",           href: "/developers/sobha-realty" },
    { label: "Aldar Properties",       href: "/developers/aldar-properties" },
  ],
  "By Emirates": [
    { label: "Dubai",                  href: "/projects?emirate=Dubai" },
    { label: "Ras Al Khaimah",         href: "/projects?emirate=Ras+Al+Khaimah" },
    { label: "Sharjah",                href: "/projects?emirate=Sharjah" },
    { label: "Ajman",                  href: "/projects?emirate=Ajman" },
    { label: "Abu Dhabi",              href: "/projects?emirate=Abu+Dhabi" },
    { label: "Fujairah",               href: "/projects?emirate=Fujairah" },
  ],
};

export default function Footer() {
  const [email, setEmail] = useState("");

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer style={{ background: "#0d1a27", color: "white" }}>
      {/* Main footer */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "72px 24px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 40 }} className="footer-grid">
          {/* Brand col */}
          <div>
            {/* Logo */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 900,
                  fontSize: 24,
                  color: "white",
                  letterSpacing: "-0.02em",
                  marginBottom: 4,
                }}
              >
                ELYSIAN
                <span style={{ color: "#7fe2e3", fontSize: 10, fontWeight: 400, letterSpacing: "0.2em", display: "block", marginTop: 2 }}>
                  REAL ESTATE
                </span>
              </div>
            </div>

            <p
              style={{
                fontFamily: "Verdana",
                fontSize: 12,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.9,
                marginBottom: 28,
                maxWidth: 240,
              }}
            >
              Dubai's trusted premium real estate agency, helping clients find their perfect property since 2009.
            </p>

            {/* Contact */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              <a href="tel:+971547786800" style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "Verdana", fontSize: 12, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
                <Phone size={13} color="#7fe2e3" style={{ flexShrink: 0 }} />
                +971 54 778 6800
              </a>
              <a href="mailto:info@elysian.com" style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "Verdana", fontSize: 12, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
                <Mail size={13} color="#7fe2e3" style={{ flexShrink: 0 }} />
                info@elysian.com
              </a>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <MapPin size={13} color="#7fe2e3" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontFamily: "Verdana", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                  Elysian Sales Center<br />Umm Al Sheif, SZR, Dubai, UAE
                </span>
              </div>
            </div>

            {/* Social */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SOCIALS.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(255,255,255,0.6)", textDecoration: "none",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background = "#7fe2e3";
                    el.style.borderColor = "#7fe2e3";
                    el.style.color = "#192537";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background = "transparent";
                    el.style.borderColor = "rgba(255,255,255,0.12)";
                    el.style.color = "rgba(255,255,255,0.6)";
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link cols */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "white",
                  marginBottom: 20,
                  letterSpacing: "0.02em",
                }}
              >
                {title}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      style={{
                        fontFamily: "Verdana",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.45)",
                        textDecoration: "none",
                        transition: "color 0.2s",
                        display: "inline-block",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#7fe2e3"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.45)"; }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <p
          style={{
            fontFamily: "Verdana",
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            margin: 0,
          }}
        >
          © {new Date().getFullYear()} Elysian Real Estate. All rights reserved. ·{" "}
          <a href="/privacy-policy" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Privacy Policy</a>{" "}
          ·{" "}
          <a href="/terms-and-conditions" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Terms of Use</a>{" "}
          · RERA Certified
        </p>

        {/* Scroll to top */}
        <button
          onClick={scrollToTop}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(127,226,227,0.1)",
            border: "1px solid rgba(127,226,227,0.2)",
            borderRadius: 999,
            padding: "8px 16px",
            cursor: "pointer",
            color: "#7fe2e3",
            fontFamily: "Verdana",
            fontSize: 11,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#7fe2e3";
            (e.currentTarget as HTMLButtonElement).style.color = "#192537";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(127,226,227,0.1)";
            (e.currentTarget as HTMLButtonElement).style.color = "#7fe2e3";
          }}
        >
          <ArrowUp size={12} />
          Back to Top
        </button>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 400px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
