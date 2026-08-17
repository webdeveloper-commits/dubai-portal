import type { NextConfig } from "next";

// Old developer slugs that were deleted during deduplication → canonical slug.
// Keeps old URLs alive (301 redirect) so bookmarks and Google don't 404.
const deletedDevSlugs: { old: string; canonical: string }[] = [
  // ── Dedup run (same-company variant names) ──────────────────────────────────
  { old: "al-barari",                       canonical: "al-barari-development" },
  { old: "al-hamra-development",            canonical: "al-hamra-real-estate-development-llc" },
  { old: "aldar-properties",                canonical: "aldar" },
  { old: "amis-development",                canonical: "amis" },
  { old: "azizi-properties",                canonical: "azizi-developments" },
  { old: "beyond-real-estate-development",  canonical: "beyond" },
  { old: "binghatti-holding-limited",       canonical: "binghatti" },
  { old: "binghatti-developers",            canonical: "binghatti" },
  { old: "binghatti-properties",            canonical: "binghatti" },
  { old: "binghatti-holding",               canonical: "binghatti" },
  { old: "bnw-properties",                  canonical: "bnw-developments" },
  { old: "ellington-properties",            canonical: "ellington" },
  { old: "emaar",                           canonical: "emaar-properties" },
  { old: "expo-city-dubai",                 canonical: "expo-city" },
  { old: "fakhruddin",                      canonical: "fakhruddin-properties" },
  { old: "hh-development",                  canonical: "h-and-h-development" },
  { old: "imtiaz",                          canonical: "imtiaz-development" },
  { old: "imtiaz-developments",             canonical: "imtiaz-development" },
  { old: "irth-group",                      canonical: "irth" },
  { old: "irth-development",                canonical: "irth" },
  { old: "majid-al-futtaim",               canonical: "majid-al-futtaim-group" },
  { old: "majid-al-futtaim-properties",    canonical: "majid-al-futtaim-group" },
  { old: "major-developments",              canonical: "major-developers" },
  { old: "major-development",               canonical: "major-developers" },
  { old: "meraas",                          canonical: "meraas-holding" },
  { old: "meraas-properties",              canonical: "meraas-holding" },
  { old: "modon",                           canonical: "modon-properties" },
  { old: "nakheel",                         canonical: "nakheel-properties" },
  { old: "neoterra-developments",          canonical: "neoterra-real-estate-development" },
  { old: "nshama",                          canonical: "nshama-properties" },
  { old: "ohana-development",              canonical: "ohana-real-estate-development" },
  { old: "palma-holdings",                 canonical: "palma-holding" },
  { old: "range",                           canonical: "range-developments" },
  { old: "sobha",                           canonical: "sobha-realty" },
  { old: "source-of-fate",                  canonical: "source-of-fate-properties" },
  { old: "dubai-south-properties",         canonical: "dubai-south" },
  { old: "wasl",                            canonical: "wasl-group" },
  { old: "wasl-properties",                canonical: "wasl-group" },
  // ── JV entries that were deleted ─────────────────────────────────────────────
  { old: "amis-x-jacob-and-co",                    canonical: "amis" },
  { old: "avnew-development-kora-properties",      canonical: "avenew-development" },
  { old: "avenew-development-x-wadeen-developers", canonical: "avenew-development" },
  { old: "beyond-omniyat-group",                   canonical: "beyond" },
  { old: "durar-group-octa-development",           canonical: "durar-group" },
  { old: "igo-invest-group-overseas",              canonical: "igo" },
  { old: "meraas-brookfield-properties",           canonical: "meraas-holding" },
  { old: "octa-durar-f5",                          canonical: "octa-properties" },
  { old: "shurooq-see-holding",                    canonical: "shurooq" },
  { old: "taraf-yas-holding",                      canonical: "taraf" },
  { old: "zaya-five-holdings",                     canonical: "zaya" },
];

// Old project slugs with accented characters → ASCII slugs.
const accentedProjectSlugs: { old: string; ascii: string }[] = [
  { old: "le-ch%C3%A2teau-by-beyond",                        ascii: "le-chateau-by-beyond" },
  { old: "hado-by-beyond-at-si%C3%B8ra-dubai-islands",       ascii: "hado-by-beyond-at-sira-dubai-islands" },
  { old: "at%C3%A9lis-at-d3",                                ascii: "atelis-at-d3" },
  { old: "arthouse-residences-by-cl%C3%A9dor",              ascii: "arthouse-residences-by-cledor" },
  { old: "treppan-living-priv%C3%A9",                        ascii: "treppan-living-prive" },
  { old: "enchant%C3%A9-by-grid-properties",                 ascii: "enchante-by-grid-properties" },
  { old: "sol%C3%A9va-beach-residences",                     ascii: "soleva-beach-residences" },
  { old: "gianfranco-ferr%C3%A9-residences",                 ascii: "gianfranco-ferre-residences" },
  { old: "c%C3%B4tier-house",                                ascii: "cotier-house" },
  { old: "r%C3%A9sidences-du-port-by-marriott",              ascii: "residences-du-port-by-marriott" },
  { old: "le-chateau-pi%C3%A9trus",                          ascii: "le-chateau-pietrus" },
];

const nextConfig: NextConfig = {
  async redirects() {
    const devRedirects = deletedDevSlugs.map(({ old, canonical }) => ({
      source:      `/developers/${old}`,
      destination: `/developers/${canonical}`,
      permanent:   true,
    }));
    const projectRedirects = accentedProjectSlugs.map(({ old, ascii }) => ({
      source:      `/projects/${old}`,
      destination: `/projects/${ascii}`,
      permanent:   true,
    }));
    return [...devRedirects, ...projectRedirects];
  },
};

export default nextConfig;
