"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Search, X, MapPin, ArrowUpRight } from "lucide-react";

const areas = [
  { id: "downtown",     name: "Downtown Dubai",     roi: "7.8%", listings: 142, lat: 25.1972, lng: 55.2744 },
  { id: "marina",       name: "Dubai Marina",        roi: "7.2%", listings: 198, lat: 25.0806, lng: 55.1403 },
  { id: "palm",         name: "Palm Jumeirah",        roi: "6.9%", listings: 87,  lat: 25.1124, lng: 55.1390 },
  { id: "business-bay", name: "Business Bay",         roi: "7.5%", listings: 115, lat: 25.1854, lng: 55.2642 },
  { id: "jvc",          name: "JVC",                 roi: "8.1%", listings: 203, lat: 25.0590, lng: 55.2057 },
  { id: "meydan",       name: "Meydan",              roi: "7.3%", listings: 64,  lat: 25.1629, lng: 55.3050 },
  { id: "creek",        name: "Dubai Creek Harbour", roi: "8.4%", listings: 76,  lat: 25.2180, lng: 55.3280 },
  { id: "hills",        name: "Damac Hills",         roi: "7.1%", listings: 93,  lat: 25.0260, lng: 55.2420 },
  { id: "jbr",          name: "JBR",                 roi: "6.8%", listings: 54,  lat: 25.0778, lng: 55.1315 },
  { id: "dso",          name: "Dubai Silicon Oasis", roi: "8.9%", listings: 128, lat: 25.1178, lng: 55.3800 },
  { id: "bluewaters",   name: "Bluewaters Island",   roi: "7.0%", listings: 41,  lat: 25.0824, lng: 55.1217 },
  { id: "sobha",        name: "Sobha Hartland",      roi: "7.6%", listings: 89,  lat: 25.1892, lng: 55.3165 },
];

type Area = typeof areas[0];
declare global { interface Window { google: any; __elysianMapInit: () => void; } }

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const MAPS_MAP_ID  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID    || "DEMO_MAP_ID";


