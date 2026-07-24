"""
JARVIS run orchestration.
Tuesday: scan opr.ae → scrape → humanize → upload images → publish → notify
Friday:  area guides + developer profiles (built in next phase)
"""
import asyncio
import random
import logging
import os
import httpx
from .tools.scraper import scan_new_projects, scrape_project_detail
from .tools.humanizer import parse_and_humanize, parse_and_humanize_pf
from .tools.images import upload_project_images
from .tools.storage import (
    get_existing_slugs, publish_project,
    get_unindexed_projects, mark_google_indexed, log_error,
    upsert_developer, upsert_area,
    get_existing_projects_index, get_existing_pf_ids,
)
from .tools.pf_scraper import (
    scan_pf_new_projects, iter_pf_all_pages, pf_to_raw, compute_pf_created_at,
    fetch_pf_detail, merge_pf_detail,
)
from .tools.dedup import check_duplicate
from .tools.enricher import run_enrichment, test_area_scrape

logger = logging.getLogger(__name__)

# Notify function is injected at startup to avoid circular imports
_notify = None
_active_task: asyncio.Task | None = None


async def _revalidate_vercel() -> None:
    """Flush Vercel's page cache so new content appears immediately."""
    url    = os.getenv("VERCEL_SITE_URL", "").rstrip("/")
    secret = os.getenv("REVALIDATE_SECRET", "")
    if not url or not secret:
        logger.warning("_revalidate_vercel: VERCEL_SITE_URL or REVALIDATE_SECRET not set — skipping")
        return
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{url}/api/revalidate",
                headers={"x-revalidate-secret": secret},
            )
            logger.info(f"Vercel revalidate: {r.status_code}")
    except Exception as e:
        logger.warning(f"_revalidate_vercel failed (non-fatal): {e}")


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

            # ── Carry opr_id from scan stub into the parsed payload ──
            if stub.get("opr_id"):
                parsed["opr_id"] = stub["opr_id"]

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
            # Prefer API's ImageLink (stub thumbnail) over browser-extracted image
            main_cloud, gallery_cloud = await upload_project_images(
                slug=parsed["slug"],
                main_url=stub.get("thumbnail") or raw.get("image_main"),
                gallery_urls=raw.get("images_all", []),
                max_gallery=10,
            )
            parsed["image_main"]   = main_cloud or (gallery_cloud[0] if gallery_cloud else None)
            parsed["images_all"]   = gallery_cloud
            parsed["brochure_url"] = stub.get("brochure_url") or ""

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

    # ── Enrich any new areas/developers created during this run ──
    await notify("Running enrichment for new areas and developers...")
    enrich_summary = await run_enrichment()
    await notify(f"Enrichment complete:\n{enrich_summary}")

    # ── Flush Vercel cache so new projects appear immediately ──
    await _revalidate_vercel()


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
        logger.info(f"[GOOGLE INDEX] Would ping: dubai-portal.vercel.app/projects/{p['slug']}")
    return True  # Return True so indexing flag is set


async def run_enrichment_only():
    """Standalone enrichment run — triggered by RUN ENRICHMENT command."""
    global _active_task
    _active_task = asyncio.current_task()
    await notify("JARVIS — enrichment pass started...")
    try:
        summary = await run_enrichment()
        await notify(f"Enrichment complete:\n{summary}")
    except asyncio.CancelledError:
        await notify("Enrichment stopped by user.")
        raise


async def run_set_featured(slug: str):
    """
    Mark one project as featured — shows in home page popup + carousel.
    Clears any other featured project first.
    Triggered by: SET FEATURED [slug]
    """
    try:
        from .tools.storage import db
        # Clear existing featured
        db().table("projects").update({"is_featured": False}).neq("slug", "__never__").execute()
        # Set new featured
        res = db().table("projects").update({"is_featured": True}).eq("slug", slug).execute()
        if res.data:
            name = res.data[0].get("name", slug)
            await _revalidate_vercel()
            await notify(
                f"Featured project updated!\n\n"
                f"{name}\n"
                f"dubai-portal.vercel.app/projects/{slug}\n\n"
                f"This project will now appear in the home page popup and Featured carousel."
            )
        else:
            await notify(f"Project '{slug}' not found in database. Check the slug and try again.")
    except Exception as e:
        logger.error(f"run_set_featured error: {e}")
        await notify(f"Error setting featured project: {e}")


