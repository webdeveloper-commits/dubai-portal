"""
Backfill image_main for projects where it's wrong (UK flag, SVG, missing).
Uses the first good image from the project's existing images_all field.

Run on the server:
  cd /var/www/dubai-portal/extractor
  source venv/bin/activate
  python backfill_images.py [--dry-run] [--limit N]
"""
import asyncio
import argparse
import logging
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

async def run(dry_run: bool = False, limit: int = 0):
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    res = db.table("projects").select("id,slug,image_main,images_all").execute()
    all_projects = res.data or []
    logger.info(f"Total projects in Supabase: {len(all_projects)}")

    if limit:
        all_projects = all_projects[:limit]

    fixed = skipped = 0

    for p in all_projects:
        slug = p["slug"]
        imgs = p.get("images_all") or []

        if not imgs:
            logger.warning(f"No images_all for: {slug}")
            skipped += 1
            continue

        new_main = imgs[0]
        logger.info(f"{'[DRY RUN] ' if dry_run else ''}Set image_main for {slug}: {new_main[:80]}")

        if not dry_run:
            db.table("projects").update({"image_main": new_main}).eq("id", p["id"]).execute()

        fixed += 1

    logger.info(f"\nDone. Fixed: {fixed} | Skipped (no images_all): {skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run, limit=args.limit))
