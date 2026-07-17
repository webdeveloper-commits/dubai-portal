"use client";
import { useState } from "react";
import EnquiryModal from "@/app/components/EnquiryModal";

export default function ProjectsEnquiryCTA() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section style={{ background: "#0d1e2e", padding: "72px 24px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 20 }}>FREE CONSULTATION</p>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(26px, 4vw, 38px)", color: "white", marginBottom: 16, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Can&apos;t find what<br />you&apos;re looking for?
          </h2>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9, marginBottom: 36 }}>
            Our advisors have access to exclusive off-market listings and pre-launch opportunities not yet on the portal.
          </p>
          <button
            onClick={() => setOpen(true)}
            style={{ display: "inline-block", background: "#7fe2e3", color: "#192537", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "15px 36px", borderRadius: 999, border: "none", cursor: "pointer", letterSpacing: "0.03em" }}
          >
            Speak to an Advisor
          </button>
        </div>
      </section>

      <EnquiryModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
