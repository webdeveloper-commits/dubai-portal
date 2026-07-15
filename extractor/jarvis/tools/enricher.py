"""
JARVIS enrichment phase — runs after each Tuesday project scrape.
Fetches area coordinates (Nominatim), area images/description (Bayut),
and developer logo/about (Bayut developer pages).
Each area/developer is enriched only once — marked enriched=True in DB.
"""
import asyncio
import random
import logging
import httpx
from .scraper import get_browser, _new_stealth_page
from .storage import db

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


# ── Geocoding ──────────────────────────────────────────────────────────────────

async def geocode(name: str, emirate: str = "Dubai") -> tuple[float | None, float | None]:
    """Accurate lat/lng from OpenStreetMap Nominatim — free, no API key needed."""
    queries = [
        f"{name}, {emirate}, UAE",
        f"{name}, UAE",
    ]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            for q in queries:
                r = await client.get(
                    NOMINATIM_URL,
                    params={"q": q, "format": "json", "limit": 1},
                    headers={"User-Agent": "dubai-portal-jarvis/1.0 (marketing@elysian.com)"},
                )
                data = r.json()
                if data:
                    lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
                    logger.info(f"Geocoded '{name}': {lat}, {lng}")
                    return lat, lng
    except Exception as e:
        logger.warning(f"Geocode failed for '{name}': {e}")
    return None, None


# ── Bayut area scrape ──────────────────────────────────────────────────────────

async def scrape_bayut_area(area_name: str, area_slug: str) -> dict:
    """Scrape Bayut community page for area description, hero image, gallery."""
    browser = await get_browser()
    page = await _new_stealth_page(browser)
    result = {}

    # Bayut uses several URL patterns for area/community pages
    slug_hyphen = area_slug.replace("_", "-")
    urls = [
        f"https://www.bayut.com/{slug_hyphen}-dubai/",
        f"https://www.bayut.com/dubai/{slug_hyphen}/",
        f"https://www.bayut.com/to-rent/property/dubai/{slug_hyphen}/",
    ]

    try:
        for url in urls:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                await asyncio.sleep(3)
                title = await page.title()
                if not title or "404" in title or "not found" in title.lower() or "error" in title.lower():
                    logger.debug(f"Bayut area URL not found: {url}")
                    continue

                logger.info(f"Bayut area page: {url} — title: {title}")

                extracted = await page.evaluate("""() => {
                    const r = {};

                    // Hero / cover image
                    const heroSelectors = [
                        'img[class*="hero"]', 'img[class*="cover"]', 'img[class*="banner"]',
                        '[class*="hero"] img', '[class*="cover"] img', '[class*="banner"] img',
                        '[class*="header"] img', 'picture img'
                    ];
                    for (const sel of heroSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.src && el.src.startsWith('http')) {
                            r.image_url = el.src;
                            break;
                        }
                    }

                    // Description paragraphs
                    const descSelectors = [
                        '[class*="description"] p', '[class*="about"] p',
                        '[class*="content"] p', 'article p', 'main p'
                    ];
                    const seen = new Set();
                    const parts = [];
                    for (const sel of descSelectors) {
                        document.querySelectorAll(sel).forEach(p => {
                            const t = p.innerText.trim();
                            if (t.length > 60 && !seen.has(t)) {
                                seen.add(t);
                                parts.push(t);
                            }
                        });
                        if (parts.length >= 3) break;
                    }
                    r.description = parts.slice(0, 3).join('\\n\\n');

                    // Gallery images
                    const galleryImgs = Array.from(document.querySelectorAll('img[src]'))
                        .map(i => i.src)
                        .filter(s => s.startsWith('http') && !s.includes('logo') && !s.includes('icon') && s.length > 40);
                    r.gallery = [...new Set(galleryImgs)].slice(0, 6);

                    return r;
                }""")

                if extracted.get("image_url") or extracted.get("description"):
                    result = extracted
                    logger.info(f"Bayut area data: image={'yes' if result.get('image_url') else 'no'}, desc={len(result.get('description',''))} chars")
                    break

            except Exception as e:
                logger.debug(f"Bayut area URL {url} failed: {e}")
                continue

    except Exception as e:
        logger.error(f"scrape_bayut_area failed for '{area_name}': {e}")
    finally:
        await page.close()

    return result


# ── Bayut developer scrape ─────────────────────────────────────────────────────

