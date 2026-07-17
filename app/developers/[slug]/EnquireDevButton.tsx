"use client";
import { useState } from "react";
import EnquiryModal from "@/app/components/EnquiryModal";

export default function EnquireDevButton({ developerName }: { developerName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", background: "#192537", color: "white",
          fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13,
          padding: "13px 20px", borderRadius: 12, border: "none", cursor: "pointer",
        }}
      >
        Enquire — Free Advice
      </button>
      {open && (
        <EnquiryModal
          isOpen={open}
          onClose={() => setOpen(false)}
          context={{ developerName }}
        />
      )}
    </>
  );
}
