"""
One-time fix for inverted created_at ordering on opr.ae projects.

During the original bulk import, projects were scraped newest-first (sort=id:desc),
so older projects got higher created_at timestamps and show first on the website.

Fix: sort all OPR projects by opr_id ASC, then assign synthetic created_at values
proportionally — lowest opr_id → 3 years ago, highest opr_id → 6 months ago.

Safe to re-run. Projects without opr_id are left untouched.
"""
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

DATE_OLDEST = datetime.now(timezone.utc) - timedelta(days=3 * 365)   # 3 years ago
DATE_NEWEST = datetime.now(timezone.utc) - timedelta(days=180)        # 6 months ago


def main():
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch all OPR projects that have opr_id stored
    res = db.table("projects").select("id, name, opr_id, created_at") \
        .not_.is_("opr_id", "null") \
        .order("opr_id", desc=False) \
        .execute()

    projects = res.data or []
    total = len(projects)
    print(f"Found {total} OPR projects with opr_id to reorder\n")

    if total == 0:
        print("Nothing to do.")
        return

    span = (DATE_NEWEST - DATE_OLDEST).total_seconds()
    updated = 0

    for i, p in enumerate(projects):
        # Linear interpolation: position 0 → DATE_OLDEST, position N-1 → DATE_NEWEST
        fraction = i / max(total - 1, 1)
        new_created_at = DATE_OLDEST + timedelta(seconds=span * fraction)
        new_ts = new_created_at.strftime("%Y-%m-%dT%H:%M:%S+00:00")

        try:
            db.table("projects").update({"created_at": new_ts}).eq("id", p["id"]).execute()
            updated += 1
            if updated % 20 == 0 or updated == total:
                print(f"  [{updated}/{total}] {p['name']} — opr_id {p['opr_id']} → {new_ts[:10]}")
        except Exception as e:
            print(f"  ✗ Failed for {p['name']}: {e}")

    print(f"\n=== Done — updated {updated}/{total} projects ===")
    print("Website will now show projects in correct order (newest opr.ae projects first).")


if __name__ == "__main__":
    main()
