"""
Scrape developer logos from PropertyFinder (582 devs, 49 pages),
match to our Supabase developers by name similarity,
upload each logo to Cloudinary, and update Supabase.

Usage:
  venv/bin/python3 scrape_dev_logos.py --dry-run   # show matches only
  venv/bin/python3 scrape_dev_logos.py             # apply

Matching strategy (in order):
  1. Exact slug match
  2. Exact normalised-name match
  3. One name is a prefix of the other (≥5 chars)
  4. Word-overlap ≥ 66 % of the longer set
"""
import os, sys, json, time, re, unicodedata, requests
import cloudinary
import cloudinary.uploader

# ── Load .env ──────────────────────────────────────────────────────────────────
_env = os.path.join(os.path.dirname(__file__), ".env")
with open(_env) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            # Use assignment (not setdefault) so last value wins — the .env has
            # placeholder lines before real values for some keys.
            os.environ[k.strip()] = v.strip()

sys.path.insert(0, os.path.dirname(__file__))
from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

cloudinary.config(
    cloud_name = os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key    = os.environ["CLOUDINARY_API_KEY"],
    api_secret = os.environ["CLOUDINARY_API_SECRET"],
    secure     = True,
)

DRY = "--dry-run" in sys.argv

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

CACHE_FILE = os.path.join(os.path.dirname(__file__), "pf_dev_logos.json")

STRIP_WORDS = {
    "properties", "property", "development", "developments", "developer",
    "developers", "real", "estate", "holding", "holdings", "limited", "ltd",
    "llc", "group", "groups", "uae", "dubai", "international", "investments",
    "investment", "realty", "homes", "home", "living", "residences",
    "residence", "projects", "project", "construction", "contracting",
    "pjsc", "fzco", "fzllc", "pvt", "inc",
}


def norm(name: str) -> str:
    """Lowercase ASCII words, strip corporate suffixes."""
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    words  = re.sub(r"[^a-z0-9 ]", " ", ascii_.lower()).split()
    core   = [w for w in words if w not in STRIP_WORDS]
    return " ".join(core)


def slug_norm(slug: str) -> str:
    return slug.replace("-", " ").strip()


def word_overlap(a: str, b: str) -> float:
    wa, wb = set(a.split()), set(b.split())
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / max(len(wa), len(wb))


def match_score(pf_slug: str, pf_name_norm: str, sb_slug: str, sb_name_norm: str) -> float:
    """Return a match confidence 0–1 between a PF dev and a Supabase dev."""
    # 1. Exact slug
    if pf_slug == sb_slug:
        return 1.0
    # 2. Exact normalised name
    if pf_name_norm and pf_name_norm == sb_name_norm:
        return 0.95
    # 3. Slug segment containment — require word-boundary match to avoid
    #    "igo" matching inside "yigo-developments"
    def slug_contains(haystack: str, needle: str) -> bool:
        if len(needle) < 4:
            return False
        padded = f"-{haystack}-"
        return f"-{needle}-" in padded
    if slug_contains(pf_slug, sb_slug) or slug_contains(sb_slug, pf_slug):
        return 0.85
    # 4. Word overlap on normalised names
    ov = word_overlap(pf_name_norm, sb_name_norm)
    if ov >= 0.66:
        return ov * 0.8
    return 0.0


# ── Step 1: Scrape PF ─────────────────────────────────────────────────────────

def scrape_pf() -> dict:
    """Return {pf_slug: {name, logo_url}} for all PF developers."""
    if os.path.exists(CACHE_FILE):
        print(f"Using cached PF data from {CACHE_FILE}")
        with open(CACHE_FILE) as f:
            return json.load(f)

    pf = {}
    total_pages = 49

    for page in range(1, total_pages + 1):
        url = f"https://www.propertyfinder.ae/en/new-projects/dev-list/uae?page={page}"
        try:
            resp  = requests.get(url, headers=HEADERS, timeout=20)
            match = re.search(
                r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
                resp.text, re.DOTALL,
            )
            if not match:
                print(f"  [page {page}] no __NEXT_DATA__ — skipping")
                continue
            data = json.loads(match.group(1))
            devs = (data.get("props", {})
                        .get("pageProps", {})
                        .get("developersResult", {})
                        .get("data", []))
            for dev in devs:
                slug = dev.get("slug", "")
                logo = dev.get("logoUrl", "")
                if slug and logo:
                    pf[slug] = {"name": dev.get("name", ""), "logo_url": logo}
            print(f"  [page {page}/{total_pages}] +{len(devs)} devs  (total: {len(pf)})")
        except Exception as e:
            print(f"  [page {page}] error: {e}")
        time.sleep(0.4)

    with open(CACHE_FILE, "w") as f:
        json.dump(pf, f, indent=2)
    print(f"\nSaved {len(pf)} PF developers to cache\n")
    return pf


