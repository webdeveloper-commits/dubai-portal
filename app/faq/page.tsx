"use client";
import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import type { Metadata } from "next";

const faqCategories = [
  {
    category: "Buying Property in Dubai",
    items: [
      {
        q: "Can foreigners buy property in Dubai?",
        a: "Yes. Non-UAE nationals can purchase freehold property in over 60 designated areas including Downtown Dubai, Dubai Marina, Palm Jumeirah, and Business Bay. There are no restrictions on nationality.",
      },
      {
        q: "What is an off-plan property?",
        a: "Off-plan properties are units purchased directly from developers before or during construction. They typically offer lower entry prices, flexible payment plans, and strong capital appreciation potential by handover.",
      },
      {
        q: "What costs are involved in buying property in Dubai?",
        a: "Beyond the purchase price, buyers should budget for Dubai Land Department (DLD) transfer fee (4%), agency commission (2%), and registration fees. Off-plan purchases may also include an Oqood registration fee.",
      },
      {
        q: "Is financing available for property purchases?",
        a: "Yes. UAE banks offer mortgages to residents and non-residents. Residents can typically borrow up to 80% of the property value (first property), while non-residents are generally limited to 50–60% LTV.",
      },
      {
        q: "What is the Dubai Land Department (DLD)?",
        a: "The Dubai Land Department is the government body responsible for registering, regulating, and overseeing all property transactions in Dubai. All sales must be registered with the DLD to be legally valid.",
      },
    ],
  },
  {
    category: "Payment Plans & Finance",
    items: [
      {
        q: "What payment plans do developers offer?",
        a: "Most Dubai developers offer flexible instalment plans — commonly 30/70 (30% during construction, 70% on handover) or 50/50 splits. Some post-handover payment plans extend up to 5 years after completion.",
      },
      {
        q: "Is there a Golden Visa linked to property investment?",
        a: "Yes. Purchasing property worth AED 2 million or more qualifies investors for a 10-year UAE Golden Visa, giving residency rights for the investor and their immediate family.",
      },
      {
        q: "Are there any property taxes in Dubai?",
        a: "Dubai has no annual property tax. The one-time 4% DLD transfer fee and annual service charges are the primary ongoing costs. This tax-free environment is one of the key attractions for investors.",
      },
    ],
  },
  {
    category: "Renting & ROI",
    items: [
      {
        q: "What rental yields can I expect in Dubai?",
        a: "Dubai offers some of the highest rental yields globally. Gross yields typically range from 5–9% depending on location and property type — JVC, Business Bay, and Dubai Silicon Oasis frequently achieve above 7%.",
      },
      {
        q: "Can I rent my property out short-term (Airbnb)?",
        a: "Yes, short-term rentals are legal in Dubai but require a holiday home licence from Dubai Tourism (DTCM). Managing through a licensed operator is the most straightforward route.",
      },
      {
        q: "What is a RERA-registered broker?",
        a: "All real estate brokers in Dubai must be licensed by the Real Estate Regulatory Agency (RERA), a division of the DLD. Always verify your agent's RERA licence number before engaging.",
      },
    ],
  },
  {
    category: "Working with Elysian",
    items: [
      {
        q: "Is your service free for buyers?",
        a: "Our consultation and property matching services are completely free for buyers on developer direct and select resale listings. Agent commissions on standard resale transactions are clearly disclosed upfront.",
      },
      {
        q: "Can you help me invest from abroad?",
        a: "Absolutely. We work with international investors every day. All documentation, viewings, and contract signings can be handled remotely via video call and secure digital signatures.",
      },
      {
        q: "How do I start the buying process?",
        a: "Simply reach out via our contact form or WhatsApp. Our advisors will understand your goals, shortlist suitable properties, arrange viewings (in-person or virtual), and guide you through every step to completion.",
      },
    ],
  },
];

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(25,37,55,0.08)",
        transition: "background 0.2s",
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "22px 0",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: open ? "#192537" : "#192537",
            lineHeight: 1.4,
            flex: 1,
          }}
        >
          {q}
        </span>
        <span
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: open ? "#7fe2e3" : "rgba(127,226,227,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          {open ? <Minus size={13} color="#192537" /> : <Plus size={13} color="#192537" />}
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
            paddingBottom: 22,
            paddingRight: 44,
          }}
        >
          {a}
        </p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  return (
    <main>
      {/* Hero banner */}
      <section
        style={{
          background: "#0d1e2e",
          paddingTop: 140,
          paddingBottom: 80,
          paddingLeft: 24,
          paddingRight: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
        }} />

        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 24, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
            <span style={{ fontFamily: "Verdana", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.35em", textTransform: "uppercase" }}>Help Centre</span>
            <div style={{ width: 24, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
          </div>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(32px, 5vw, 52px)", color: "white", lineHeight: 1.1, marginBottom: 20, letterSpacing: "-0.025em" }}>
            Frequently Asked<br />
            <span style={{ color: "#7fe2e3" }}>Questions</span>
          </h1>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9, maxWidth: 480, margin: "0 auto" }}>
            Everything you need to know about buying, investing, and renting property in Dubai.
          </p>
        </div>
      </section>

      {/* FAQ body */}
      <section style={{ background: "#f9f9f9", padding: "80px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 56 }}>
          {faqCategories.map(({ category, items }) => (
            <div key={category}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                <div style={{ width: 4, height: 22, background: "#7fe2e3", borderRadius: 2 }} />
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 18, color: "#192537", letterSpacing: "-0.01em" }}>
                  {category}
                </h2>
              </div>
              <div style={{ background: "white", borderRadius: 16, padding: "0 28px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>
                {items.map(({ q, a }) => (
                  <AccordionItem key={q} q={q} a={a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section style={{ background: "#0d1e2e", padding: "64px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 26, color: "white", marginBottom: 14, letterSpacing: "-0.02em" }}>
            Still have questions?
          </h3>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.85, marginBottom: 32 }}>
            Our advisors are available 7 days a week. Reach out and we'll get back to you within the hour.
          </p>
          <a
            href="#"
            style={{
              display: "inline-block",
              background: "#7fe2e3",
              color: "#192537",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              padding: "14px 32px",
              borderRadius: 999,
              textDecoration: "none",
              letterSpacing: "0.03em",
            }}
          >
            Speak to an Advisor
          </a>
        </div>
      </section>

    </main>
  );
}
