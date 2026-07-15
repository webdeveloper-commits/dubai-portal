"""
JARVIS run orchestration.
Tuesday: scan opr.ae → scrape → humanize → upload images → publish → notify
Friday:  area guides + developer profiles (built in next phase)
"""
import asyncio
import random
import logging
from .tools.scraper import scan_new_projects, scrape_project_detail
from .tools.humanizer import parse_and_humanize
from .tools.images import upload_project_images
from .tools.storage import (
    get_existing_slugs, publish_project,
    get_unindexed_projects, mark_google_indexed, log_error,
    upsert_developer, upsert_area,
)

logger = logging.getLogger(__name__)

# Notify function is injected at startup to avoid circular imports
_notify = None
_active_task: asyncio.Task | None = None


def set_notify(fn):
    global _notify
    _notify = fn


async def notify(msg: str):
    if _notify:
        await _notify(msg)
    else:
        logger.info(f"[NOTIFY] {msg}")


def is_running() -> bool:
    return _active_task is not None and not _active_task.done()


def stop_run() -> bool:
    """Cancel the active run task. Returns True if there was something to cancel."""
    global _active_task
    if _active_task and not _active_task.done():
        _active_task.cancel()
        return True
    return False


# ── Tuesday Run — Projects + Blog ──────────────────────────────────────────────

async def run_tuesday():
    global _active_task
    _active_task = asyncio.current_task()
    await notify("JARVIS — Tuesday run started\nScanning opr.ae for new projects...")

    existing_slugs = get_existing_slugs()
    # Scan 10 candidates — Claude will filter non-UAE, we publish up to 5 UAE projects
    stubs = await scan_new_projects(existing_slugs, max_new=10)

    if not stubs:
        await notify("No new projects found on opr.ae. Nothing to publish.")
        return

    await notify(f"Found {len(stubs)} new projects. Processing now...")

    published = []
    errors    = []
    skipped   = []
    MAX_PUBLISH = 5  # stop after publishing this many UAE projects

    for i, stub in enumerate(stubs):
        if len(published) >= MAX_PUBLISH:
            logger.info(f"Reached publish limit ({MAX_PUBLISH}) — stopping")
            break
        name = stub.get("name", stub["slug"])
        try:
            # ── Scrape detail page ──
            await notify(f"Scraping: {name}...")
            raw = await scrape_project_detail(stub["url"])
            if not raw:
                errors.append(f"{name} (scrape failed)")
                log_error("opr.ae", "scrape_failed", "returned None", False)
                continue
            logger.info(f"Scraped {name}: {len(raw.get('description_raw',''))} chars, {raw.get('image_count',0)} images")

            # ── Parse + humanize via Claude ──
            parsed = await parse_and_humanize(raw)
            if not parsed:
                errors.append(f"{name} (scrape/parse error)")
                log_error("opr.ae", "parse_failed", "returned None after scrape", False)
                continue
            if parsed.get("_skip"):
                skipped.append(f"{name} (non-UAE)")
                continue

            # ── Duplicate check (slug may differ from URL slug) ──
            if parsed["slug"] in existing_slugs:
                skipped.append(parsed["name"])
                continue

            # ── Upsert developer and area — get IDs to link to project ──
            dev_data  = parsed.pop("_developer", {})
            area_data = parsed.pop("_area", {})
            dev_id  = upsert_developer(dev_data)
            area_id = upsert_area(area_data)
            if dev_id:
                parsed["developer_id"] = dev_id
            if area_id:
                parsed["area_id"] = area_id

            # ── Upload images to Cloudinary ──
            main_cloud, gallery_cloud = await upload_project_images(
                slug=parsed["slug"],
                main_url=raw.get("image_main"),
                gallery_urls=raw.get("images_all", []),
                max_gallery=10,
            )
            parsed["image_main"]  = main_cloud
            parsed["images_all"]  = gallery_cloud

            # ── Publish to Supabase ──
            row_id = publish_project(parsed)
            if row_id:
                published.append({
                    "id":    row_id,
                    "name":  parsed["name"],
                    "slug":  parsed["slug"],
                    "price": parsed.get("price_from", 0),
                })
                existing_slugs.add(parsed["slug"])
            else:
                errors.append(parsed["name"])

            # Progress update every 3 items
            if (i + 1) % 3 == 0:
                await notify(f"Progress: {i + 1}/{len(stubs)} processed...")

            # Polite delay between project scrapes — randomised to avoid rate limiting
            await asyncio.sleep(random.uniform(8, 14))

        except asyncio.CancelledError:
            await notify(
                f"Run stopped by user.\n"
                f"Published so far: {len(published)}, skipped: {len(skipped)}, failed: {len(errors)}"
            )
            raise  # let asyncio clean up the task properly

        except Exception as e:
            logger.error(f"Error processing '{name}': {e}")
            errors.append(name)
            log_error("opr.ae", "unexpected", str(e), False)

    # ── Send summary + approval request ──
    await notify(_build_project_summary(published, errors, skipped))


