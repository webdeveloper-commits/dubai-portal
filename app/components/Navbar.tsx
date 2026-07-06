"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

const navLinks = [
  { label: "Properties", href: "/projects" },
  { label: "Communities", href: "/area-guides" },
  { label: "Blog", href: "/blog" },
];

export default function Navbar({ developers = [] }: { developers?: { name: string; slug: string }[] }) {
  const [devOpen, setDevOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDevOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 72,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          transition: "background 0.3s, backdrop-filter 0.3s, border-color 0.3s",
          background: scrolled ? "rgba(13,26,39,0.97)" : "rgba(13,26,39,0.55)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: scrolled ? "1px solid rgba(127,226,227,0.1)" : "1px solid transparent",
        }}
      >
        <div style={{ maxWidth: 1280, width: "100%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 20, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>
              ELYSIAN
              <span style={{ color: "#7fe2e3", fontSize: 8, fontWeight: 400, letterSpacing: "0.22em", display: "block", marginTop: 2, textTransform: "uppercase" }}>
                Real Estate
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }} className="nav-desktop">
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                style={{
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                  textDecoration: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  transition: "color 0.2s",
                  letterSpacing: "0.02em",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "white")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
              >
                {label}
              </Link>
            ))}

            {/* Developers dropdown */}
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <button
                onClick={() => setDevOpen(o => !o)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 12,
                  color: devOpen ? "white" : "rgba(255,255,255,0.6)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px 14px",
                  borderRadius: 8,
                  letterSpacing: "0.02em",
                  transition: "color 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "white")}
                onMouseLeave={e => { if (!devOpen) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              >
                Developers
                <ChevronDown
                  size={13}
                  style={{ transition: "transform 0.2s", transform: devOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              {devOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#0d1a27",
                    border: "1px solid rgba(127,226,227,0.12)",
                    borderRadius: 12,
                    padding: "8px 0",
                    minWidth: 200,
                    boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
                    animation: "dropIn 0.15s ease",
                  }}
                >
                  <Link
                    href="/developers"
                    onClick={() => setDevOpen(false)}
                    style={{
                      display: "block",
                      padding: "9px 18px",
                      fontFamily: "Verdana, sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#7fe2e3",
                      textDecoration: "none",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      marginBottom: 4,
                    }}
                  >
                    All Developers
                  </Link>
                  {developers.map(({ name, slug }) => (
                    <Link
                      key={slug}
                      href={`/developers/${slug}`}
                      onClick={() => setDevOpen(false)}
                      style={{
                        display: "block",
                        padding: "9px 18px",
                        fontFamily: "Verdana, sans-serif",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.6)",
                        textDecoration: "none",
                        transition: "all 0.15s",
                        letterSpacing: "0.01em",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = "white";
                        e.currentTarget.style.background = "rgba(127,226,227,0.06)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/faq"
              style={{
                fontFamily: "Verdana, sans-serif",
                fontSize: 12,
                color: "rgba(255,255,255,0.6)",
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: 8,
                transition: "color 0.2s",
                letterSpacing: "0.02em",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "white")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            >
              FAQ
            </Link>

            <a
              href="https://wa.me/971400000000"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 12,
                color: "#192537",
                background: "#7fe2e3",
                textDecoration: "none",
                padding: "9px 20px",
                borderRadius: 999,
                marginLeft: 8,
                letterSpacing: "0.03em",
                transition: "background 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "white")}
              onMouseLeave={e => (e.currentTarget.style.background = "#7fe2e3")}
            >
              Contact Us
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="nav-mobile-toggle"
            onClick={() => setMobileOpen(o => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "white", padding: 8, display: "none" }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed",
            top: 72,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#0d1a27",
            zIndex: 99,
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            overflowY: "auto",
          }}
          className="nav-mobile-menu"
        >
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMobileOpen(false)}
              style={{ fontFamily: "Verdana, sans-serif", fontSize: 15, color: "rgba(255,255,255,0.7)", textDecoration: "none", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              {label}
            </Link>
          ))}

          {/* Mobile developers submenu */}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 15, color: "rgba(255,255,255,0.7)", padding: "14px 0 8px" }}>
              Developers
            </div>
            <Link
              href="/developers"
              onClick={() => setMobileOpen(false)}
              style={{ display: "block", fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7fe2e3", padding: "8px 16px", textDecoration: "none" }}
            >
              All Developers
            </Link>
            {developers.map(({ name, slug }) => (
              <Link
                key={slug}
                href={`/developers/${slug}`}
                onClick={() => setMobileOpen(false)}
                style={{ display: "block", fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "8px 16px", textDecoration: "none" }}
              >
                {name}
              </Link>
            ))}
          </div>

          <Link
            href="/faq"
            onClick={() => setMobileOpen(false)}
            style={{ fontFamily: "Verdana, sans-serif", fontSize: 15, color: "rgba(255,255,255,0.7)", textDecoration: "none", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            FAQ
          </Link>

          <a
            href="https://wa.me/971400000000"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#192537", background: "#7fe2e3", textDecoration: "none", padding: "14px 20px", borderRadius: 999, textAlign: "center", marginTop: 16 }}
          >
            Contact Us
          </a>
        </div>
      )}

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-toggle { display: flex !important; }
        }
      `}</style>
    </>
  );
}
