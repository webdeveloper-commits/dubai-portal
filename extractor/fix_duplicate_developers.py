"""
Find and merge duplicate developers in Supabase by normalised name.

Strips common corporate suffixes (Properties, Development, Holding, etc.)
then groups developers whose core name matches. Keeps the record with the
best data (logo > intro > oldest). Re-points projects.developer_id.

Usage:
  venv/bin/python3 fix_duplicate_developers.py --dry-run   # preview
  venv/bin/python3 fix_duplicate_developers.py             # apply
"""
import os, sys, re
from collections import defaultdict

# ── load .env ─────────────────────────────────────────────────────────────────
_env = os.path.join(os.path.dirname(__file__), ".env")
with open(_env) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, os.path.dirname(__file__))
from supabase import create_client

db  = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
DRY = "--dry-run" in sys.argv

STRIP_WORDS = {
    "properties", "property", "development", "developments", "developer",
    "developers", "real", "estate", "holding", "holdings", "limited", "ltd",
    "llc", "group", "groups", "uae", "dubai", "international", "investments",
    "investment", "realty", "homes", "home", "living", "residences",
    "residence", "projects", "project", "construction", "contracting", "by",
    "and", "&", "the",
}


def normalize(name: str) -> str:
    """Return core brand name with corporate suffixes removed."""
    words = re.sub(r"[^a-z0-9 ]", " ", name.lower()).split()
    core  = [w for w in words if w not in STRIP_WORDS]
    return " ".join(core).strip()


def score(dev: dict) -> int:
    s = 0
    if dev.get("logo_color_url") or dev.get("logo_url"): s += 10
    if dev.get("logo_dark_url"):  s += 5
    if dev.get("intro_short"):    s += 3
    if dev.get("tagline"):        s += 1
    return s


def fetch_all(table, select="*"):
    rows, step, offset = [], 1000, 0
    while True:
        chunk = db.table(table).select(select).range(offset, offset + step - 1).execute().data
        rows.extend(chunk)
        if len(chunk) < step:
            break
        offset += step
    return rows


# ── Fetch data ────────────────────────────────────────────────────────────────
print("Fetching developers from Supabase...")
devs = fetch_all("developers",
    "id,created_at,name,slug,logo_color_url,logo_url,logo_dark_url,intro_short,tagline,is_published,published")
print(f"  Total: {len(devs)}\n")

print("Fetching projects (developer_id)...")
projects = fetch_all("projects", "id,developer_id,developer_slug")
print(f"  Total: {len(projects)}\n")

proj_by_dev = defaultdict(list)
for p in projects:
    if p.get("developer_id"):
        proj_by_dev[p["developer_id"]].append(p["id"])

# ── Group by normalised name ──────────────────────────────────────────────────
groups = defaultdict(list)
for d in devs:
    key = normalize(d.get("name") or "")
    if key:
        groups[key].append(d)

dupes = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Found {len(dupes)} groups with potential duplicates:\n")

# Override: force a specific slug as canonical for a given core name.
SLUG_OVERRIDE = {
    "binghatti": "binghatti",
}

if not dupes:
    print("No duplicates detected.")
    sys.exit(0)

# ── Print summary ─────────────────────────────────────────────────────────────
deleted_devs    = 0
repointed_projs = 0

for key, recs in sorted(dupes.items()):
    override_slug = SLUG_OVERRIDE.get(key)
    if override_slug:
        canonical = next((r for r in recs if r.get("slug") == override_slug), None) \
                    or max(recs, key=lambda d: (score(d), d.get("created_at") or ""))
    else:
        canonical = max(recs, key=lambda d: (score(d), d.get("created_at") or ""))
    duplicates = [r for r in recs if r["id"] != canonical["id"]]

    affected_proj_ids = []
    for dup in duplicates:
        affected_proj_ids.extend(proj_by_dev.get(dup["id"], []))

    print(f"Core name : '{key}'")
    for r in recs:
        marker = "KEEP" if r["id"] == canonical["id"] else "DEL "
        logo   = "✓logo" if (r.get("logo_color_url") or r.get("logo_url")) else "     "
        print(f"  [{marker}] {logo}  '{r['name']}'  slug={r['slug']}")
    print(f"  → {len(affected_proj_ids)} projects will be re-pointed to canonical")

    if not DRY:
        # Re-point projects
        for pid in affected_proj_ids:
            db.table("projects").update({
                "developer_id":   canonical["id"],
                "developer_slug": canonical["slug"],
            }).eq("id", pid).execute()

        # Delete duplicates
        for dup in duplicates:
            db.table("developers").delete().eq("id", dup["id"]).execute()
            print(f"  ✓ Deleted '{dup['name']}' (id={dup['id']})")

        deleted_devs    += len(duplicates)
        repointed_projs += len(affected_proj_ids)

    print()

# ── Summary ───────────────────────────────────────────────────────────────────
if DRY:
    print("=" * 60)
    print("DRY RUN — no changes made.")
    print("Review the groups above, then run without --dry-run to apply.")
    print()
    print("If any group should NOT be merged (different companies with")
    print("similar names), add their core key to the EXCLUDE list at")
    print("the top of this script before running for real.")
else:
    print(f"=== Done — deleted {deleted_devs} duplicates, re-pointed {repointed_projs} projects ===")
