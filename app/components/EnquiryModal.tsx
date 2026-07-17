"use client";
import { useState, useEffect } from "react";
import { X, CheckCircle2, Phone } from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import PhoneField from "./PhoneField";
import { getLeadTrackingData } from "@/lib/tracking";

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

// ── Main modal ────────────────────────────────────────────────────────────────

export default function EnquiryModal({ isOpen, onClose, context = {} }: Props) {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [message, setMessage] = useState("");
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setName(""); setEmail(""); setPhone("");
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
    if (!name.trim())  errs.name  = "Your name is required.";
    if (!email.trim()) errs.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                       errs.email = "Please enter a valid email.";
    if (!phone || !isValidPhoneNumber("+" + phone))
                       errs.phone = "Please enter a valid phone number.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
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
          name:          name.trim(),
          email:         email.trim(),
          phone:         "+" + phone,
          message:       message.trim(),
          projectName:   context.projectName   || null,
          developerName: context.developerName || null,
          areaName:      context.areaName      || null,
          sourceUrl:     typeof window !== "undefined" ? window.location.href : null,
          ...tracking,
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

                {/* Phone */}
                <div>
                  <PhoneField value={phone} onChange={setPhone} error={!!errors.phone} />
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
