"""
Re-process existing projects to fix:
  - aeo_faq (was always [] due to JSON parse bug)
  - seo_keywords, seo_title, seo_description, tagline, descriptions
  - brochure_url (download PDF from opr.ae → upload to Cloudinary)

Only updates content fields — slug, images, developer_id, area_id untouched.

Run on the server:
  cd /var/www/dubai-portal/extractor
  source venv/bin/activate
  python reprocess_projects.py [--dry-run] [--limit N] [--slug SLUG]
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

CONTENT_FIELDS = [
    "tagline", "description_short", "description_long",
    "seo_title", "seo_description", "seo_keywords",
    "aeo_faq", "whatsapp_share_text",
]


def fetch_api_brochures() -> dict[str, str]:
    """Return {opr_slug: PDF_url} from opr-search API."""
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
        pdf = attrs.get("PDF") or ""
        if slug and pdf:
            result[slug] = pdf
    logger.info(f"Fetched {len(result)} brochure URLs from API")
    return result


def get_brochure_url(slug: str, pdf_url: str) -> str:
    """
    Try to upload PDF to Cloudinary. If too large (>10MB), fall back to
    storing the cdn.opr.ae URL directly — it's a CDN link, not branded as OPR.
    """
    try:
        result = cloudinary.uploader.upload(
            pdf_url,
            public_id=f"projects/{slug}-brochure",
            resource_type="raw",
            overwrite=True,
        )
        url = result.get("secure_url", "")
        logger.info(f"Brochure uploaded to Cloudinary: {url}")
        return url
    except Exception as e:
        if "too large" in str(e).lower() or "10485760" in str(e):
            logger.info(f"Brochure too large for Cloudinary — storing CDN URL directly: {pdf_url}")
            return pdf_url
        logger.warning(f"Brochure upload failed for {slug}: {e}")
        return pdf_url  # fall back to original URL on any error


async def run(dry_run: bool = False, limit: int = 0, only_slug: str = ""):
    from jarvis.tools.scraper import scrape_project_detail
    from jarvis.tools.humanizer import parse_and_humanize

    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    res = db.table("projects").select(
        "id,slug,data_source_url,aeo_faq,brochure_url"
    ).execute()
    projects = res.data or []
    logger.info(f"Total projects: {len(projects)}")

    if only_slug:
        projects = [p for p in projects if p["slug"] == only_slug]
    elif limit:
        projects = projects[:limit]

    logger.info("Fetching brochure URLs from opr-search API...")
    api_brochures = fetch_api_brochures()

    done = failed = skipped = 0

    for p in projects:
        slug = p["slug"]
        source_url = p.get("data_source_url") or ""

        if not source_url:
            logger.warning(f"No source URL for {slug} — skipping")
            skipped += 1
            continue

        opr_slug = unquote(source_url.rstrip("/").split("/")[-1])
        pdf_url = api_brochures.get(opr_slug, "")

        logger.info(f"\n{'[DRY RUN] ' if dry_run else ''}Processing: {slug}")
        logger.info(f"  source : {source_url}")
        logger.info(f"  pdf    : {pdf_url or 'none'}")

        if dry_run:
            done += 1
            continue

        # ── Re-scrape detail page ──
        raw = await scrape_project_detail(source_url)
        if not raw:
            logger.error(f"  scrape failed — skipping {slug}")
            failed += 1
            continue

        # ── Re-humanize ──
        parsed = await parse_and_humanize(raw)
        if not parsed or parsed.get("_skip"):
            logger.error(f"  humanize failed — skipping {slug}")
            failed += 1
            continue

        # ── Upload brochure to Cloudinary ──
        our_brochure_url = ""
        if pdf_url:
            our_brochure_url = get_brochure_url(slug, pdf_url)

        # ── Build update payload (content fields only) ──
        update = {field: parsed.get(field) for field in CONTENT_FIELDS if field in parsed}
        if our_brochure_url:
            update["brochure_url"] = our_brochure_url

        faq_count = len(update.get("aeo_faq") or [])
        kw_count  = len(update.get("seo_keywords") or [])
        logger.info(f"  aeo_faq: {faq_count} items | seo_keywords: {kw_count} | brochure: {'yes' if our_brochure_url else 'no'}")

        db.table("projects").update(update).eq("id", p["id"]).execute()
        done += 1

        # Brief pause between projects
        await asyncio.sleep(5)

    logger.info(f"\nDone: {done} | Failed: {failed} | Skipped: {skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Process only first N projects")
    parser.add_argument("--slug", type=str, default="", help="Process one specific project slug")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run, limit=args.limit, only_slug=args.slug))
