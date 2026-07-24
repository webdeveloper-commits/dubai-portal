"""
One-time backfill script.

Does two things:
  1. Populates opr_id for every existing project by matching against the opr.ae API
  2. Recalculates created_at for every project proportionally to its opr_id rank
     so the website listing (sorted created_at DESC) shows newest projects first.

Run once after adding the opr_id column. Safe to re-run — uses UPDATE not INSERT.
"""
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import json
from datetime import datetime, timedelta, timezone
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

OPR_API_BASE = "https://opr-search.mpp.agency/api/projects"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer":    "https://opr.ae/projects",
    "Origin":     "https://opr.ae",
}

# Date range for synthetic created_at
# Oldest project → DATE_START, newest → DATE_END
DATE_START = datetime.now(timezone.utc) - timedelta(days=365 * 3)   # 3 years ago
DATE_END   = datetime.now(timezone.utc) - timedelta(days=7)          # 1 week ago


def fetch_all_opr_projects() -> list[dict]:
    """Fetch every project from opr.ae API sorted oldest→newest."""
    all_projects = []
    page = 1
    while True:
        params = urllib.parse.urlencode({
            "populate":              "*",
            "pagination[pageSize]":  "500",
            "pagination[page]":      page,
            "sort":                  "id:asc",
        })
        url = f"{OPR_API_BASE}?{params}"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
        except Exception as e:
            print(f"  ✗ API error on page {page}: {e}")
            break

        items     = data.get("data", [])
        meta      = data.get("meta", {}).get("pagination", {})
        total_pgs = meta.get("pageCount", 1)

        all_projects.extend(items)
        print(f"  Fetched page {page}/{total_pgs} — {len(items)} projects (total so far: {len(all_projects)})")

        if page >= total_pgs:
            break
        page += 1
        time.sleep(0.4)

    return all_projects


def build_opr_lookup(opr_projects: list[dict]) -> dict[str, int]:
    """
    Build slug → opr_id lookup from opr.ae projects.
    Tries both the URL-slug (last segment of Link) and the full Link path.
    """
    lookup: dict[str, int] = {}
    for item in opr_projects:
        opr_id = item.get("id")
        if not opr_id:
            continue
        link = item.get("attributes", {}).get("Link", "")
        if not link:
            continue
        url_slug = link.rstrip("/").split("/")[-1]
        lookup[url_slug] = opr_id
        # Also store the full path without leading slash as a fallback key
        lookup[link.strip("/")] = opr_id
    return lookup


def normalize(s: str) -> str:
    stop = {"by", "at", "the", "in", "of", "and", "&", "a", "an"}
    words = re.sub(r"[^\w\s]", "", s.lower()).split()
    return " ".join(w for w in words if w not in stop)


def main():
    print("=== opr.ae ordering backfill ===\n")

    # ── 1. Fetch all opr.ae projects ────────────────────────────────────────────
    print("Step 1 — Fetching all projects from opr.ae API (sort=id:asc)...")
    opr_projects = fetch_all_opr_projects()
    print(f"  Total from opr.ae: {len(opr_projects)}\n")

    if not opr_projects:
        print("No projects returned from opr.ae — aborting.")
        sys.exit(1)

    opr_lookup = build_opr_lookup(opr_projects)

    # ── 2. Fetch all projects from Supabase ─────────────────────────────────────
    print("Step 2 — Fetching all projects from Supabase...")
    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    res = db.table("projects").select("id, slug, name, data_source_url, opr_id").execute()
    db_projects = res.data or []
    print(f"  Total in DB: {len(db_projects)}\n")

    # ── 3. Match each DB project to its opr_id ──────────────────────────────────
    print("Step 3 — Matching DB projects to opr_id...")
    matched   = []  # (db_id, opr_id)
    unmatched = []  # db_ids we couldn't match

    for p in db_projects:
        if p.get("opr_id"):
            # Already has an opr_id (from a previous run or manual entry) — keep it
            matched.append((p["id"], p["opr_id"]))
            continue

        opr_id = None

        # Try 1: match via data_source_url slug
        src_url = p.get("data_source_url") or ""
        if "/projects/" in src_url:
            url_slug = src_url.rstrip("/").split("/")[-1]
            opr_id = opr_lookup.get(url_slug)

        # Try 2: match via DB slug directly
        if not opr_id and p.get("slug"):
            opr_id = opr_lookup.get(p["slug"])

        if opr_id:
            matched.append((p["id"], opr_id))
        else:
            unmatched.append(p["id"])

    print(f"  Matched:   {len(matched)}")
    print(f"  Unmatched: {len(unmatched)}\n")

    # ── 4. Assign synthetic created_at based on opr_id rank ─────────────────────
    print("Step 4 — Calculating synthetic created_at values...")

    # Sort matched by opr_id ascending (oldest first)
    matched.sort(key=lambda x: x[1])
    total = len(matched)
    span  = (DATE_END - DATE_START).total_seconds()

    updates = []
    for rank, (db_id, opr_id) in enumerate(matched):
        fraction   = rank / max(total - 1, 1)
        synth_date = DATE_START + timedelta(seconds=fraction * span)
        updates.append({
            "db_id":      db_id,
            "opr_id":     opr_id,
            "created_at": synth_date.isoformat(),
        })

    # ── 5. Apply updates to Supabase ────────────────────────────────────────────
    print(f"Step 5 — Updating {len(updates)} rows in Supabase...")
    ok = 0
    fail = 0
    for u in updates:
        try:
            db.table("projects").update({
                "opr_id":     u["opr_id"],
                "created_at": u["created_at"],
            }).eq("id", u["db_id"]).execute()
            ok += 1
            if ok % 50 == 0:
                print(f"  {ok}/{len(updates)} updated...")
        except Exception as e:
            print(f"  ✗ Failed to update db_id={u['db_id']}: {e}")
            fail += 1

    print(f"\n=== Done ===")
    print(f"  Updated:   {ok}")
    print(f"  Failed:    {fail}")
    print(f"  Unmatched: {len(unmatched)} (created_at left as-is)")

    if unmatched:
        print(f"\n  Unmatched DB ids: {unmatched[:20]}{'...' if len(unmatched) > 20 else ''}")
        print("  These are likely manually-added or non-opr.ae projects — no action needed.")


if __name__ == "__main__":
    main()
