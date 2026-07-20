"""
Backfill image_main for existing projects using the opr-search API's ImageLink.
The UK flag ended up as images_all[0] because it was the phone input country icon
scraped from the page. The API's ImageLink is the real project thumbnail.

Matches projects by extracting the opr.ae slug from data_source_url (the stored
original URL), since Claude may generate a different slug than the one in the URL.

Run on the server:
  cd /var/www/dubai-portal/extractor
  source venv/bin/activate
  python backfill_images.py [--dry-run] [--limit N]
"""
import asyncio
import argparse
import logging
import os
import requests
import cloudinary
import cloudinary.uploader
from urllib.parse import unquote
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

OPR_SEARCH_API = (
    "https://opr-search.mpp.agency/api/projects"
    "?populate=*&pagination%5BpageSize%5D=1500&sort=id:desc"
)


def fetch_api_images() -> dict[str, str]:
    """Return {opr_slug: ImageLink} keyed by the slug in the opr.ae URL."""
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://opr.ae/projects",
        "Origin": "https://opr.ae",
    }
    resp = requests.get(OPR_SEARCH_API, headers=headers, timeout=30)
    resp.raise_for_status()
    result = {}
    for item in resp.json().get("data", []):
        attrs = item.get("attributes", {})
        link = attrs.get("Link", "")
        slug = unquote(link.rstrip("/").split("/")[-1])
        img = attrs.get("ImageLink", "")
        if slug and img:
            result[slug] = img
    logger.info(f"Fetched {len(result)} project thumbnails from opr-search API")
    return result


def opr_slug_from_url(url: str) -> str:
    """Extract the project slug from an opr.ae URL."""
    return unquote((url or "").rstrip("/").split("/")[-1])


def upload_main(slug: str, source_url: str):
    """Upload to Cloudinary with overwrite=True, return secure URL."""
    try:
        result = cloudinary.uploader.upload(
            source_url,
            public_id=f"projects/{slug}-main",
            overwrite=True,
            resource_type="image",
            folder="projects",
            transformation=[
                {"width": 1200, "crop": "limit", "quality": "auto:good", "fetch_format": "auto"}
            ],
        )
        return result.get("secure_url")
    except Exception as e:
        logger.error(f"Cloudinary upload failed for {slug}: {e}")
        return None


async def run(dry_run: bool = False, limit: int = 0):
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    res = db.table("projects").select("id,slug,image_main,images_all,data_source_url").execute()
    all_projects = res.data or []
    logger.info(f"Total projects in Supabase: {len(all_projects)}")

    if limit:
        all_projects = all_projects[:limit]

    logger.info("Fetching real thumbnails from opr-search API...")
    api_images = fetch_api_images()

    fixed = skipped = no_match = 0

    for p in all_projects:
        db_slug = p["slug"]
        source_url = p.get("data_source_url") or ""
        opr_slug = opr_slug_from_url(source_url)

        api_img = api_images.get(opr_slug)
        if not api_img:
            logger.warning(f"No API match for: {db_slug} (opr slug: {opr_slug!r})")
            no_match += 1
            continue

        logger.info(f"{'[DRY RUN] ' if dry_run else ''}Fix {db_slug}")
        logger.info(f"  opr slug : {opr_slug}")
        logger.info(f"  image    : {api_img}")

        if not dry_run:
            cloud_url = upload_main(db_slug, api_img)
            if cloud_url:
                db.table("projects").update({"image_main": cloud_url}).eq("id", p["id"]).execute()
                logger.info(f"  saved    : {cloud_url[:100]}")
            else:
                logger.error(f"  upload failed — skipping DB update for {db_slug}")
                skipped += 1
                continue

        fixed += 1

    logger.info(f"\nDone. Fixed: {fixed} | No API match: {no_match} | Errors: {skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run, limit=args.limit))
