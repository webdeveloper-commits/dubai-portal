"use client";
import { useState, useEffect } from "react";
import { X, Phone } from "lucide-react";
import EnquiryModal from "@/app/components/EnquiryModal";

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

/* ── Floating contact buttons — Call + Enquire ── */
export function FloatingContact() {
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 20,
          bottom: 24,
          zIndex: 9998,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
        }}
      >
        {/* Call */}
        <a
          href="tel:+97140000000"
          aria-label="Call us"
          style={{
            width: 50,
            height: 50,
            borderRadius: "50%",
            background: "#7fe2e3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(127,226,227,0.4)",
            textDecoration: "none",
            transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)"; }}
        >
          <Phone size={19} color="#192537" />
        </a>

        {/* Enquire */}
        <button
          onClick={() => setEnquiryOpen(true)}
          aria-label="Enquire now"
          style={{
            width: 50,
            height: 50,
            borderRadius: "50%",
            background: "#192537",
            border: "2px solid #7fe2e3",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 24px rgba(25,37,55,0.4)",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#7fe2e3"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#192537"; }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" stroke="#7fe2e3" strokeWidth="1.5"/>
            <path d="M7 8h6M7 11h4" stroke="#7fe2e3" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <EnquiryModal isOpen={enquiryOpen} onClose={() => setEnquiryOpen(false)} />
    </>
  );
}
