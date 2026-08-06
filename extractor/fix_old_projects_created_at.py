"""
One-time fix: the 3x daily auto-backfill imported ~220 old OPR projects
and gave them created_at = NOW() (because run_backfill briefly had no
created_at logic). These old/ready projects are now floating to the top
of the website above genuinely new projects.

Fix: for any project with opr_id in the historical range (7436–8004)
whose created_at is today (2026-08-06), apply _compute_opr_created_at
so they slot back into the correct timeline position.
"""
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "jarvis"))

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

# Must match runner.py anchors exactly
_OPR_ID_MIN  = 7436
_OPR_ID_MAX  = 8004
_OPR_DATE_MIN = datetime(2023, 9, 2,  tzinfo=timezone.utc)
_OPR_DATE_MAX = datetime(2026, 1, 26, tzinfo=timezone.utc)
_OPR_SLOPE = (_OPR_DATE_MAX - _OPR_DATE_MIN).total_seconds() / (_OPR_ID_MAX - _OPR_ID_MIN)


def compute_created_at(opr_id: int) -> str:
    delta_secs = (opr_id - _OPR_ID_MIN) * _OPR_SLOPE
    dt = _OPR_DATE_MIN + timedelta(seconds=delta_secs)
    dt = min(dt, datetime.now(timezone.utc))
    return dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")


def main():
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Find historical OPR projects that wrongly got today's date
    cutoff = "2026-08-05T00:00:00+00:00"
    res = db.table("projects") \
        .select("id, name, opr_id, created_at") \
        .not_.is_("opr_id", "null") \
        .lte("opr_id", _OPR_ID_MAX) \
        .gte("created_at", cutoff) \
        .execute()

    projects = res.data or []
    print(f"Found {len(projects)} historical OPR projects with wrong created_at\n")

    if not projects:
        print("Nothing to fix.")
        return

    updated = 0
    for p in projects:
        opr_id = p["opr_id"]
        new_ts = compute_created_at(opr_id)
        try:
            db.table("projects").update({"created_at": new_ts}).eq("id", p["id"]).execute()
            updated += 1
            if updated % 20 == 0 or updated == len(projects):
                print(f"  [{updated}/{len(projects)}] '{p['name']}' opr_id={opr_id} → {new_ts[:10]}")
        except Exception as e:
            print(f"  ✗ Failed for '{p['name']}': {e}")

    print(f"\n=== Done — fixed {updated}/{len(projects)} projects ===")
    print("Old/ready projects will no longer appear at the top of the website.")


if __name__ == "__main__":
    main()