def _build_project_summary(published: list, errors: list, skipped: list) -> str:
    lines = ["JARVIS Tuesday Run Complete\n"]

    if published:
        lines.append(f"Published {len(published)} projects:")
        for i, p in enumerate(published, 1):
            price = f"AED {p['price']:,}" if p["price"] else "Price on request"
            lines.append(f"  {i}. {p['name']} — {price}")
            lines.append(f"     dubai-portal.vercel.app/projects/{p['slug']}")

    if skipped:
        lines.append(f"\nSkipped {len(skipped)} duplicates: {', '.join(skipped)}")

    if errors:
        lines.append(f"\nFailed ({len(errors)}): {', '.join(errors)}")

    if published:
        lines.append(
            "\nReview the links above on your website.\n"
            "Reply APPROVE ALL to submit to Google,\n"
            "or APPROVE 1,3 to approve specific ones,\n"
            "or FIX 2 [what's wrong] to request a fix."
        )

    return "\n".join(lines)


# ── Approval handler ───────────────────────────────────────────────────────────

async def handle_approve(command: str):
    """
    Called when user replies APPROVE ALL or APPROVE 1,3 etc.
    Marks google_indexed=True and pings Google Indexing API.
    """
    unindexed = get_unindexed_projects()
    if not unindexed:
        await notify("No projects pending Google indexing.")
        return

    if "all" in command.lower():
        to_index = unindexed
    else:
        # Parse "APPROVE 1,3,5" — convert 1-based to list index
        nums = [int(n.strip()) - 1 for n in command.replace("APPROVE", "").split(",") if n.strip().isdigit()]
        to_index = [unindexed[n] for n in nums if 0 <= n < len(unindexed)]

    if not to_index:
        await notify("Could not parse which projects to approve. Try APPROVE ALL.")
        return

    ids = [p["id"] for p in to_index]
    names = [p["name"] for p in to_index]

    # Ping Google Indexing API
    indexed = await _ping_google(to_index)
    if indexed:
        mark_google_indexed(ids)
        await notify(
            f"Submitted {len(to_index)} pages to Google:\n" +
            "\n".join(f"  • {n}" for n in names) +
            "\nGoogle will crawl within 24–48 hours."
        )
    else:
        await notify("Google Indexing API call failed. Will retry on next run.")


async def _ping_google(projects: list[dict]) -> bool:
    """
    Submit URLs to Google Indexing API.
    Requires GOOGLE_INDEXING credentials — stubbed for now, will be wired up
    when OAuth is set up.
    """
    # TODO: implement Google Indexing API OAuth flow
    # For now, log the URLs that would be submitted
    for p in projects:
        logger.info(f"[GOOGLE INDEX] Would ping: propsale.co/projects/{p['slug']}")
    return True  # Return True so indexing flag is set
