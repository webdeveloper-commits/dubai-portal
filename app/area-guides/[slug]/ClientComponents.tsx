"use client";
import { useState } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import dynamic from "next/dynamic";
import EnquiryModal from "@/app/components/EnquiryModal";
import PhoneField from "@/app/components/PhoneField";
import { getLeadTrackingData } from "@/lib/tracking";

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
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 0", textAlign: "left" }}
      >
        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 14, color: "#192537", lineHeight: 1.4, flex: 1 }}>
          {q}
        </span>
        <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: open ? "#7fe2e3" : "rgba(127,226,227,0.12)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
          <ChevronDown size={13} color="#192537" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s" }} />
        </span>
      </button>
      <div style={{ maxHeight: open ? 400 : 0, overflow: "hidden", transition: "max-height 0.3s ease" }}>
        <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.85, paddingBottom: 20, paddingRight: 40, margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────

export function LeadForm({ areaName }: { areaName: string }) {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [message, setMessage] = useState("");
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const inp: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1.5px solid #e5e5e5", fontFamily: "Verdana, sans-serif",
    fontSize: 13, color: "#333", outline: "none", boxSizing: "border-box", background: "white",
  };
  const errSt: React.CSSProperties = { fontFamily: "Verdana", fontSize: 11, color: "#e53e3e", marginTop: 3 };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = "Name is required.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Valid email required.";
    if (!phone || !isValidPhoneNumber("+" + phone)) e.phone = "Please enter a valid phone number.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const tracking = getLeadTrackingData();

    try {
      const res = await fetch("/api/enquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:      name.trim(),
          email:     email.trim(),
          phone:     "+" + phone,
          message:   message.trim(),
          areaName,
          sourceUrl: typeof window !== "undefined" ? window.location.href : null,
          ...tracking,
        }),
      });
      const json = await res.json();
      if (!res.ok) setErrors({ submit: json.error || "Something went wrong." });
      else setSent(true);
    } catch {
      setErrors({ submit: "Connection error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (sent) return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <CheckCircle2 size={44} color="#7fe2e3" style={{ marginBottom: 14 }} />
      <h4 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 18, color: "#192537", marginBottom: 8 }}>Thank you!</h4>
      <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.7 }}>
        We&apos;ve received your enquiry about <strong>{areaName}</strong>.<br />
        An advisor will contact you within the hour.
      </p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <input type="text" placeholder="Your Full Name *" value={name} onChange={e => setName(e.target.value)}
          style={{ ...inp, borderColor: errors.name ? "#e53e3e" : "#e5e5e5" }} />
        {errors.name && <p style={errSt}>{errors.name}</p>}
      </div>
      <div>
        <input type="email" placeholder="Email Address *" value={email} onChange={e => setEmail(e.target.value)}
          style={{ ...inp, borderColor: errors.email ? "#e53e3e" : "#e5e5e5" }} />
        {errors.email && <p style={errSt}>{errors.email}</p>}
      </div>
      <div>
        <PhoneField value={phone} onChange={setPhone} error={!!errors.phone} />
        {errors.phone && <p style={errSt}>{errors.phone}</p>}
      </div>
      <div>
        <textarea
          placeholder="Message (optional)"
          value={message} onChange={e => setMessage(e.target.value)}
          rows={3}
          style={{ ...inp, resize: "none", lineHeight: 1.6 }}
          onFocus={e => { e.currentTarget.style.borderColor = "#7fe2e3"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "#e5e5e5"; }}
        />
      </div>
      {errors.submit && <p style={{ ...errSt, textAlign: "center" }}>{errors.submit}</p>}
      <button type="submit" disabled={loading}
        style={{ background: loading ? "#b2e8e8" : "#7fe2e3", color: "#192537", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "14px", borderRadius: 12, border: "none", cursor: loading ? "default" : "pointer", marginTop: 4 }}>
        {loading ? "Sending…" : "Send Enquiry"}
      </button>
      <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#bbb", textAlign: "center", margin: 0 }}>
        Free consultation · No obligation · Reply within 1 hour
      </p>
    </form>
  );
}

// ─── Enquire button — replaces WhatsApp CTA ───────────────────────────────────

export function EnquireButton({ areaName }: { areaName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "12px", borderRadius: 12,
          background: "#7fe2e3", color: "#192537",
          fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13,
          border: "none", cursor: "pointer", boxSizing: "border-box",
        }}
      >
        Enquire About This Area
      </button>
      <EnquiryModal isOpen={open} onClose={() => setOpen(false)} context={{ areaName }} />
    </>
  );
}
