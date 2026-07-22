"use client";

interface PaginationProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalItems, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 38, height: 38, borderRadius: 10, border: "1.5px solid #e0e0e0",
    background: "white", fontFamily: "Montserrat, sans-serif", fontWeight: 600,
    fontSize: 13, color: "#192537", cursor: "pointer", transition: "all 0.2s",
    padding: "0 14px",
  };

  return (
    <div className="pgn-wrap" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 52, flexWrap: "wrap" }}>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        style={{ ...base, ...(page === 1 ? { color: "#ccc", cursor: "not-allowed", opacity: 0.5 } : {}) }}
      >
        ← Prev
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`d${i}`} style={{ fontFamily: "Montserrat, sans-serif", fontSize: 13, color: "#bbb", padding: "0 2px" }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            style={{ ...base, ...(p === page ? { background: "#192537", color: "#7fe2e3", border: "1.5px solid #192537" } : {}) }}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        style={{ ...base, ...(page === totalPages ? { color: "#ccc", cursor: "not-allowed", opacity: 0.5 } : {}) }}
      >
        Next →
      </button>

      <style>{`
        @media (max-width: 480px) {
          .pgn-wrap { gap: 4px; }
          .pgn-wrap button { min-width: 32px; height: 34px; font-size: 11px; padding: 0 8px; }
        }
      `}</style>
    </div>
  );
}
