import os
from supabase import create_client
from dotenv import load_dotenv
load_dotenv()

db = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
res = db.table("projects").select("slug,image_main,images_all").execute()
for p in res.data:
    print(p["slug"], "|", p.get("image_main", "")[:80])
    imgs = p.get("images_all") or []
    print("  images_all:", len(imgs), "|", imgs[0][:80] if imgs else "NONE")
