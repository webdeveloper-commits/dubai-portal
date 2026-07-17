"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { Search, X, Navigation } from "lucide-react";

const LIBRARIES: ("places")[] = ["places"];
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface Place {
  place_id: string;
  name: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry: { location: google.maps.LatLng };
}

interface Props {
  areaName: string;
  latitude?: number;
  longitude?: number;
}

export default function PrimeLocationMap({ areaName, latitude, longitude }: Props) {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  );
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: MAPS_KEY,
    libraries: LIBRARIES,
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapInstance(map);
    setPlacesService(new window.google.maps.places.PlacesService(map));
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
    setMapInstance(null);
    setPlacesService(null);
  }, []);

  useEffect(() => {
    if (!isLoaded || !areaName || (latitude && longitude)) return;
    const svc = new window.google.maps.places.PlacesService(document.createElement("div"));
    svc.textSearch({ query: `${areaName}, UAE`, fields: ["geometry", "name"] }, (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.length) {
        const loc = results[0]?.geometry?.location;
        if (loc) { setCenter({ lat: loc.lat(), lng: loc.lng() }); return; }
      }
      // last-resort fallback: centre of UAE
      setCenter({ lat: 24.4539, lng: 54.3773 });
    });
  }, [isLoaded, areaName, latitude, longitude]);

  const searchByText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placesService || !searchQuery || !center) return;
    placesService.textSearch(
      { location: new window.google.maps.LatLng(center.lat, center.lng), radius: 3000, query: searchQuery },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          setPlaces(results as unknown as Place[]);
          const bounds = new window.google.maps.LatLngBounds();
          results.forEach((p) => p?.geometry?.location && bounds.extend(p.geometry.location));
          mapInstance?.fitBounds(bounds);
        } else {
          setPlaces([]);
        }
      }
    );
  };

  const resetMap = () => {
    setPlaces([]);
    setSearchQuery("");
    setSelectedPlace(null);
    if (mapInstance && center) { mapInstance.panTo(center); mapInstance.setZoom(14); }
  };

  if (!isLoaded || !center) {
    return (
      <div style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>
        <div style={{ padding: "28px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 4, height: 22, background: "#7fe2e3", borderRadius: 2 }} />
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", margin: 0 }}>Location</h2>
          </div>
        </div>
        <div style={{ height: 340, background: "#f4f6f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e" }}>Loading map…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>
      <div style={{ padding: "28px 28px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 4, height: 22, background: "#7fe2e3", borderRadius: 2 }} />
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", margin: 0 }}>Location</h2>
        </div>
        <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7a8a9e", margin: 0 }}>
          Search hospitals, schools, restaurants and more nearby <strong>{areaName}</strong>.
        </p>
      </div>

      {places.length > 0 && (
        <div style={{ margin: "0 28px 16px", background: "#f8fafb", borderRadius: 12, padding: "12px 14px", maxHeight: 200, overflowY: "auto", border: "1px solid #f0f0f0" }}>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{places.length} results found</p>
          {places.map((place, i) => (
            <button key={place.place_id || i}
              onClick={() => { setSelectedPlace(place); mapInstance?.panTo(place.geometry.location); mapInstance?.setZoom(16); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "white", border: "1px solid #f0f0f0", borderRadius: 8, padding: "8px 10px", cursor: "pointer", marginBottom: 6, textAlign: "left" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#7fe2e3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#0f3d4a", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ overflow: "hidden" }}>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#192537", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{place.name}</p>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7a8a9e", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{place.vicinity}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{ position: "relative", height: 360, margin: "0 0 0" }}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={center}
          zoom={14}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{ disableDefaultUI: true, zoomControl: true, mapTypeControl: false }}
        >
          <Marker position={center} icon={{ url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" }} />
          {places.map((place, i) => (
            <Marker
              key={place.place_id}
              position={place.geometry.location}
              onClick={() => setSelectedPlace(place)}
              label={{ text: String(i + 1), color: "white", fontSize: "12px", fontWeight: "bold" }}
            />
          ))}
          {selectedPlace && (
            <InfoWindow position={selectedPlace.geometry.location} onCloseClick={() => setSelectedPlace(null)}>
              <div style={{ padding: "6px 4px", maxWidth: 200 }}>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#192537", margin: "0 0 4px" }}>{selectedPlace.name}</p>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", margin: "0 0 6px" }}>{selectedPlace.vicinity}</p>
                {selectedPlace.rating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#f59e0b" }}>★</span>
                    <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, fontWeight: 700 }}>{selectedPlace.rating}</span>
                    <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#aaa" }}>({selectedPlace.user_ratings_total || 0})</span>
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 10 }}>
          <form onSubmit={searchByText} style={{ background: "white", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(25,37,55,0.12)", border: "1.5px solid #e8edf4" }}>
            <Search size={15} color="#7a8a9e" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nearby (e.g. schools, cafes, hospitals)…"
              style={{ flex: 1, border: "none", outline: "none", fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#192537", background: "transparent", minWidth: 0 }}
            />
            <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
              <Navigation size={15} color="#7fe2e3" />
            </button>
            {(places.length > 0 || searchQuery) && (
              <button type="button" onClick={resetMap} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                <X size={14} color="#7a8a9e" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