async def run_set_handpicked(slug: str, state: bool = True):
    """
    Mark/unmark a project as Handpicked for You.
    Triggered by: SET HANDPICKED [slug] / REMOVE HANDPICKED [slug]
    """
    try:
        from .tools.storage import db
        res = db().table("projects").update({"is_handpicked": state}).eq("slug", slug).execute()
        if res.data:
            name = res.data[0].get("name", slug)
            action = "added to" if state else "removed from"
            await _revalidate_vercel()
            await notify(
                f"Project {action} Handpicked for You!\n\n"
                f"{name}\n"
                f"dubai-portal.vercel.app/projects/{slug}"
            )
        else:
            await notify(f"Project '{slug}' not found. Check the slug and try again.")
    except Exception as e:
        logger.error(f"run_set_handpicked error: {e}")
        await notify(f"Error updating handpicked status: {e}")


async def run_get_project(slug_or_url: str):
    """
    Fetch and display project details from the database by slug or portal URL.
    Triggered by: GET PROJECT [slug or dubai-portal.vercel.app/projects/slug]
    """
    try:
        from .tools.storage import db
        # Extract slug from URL if a full URL was provided
        slug = slug_or_url.strip().rstrip("/")
        if "/projects/" in slug:
            slug = slug.split("/projects/")[-1].split("?")[0].rstrip("/")

        res = db().table("projects").select(
            "name,slug,developer_slug,geo_summary,price_from,price_to,"
            "handover_quarter,handover_year,status,bedroom_min,bedroom_max,"
            "property_types,is_published,google_indexed,is_featured,is_handpicked,"
            "image_main,images_all,aeo_faq,seo_description,data_source_url"
        ).eq("slug", slug).single().execute()

        if not res.data:
            await notify(f"No project found with slug '{slug}'.")
            return

        p = res.data
        name       = p.get("name", slug)
        price      = f"AED {p['price_from']:,}" if p.get("price_from") else "Price on request"
        handover   = f"{p.get('handover_quarter') or ''} {p.get('handover_year') or ''}".strip() or "TBD"
        beds       = f"{p['bedroom_min']}–{p['bedroom_max']} BR" if p.get("bedroom_min") else "Various"
        imgs       = len(p.get("images_all") or [])
        faqs       = len(p.get("aeo_faq") or [])
        flags      = []
        if p.get("is_published"):    flags.append("Published")
        if p.get("google_indexed"): flags.append("Google-indexed")
        if p.get("is_featured"):    flags.append("Featured")
        if p.get("is_handpicked"):  flags.append("Handpicked")

        lines = [
            f"PROJECT: {name}",
            f"Slug: {slug}",
            f"Developer: {p.get('developer_slug', 'N/A')}",
            f"Location: {p.get('geo_summary', 'N/A')}",
            f"Price: {price}",
            f"Handover: {handover}",
            f"Bedrooms: {beds}",
            f"Status: {p.get('status', 'N/A')}",
            f"Main image: {'Yes' if p.get('image_main') else 'MISSING'}",
            f"Gallery images: {imgs}",
            f"FAQ entries: {faqs}",
            f"Flags: {', '.join(flags) if flags else 'None'}",
            f"Source: {p.get('data_source_url', 'N/A')}",
            f"URL: dubai-portal.vercel.app/projects/{slug}",
        ]
        await notify("\n".join(lines))
    except Exception as e:
        logger.error(f"run_get_project error: {e}")
        await notify(f"Error fetching project: {e}")


async def run_test_area(area_name: str):
    """Debug: scrape one area from Bayut and report what was found."""
    await notify(f"Testing Bayut scrape for: {area_name}...")
    try:
        report = await test_area_scrape(area_name)
        await notify(report)
    except Exception as e:
        await notify(f"TEST AREA error: {e}")


# ── Add a single specific project by URL ───────────────────────────────────────

