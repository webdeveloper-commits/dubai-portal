"""
Backfill image_main for existing projects using opr-search API ImageLink.

Fetches all projects from Supabase, matches to opr-search API by slug,
uploads the correct image to Cloudinary, and updates image_main in Supabase.

Run on the server:
  cd /var/www/dubai-portal/extractor
  source venv/bin/activate
  python backfill_images.py [--dry-run] [--limit N]
"""
import asyncio
import argparse
import logging
import re
import requests
from urllib.parse import unquote
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPR_SEARCH_API = "https://opr-search.mpp.agency/api/projects?populate=*&pagination[pageSize]=1500&sort=id:desc"

# Images that are wrong (UK flag, SVG icons, tiny files)
BAD_IMAGE_PATTERNS = [
    "united_kingdom", "flag", ".svg", "21x21", "20x20",
    "intltelplp",  # phone input library
]


def is_bad_image(url: str | None) -> bool:
    if not url:
        return True
    u = url.lower()
    return any(p in u for p in BAD_IMAGE_PATTERNS)


async def upload_image(source_url: str, public_id: str) -> str | None:
    import cloudinary
    import cloudinary.uploader
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )
    for attempt in range(3):
        try:
            result = cloudinary.uploader.upload(
                source_url,
                public_id=public_id,
                overwrite=True,
                resource_type="image",
                transformation=[
                    {"width": 1200, "crop": "limit", "quality": "auto:good", "fetch_format": "auto"}
                ],
            )
            url = result.get("secure_url")
            if url:
                return url
        except Exception as e:
            logger.warning(f"Upload attempt {attempt+1} failed for {public_id}: {e}")
            if attempt < 2:
                await asyncio.sleep(5)
    return None


async def run(dry_run: bool = False, limit: int = 0):
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Fetch all projects from Supabase
    res = db.table("projects").select("id,slug,image_main,data_source_url").execute()
    all_projects = res.data or []
    logger.info(f"Supabase: {len(all_projects)} total projects")

    # Find projects with bad/missing images
    to_fix = [p for p in all_projects if is_bad_image(p.get("image_main"))]
    logger.info(f"Projects needing image fix: {len(to_fix)}")
    if limit:
        to_fix = to_fix[:limit]
        logger.info(f"Limiting to {limit} projects")

    if not to_fix:
        logger.info("Nothing to fix.")
        return

    # 2. Fetch API project list — build slug → ImageLink map
    logger.info("Fetching opr-search API...")
    headers = {"Referer": "https://opr.ae/projects", "Origin": "https://opr.ae"}
    resp = requests.get(OPR_SEARCH_API, headers=headers, timeout=30)
    resp.raise_for_status()
    api_projects = resp.json().get("data", [])
    logger.info(f"API returned {len(api_projects)} projects")

    # Build lookup: opr.ae URL slug → ImageLink
    api_map: dict[str, str] = {}
    for item in api_projects:
        attrs = item.get("attributes", {})
        link = attrs.get("Link", "")
        image = attrs.get("ImageLink", "")
        if link and image:
            url_slug = unquote(link.rstrip("/").split("/")[-1])
            api_map[url_slug] = image

    logger.info(f"API image map: {len(api_map)} entries")

    # 3. Match and update
    fixed = 0
    not_found = 0
    errors = 0

    for project in to_fix:
        db_slug = project["slug"]
        source_url = project.get("data_source_url", "")

        # Extract the opr.ae URL slug from data_source_url
        opr_slug = unquote(source_url.rstrip("/").split("/")[-1]) if source_url else ""

        # Try opr_slug first, then db_slug
        image_url = api_map.get(opr_slug) or api_map.get(db_slug)

        if not image_url:
            logger.warning(f"No API image found for: {db_slug} (opr_slug={opr_slug})")
            not_found += 1
            continue

        logger.info(f"{'[DRY RUN] ' if dry_run else ''}Fixing {db_slug}: {image_url[:80]}")

        if dry_run:
            fixed += 1
            continue

        # Upload to Cloudinary
        cloud_url = await upload_image(image_url, f"projects/{db_slug}-main")
        if not cloud_url:
            logger.error(f"Upload failed for {db_slug}")
            errors += 1
            continue

        # Update Supabase
        try:
            db.table("projects").update({"image_main": cloud_url}).eq("id", project["id"]).execute()
            logger.info(f"Updated {db_slug} → {cloud_url[:80]}")
            fixed += 1
        except Exception as e:
            logger.error(f"Supabase update failed for {db_slug}: {e}")
            errors += 1

    logger.info(f"\nDone. Fixed: {fixed} | Not found in API: {not_found} | Errors: {errors}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Show what would be updated, don't write")
    parser.add_argument("--limit", type=int, default=0, help="Only process N projects (0 = all)")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run, limit=args.limit))
