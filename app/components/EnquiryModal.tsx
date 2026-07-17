"use client";
import { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, ChevronDown, Phone } from "lucide-react";

// ── Country codes (ordered by UAE real-estate market relevance) ───────────────
const COUNTRY_CODES = [
  { code: "+971", label: "🇦🇪 UAE (+971)" },
  { code: "+966", label: "🇸🇦 Saudi Arabia (+966)" },
  { code: "+974", label: "🇶🇦 Qatar (+974)" },
  { code: "+965", label: "🇰🇼 Kuwait (+965)" },
  { code: "+973", label: "🇧🇭 Bahrain (+973)" },
  { code: "+968", label: "🇴🇲 Oman (+968)" },
  { code: "+91",  label: "🇮🇳 India (+91)" },
  { code: "+92",  label: "🇵🇰 Pakistan (+92)" },
  { code: "+44",  label: "🇬🇧 UK (+44)" },
  { code: "+1",   label: "🇺🇸 USA/Canada (+1)" },
  { code: "+49",  label: "🇩🇪 Germany (+49)" },
  { code: "+33",  label: "🇫🇷 France (+33)" },
  { code: "+7",   label: "🇷🇺 Russia (+7)" },
  { code: "+86",  label: "🇨🇳 China (+86)" },
  { code: "+61",  label: "🇦🇺 Australia (+61)" },
  { code: "+962", label: "🇯🇴 Jordan (+962)" },
  { code: "+961", label: "🇱🇧 Lebanon (+961)" },
  { code: "+20",  label: "🇪🇬 Egypt (+20)" },
  { code: "+212", label: "🇲🇦 Morocco (+212)" },
  { code: "+27",  label: "🇿🇦 South Africa (+27)" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnquiryContext {
  projectName?:   string;
  developerName?: string;
  areaName?:      string;
}

interface Props {
  isOpen:   boolean;
  onClose:  () => void;
  context?: EnquiryContext;
}

// ── Country code dropdown ─────────────────────────────────────────────────────

function CountryCodeDropdown({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = COUNTRY_CODES.find(c => c.code === value) ?? COUNTRY_CODES[0];
  const filtered = COUNTRY_CODES.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
  );

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          height: 44, padding: "0 10px 0 12px",
          background: "#f4f6f9", border: "1.5px solid #e0e0e0",
          borderRadius: "10px 0 0 10px", cursor: "pointer",
          fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#192537",
          whiteSpace: "nowrap", minWidth: 80,
        }}
      >
        <span style={{ fontSize: 14 }}>{selected.label.split(" ")[0]}</span>
        <span>{value}</span>
        <ChevronDown size={11} color="#7a8a9e"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 9999,
          background: "white", border: "1.5px solid #e0e0e0", borderRadius: 12,
          boxShadow: "0 12px 36px rgba(0,0,0,0.14)", minWidth: 220, maxHeight: 260, overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search country..."
            style={{
              padding: "10px 14px", border: "none", borderBottom: "1px solid #f0f0f0",
              fontFamily: "Verdana", fontSize: 12, outline: "none", background: "#f9f9f9",
            }}
          />
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.map(c => (
              <button key={c.code} type="button"
                onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
                style={{
                  display: "block", width: "100%", padding: "10px 14px", textAlign: "left",
                  fontFamily: "Verdana", fontSize: 12, border: "none", cursor: "pointer",
                  background: c.code === value ? "#f0fbfb" : "white",
                  color: c.code === value ? "#192537" : "#444",
                  borderBottom: "0.5px solid #f5f5f5",
                }}
                onMouseEnter={e => { if (c.code !== value) (e.currentTarget as HTMLButtonElement).style.background = "#f9f9f9"; }}
                onMouseLeave={e => { if (c.code !== value) (e.currentTarget as HTMLButtonElement).style.background = "white"; }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function EnquiryModal({ isOpen, onClose, context = {} }: Props) {
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [countryCode, setCountryCode] = useState("+971");
  const [phone,       setPhone]       = useState("");
  const [message,     setMessage]     = useState("");
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [loading,     setLoading]     = useState(false);
  const [sent,        setSent]        = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setName(""); setEmail(""); setCountryCode("+971"); setPhone("");
      setMessage(""); setErrors({}); setLoading(false); setSent(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else        document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim())        errs.name  = "Your name is required.";
    if (!email.trim())       errs.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                             errs.email = "Please enter a valid email.";
    if (!phone.trim())       errs.phone = "Phone number is required.";
    else if (phone.replace(/\D/g, "").length < 6)
                             errs.phone = "Please enter a valid phone number.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    // Collect active filter params from URL
    const filterDetails = typeof window !== "undefined"
      ? Object.fromEntries(new URLSearchParams(window.location.search).entries())
      : {};

    try {
      const res = await fetch("/api/enquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          countryCode,
          phone: phone.trim(),
          message: message.trim(),
          projectName:   context.projectName   || null,
          developerName: context.developerName || null,
          areaName:      context.areaName      || null,
          filterDetails: Object.keys(filterDetails).length ? filterDetails : null,
          sourceUrl:     typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors({ submit: json.error || "Something went wrong. Please try again." });
      } else {
        setSent(true);
      }
    } catch {
      setErrors({ submit: "Connection error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 13px", borderRadius: 10,
    border: "1.5px solid #e0e0e0", fontFamily: "Verdana, sans-serif",
    fontSize: 12, color: "#333", outline: "none",
    boxSizing: "border-box", background: "#fafafa",
    transition: "border-color 0.2s",
  };
  const errSt: React.CSSProperties = {
    fontFamily: "Verdana", fontSize: 11, color: "#e53e3e", marginTop: 4,
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(13,26,39,0.72)", backdropFilter: "blur(4px)",
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", zIndex: 10001,
          transform: "translate(-50%,-50%)",
          background: "white", borderRadius: 24,
          width: "min(92vw, 480px)", maxHeight: "90vh",
          overflowY: "auto", boxShadow: "0 32px 80px rgba(13,26,39,0.28)",
          animation: "slideUp 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "24px 28px 0",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontFamily: "Verdana", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 5px" }}>
              Free Consultation
            </p>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", margin: 0, lineHeight: 1.2 }}>
              {context.projectName ? `Enquire About\n${context.projectName}` : "Speak to an Advisor"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#7a8a9e", marginTop: -2 }}>
            <X size={20} />
          </button>
        </div>

        {/* Context pill */}
        {(context.projectName || context.areaName || context.developerName) && (
          <div style={{ padding: "12px 28px 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {context.projectName   && <span style={{ fontFamily: "Verdana", fontSize: 10, background: "rgba(127,226,227,0.1)", color: "#0d5e5f", border: "1px solid rgba(127,226,227,0.3)", borderRadius: 999, padding: "4px 12px" }}>{context.projectName}</span>}
            {context.developerName && <span style={{ fontFamily: "Verdana", fontSize: 10, background: "#f4f6f9", color: "#7a8a9e", borderRadius: 999, padding: "4px 12px" }}>{context.developerName}</span>}
            {context.areaName      && <span style={{ fontFamily: "Verdana", fontSize: 10, background: "#f4f6f9", color: "#7a8a9e", borderRadius: 999, padding: "4px 12px" }}>{context.areaName}</span>}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: "20px 28px 28px" }}>
          {sent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <CheckCircle2 size={48} color="#7fe2e3" style={{ marginBottom: 16 }} />
              <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 18, color: "#192537", marginBottom: 8 }}>Thank you!</h3>
              <p style={{ fontFamily: "Verdana", fontSize: 13, color: "#7a8a9e", lineHeight: 1.7, margin: "0 0 24px" }}>
                {context.projectName
                  ? `We've received your enquiry about ${context.projectName}.`
                  : "We've received your enquiry."}{" "}
                An advisor will contact you within the hour.
              </p>
              <button onClick={onClose} style={{ background: "#192537", color: "white", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "12px 28px", borderRadius: 999, border: "none", cursor: "pointer" }}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Name */}
                <div>
                  <input
                    type="text" placeholder="Your Full Name *"
                    value={name} onChange={e => setName(e.target.value)}
                    style={{ ...inp, borderColor: errors.name ? "#e53e3e" : "#e0e0e0" }}
                    onFocus={e => { if (!errors.name) e.currentTarget.style.borderColor = "#7fe2e3"; }}
                    onBlur={e => { if (!errors.name) e.currentTarget.style.borderColor = "#e0e0e0"; }}
                  />
                  {errors.name && <p style={errSt}>{errors.name}</p>}
                </div>

                {/* Email */}
                <div>
                  <input
                    type="email" placeholder="Email Address *"
                    value={email} onChange={e => setEmail(e.target.value)}
                    style={{ ...inp, borderColor: errors.email ? "#e53e3e" : "#e0e0e0" }}
                    onFocus={e => { if (!errors.email) e.currentTarget.style.borderColor = "#7fe2e3"; }}
                    onBlur={e => { if (!errors.email) e.currentTarget.style.borderColor = "#e0e0e0"; }}
                  />
                  {errors.email && <p style={errSt}>{errors.email}</p>}
                </div>

                {/* Phone with country code */}
                <div>
                  <div style={{ display: "flex" }}>
                    <CountryCodeDropdown value={countryCode} onChange={setCountryCode} />
                    <input
                      type="tel" placeholder="Phone Number *"
                      value={phone} onChange={e => setPhone(e.target.value)}
                      style={{
                        ...inp, flex: 1,
                        borderRadius: "0 10px 10px 0",
                        borderLeft: "none",
                        borderColor: errors.phone ? "#e53e3e" : "#e0e0e0",
                      }}
                      onFocus={e => { if (!errors.phone) e.currentTarget.style.borderColor = "#7fe2e3"; }}
                      onBlur={e => { if (!errors.phone) e.currentTarget.style.borderColor = "#e0e0e0"; }}
                    />
                  </div>
                  {errors.phone && <p style={errSt}>{errors.phone}</p>}
                </div>

                {/* Message */}
                <textarea
                  placeholder="Message (optional)"
                  value={message} onChange={e => setMessage(e.target.value)}
                  rows={3}
                  style={{ ...inp, resize: "none", lineHeight: 1.6 }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#7fe2e3"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#e0e0e0"; }}
                />

                {/* Submit error */}
                {errors.submit && (
                  <p style={{ ...errSt, textAlign: "center", margin: 0 }}>{errors.submit}</p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? "#b2e8e8" : "linear-gradient(135deg,#7fe2e3,#4db8b9)",
                    color: "#192537", fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700, fontSize: 13,
                    padding: "14px", borderRadius: 12,
                    border: "none", cursor: loading ? "default" : "pointer",
                    letterSpacing: "0.02em", transition: "opacity 0.2s",
                  }}
                >
                  {loading ? "Sending…" : "Send Enquiry"}
                </button>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: -4 }}>
                  <span style={{ fontFamily: "Verdana", fontSize: 10, color: "#bbb" }}>Free consultation</span>
                  <span style={{ color: "#e0e0e0" }}>·</span>
                  <span style={{ fontFamily: "Verdana", fontSize: 10, color: "#bbb" }}>No obligation</span>
                  <span style={{ color: "#e0e0e0" }}>·</span>
                  <span style={{ fontFamily: "Verdana", fontSize: 10, color: "#bbb" }}>Reply within 1 hour</span>
                </div>

                {/* Call option */}
                <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontFamily: "Verdana", fontSize: 11, color: "#aaa" }}>Prefer to call?</span>
                  <a href="tel:+97140000000" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#192537", textDecoration: "none" }}>
                    <Phone size={11} color="#7fe2e3" /> +971 4 000 0000
                  </a>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%,-48%) } to { opacity: 1; transform: translate(-50%,-50%) } }
      `}</style>
    </>
  );
}