async def scrape_bayut_developer(dev_name: str, dev_slug: str) -> dict:
    """Scrape Bayut developer page for logo, about text."""
    browser = await get_browser()
    page = await _new_stealth_page(browser)
    result = {}

    slug_hyphen = dev_slug.replace("_", "-")
    urls = [
        f"https://www.bayut.com/developers/{slug_hyphen}/",
        f"https://www.bayut.com/developers/{slug_hyphen}-properties/",
    ]

    try:
        for url in urls:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                await asyncio.sleep(3)
                title = await page.title()
                if not title or "404" in title or "not found" in title.lower():
                    logger.debug(f"Bayut developer URL not found: {url}")
                    continue

                logger.info(f"Bayut developer page: {url}")

                extracted = await page.evaluate("""() => {
                    const r = {};

                    // Developer logo
                    const logoSelectors = [
                        '[class*="developer"] img', '[class*="logo"] img',
                        'header img', '[class*="profile"] img'
                    ];
                    for (const sel of logoSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.src && el.src.startsWith('http') && !el.src.includes('placeholder')) {
                            r.logo_url = el.src;
                            break;
                        }
                    }

                    // About / description
                    const aboutSelectors = [
                        '[class*="about"] p', '[class*="description"] p',
                        '[class*="bio"] p', 'article p'
                    ];
                    for (const sel of aboutSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.innerText.trim().length > 40) {
                            r.intro_short = el.innerText.trim().slice(0, 400);
                            break;
                        }
                    }

                    // Website link
                    const links = Array.from(document.querySelectorAll('a[href*="http"]'));
                    const website = links.find(a => {
                        const href = a.href || '';
                        return !href.includes('bayut') && !href.includes('propertyfinder') && href.startsWith('http');
                    });
                    r.website_url = website ? website.href : null;

                    return r;
                }""")

                if extracted.get("logo_url") or extracted.get("intro_short"):
                    result = extracted
                    logger.info(f"Bayut dev data: logo={'yes' if result.get('logo_url') else 'no'}, about={len(result.get('intro_short',''))} chars")
                    break

            except Exception as e:
                logger.debug(f"Bayut developer URL {url} failed: {e}")
                continue

    except Exception as e:
        logger.error(f"scrape_bayut_developer failed for '{dev_name}': {e}")
    finally:
        await page.close()

    return result


# ── Enrichment runners ─────────────────────────────────────────────────────────

async def enrich_areas() -> list[str]:
    """Geocode + Bayut-enrich all unenriched areas. Returns names enriched."""
    try:
        res = db().table("areas").select("id, name, slug, emirate, description_short, image_url").eq("enriched", False).execute()
        areas = res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch unenriched areas: {e}")
        return []

    if not areas:
        logger.info("No unenriched areas found")
        return []

    logger.info(f"Enriching {len(areas)} areas...")
    enriched_names = []

    for area in areas:
        try:
            area_id   = area["id"]
            area_name = area["name"]
            area_slug = area.get("slug", "")
            emirate   = area.get("emirate", "Dubai")
            updates   = {}

            # Accurate geocoding via Nominatim
            lat, lng = await geocode(area_name, emirate)
            if lat:
                updates["latitude"]  = lat
                updates["longitude"] = lng

            # Bayut area page
            bayut = await scrape_bayut_area(area_name, area_slug)
            if bayut.get("description") and not area.get("description_short"):
                updates["description_short"] = bayut["description"][:500]
            if bayut.get("image_url") and not area.get("image_url"):
                updates["image_url"]       = bayut["image_url"]
                updates["cover_image_url"] = bayut["image_url"]

            updates["enriched"] = True
            db().table("areas").update(updates).eq("id", area_id).execute()
            logger.info(f"Area '{area_name}' enriched — lat={lat}, bayut_img={'yes' if bayut.get('image_url') else 'no'}")
            enriched_names.append(area_name)

        except Exception as e:
            logger.error(f"enrich_areas failed for '{area.get('name')}': {e}")
            # Still mark enriched to avoid retrying a broken area forever
            try:
                db().table("areas").update({"enriched": True}).eq("id", area["id"]).execute()
            except Exception:
                pass

        await asyncio.sleep(random.uniform(4, 8))

    return enriched_names


async def enrich_developers() -> list[str]:
    """Bayut-enrich all unenriched developers. Returns names enriched."""
    try:
        res = db().table("developers").select("id, name, slug, logo_url, intro_short").eq("enriched", False).execute()
        developers = res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch unenriched developers: {e}")
        return []

    if not developers:
        logger.info("No unenriched developers found")
        return []

    logger.info(f"Enriching {len(developers)} developers...")
    enriched_names = []

    for dev in developers:
        try:
            dev_id   = dev["id"]
            dev_name = dev["name"]
            dev_slug = dev.get("slug", "")
            updates  = {}

            bayut = await scrape_bayut_developer(dev_name, dev_slug)
            if bayut.get("logo_url") and not dev.get("logo_url"):
                updates["logo_url"]       = bayut["logo_url"]
                updates["logo_color_url"] = bayut["logo_url"]
            if bayut.get("intro_short") and not dev.get("intro_short"):
                updates["intro_short"] = bayut["intro_short"]
            if bayut.get("website_url"):
                updates["website_url"] = bayut["website_url"]

            updates["enriched"] = True
            db().table("developers").update(updates).eq("id", dev_id).execute()
            logger.info(f"Developer '{dev_name}' enriched — bayut_logo={'yes' if bayut.get('logo_url') else 'no'}")
            enriched_names.append(dev_name)

        except Exception as e:
            logger.error(f"enrich_developers failed for '{dev.get('name')}': {e}")
            try:
                db().table("developers").update({"enriched": True}).eq("id", dev["id"]).execute()
            except Exception:
                pass

        await asyncio.sleep(random.uniform(4, 8))

    return enriched_names


async def run_enrichment() -> str:
    """Full enrichment pass for areas + developers. Returns summary string."""
    logger.info("Enrichment pass starting...")
    area_names = await enrich_areas()
    dev_names  = await enrich_developers()

    parts = []
    if area_names:
        parts.append(f"Areas enriched ({len(area_names)}): {', '.join(area_names)}")
    if dev_names:
        parts.append(f"Developers enriched ({len(dev_names)}): {', '.join(dev_names)}")
    if not parts:
        parts.append("No areas or developers pending enrichment.")

    return "\n".join(parts)