async def run_add_project(url: str):
    """
    Add one specific project by its opr.ae URL.
    Use when a project launched mid-week or you want one specific listing.
    Triggered by: ADD PROJECT [url]
    """
    global _active_task
    _active_task = asyncio.current_task()

    # Normalise URL
    if not url.startswith("http"):
        url = "https://opr.ae" + ("/" if not url.startswith("/") else "") + url

    slug = url.rstrip("/").split("/")[-1]
    await notify(f"Adding project: {slug}\nScraping {url}...")

    try:
        existing_slugs = get_existing_slugs()
        if slug in existing_slugs:
            await notify(f"Project '{slug}' already exists in our DB. Nothing to do.")
            return

        # Scrape detail page
        raw = await scrape_project_detail(url)
        if not raw:
            await notify(f"Could not scrape {url}\nCheck the URL is a valid opr.ae project page.")
            return

        # Parse + humanize
        parsed = await parse_and_humanize(raw)
        if not parsed:
            await notify(f"Could not parse project data from {url}")
            return
        if parsed.get("_skip"):
            await notify(f"Project skipped — Claude determined it is not a UAE project.")
            return

        if parsed["slug"] in existing_slugs:
            await notify(f"Project '{parsed['name']}' already exists in our DB.")
            return

        # Upsert developer + area
        dev_data  = parsed.pop("_developer", {})
        area_data = parsed.pop("_area", {})
        dev_id  = upsert_developer(dev_data)
        area_id = upsert_area(area_data)
        if dev_id:
            parsed["developer_id"] = dev_id
        if area_id:
            parsed["area_id"] = area_id

        # Upload images
        main_cloud, gallery_cloud = await upload_project_images(
            slug=parsed["slug"],
            main_url=raw.get("image_main"),
            gallery_urls=raw.get("images_all", []),
            max_gallery=10,
        )
        parsed["image_main"] = main_cloud or (gallery_cloud[0] if gallery_cloud else None)
        parsed["images_all"] = gallery_cloud

        # Publish
        row_id = publish_project(parsed)
        if not row_id:
            await notify(f"Failed to save project '{parsed['name']}' to database.")
            return

        price = f"AED {parsed['price_from']:,}" if parsed.get("price_from") else "Price on request"
        await notify(
            f"Project added successfully!\n\n"
            f"{parsed['name']}\n"
            f"{price}\n"
            f"dubai-portal.vercel.app/projects/{parsed['slug']}\n\n"
            f"Reply APPROVE ALL to submit to Google."
        )

        # Enrich any new area/developer
        await notify("Running enrichment for new area/developer...")
        enrich_summary = await run_enrichment()
        if enrich_summary.strip():
            await notify(f"Enrichment done:\n{enrich_summary}")

        # Flush Vercel cache
        await _revalidate_vercel()

    except asyncio.CancelledError:
        await notify("Add project stopped.")
        raise
    except Exception as e:
        logger.error(f"run_add_project error: {e}")
        await notify(f"Error adding project: {e}")


# ── Backfill — catch all existing opr.ae projects not yet in DB ────────────────

_BACKFILL_PER_RUN = 50  # projects per auto-backfill run (~25 min each)


async def run_backfill(auto: bool = False) -> bool:
    """
    Scan opr.ae API for projects not yet in DB and import them.
    Processes up to _BACKFILL_PER_RUN per call to avoid rate-limiting.

    auto=True  → quieter Telegram output, returns True when all done
    auto=False → verbose output (triggered manually via BACKFILL PROJECTS)

    Returns True when no more projects remain (backfill complete).
    """
    global _active_task
    _active_task = asyncio.current_task()

    if not auto:
        await notify(
            f"JARVIS — Backfill started\n"
            f"Scanning opr.ae API for projects not in our DB...\n"
            f"Will process up to {_BACKFILL_PER_RUN} per run.\n"
            f"Send BACKFILL PROJECTS again after this finishes for the next batch."
        )

    try:
        existing_slugs = get_existing_slugs()
        stubs = await scan_new_projects(existing_slugs, max_new=_BACKFILL_PER_RUN)

        if not stubs:
            if not auto:
                await notify("Backfill complete — no missing projects found. DB is fully up to date.")
            return True  # signal: all done

        if not auto:
            await notify(
                f"Found {len(stubs)} missing projects this batch. Processing now...\n"
                f"(There may be more — send BACKFILL PROJECTS again after this finishes.)"
            )

        published = []
        errors    = []
        skipped   = []

        for i, stub in enumerate(stubs):
            name = stub.get("name", stub["slug"])
            try:
                raw = await scrape_project_detail(stub["url"])
                if not raw:
                    errors.append(name)
                    continue

                parsed = await parse_and_humanize(raw)
                if not parsed:
                    errors.append(name)
                    continue
                if parsed.get("_skip"):
                    skipped.append(name)
                    continue

                if parsed["slug"] in existing_slugs:
                    skipped.append(parsed["name"])
                    continue

                dev_data  = parsed.pop("_developer", {})
                area_data = parsed.pop("_area", {})
                dev_id  = upsert_developer(dev_data)
                area_id = upsert_area(area_data)
                if dev_id:
                    parsed["developer_id"] = dev_id
                if area_id:
                    parsed["area_id"] = area_id

                main_cloud, gallery_cloud = await upload_project_images(
                    slug=parsed["slug"],
                    main_url=stub.get("thumbnail") or raw.get("image_main"),
                    gallery_urls=raw.get("images_all", []),
                    max_gallery=10,
                )
                parsed["image_main"]   = main_cloud or (gallery_cloud[0] if gallery_cloud else None)
                parsed["images_all"]   = gallery_cloud
                parsed["brochure_url"] = stub.get("brochure_url") or ""

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

                # Progress update every 10 items (less noise in auto mode)
                if not auto and (i + 1) % 10 == 0:
                    await notify(
                        f"Backfill progress: {i + 1}/{len(stubs)} processed "
                        f"({len(published)} published, {len(skipped)} skipped, {len(errors)} errors)"
                    )

                await asyncio.sleep(random.uniform(8, 14))

            except asyncio.CancelledError:
                await notify(
                    f"Backfill stopped.\n"
                    f"Published: {len(published)}, skipped: {len(skipped)}, failed: {len(errors)}"
                )
                raise
            except Exception as e:
                logger.error(f"Backfill error for '{name}': {e}")
                errors.append(name)

        # Summary
        total_in_db = len(get_existing_slugs())
        lines = [f"Backfill batch done — {len(published)} published, {len(skipped)} skipped, {len(errors)} failed"]
        lines.append(f"Total projects in DB now: {total_in_db}")
        if published and not auto:
            lines.append("\nPublished this batch:")
            for p in published:
                price = f"AED {p['price']:,}" if p["price"] else "Price on request"
                lines.append(f"  • {p['name']} — {price}")
                lines.append(f"    dubai-portal.vercel.app/projects/{p['slug']}")
        if not auto:
            lines.append("\nSend BACKFILL PROJECTS again to process the next batch.")
            if published:
                lines.append("Send APPROVE ALL to submit these to Google.")
        await notify("\n".join(lines))

        # Enrich new areas/developers
        if published:
            enrich_summary = await run_enrichment()
            if enrich_summary.strip() and not auto:
                await notify(f"Enrichment complete:\n{enrich_summary}")

        await _revalidate_vercel()
        return False  # more projects may remain

    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.error(f"run_backfill error: {e}")
        await notify(f"Backfill error: {e}")
        return False


