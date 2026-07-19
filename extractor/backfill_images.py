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

BAD_PATTERNS = ["united_kingdom", "flag", ".svg", "21x21", "20x20", "intltelplp"]


def is_bad(url: str | None) -> bool:
    if not url:
        return True
    u = url.lower()
    return any(p in u for p in BAD_PATTERNS)


def first_good(images: list) -> str | None:
    for img in (images or []):
        if isinstance(img, str) and not is_bad(img):
            return img
    return None


async def run(dry_run: bool = False, limit: int = 0):
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    res = db.table("projects").select("id,slug,image_main,images_all").execute()
    all_projects = res.data or []
    logger.info(f"Total projects in Supabase: {len(all_projects)}")

    to_fix = [p for p in all_projects if is_bad(p.get("image_main"))]
    logger.info(f"Projects with bad/missing image_main: {len(to_fix)}")

    if limit:
        to_fix = to_fix[:limit]

    fixed = skipped = 0

    for p in to_fix:
        slug = p["slug"]
        good_img = first_good(p.get("images_all") or [])

        if not good_img:
            logger.warning(f"No good image in images_all for: {slug}")
            skipped += 1
            continue

        logger.info(f"{'[DRY RUN] ' if dry_run else ''}Fix {slug}: {good_img[:80]}")

        if not dry_run:
            db.table("projects").update({"image_main": good_img}).eq("id", p["id"]).execute()

        fixed += 1

    logger.info(f"\nDone. Fixed: {fixed} | Skipped (no images_all): {skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run, limit=args.limit))
