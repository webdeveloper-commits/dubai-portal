"use client";
import { useState, useEffect } from "react";
import { X, Phone, MessageCircle } from "lucide-react";

/* ── Disclaimer bar ── */
export function Disclaimer() {
  return (
    <div
      style={{
        background: "#f0f4f8",
        borderTop: "1px solid #dde4ed",
        padding: "16px 24px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: "Verdana",
          fontSize: 11,
          color: "#7a8a9e",
          lineHeight: 1.75,
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        <strong style={{ color: "#192537" }}>Disclaimer:</strong> We are a real estate agency and not the property developer.
        All information, including project details, prices, and availability, is subject to change and is provided for
        informational purposes only. The information displayed is based on data supplied by the developers. When you buy
        a property through our agency, you will purchase directly from the developer at the official developer price.
        Our service to you is free of charge, as we are compensated directly by the developers. We strive to ensure
        accuracy but for the most up-to-date and reliable details, please contact us directly.
      </p>
    </div>
  );
}

/* ── Cookie banner ── */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("elysian_cookies");
    if (!accepted) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("elysian_cookies", "true");
    setVisible(false);
  };

  const decline = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 520,
        background: "#192537",
        borderRadius: 20,
        padding: "24px 28px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        border: "1px solid rgba(127,226,227,0.15)",
        animation: "slideUp 0.4s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 15,
            color: "white",
          }}
        >
          🍪 Cookie Preferences
        </div>
        <button
          onClick={decline}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.5)",
            padding: 0,
          }}
        >
          <X size={18} />
        </button>
      </div>

      <p
        style={{
          fontFamily: "Verdana",
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.75,
          marginBottom: 20,
        }}
      >
        We use cookies to enhance your browsing experience, serve personalized property recommendations, and analyse
        our traffic. By clicking "Accept All", you consent to our use of cookies.
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={accept}
          style={{
            flex: 1,
            background: "#7fe2e3",
            color: "#192537",
            border: "none",
            borderRadius: 999,
            padding: "11px 20px",
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "white"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#7fe2e3"; }}
        >
          Accept All
        </button>
        <button
          onClick={decline}
          style={{
            flex: 1,
            background: "transparent",
            color: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 999,
            padding: "11px 20px",
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.4)";
            (e.currentTarget as HTMLButtonElement).style.color = "white";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)";
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)";
          }}
        >
          Decline
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── WhatsApp + Call floating buttons ── */
export function FloatingContact() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 88,
        zIndex: 9998,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      {/* WhatsApp */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: expanded ? 1 : 0,
          transform: expanded ? "translateX(0)" : "translateX(20px)",
          pointerEvents: expanded ? "auto" : "none",
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}
      >
        <span
          style={{
            fontFamily: "Verdana",
            fontSize: 11,
            background: "#192537",
            color: "white",
            padding: "6px 14px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          Chat on WhatsApp
        </span>
        <a
          href="https://wa.me/971400000000"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#25D366",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(37,211,102,0.4)",
            textDecoration: "none",
            transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)"; }}
        >
          <MessageCircle size={22} color="white" />
        </a>
      </div>

      {/* Call */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: expanded ? 1 : 0,
          transform: expanded ? "translateX(0)" : "translateX(20px)",
          pointerEvents: expanded ? "auto" : "none",
          transition: "opacity 0.25s ease 0.05s, transform 0.25s ease 0.05s",
        }}
      >
        <span
          style={{
            fontFamily: "Verdana",
            fontSize: 11,
            background: "#192537",
            color: "white",
            padding: "6px 14px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          Call Us Now
        </span>
        <a
          href="tel:+971400000000"
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#7fe2e3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(127,226,227,0.35)",
            textDecoration: "none",
            transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)"; }}
        >
          <Phone size={20} color="#192537" />
        </a>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#192537",
          border: "2px solid #7fe2e3",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px rgba(25,37,55,0.4)",
          transition: "all 0.25s",
          transform: expanded ? "rotate(45deg)" : "rotate(0deg)",
        }}
        aria-label="Contact options"
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#7fe2e3"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#192537"; }}
      >
        {/* Custom contact icon */}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 2C6.03 2 2 6.03 2 11c0 1.77.49 3.42 1.34 4.83L2 20l4.31-1.32C7.66 19.53 9.29 20 11 20c4.97 0 9-4.03 9-9s-4.03-9-9-9z" stroke="#7fe2e3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M7.5 9.5c.5 1 1.5 2.5 3 3.5" stroke="#7fe2e3" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M10.5 13c.5.3 1.3.5 2 .3l1.5-.5" stroke="#7fe2e3" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
