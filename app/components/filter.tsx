"use client";
import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, MapPin } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const AREAS = [
  "Downtown Dubai", "Dubai Marina", "Palm Jumeirah", "Business Bay",
  "JVC", "JVT", "Eden Hills", "Dubai Motor City", "The Acres",
  "Yas Island", "DAMAC Hills", "Zayed City", "Jumeirah",
  "Dubai Hills", "Arabian Ranches", "Al Barsha", "Dubai Creek Harbour",
];

const DEVELOPERS = [
  "Al Hamra", "Emaar", "DAMAC", "Nakheel", "BEYOND", "Aldar",
  "Al Barari Developers", "Sobha", "Meraas", "Ellington",
  "Binghatti", "Azizi", "Select Group", "Reportage",
];

const HANDOVER_OPTIONS = ["Ready Now", "2025", "2026", "2027", "2028+"];

const LIFESTYLE_OPTIONS = [
  "Beachfront", "Golf", "Waterfront", "City View",
  "Family Community", "Investment", "Downtown Living", "Island Living",
];

const PROPERTY_TYPES = [
  "Villas", "Townhouses", "Apartments", "Penthouses",
  "Duplexes", "Studios", "Land Plots",
];

// ─── Types ────────────────────────────────────────────────────────────────────

// (DropPos removed — dropdowns now use position:absolute, not position:fixed)

export interface FilterState {
  projectSearch: string;
  priceFrom: number;
  priceTo: number;
  propertyTypes: string[];
  areas: string[];
  developers: string[];
  handover: string[];
  lifestyle: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  projectSearch: "", priceFrom: 0, priceTo: 100_000_000,
  propertyTypes: [], areas: [], developers: [], handover: [], lifestyle: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAED(val: number): string {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1) + "M";
  if (val >= 1_000) return (val / 1_000).toFixed(0) + "K";
  return val.toString();
}

// ─── CheckboxDropdown ─────────────────────────────────────────────────────────

