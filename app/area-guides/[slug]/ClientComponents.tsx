"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";
import EnquiryModal from "@/app/components/EnquiryModal";

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

// ─── Country code dropdown ────────────────────────────────────────────────────

const CC_LIST = [
  { code: "+971", flag: "🇦🇪" }, { code: "+966", flag: "🇸🇦" }, { code: "+974", flag: "🇶🇦" },
  { code: "+965", flag: "🇰🇼" }, { code: "+973", flag: "🇧🇭" }, { code: "+968", flag: "🇴🇲" },
  { code: "+91",  flag: "🇮🇳" }, { code: "+92",  flag: "🇵🇰" }, { code: "+44",  flag: "🇬🇧" },
  { code: "+1",   flag: "🇺🇸" }, { code: "+49",  flag: "🇩🇪" }, { code: "+33",  flag: "🇫🇷" },
  { code: "+7",   flag: "🇷🇺" }, { code: "+86",  flag: "🇨🇳" }, { code: "+61",  flag: "🇦🇺" },
];

function CCDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const sel = CC_LIST.find(c => c.code === value) ?? CC_LIST[0];
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 3, height: 44, padding: "0 8px 0 10px", background: "#f4f6f9", border: "1.5px solid #e5e5e5", borderRadius: "10px 0 0 10px", cursor: "pointer", fontFamily: "Verdana", fontSize: 11, color: "#192537", whiteSpace: "nowrap", minWidth: 72 }}>
        <span style={{ fontSize: 14 }}>{sel.flag}</span> {value}
        <ChevronDown size={10} color="#7a8a9e" />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, zIndex: 200, background: "white", border: "1.5px solid #e5e5e5", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", minWidth: 160, maxHeight: 200, overflowY: "auto" }}>
          {CC_LIST.map(c => (
            <button key={c.code} type="button" onClick={() => { onChange(c.code); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 12px", textAlign: "left", fontFamily: "Verdana", fontSize: 11, border: "none", cursor: "pointer", background: c.code === value ? "#f0fbfb" : "white", borderBottom: "0.5px solid #f5f5f5" }}>
              <span style={{ fontSize: 14 }}>{c.flag}</span> {c.code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────

export function LeadForm({ areaName }: { areaName: string }) {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [cc,      setCc]      = useState("+971");
  const [phone,   setPhone]   = useState("");
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
    if (!phone.trim() || phone.replace(/\D/g, "").length < 6)        e.phone = "Valid phone required.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/enquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), countryCode: cc, phone: phone.trim(),
          areaName,
          sourceUrl: typeof window !== "undefined" ? window.location.href : null,
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
        <div style={{ display: "flex" }}>
          <CCDropdown value={cc} onChange={setCc} />
          <input type="tel" placeholder="Phone Number *" value={phone} onChange={e => setPhone(e.target.value)}
            style={{ ...inp, flex: 1, borderRadius: "0 10px 10px 0", borderLeft: "none", borderColor: errors.phone ? "#e53e3e" : "#e5e5e5" }} />
        </div>
        {errors.phone && <p style={errSt}>{errors.phone}</p>}
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