# ── Step 2: Upload logo to Cloudinary ─────────────────────────────────────────

def upload_logo(pf_logo_url: str, dev_slug: str):
    """Upload PF logo to Cloudinary. Returns secure Cloudinary URL or None."""
    try:
        result = cloudinary.uploader.upload(
            pf_logo_url,
            folder        = "dubai-portal/developer-logos",
            public_id     = dev_slug,
            overwrite     = True,
            resource_type = "image",
            transformation = [{"width": 400, "crop": "limit", "quality": "auto", "fetch_format": "auto"}],
        )
        return result["secure_url"]
    except Exception as e:
        print(f"    Cloudinary upload failed for '{dev_slug}': {e}")
        return None


# ── Step 3: Match & update ────────────────────────────────────────────────────

def run(pf: dict):
    print("\nFetching Supabase developers...")
    rows = db.table("developers").select("id,name,slug,logo_color_url,logo_url").execute().data
    print(f"  {len(rows)} developers in Supabase\n")

    # Pre-compute normalised names for Supabase devs
    sb_devs = [{
        **r,
        "_norm": norm(r.get("name") or ""),
        "_slug_norm": slug_norm(r.get("slug") or ""),
    } for r in rows]

    updated = skipped = no_match = 0

    for pf_slug, entry in sorted(pf.items(), key=lambda x: x[1]["name"]):
        pf_name      = entry["name"]
        pf_logo_url  = entry["logo_url"]
        pf_name_norm = norm(pf_name)

        # Find best matching Supabase developer
        best_score  = 0.0
        best_dev    = None
        for sb in sb_devs:
            score = match_score(pf_slug, pf_name_norm, sb["slug"], sb["_norm"])
            if score > best_score:
                best_score = score
                best_dev   = sb

        MIN_SCORE = 0.60
        if not best_dev or best_score < MIN_SCORE:
            no_match += 1
            continue

        # Skip if already has the same logo we'd upload
        existing = (best_dev.get("logo_color_url") or best_dev.get("logo_url") or "").strip()
        if existing and "cloudinary.com" in existing:
            skipped += 1
            continue

        print(f"MATCH  PF '{pf_name}'  →  DB '{best_dev['name']}'  (score={best_score:.2f})")
        print(f"       PF logo: {pf_logo_url[:80]}")

        if not DRY:
            cdn_url = upload_logo(pf_logo_url, best_dev["slug"])
            if cdn_url:
                db.table("developers").update({
                    "logo_color_url": cdn_url,
                    "logo_url":       cdn_url,
                }).eq("id", best_dev["id"]).execute()
                print(f"       ✓ Uploaded & updated → {cdn_url[:80]}")
                updated += 1
            else:
                # Fall back to storing PF URL directly
                db.table("developers").update({
                    "logo_color_url": pf_logo_url,
                    "logo_url":       pf_logo_url,
                }).eq("id", best_dev["id"]).execute()
                print(f"       ✓ Stored PF URL directly (Cloudinary failed)")
                updated += 1
        else:
            print(f"       [dry-run] would upload & set logo_color_url")

    print(f"\n{'DRY RUN — ' if DRY else ''}updated={updated}  skipped(already CDN)={skipped}  no_match={no_match}")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Step 1 — scraping PropertyFinder logos...\n")
    pf = scrape_pf()
    print(f"Total PF developers with logos: {len(pf)}\n")

    print("Step 2 — matching & updating Supabase...\n")
    run(pf)

    print("\nDone.")