function CheckboxDropdown({
  label, options, selected, onChange, searchable = false, searchPlaceholder = "Search…",
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelMinW = searchable ? 280 : 220;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  }

  function handleToggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setAlignRight(r.left + panelMinW > window.innerWidth - 8);
    }
    setOpen(o => !o);
  }

  const btnLabel =
    selected.length === 0 ? label
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`;

  const isActive = selected.length > 0;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 0 }}>
      <button
        onClick={handleToggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 6, width: "100%", height: 48, boxSizing: "border-box",
          border: isActive ? "1.5px solid #7fe2e3" : "1.5px solid #e0e0e0",
          borderRadius: 12, padding: "0 12px",
          background: "white", cursor: "pointer", fontFamily: "Verdana",
          fontSize: 13, color: isActive ? "#192537" : "#666",
          transition: "border-color 0.2s", minWidth: 0,
        }}
      >
        <span style={{ fontWeight: isActive ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
          {btnLabel}
        </span>
        <ChevronDown size={13} color={isActive ? "#7fe2e3" : "#aaa"}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: alignRight ? undefined : 0,
          right: alignRight ? 0 : undefined,
          minWidth: panelMinW,
          background: "white", border: "1.5px solid #e5e5e5", borderRadius: 14,
          zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", overflow: "hidden",
          boxSizing: "border-box",
        }}>
          {searchable && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f0f0f0" }}>
              <Search size={12} color="#bbb" />
              <input autoFocus type="text" placeholder={searchPlaceholder} value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontFamily: "Verdana", fontSize: 12, color: "#222", width: "100%", background: "transparent" }} />
            </div>
          )}
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {filtered.map(opt => (
              <label key={opt} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", fontSize: 13, color: "#333", cursor: "pointer",
                borderBottom: "0.5px solid #f5f5f5",
                background: selected.includes(opt) ? "#f0fbfb" : "white",
              }}>
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
                  style={{ accentColor: "#7fe2e3", width: 15, height: 15, cursor: "pointer", flexShrink: 0 }} />
                <span style={{ textAlign: "left" }}>{opt}</span>
              </label>
            ))}
            {filtered.length === 0 && <div style={{ padding: "14px 16px", fontSize: 12, color: "#bbb" }}>No results</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PriceDropdown ────────────────────────────────────────────────────────────

function PriceDropdown({ priceFrom, priceTo, onChange }: {
  priceFrom: number; priceTo: number; onChange: (from: number, to: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const MAX = 100_000_000;
  const PANEL_W = 260;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isActive = priceFrom > 0 || priceTo < MAX;

  function handleToggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setAlignRight(r.left + PANEL_W > window.innerWidth - 8);
    }
    setOpen(o => !o);
  }

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 0 }}>
      <button onClick={handleToggle} style={{
        display: "flex", alignItems: "center", gap: 6,
        width: "100%", height: 48, boxSizing: "border-box",
        border: isActive ? "1.5px solid #7fe2e3" : "1.5px solid #e0e0e0",
        borderRadius: 12, padding: "0 12px",
        background: "white", cursor: "pointer", textAlign: "left",
        transition: "border-color 0.2s", minWidth: 0, overflow: "hidden",
      }}>
        <span style={{ fontFamily: "Verdana", fontSize: 13, color: isActive ? "#192537" : "#666", fontWeight: isActive ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isActive
            ? `AED ${formatAED(priceFrom)} – ${formatAED(priceTo)}`
            : "Price Range"}
        </span>
        <ChevronDown size={13} color={isActive ? "#7fe2e3" : "#aaa"} style={{ flexShrink: 0, marginLeft: "auto", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: alignRight ? undefined : 0,
          right: alignRight ? 0 : undefined,
          minWidth: PANEL_W,
          background: "white", border: "1.5px solid #e5e5e5", borderRadius: 14,
          zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          padding: "18px 20px 16px", boxSizing: "border-box",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Min Price", val: priceFrom, oc: (v: number) => onChange(Math.min(v, priceTo - 500_000), priceTo) },
              { label: "Max Price", val: priceTo,   oc: (v: number) => onChange(priceFrom, Math.max(v, priceFrom + 500_000)) },
            ].map(({ label, val, oc }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontFamily: "Verdana", fontSize: 11, color: "#888" }}>{label}</label>
                  <span style={{ fontFamily: "Verdana", fontSize: 12, fontWeight: 600, color: "#192537" }}>AED {val.toLocaleString()}</span>
                </div>
                <input type="range" min={0} max={MAX} step={500_000} value={val}
                  onChange={e => oc(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#7fe2e3" }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main FilterBar ───────────────────────────────────────────────────────────

export default function FilterBar({
  filters,
  onFiltersChange,
  onSearch,
  onShowMap,
  areas = AREAS,
  developers = DEVELOPERS,
  projectNames = [],
  propertyTypes = PROPERTY_TYPES,
  lifestyleOptions = LIFESTYLE_OPTIONS,
}: {
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  onSearch?: (f: FilterState) => void;
  onShowMap?: () => void;
  areas?: string[];
  developers?: string[];
  projectNames?: string[];
  propertyTypes?: string[];
  lifestyleOptions?: string[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = filters.projectSearch.trim().length > 0
    ? projectNames.filter(n => n.toLowerCase().includes(filters.projectSearch.toLowerCase())).slice(0, 8)
    : [];

  function update<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    onFiltersChange({ ...filters, [key]: val });
  }

  function selectSuggestion(name: string) {
    const updated = { ...filters, projectSearch: name };
    onFiltersChange(updated);
    onSearch?.(updated);
    setShowSuggestions(false);
  }

  return (
    <>
      <style>{`
        .fb-outer {
          background: white;
          border-radius: 20px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.10);
          padding: 14px 16px;
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        /* ── Desktop (>900px): 2 tight rows, buttons in row 2 ── */
        .fb-row1 {
          display: grid;
          grid-template-columns: minmax(0,1.4fr) minmax(0,1fr) minmax(0,0.9fr);
          gap: 10px;
        }
        .fb-row2 {
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 240px;
          gap: 10px;
          margin-top: 10px;
        }

        /* ── Tablet (601–900px): filters in row2, buttons get their own row ── */
        @media (max-width: 900px) and (min-width: 601px) {
          .fb-row1 {
            grid-template-columns: minmax(0,1.4fr) minmax(0,1fr) minmax(0,0.9fr);
          }
          .fb-row2 {
            grid-template-columns: minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);
          }
          .fb-row3 {
            display: flex !important;
            gap: 10px;
            margin-top: 10px;
          }
        }

        /* ── Mobile (≤600px): everything single column ── */
        @media (max-width: 600px) {
          .fb-row1 { grid-template-columns: 1fr; }
          .fb-row2 { grid-template-columns: 1fr 1fr; }
          .fb-row3 {
            display: flex !important;
            gap: 10px;
            margin-top: 10px;
          }
        }

        /* Row3 hidden on desktop (buttons live in row2 there) */
        .fb-row3 { display: none; }

        /* On desktop, show the inline buttons inside row2 */
        .fb-inline-btns { display: flex; gap: 8px; }

        /* On tablet/mobile, hide inline buttons — they move to row3 */
        @media (max-width: 900px) {
          .fb-inline-btns { display: none; }
        }

        .fb-action {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          width: 100%;
          border-radius: 12px;
          font-family: Verdana;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-sizing: border-box;
          white-space: nowrap;
        }
        .fb-map { background: white; border: 1.5px solid #7fe2e3; color: #7fe2e3; }
        .fb-map:hover { background: #f0fbfb; }
        .fb-find { background: #7fe2e3; border: none; color: #192537; }
        .fb-find:hover { background: #5dd4d5; }
      `}</style>

      <div className="fb-outer">

        {/* ── Row 1: search + price + property type ── */}
        <div className="fb-row1">
          <div ref={searchRef} style={{ position: "relative", minWidth: 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              border: `1.5px solid ${filters.projectSearch ? "#7fe2e3" : "#e0e0e0"}`, borderRadius: 12,
              padding: "0 12px", height: 48, background: "white",
              boxSizing: "border-box", width: "100%",
            }}>
              <Search size={15} color="#aaa" style={{ flexShrink: 0 }} />
              <input
                type="text" placeholder="Search Project Name"
                value={filters.projectSearch}
                onChange={e => {
                  update("projectSearch", e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                style={{ border: "none", outline: "none", fontFamily: "Verdana", fontSize: 13, color: "#222", width: "100%", background: "transparent" }}
              />
              {filters.projectSearch && (
                <button onClick={() => { update("projectSearch", ""); setShowSuggestions(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: 54, left: 0, right: 0,
                background: "white", border: "1.5px solid #e5e5e5", borderRadius: 14,
                zIndex: 300, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", overflow: "hidden",
              }}>
                {suggestions.map(name => (
                  <button key={name} onMouseDown={() => selectSuggestion(name)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "11px 16px", background: "white",
                      border: "none", borderBottom: "0.5px solid #f5f5f5",
                      cursor: "pointer", textAlign: "left", fontFamily: "Verdana", fontSize: 13, color: "#333",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f0fbfb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "white")}
                  >
                    <Search size={12} color="#7fe2e3" style={{ flexShrink: 0 }} />
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <PriceDropdown
            priceFrom={filters.priceFrom} priceTo={filters.priceTo}
            onChange={(from, to) => onFiltersChange({ ...filters, priceFrom: from, priceTo: to })}
          />

          <CheckboxDropdown label="Property Type" options={propertyTypes}
            selected={filters.propertyTypes} onChange={vals => update("propertyTypes", vals)} />
        </div>

        {/* ── Row 2: 4 filter dropdowns + buttons (desktop only) ── */}
        <div className="fb-row2">
          <CheckboxDropdown label="Area" options={areas}
            selected={filters.areas} onChange={vals => update("areas", vals)}
            searchable searchPlaceholder="Search area" />

          <CheckboxDropdown label="Developer" options={developers}
            selected={filters.developers} onChange={vals => update("developers", vals)}
            searchable searchPlaceholder="Search developer" />

          <CheckboxDropdown label="Handover" options={HANDOVER_OPTIONS}
            selected={filters.handover} onChange={vals => update("handover", vals)} />

          <CheckboxDropdown label="Lifestyle" options={lifestyleOptions}
            selected={filters.lifestyle} onChange={vals => update("lifestyle", vals)} />

          {/* Buttons visible only on desktop (>900px) */}
          <div className="fb-inline-btns">
            {onShowMap && (
              <button className="fb-action fb-map" onClick={onShowMap}>
                <MapPin size={15} color="#7fe2e3" style={{ flexShrink: 0 }} />
                Show Map
              </button>
            )}

            <button className="fb-action fb-find" onClick={() => onSearch?.(filters)}>
              <Search size={15} color="#192537" style={{ flexShrink: 0 }} />
              Find
            </button>
          </div>
        </div>

        {/* ── Row 3: buttons only on tablet + mobile ── */}
        <div className="fb-row3">
          {onShowMap && (
            <button className="fb-action fb-map" onClick={onShowMap} style={{ flex: 1 }}>
              <MapPin size={15} color="#7fe2e3" style={{ flexShrink: 0 }} />
              Show Map
            </button>
          )}

          <button className="fb-action fb-find" onClick={() => onSearch?.(filters)} style={{ flex: 1 }}>
            <Search size={15} color="#192537" style={{ flexShrink: 0 }} />
            Find
          </button>
        </div>

      </div>
    </>
  );
}
