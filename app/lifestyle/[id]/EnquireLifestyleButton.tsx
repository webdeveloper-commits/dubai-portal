"use client";
import { useState } from "react";
import EnquiryModal from "@/app/components/EnquiryModal";

export default function EnquireLifestyleButton({ lifestyleLabel }: { lifestyleLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: "#7fe2e3", color: "#192537",
          fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14,
          padding: "16px 36px", borderRadius: 14, border: "none", cursor: "pointer",
          boxShadow: "0 8px 32px rgba(127,226,227,0.35)",
          transition: "background 0.2s, transform 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#5dd4d5"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#7fe2e3"; }}
      >
        Speak to an Advisor
      </button>
      {open && (
        <EnquiryModal
          isOpen={open}
          onClose={() => setOpen(false)}
          context={{ areaName: lifestyleLabel }}
        />
      )}
    </>
  );
}
