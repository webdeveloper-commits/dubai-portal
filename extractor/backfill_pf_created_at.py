"""
One-time fix: update created_at for existing PF projects based on their
actual PF listing page number AND position within that page.

All 24 PF projects were incorrectly set to 2025-02-06 (18 months ago).
They are actually on PF pages 1-2 (most recent), so they should sit
at the TOP of our website alongside the latest OPR projects.

Formula (matches compute_pf_created_at in pf_scraper.py):
  position = (page - 1) * 28 + item_index
  total = 129 * 28 + 27 = 3639
  days_back = position / 3639 * (3 * 365)

  page 1, slot 0  → today
  page 1, slot 27 → ~8.1 days ago
  page 2, slot 0  → ~8.4 days ago

Safe to re-run.
"""
import os
import sys
import time
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "jarvis"))

from supabase import create_client
from jarvis.tools.pf_scraper import fetch_pf_listing_page

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

MAX_PAGES      = 130
ITEMS_PER_PAGE = 28
SCAN_PAGES     = 5   # all 24 projects are on pages 1-2; scan 5 for safety


def pf_created_at_for_position(page: int, item_index: int) -> str:
    now         = datetime.now(timezone.utc)
    total_slots = (MAX_PAGES - 1) * ITEMS_PER_PAGE + (ITEMS_PER_PAGE - 1)
    position    = (page - 1) * ITEMS_PER_PAGE + item_index
    days_back   = position / max(total_slots, 1) * (3 * 365)
    return (now - timedelta(days=days_back)).isoformat()


def main():
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── Step 1: build pf_id → (page, item_index) map from live PF listing ──
    print(f"Scanning first {SCAN_PAGES} PF listing pages to map pf_id → position...")
    pf_position_map: dict[str, tuple[int, int]] = {}   # pf_id → (page, item_index)

    for page in range(1, SCAN_PAGES + 1):
        projects = fetch_pf_listing_page(page, sort="mr")
        if not projects:
            print(f"  Page {page}: empty — stopping scan")
            break
        for idx, p in enumerate(projects):
            pf_id = str(p.get("id") or p.get("uuid") or "").strip()
            if pf_id and pf_id not in pf_position_map:
                pf_position_map[pf_id] = (page, idx)
        print(f"  Page {page}: {len(projects)} projects (total mapped: {len(pf_position_map)})")
        time.sleep(0.8)

    print(f"\nTotal PF IDs mapped from live pages: {len(pf_position_map)}\n")

    # ── Step 2: fetch all our PF projects from Supabase ──
    res = db.table("projects").select("id, name, pf_id, created_at") \
        .not_.is_("pf_id", "null") \
        .execute()

    db_projects = res.data or []
    print(f"Found {len(db_projects)} PF projects in Supabase\n")

    if not db_projects:
        print("Nothing to update.")
        return

    # ── Step 3: update created_at for each matched project ──
    updated  = 0
    skipped  = 0
    no_match = []

    for p in db_projects:
        pf_id = str(p.get("pf_id") or "").strip()
        name  = p.get("name", "?")

        position = pf_position_map.get(pf_id)
        if position is None:
            print(f"  ? No match in live PF for '{name}' (pf_id={pf_id}) — leaving unchanged")
            no_match.append(name)
            skipped += 1
            continue

        page, item_index = position
        new_ts = pf_created_at_for_position(page, item_index)
        try:
            db.table("projects").update({"created_at": new_ts}).eq("id", p["id"]).execute()
            updated += 1
            print(f"  [{updated}] '{name}' — PF page {page}, slot {item_index} → {new_ts[:10]}")
        except Exception as e:
            print(f"  ✗ Failed for '{name}': {e}")

    print(f"\n=== Done — updated {updated}, skipped {skipped} ===")
    if no_match:
        print(f"\nProjects not found on live PF (may have been removed — left unchanged):")
        for n in no_match:
            print(f"  • {n}")
    print("\nWebsite will now show PF projects in the same order as PF listing (page 1, slot 0 = top).")


if __name__ == "__main__":
    main()