/* ── Glass Tooltip ── */
function GlassTooltip({ area, onClose }: { area: Area; onClose: () => void }) {
  return (
    <div style={{ width: 230, borderRadius: 20, overflow: "hidden", background: "rgba(25,37,55,0.82)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", fontFamily: "Montserrat, Verdana, sans-serif" }}>
      <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 9, color: "#7fe2e3", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500, marginBottom: 5 }}>Dubai, UAE</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "white", lineHeight: 1.25 }}>{area.name}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, display: "flex" }}>
          <X size={14} color="rgba(255,255,255,0.5)" />
        </button>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "0 18px" }} />
      <div style={{ display: "flex", alignItems: "center", padding: "14px 18px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>Est. ROI</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "#7fe2e3" }}>{area.roi}</div>
        </div>
        <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.15)", margin: "0 16px" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>Listings</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "white" }}>{area.listings}</div>
        </div>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "0 18px" }} />
      <div style={{ padding: "12px 18px" }}>
        <a href={`/properties?area=${area.id}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 0", borderRadius: 999, background: "#192537", color: "white", fontSize: 12, fontWeight: 500, textDecoration: "none", letterSpacing: "0.03em", boxSizing: "border-box" as const, transition: "background 0.2s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#7fe2e3"; (e.currentTarget as HTMLAnchorElement).style.color = "#192537"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#192537"; (e.currentTarget as HTMLAnchorElement).style.color = "white"; }}
        >
          View All Listings
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#7fe2e3", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArrowUpRight size={11} color="#192537" />
          </span>
        </a>
      </div>
    </div>
  );
}

export default function PropertiesByArea() {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef  = useRef<any[]>([]);
  const overlayRef  = useRef<any>(null);
  const rootRef     = useRef<any>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const [selected,     setSelected]     = useState<Area | null>(null);
  const [searchVal,    setSearchVal]    = useState("");
  const [mapLoaded,    setMapLoaded]    = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = ["All", "High ROI (8%+)", "100+ Listings"];

  const filteredAreas = areas.filter((a) => {
    if (activeFilter === "High ROI (8%+)") return parseFloat(a.roi) >= 8;
    if (activeFilter === "100+ Listings")  return a.listings >= 100;
    return true;
  });

  /* ── Close tooltip ── */
  const closeTooltip = useCallback(() => {
    if (overlayRef.current) { overlayRef.current.setMap(null); overlayRef.current = null; }
    if (rootRef.current)    { rootRef.current.unmount(); rootRef.current = null; }
    setSelected(null);
  }, []);

  /* ── Show tooltip via OverlayView + createRoot ── */
  const showTooltip = useCallback((area: Area) => {
    if (!mapInstance.current || !window.google) return;
    if (overlayRef.current) { overlayRef.current.setMap(null); overlayRef.current = null; }
    if (rootRef.current)    { rootRef.current.unmount(); rootRef.current = null; }

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;z-index:999;pointer-events:auto;";

    class ElysianOverlay extends window.google.maps.OverlayView {
      onAdd()  { this.getPanes()!.floatPane.appendChild(container); }
      draw()   {
        const pt = this.getProjection().fromLatLngToDivPixel(new window.google.maps.LatLng(area.lat, area.lng));
        if (pt) { container.style.left = `${pt.x - 115}px`; container.style.top = `${pt.y - 290}px`; }
      }
      onRemove() { container.parentNode?.removeChild(container); }
    }

    const overlay = new ElysianOverlay();
    overlay.setMap(mapInstance.current);
    overlayRef.current = overlay;

    const root = createRoot(container);
    rootRef.current = root;
    root.render(<GlassTooltip area={area} onClose={closeTooltip} />);
    setSelected(area);
    mapInstance.current.panTo({ lat: area.lat, lng: area.lng });
  }, [closeTooltip]);

  /* ── Drop markers using AdvancedMarkerElement + PinElement ── */
  const dropMarkers = useCallback(async (map: any, areaList: Area[]) => {
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];

    // Use importLibrary so the marker library is guaranteed to be ready
    const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary("marker") as any;

    areaList.forEach((area) => {
      const pin = new PinElement({
        background:  "#192537",
        borderColor: "#7fe2e3",
        glyphColor:  "#7fe2e3",
        scale: 1.2,
      });

      const marker = new AdvancedMarkerElement({
        position: { lat: area.lat, lng: area.lng },
        map,
        title: area.name,
        content: pin.element,
      });

      marker.addListener("click", () => showTooltip(area));
      marker.element.addEventListener("mouseenter", () => showTooltip(area));
      markersRef.current.push(marker);
    });
  }, [showTooltip]);

  /* ── Init map ── */
  const initMap = useCallback(async () => {
    if (!mapRef.current || mapInstance.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 25.1124, lng: 55.2500 },
      zoom: 11,
      mapId: MAPS_MAP_ID,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
      gestureHandling: "greedy",
    });

    mapInstance.current = map;

    // Search using Autocomplete (still works, just deprecated for new customers — use until broken)
    if (inputRef.current) {
      try {
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "ae" },
          fields: ["geometry"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (place.geometry?.viewport) map.fitBounds(place.geometry.viewport);
          else if (place.geometry?.location) { map.panTo(place.geometry.location); map.setZoom(14); }
        });
      } catch { /* silent fallback */ }
    }

    dropMarkers(map, filteredAreas);
    map.addListener("click", closeTooltip);
    setMapLoaded(true);
  }, [filteredAreas, dropMarkers, closeTooltip]);

  /* ── Re-drop markers when filter changes ── */
  useEffect(() => {
    if (mapInstance.current) dropMarkers(mapInstance.current, filteredAreas);
  }, [activeFilter, dropMarkers, filteredAreas]);

  /* ── Load script ── */
  useEffect(() => {
    if (window.google?.maps) { initMap(); return; }
    window.__elysianMapInit = initMap;
    const s = document.createElement("script");
    s.src   = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&v=weekly&loading=async&libraries=places,marker&callback=__elysianMapInit`;
    s.async = true;
    document.head.appendChild(s);
    return () => { try { document.head.removeChild(s); } catch {} };
  }, [initMap]);

  const handleSidebarClick = (area: Area) => {
    if (mapInstance.current) { mapInstance.current.panTo({ lat: area.lat, lng: area.lng }); mapInstance.current.setZoom(13); }
    showTooltip(area);
  };

  return (
    <section style={{ background: "#f9f9f9", padding: "72px 0 0" }}>

      {/* ── Heading — above the map ── */}
      <div style={{ textAlign: "center", marginBottom: 40, padding: "0 32px" }}>
        <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", letterSpacing: "0.3em", textTransform: "uppercase", margin: "0 0 14px" }}>
          Explore Dubai
        </p>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: "clamp(28px, 4.5vw, 52px)", color: "#192537", margin: "0 0 16px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          Properties <span style={{ color: "#7fe2e3" }}>by Area</span>
        </h2>
        <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", maxWidth: 500, margin: "0 auto", lineHeight: 1.8 }}>
          Click any pin to explore ROI and available listings in each community.
        </p>
      </div>

      {/* ── Mobile search — above map ── */}
      <div className="mobile-search-bar" style={{ display: "none", padding: "0 16px 12px" }}>
        <div style={{ background: "white", borderRadius: 999, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(25,37,55,0.1)", border: "1.5px solid rgba(25,37,55,0.07)" }}>
          <Search size={14} color="#7a8a9e" strokeWidth={2} style={{ flexShrink: 0 }} />
          <input type="text" placeholder="Search a community in Dubai…" value={searchVal} onChange={(e) => setSearchVal(e.target.value)}
            style={{ border: "none", outline: "none", fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#192537", background: "transparent", flex: 1, minWidth: 0 }} />
          {searchVal && <button onClick={() => setSearchVal("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={13} color="#7a8a9e" /></button>}
        </div>
      </div>

      {/* ── Map container — heading lives INSIDE the map ── */}
      <div style={{ position: "relative", width: "100%", height: "780px" }} className="map-container">

        {/* Map canvas */}
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />



        {/* ── Search bar — top center inside map ── */}
        <div className="desktop-map-controls" style={{
          position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 5, width: "calc(100% - 560px)", maxWidth: 480, minWidth: 280,
        }}>
          <div style={{ background: "white", borderRadius: 999, padding: "11px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 24px rgba(25,37,55,0.14)", border: "1.5px solid rgba(25,37,55,0.07)" }}>
            <Search size={15} color="#7a8a9e" strokeWidth={2} style={{ flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search community or area in Dubai…"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              style={{ border: "none", outline: "none", fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#192537", background: "transparent", flex: 1, minWidth: 0 }}
            />
            {searchVal && (
              <button onClick={() => { setSearchVal(""); if (inputRef.current) inputRef.current.value = ""; }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <X size={14} color="#7a8a9e" />
              </button>
            )}
          </div>
        </div>

        {/* ── Sidebar — right ── */}
        <div className="map-sidebar" style={{
          position: "absolute", top: 16, bottom: 16, right: 16, width: 230,
          overflowY: "auto", background: "white", borderRadius: 20,
          boxShadow: "0 8px 40px rgba(25,37,55,0.14)", zIndex: 5, scrollbarWidth: "none" as const,
        }}>
          <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid #f0f4f8" }}>
            <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7a8a9e", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>
              {filteredAreas.length} Areas
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {filters.map((f) => {
                const isActive = activeFilter === f;
                return (
                  <button key={f} onClick={() => setActiveFilter(f)} style={{
                    padding: "5px 12px", borderRadius: 999,
                    border: `1.5px solid ${isActive ? "#192537" : "#e0e8f0"}`,
                    background: isActive ? "#192537" : "transparent",
                    color: isActive ? "white" : "#7a8a9e",
                    fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 11,
                    cursor: "pointer", whiteSpace: "nowrap" as const, transition: "all 0.2s",
                  }}>{f}</button>
                );
              })}
            </div>
          </div>
          {filteredAreas.map((area) => {
            const isActive = selected?.id === area.id;
            return (
              <button key={area.id} onClick={() => handleSidebarClick(area)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "10px 14px",
                background: isActive ? "rgba(127,226,227,0.1)" : "transparent",
                border: "none", borderLeft: isActive ? "3px solid #7fe2e3" : "3px solid transparent",
                cursor: "pointer", textAlign: "left" as const, transition: "all 0.18s",
              }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafb"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 12, color: "#192537", marginBottom: 2 }}>{area.name}</div>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7a8a9e" }}>{area.listings} listings</div>
                </div>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 12, color: "#7fe2e3", flexShrink: 0, marginLeft: 8 }}>{area.roi}</span>
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {!mapLoaded && (
          <div style={{ position: "absolute", inset: 0, background: "#f5f7fa", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <MapPin size={32} color="#7fe2e3" />
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 14, color: "#192537" }}>Loading map…</p>
          </div>
        )}
      </div>

      {/* ── Mobile filters + cards ── */}
      <div className="mobile-filters" style={{ display: "none", padding: "14px 16px 0", gap: 8, flexWrap: "wrap" as const }}>
        {filters.map((f) => {
          const isActive = activeFilter === f;
          return (
            <button key={f} onClick={() => setActiveFilter(f)} style={{
              padding: "8px 18px", borderRadius: 999,
              border: `1.5px solid ${isActive ? "#192537" : "#e0e8f0"}`,
              background: isActive ? "#192537" : "white",
              color: isActive ? "white" : "#7a8a9e",
              fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 12,
              cursor: "pointer", boxShadow: "0 2px 8px rgba(25,37,55,0.07)",
            }}>{f}</button>
          );
        })}
      </div>

      <div className="mobile-area-list" style={{ display: "none", padding: "12px 0 0" }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingBottom: 8, paddingLeft: 16, paddingRight: 16, scrollbarWidth: "none" as const }}>
          {filteredAreas.map((area) => {
            const isActive = selected?.id === area.id;
            return (
              <a key={area.id} href={`/properties?area=${area.id}`}
                onClick={(e) => { e.preventDefault(); setSelected(area); }}
                style={{ flex: "0 0 auto", width: 170, scrollSnapAlign: "start", background: isActive ? "#192537" : "white", borderRadius: 16, padding: "14px 16px", boxShadow: "0 4px 16px rgba(25,37,55,0.08)", border: isActive ? "1.5px solid #7fe2e3" : "1.5px solid transparent", textDecoration: "none", display: "block" }}
              >
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 13, color: isActive ? "white" : "#192537", marginBottom: 6, lineHeight: 1.3 }}>{area.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: isActive ? "rgba(255,255,255,0.6)" : "#7a8a9e" }}>{area.listings} listings</span>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 13, color: "#7fe2e3" }}>{area.roi}</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      <p style={{ textAlign: "center", fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#b0bec8", padding: "16px 32px 0", marginBottom: 0 }}>
        ROI figures are estimates based on current market data and may vary.
      </p>

      <style>{`
        .map-sidebar::-webkit-scrollbar { display: none; }
        .mobile-area-list div::-webkit-scrollbar { display: none; }
        /* Remove Google autocomplete ugly border */
        .pac-container { border-radius: 12px; border: 1.5px solid #e8edf4; box-shadow: 0 8px 32px rgba(25,37,55,0.12); margin-top: 8px; font-family: Verdana, sans-serif; }
        .pac-item { padding: 8px 14px; font-size: 13px; cursor: pointer; }
        .pac-item:hover { background: #f5f7fa; }
        @media (max-width: 768px) {
          .map-container         { height: 520px !important; }
          .desktop-map-controls  { display: none !important; }
          .map-sidebar           { display: none !important; }
          .mobile-search-bar     { display: block !important; }
          .mobile-filters        { display: flex !important; }
          .mobile-area-list      { display: block !important; }
        }
        @media (max-width: 480px) {
          .map-container { height: 420px !important; }
        }
      `}</style>
    </section>
  );
}