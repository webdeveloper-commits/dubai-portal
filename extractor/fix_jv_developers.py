"""
Remove joint-venture / parenthetical-variant developer entries from Supabase.

JARVIS creates these when a project lists multiple co-developers:
  "Avenew Development x Wadeen Developers"
  "Durar Group & OCTA Development"
  "BEYOND (OMNIYAT Group)"
  "OCTA, Centurion Properties & Flora Realty"

Each JV entry is deleted and its projects re-pointed to the primary developer
(the first company listed in the name) if a canonical record exists.

Usage:
  venv/bin/python3 fix_jv_developers.py --dry-run
  venv/bin/python3 fix_jv_developers.py
"""
import os, sys, re
from collections import defaultdict

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

# These match JV patterns syntactically but are legitimate single-company names — skip them.
EXCLUDE_SLUGS = {
    "abu-dhabi-national-hotels-adnh",  # single company with abbreviation in parens
    "tissoli-luxury-developers",        # "(FZ-LLC)" is a legal entity suffix, not a parent
}

# ── Pattern detection ──────────────────────────────────────────────────────────
# "A & B", "A x B" (separator usage — not brand like "H&H")
AMP_X   = re.compile(r'\s+(?:&|x)\s+', re.I)
# "A, B & C" style list
COMMA   = re.compile(r',\s+')
# "A/B" where both sides start with capital — "OCTA/Durar"
SLASH   = re.compile(r'(?<=[A-Za-z])/(?=[A-Z])')
# "BRAND (Parent Group)" parenthetical suffix
PAREN   = re.compile(r'\s*\([^)]+\)\s*$')


def is_jv(name: str) -> bool:
    if AMP_X.search(name):  return True
    if COMMA.search(name):  return True
    if SLASH.search(name):  return True
    if PAREN.search(name):  return True
    return False


def primary_name(name: str) -> str:
    """Return the primary company name from a JV / variant name."""
    clean = PAREN.sub('', name).strip()          # strip "(Parent Group)"
    m = AMP_X.search(clean) or COMMA.search(clean) or SLASH.search(clean)
    return clean[:m.start()].strip() if m else clean


def make_slug(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def fetch_all(table, select="*"):
    rows, step, offset = [], 1000, 0
    while True:
        chunk = db.table(table).select(select).range(offset, offset + step - 1).execute().data
        rows.extend(chunk)
        if len(chunk) < step:
            break
        offset += step
    return rows


# ── Fetch ──────────────────────────────────────────────────────────────────────
print("Fetching developers...")
devs = fetch_all("developers", "id,name,slug,logo_color_url,logo_url")
print(f"  Total: {len(devs)}\n")

print("Fetching projects...")
projects = fetch_all("projects", "id,developer_id,developer_slug")
print(f"  Total: {len(projects)}\n")

proj_by_dev = defaultdict(list)
for p in projects:
    if p.get("developer_id"):
        proj_by_dev[p["developer_id"]].append(p)

# Build lookups (non-JV developers only, to avoid matching a JV as canonical)
real_devs   = [d for d in devs if not is_jv(d["name"])]
by_slug     = {d["slug"]: d for d in real_devs}
by_name_low = {d["name"].lower(): d for d in real_devs}

# ── Identify JV entries ────────────────────────────────────────────────────────
jv_devs = [d for d in devs if is_jv(d["name"])]
print(f"Found {len(jv_devs)} joint-venture / variant entries:\n")

deleted    = 0
repointed  = 0
no_canonical = []

for jv in sorted(jv_devs, key=lambda d: d["name"]):
    if jv["slug"] in EXCLUDE_SLUGS:
        print(f"SKIP : '{jv['name']}'  (legitimate single company — not a JV)\n")
        continue

    pname = primary_name(jv["name"])
    pslug = make_slug(pname)

    # Try slug exact match, then slug prefix, then name prefix
    canonical = by_slug.get(pslug)
    if not canonical:
        canonical = by_name_low.get(pname.lower())
    if not canonical:
        # Try: any real dev whose slug starts with the primary slug
        for d in real_devs:
            if d["slug"].startswith(pslug):
                canonical = d
                break
    if not canonical:
        # Try: any real dev whose name starts with the primary name (case-insensitive)
        pname_low = pname.lower()
        for d in real_devs:
            if d["name"].lower().startswith(pname_low):
                canonical = d
                break

    affected = proj_by_dev.get(jv["id"], [])

    print(f"JV   : '{jv['name']}'  slug={jv['slug']}")
    print(f"  Primary: '{pname}'")
    if canonical:
        print(f"  → Merge into: '{canonical['name']}'  slug={canonical['slug']}")
        print(f"  → {len(affected)} project(s) re-pointed")
    else:
        print(f"  → No canonical found — DELETE only ({len(affected)} projects lose developer link)")
        no_canonical.append(jv["name"])

    if not DRY:
        if canonical:
            for p in affected:
                db.table("projects").update({
                    "developer_id":   canonical["id"],
                    "developer_slug": canonical["slug"],
                }).eq("id", p["id"]).execute()
                repointed += 1
        db.table("developers").delete().eq("id", jv["id"]).execute()
        deleted += 1
        print(f"  ✓ Deleted")
    print()

# ── Summary ───────────────────────────────────────────────────────────────────
if DRY:
    print("=" * 60)
    print("DRY RUN — no changes made.")
    if no_canonical:
        print("\nNo canonical found for these (will be deleted without re-pointing):")
        for n in no_canonical:
            print(f"  • {n}")
    print("\nRe-run without --dry-run to apply.")
else:
    print(f"=== Done — deleted {deleted} JV entries, re-pointed {repointed} projects ===")
    if no_canonical:
        print("\nDeleted without re-pointing (no canonical found):")
        for n in no_canonical:
            print(f"  • {n}")
