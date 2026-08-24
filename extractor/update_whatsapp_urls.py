"""One-time script: replace old domain in whatsapp_share_text across all Supabase projects."""
import os

_env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(_env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from supabase import create_client

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

rows = db.table("projects").select("id,whatsapp_share_text").not_.is_("whatsapp_share_text", "null").execute()

updated = 0
for r in rows.data:
    old = r.get("whatsapp_share_text") or ""
    if "dubai-portal.vercel.app" in old:
        new = old.replace("dubai-portal.vercel.app", "offplansearchuae.com")
        db.table("projects").update({"whatsapp_share_text": new}).eq("id", r["id"]).execute()
        updated += 1

print(f"Updated {updated} records")
