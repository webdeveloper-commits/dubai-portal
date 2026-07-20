"""
Fix aeo_faq and seo_keywords for projects that are still missing them.
Only processes projects where aeo_faq is empty — skips ones already fixed.

Run on the server:
  cd /var/www/dubai-portal/extractor
  source venv/bin/activate
  python fix_missing_faq.py
"""
import asyncio
import logging
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

CONTENT_FIELDS = [
    "tagline", "description_short", "description_long",
    "seo_title", "seo_description", "seo_keywords",
    "aeo_faq", "whatsapp_share_text",
]


async def run():
    from jarvis.tools.scraper import scrape_project_detail
    from jarvis.tools.humanizer import parse_and_humanize

    db = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

    res = db.table("projects").select("id,slug,data_source_url,aeo_faq").execute()
    all_projects = res.data or []

    # Only process those with empty aeo_faq
    to_fix = [p for p in all_projects if not p.get("aeo_faq") or len(p["aeo_faq"]) == 0]
    logger.info(f"Total projects: {len(all_projects)} | Need fixing: {len(to_fix)}")

    done = failed = 0

    for i, p in enumerate(to_fix, 1):
        slug = p["slug"]
        source_url = p.get("data_source_url") or ""
        if not source_url:
            logger.warning(f"[{i}/{len(to_fix)}] No source URL — skipping {slug}")
            failed += 1
            continue

        logger.info(f"[{i}/{len(to_fix)}] Processing: {slug}")

        raw = await scrape_project_detail(source_url)
        if not raw:
            logger.error(f"  scrape failed")
            failed += 1
            continue

        parsed = await parse_and_humanize(raw)
        if not parsed or parsed.get("_skip"):
            logger.error(f"  humanize failed")
            failed += 1
            continue

        update = {field: parsed.get(field) for field in CONTENT_FIELDS if field in parsed}
        faq_count = len(update.get("aeo_faq") or [])
        kw_count  = len(update.get("seo_keywords") or [])

        db.table("projects").update(update).eq("id", p["id"]).execute()
        logger.info(f"  saved — aeo_faq: {faq_count} | seo_keywords: {kw_count}")
        done += 1

        await asyncio.sleep(5)

    logger.info(f"\nDone: {done} | Failed: {failed}")


if __name__ == "__main__":
    asyncio.run(run())