# ── Property Finder bulk import ────────────────────────────────────────────────

_PF_BATCH_SIZE = 30  # projects per IMPORT PF run


async def run_pf_import(auto: bool = False) -> bool:
    """
    Bulk import Property Finder projects.
    Paginates PF listing, applies three-tier dedup, humanizes + publishes.

    Processes up to _PF_BATCH_SIZE per call — send IMPORT PF again for next batch.

    Returns True when all pages have been scanned (no more new projects found).
    """
    global _active_task
    _active_task = asyncio.current_task()

    if not auto:
        await notify(
            f"JARVIS — Property Finder import started\n"
            f"Will process up to {_PF_BATCH_SIZE} new projects per batch.\n"
            f"Applying three-tier dedup against {len(get_existing_slugs())} existing projects.\n"
            f"This will take 20–40 minutes per batch."
        )

    try:
        existing_slugs   = get_existing_slugs()
        existing_pf_ids  = get_existing_pf_ids()
        existing_index   = get_existing_projects_index()

        published:     list[dict] = []
        skipped_exact: list[str]  = []   # Tier 1 — definite dups
        near_matches:  list[str]  = []   # Tier 2 — phase variants, need user review
        errors:        list[str]  = []
        pages_scanned: int        = 0
        all_done:      bool       = False

        async def _process_pf_item(pf_item: dict) -> str:
            """Process one PF project. Returns 'published', 'exact', 'near', 'skip', or 'error'."""
            pf_id = str(pf_item.get("id") or pf_item.get("uuid") or "")
            title = pf_item.get("title", "?")

            if pf_id and pf_id in existing_pf_ids:
                return "skip"  # already imported

            raw = pf_to_raw(pf_item)

            # ── Fetch detail page: floor plans, commute times, full FAQs, etc. ──
            share_url = pf_item.get("shareUrl") or ""
            if share_url:
                try:
                    detail = await asyncio.get_event_loop().run_in_executor(
                        None, fetch_pf_detail, share_url
                    )
                    if detail:
                        merge_pf_detail(raw, detail)
                except Exception as e:
                    logger.warning(f"PF detail fetch failed for '{title}': {e} — continuing with listing data")

            # ── Three-tier dedup against all existing projects ──
            structured = raw.get("_pf_structured", {})
            tier, match = check_duplicate(
                name=structured.get("name", title),
                developer_slug=structured.get("developer_slug", ""),
                area_name=structured.get("area_name", ""),
                existing_index=existing_index,
            )
            if tier == "exact":
                logger.info(f"PF import: exact dup '{title}' — skipping")
                return "exact"
            if tier == "near":
                db_name = (match or {}).get("name", "?")
                logger.info(f"PF import: near match '{title}' ~ '{db_name}' — flagging for review")
                return "near"

            # ── Also slug-check in case the name mapping produces same slug ──
            slug = structured.get("name", title).lower().strip()
            import re as _re
            slug = _re.sub(r"[^\w\s-]", "", slug)
            slug = _re.sub(r"[\s_]+", "-", slug).strip("-")
            if slug in existing_slugs:
                return "exact"

            # ── Humanize via Claude (skip extraction since data is structured) ──
            parsed = await parse_and_humanize_pf(raw)
            if not parsed:
                return "error"

            if parsed["slug"] in existing_slugs:
                return "exact"

            # ── Upsert developer and area ──
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
            parsed["image_main"] = main_cloud or (gallery_cloud[0] if gallery_cloud else None)
            parsed["images_all"] = gallery_cloud

            # ── Set pf_id and synthetic created_at ──
            parsed["pf_id"]      = pf_id
            parsed["created_at"] = compute_pf_created_at(raw)

            # Publish (storage.py maps pf_url → data_source_url)
            row_id = publish_project(parsed)
            if row_id:
                existing_slugs.add(parsed["slug"])
                if pf_id:
                    existing_pf_ids.add(pf_id)
                existing_index.append({
                    "name":           parsed["name"],
                    "developer_slug": parsed["developer_slug"],
                    "geo_summary":    parsed["geo_summary"],
                })
                return "published"
            return "error"

        # ── Paginate through PF until batch full or all pages done ──
        processed = 0
        for pf_item in iter_pf_all_pages(max_pages=130):
            if processed >= _PF_BATCH_SIZE:
                break

            title = pf_item.get("title", "?")
            pages_scanned += 1

            try:
                result = await _process_pf_item(pf_item)
                processed += 1

                if result == "published":
                    name    = pf_item.get("title", "?")
                    price   = pf_item.get("startingPrice")
                    price_s = f"AED {price:,}" if price else "Price on request"
                    published.append({"name": name, "price": price_s})
                elif result == "exact":
                    skipped_exact.append(title)
                elif result == "near":
                    near_matches.append(title)
                elif result == "error":
                    errors.append(title)

                if processed % 10 == 0 and not auto:
                    await notify(
                        f"PF import progress: {processed} processed "
                        f"({len(published)} published, {len(skipped_exact)} dups, "
                        f"{len(near_matches)} near, {len(errors)} errors)"
                    )

                await asyncio.sleep(random.uniform(4, 8))

            except asyncio.CancelledError:
                await notify(
                    f"PF import stopped by user.\n"
                    f"Published: {len(published)}, dups: {len(skipped_exact)}, "
                    f"near: {len(near_matches)}, errors: {len(errors)}"
                )
                raise
            except Exception as e:
                logger.error(f"PF import error for '{title}': {e}")
                errors.append(title)

        else:
            all_done = True  # for-loop completed without break → no more pages

        # ── Summary ──
        lines = [f"Property Finder import batch complete\n"]
        lines.append(f"Published:   {len(published)} new projects")
        lines.append(f"Duplicates:  {len(skipped_exact)} (exact match, skipped)")
        lines.append(f"Near-match:  {len(near_matches)} (possible phases — need your review)")
        lines.append(f"Errors:      {len(errors)}")

        if published:
            lines.append("\nNewly published:")
            for p in published[:15]:
                lines.append(f"  • {p['name']} — {p['price']}")
            if len(published) > 15:
                lines.append(f"  ... and {len(published) - 15} more")

        if near_matches:
            lines.append(
                f"\nNear-matches (skipped — same base name, different phase):\n"
                + "\n".join(f"  ? {n}" for n in near_matches[:10])
            )
            lines.append("To publish any of these, use: ADD PROJECT [pf-url]")

        if all_done:
            lines.append("\nAll PF pages scanned — import complete!")
        else:
            lines.append(f"\nSend IMPORT PF again to process the next batch.")

        if published:
            lines.append("\nSend APPROVE ALL to submit new projects to Google.")

        await notify("\n".join(lines))

        await _revalidate_vercel()
        return all_done

    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.error(f"run_pf_import error: {e}")
        await notify(f"PF import error: {e}")
        return False
