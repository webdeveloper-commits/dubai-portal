// ── Client-side lead tracking ─────────────────────────────────────────────────
// Uses sessionStorage so data persists across page navigations within the same
// browser tab, even when the URL changes (listing → detail → form).

const UTM_KEY    = "ely_utm";    // Google Ads / UTM data from landing page
const SEARCH_KEY = "ely_search"; // Last active filter/search state

export interface UTMData {
  utm_source?:     string;
  utm_medium?:     string;
  utm_campaign?:   string;
  utm_content?:    string;
  utm_term?:       string;
  gclid?:          string;  // Google Click ID (auto-appended by Google Ads)
  landing_page?:   string;  // full URL where user first arrived
  captured_at?:    string;
  custom_params?:  Record<string, string>; // any extra params Google Ads sends (lifestyle=beach, area=marina, etc.)
}

export interface SearchContext {
  areas?:          string[];
  developers?:     string[];
  property_types?: string[];
  lifestyle?:      string[];
  handover?:       string[];
  price_from?:     number;
  price_to?:       number;
  query?:          string;
  source_page?:    string; // URL of the listing page they searched on
  updated_at?:     string;
}

// ── UTM capture (call once per page load from TrackingInit) ──────────────────

/** Captures UTM params + gclid from the landing URL into sessionStorage.
 *  First-touch model: only saves on the FIRST visit in the session so that
 *  internal navigation doesn't overwrite the original ad attribution. */
export function captureUTMParams(): void {
  if (typeof window === "undefined") return;
  try {
    const p           = new URLSearchParams(window.location.search);
    const utmSource   = p.get("utm_source");
    const gclid       = p.get("gclid");
    if (!utmSource && !gclid) return; // No tracking params — nothing to save

    if (sessionStorage.getItem(UTM_KEY)) return; // Already captured this session

    // Separate known UTM/Google fields from custom ad params
    const KNOWN = new Set(["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid"]);
    const custom: Record<string, string> = {};
    p.forEach((val, key) => { if (!KNOWN.has(key)) custom[key] = val; });

    const data: UTMData = {
      utm_source:    utmSource                    || undefined,
      utm_medium:    p.get("utm_medium")          || undefined,
      utm_campaign:  p.get("utm_campaign")        || undefined,
      utm_content:   p.get("utm_content")         || undefined,
      utm_term:      p.get("utm_term")            || undefined,
      gclid:         gclid                        || undefined,
      landing_page:  window.location.href,
      captured_at:   new Date().toISOString(),
      custom_params: Object.keys(custom).length ? custom : undefined,
    };
    sessionStorage.setItem(UTM_KEY, JSON.stringify(data));
  } catch { /* sessionStorage may be blocked (private mode, etc.) */ }
}

// ── Search context (call from the filter grid when filters change) ────────────

/** Saves the user's active search/filter criteria to sessionStorage.
 *  This bridges the gap when user goes from /projects?area=X to /projects/slug
 *  — the filter state is no longer in the URL but is still in sessionStorage. */
export function saveSearchContext(ctx: SearchContext): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SEARCH_KEY, JSON.stringify({
      ...ctx,
      source_page: window.location.href,
      updated_at:  new Date().toISOString(),
    }));
  } catch { /* ignore */ }
}

// ── Read all tracking data at form submit time ────────────────────────────────

/** Returns a merged tracking payload to attach to every form submission.
 *  Falls back to current URL params in case sessionStorage was cleared. */
export function getLeadTrackingData(): {
  utm_source:     string | null;
  utm_medium:     string | null;
  utm_campaign:   string | null;
  utm_content:    string | null;
  utm_term:       string | null;
  gclid:          string | null;
  landing_page:   string | null;
  custom_params:  Record<string, string> | null;
  search_context: SearchContext | null;
} {
  const empty = {
    utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: null, utm_term: null, gclid: null,
    landing_page: null, custom_params: null, search_context: null,
  };
  if (typeof window === "undefined") return empty;

  try {
    const utm:    UTMData       | null = JSON.parse(sessionStorage.getItem(UTM_KEY)    || "null");
    const search: SearchContext | null = JSON.parse(sessionStorage.getItem(SEARCH_KEY) || "null");

    // Fallback: read current URL params (covers direct ad landing on a detail page)
    const p = new URLSearchParams(window.location.search);
    const KNOWN = new Set(["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid"]);
    const currentCustom: Record<string, string> = {};
    p.forEach((val, key) => { if (!KNOWN.has(key)) currentCustom[key] = val; });

    return {
      utm_source:    utm?.utm_source    || p.get("utm_source")   || null,
      utm_medium:    utm?.utm_medium    || p.get("utm_medium")   || null,
      utm_campaign:  utm?.utm_campaign  || p.get("utm_campaign") || null,
      utm_content:   utm?.utm_content   || p.get("utm_content")  || null,
      utm_term:      utm?.utm_term      || p.get("utm_term")     || null,
      gclid:         utm?.gclid         || p.get("gclid")        || null,
      landing_page:  utm?.landing_page  || null,
      custom_params: utm?.custom_params || (Object.keys(currentCustom).length ? currentCustom : null),
      search_context: search || null,
    };
  } catch { return empty; }
}
