"use client";
import { useState } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";

export const PrimeLocationMap = dynamic(
  () => import("@/app/components/PrimeLocationMap"),
  { ssr: false }
);

export function FaqAccordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(25,37,55,0.08)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "20px 0",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: "#192537",
            lineHeight: 1.4,
            flex: 1,
          }}
        >
          {q}
        </span>
        <span
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: open ? "#7fe2e3" : "rgba(127,226,227,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <ChevronDown
            size={13}
            color="#192537"
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.25s",
            }}
          />
        </span>
      </button>
      <div
        style={{
          maxHeight: open ? 400 : 0,
          overflow: "hidden",
          transition: "max-height 0.3s ease",
        }}
      >
        <p
          style={{
            fontFamily: "Verdana, sans-serif",
            fontSize: 13,
            color: "#7a8a9e",
            lineHeight: 1.85,
            paddingBottom: 20,
            paddingRight: 40,
            margin: 0,
          }}
        >
          {a}
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid #e5e5e5",
  fontFamily: "Verdana, sans-serif",
  fontSize: 13,
  color: "#333",
  outline: "none",
  boxSizing: "border-box",
  background: "white",
};

export function LeadForm({ areaName }: { areaName: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <CheckCircle2 size={44} color="#7fe2e3" style={{ marginBottom: 14 }} />
        <h4
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 18,
            color: "#192537",
            marginBottom: 8,
          }}
        >
          Thank you!
        </h4>
        <p
          style={{
            fontFamily: "Verdana, sans-serif",
            fontSize: 13,
            color: "#7a8a9e",
            lineHeight: 1.7,
          }}
        >
          We&apos;ve received your enquiry about <strong>{areaName}</strong>.<br />
          An advisor will contact you within the hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {(
        [
          { key: "name",  ph: "Your Name",         type: "text"  },
          { key: "email", ph: "Email Address",      type: "email" },
          { key: "phone", ph: "Phone / WhatsApp",   type: "tel"   },
        ] as { key: "name" | "email" | "phone"; ph: string; type: string }[]
      ).map(({ key, ph, type }) => (
        <input
          key={key}
          type={type}
          placeholder={ph}
          required={key !== "phone"}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          style={inputStyle}
        />
      ))}
      <button
        type="submit"
        style={{
          background: "#7fe2e3",
          color: "#192537",
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          padding: "14px",
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          marginTop: 4,
        }}
      >
        Send Enquiry
      </button>
      <p
        style={{
          fontFamily: "Verdana, sans-serif",
          fontSize: 10,
          color: "#bbb",
          textAlign: "center",
          margin: 0,
        }}
      >
        Free consultation · No obligation · Reply within 1 hour
      </p>
    </form>
  );
}
