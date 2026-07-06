"use client";
import { useState } from "react";
import { ArrowUp, Phone, Mail, MapPin, Camera, Briefcase, Globe, MessageCircle, Play } from "lucide-react";

const footerLinks = {
  "Properties": [
    "Apartments for Sale",
    "Villas for Sale",
    "Penthouses",
    "Townhouses",
    "Commercial",
    "Off-Plan Projects",
  ],
  "Communities": [
    "Downtown Dubai",
    "Dubai Marina",
    "Palm Jumeirah",
    "Business Bay",
    "JVC",
    "Dubai Creek Harbour",
  ],
  "Developers": [
    "Emaar Properties",
    "Damac Properties",
    "Nakheel",
    "Meraas",
    "Sobha Realty",
    "Aldar Properties",
  ],
  "Company": [
    "About Elysian",
    "Our Team",
    "Careers",
    "Blog & News",
    "Testimonials",
    "Contact Us",
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
              {[
                { Icon: Phone, text: "+971 4 000 0000" },
                { Icon: Mail, text: "hello@elysian.ae" },
                { Icon: MapPin, text: "DIFC, Dubai, UAE" },
              ].map(({ Icon, text }) => (
                <div
                  key={text}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontFamily: "Verdana",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  <Icon size={13} color="#7fe2e3" />
                  {text}
                </div>
              ))}
            </div>

            {/* Social */}
            <div style={{ display: "flex", gap: 10 }}>
              {[Camera, Briefcase, Globe, MessageCircle, Play].map((Icon, i) => (
                <button
                  key={i}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#7fe2e3";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#7fe2e3";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                  }}
                >
                  <Icon size={14} color="white" />
                </button>
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
                  <li key={link}>
                    <a
                      href="#"
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
                      {link}
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
          <a href="#" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Privacy Policy</a>{" "}
          ·{" "}
          <a href="#" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Terms of Use</a>{" "}
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
