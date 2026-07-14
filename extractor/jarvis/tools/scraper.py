"""
opr.ae scraper — uses async_playwright, browser singleton.
Handles: dynamic load, Load More button, background-image CSS extraction,
gallery tabs, non-UAE filtering, ad card filtering.
"""
import re
import asyncio
import logging
from playwright.async_api import async_playwright, Browser, Page, Playwright

logger = logging.getLogger(__name__)

OPR_BASE      = "https://opr.ae"
PROJECTS_URL  = "https://opr.ae/projects"
MAX_LOAD_MORE = 5  # max clicks = 50 projects per scan

UAE_KEYWORDS = [
    "dubai", "abu dhabi", "sharjah", "ajman",
    "ras al khaimah", "fujairah", "umm al quwain",
    "uae", "united arab emirates",
]

# ── Browser singleton ──────────────────────────────────────────────────────────

_pw: Playwright | None = None
_browser: Browser | None = None


async def get_browser() -> Browser:
    global _pw, _browser
    if _browser is None or not _browser.is_connected():
        _pw = await async_playwright().start()
        _browser = await _pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        logger.info("Chromium launched")
    return _browser


async def close_browser() -> None:
    global _pw, _browser
    if _browser:
        await _browser.close()
        _browser = None
    if _pw:
        await _pw.stop()
        _pw = None


def _stealth_headers() -> dict:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }


# ── Image URL extraction ───────────────────────────────────────────────────────

def _parse_bg_url(style: str) -> str | None:
    """Extract clean URL from CSS background-image: url('...') string."""
    m = re.search(r'url\(["\']?(https?://[^"\')\s]+)["\']?\)', style)
    if not m:
        return None
    url = m.group(1)
    # Strip Creatium JSON params encoded as %7B{ ... }
    url = re.sub(r'%7B.*$', '', url)
    url = re.sub(r'\{.*$', '', url)
    return url.strip()


def _parse_href_url(href: str) -> str | None:
    """Extract clean image URL from gallery <a href> (strips %7B params)."""
    if not href or not href.startswith("http"):
        return None
    clean = re.sub(r'%7B.*$', '', href).strip()
    return clean if clean else None


# ── Step 1: Scan listing page for new project URLs ─────────────────────────────

async def scan_new_projects(existing_slugs: set[str]) -> list[dict]:
    """
    Visit opr.ae/projects, paginate via Load More, collect new project URLs.
    Stops early when it hits a project already in existing_slugs.
    Returns list of lightweight dicts: {url, slug, name, price_text, thumbnail}
    """
    browser = await get_browser()
    page = await browser.new_page()
    await page.set_extra_http_headers(_stealth_headers())

    new_projects: list[dict] = []
    stop = False

    try:
        logger.info("Loading opr.ae/projects...")
        await page.goto(PROJECTS_URL, wait_until="domcontentloaded", timeout=45_000)

        # Wait for at least one "Discover more" link to appear (projects are JS-rendered)
        try:
            await page.wait_for_selector("a:has-text('Discover more')", timeout=30_000)
            logger.info("Project cards detected on page")
        except Exception:
            logger.warning("Timed out waiting for project cards — page may be blocked or slow")

        await asyncio.sleep(3)  # extra wait for remaining cards to render

        # Debug: log page title so we can detect Cloudflare challenge pages
        title = await page.title()
        logger.info(f"Page title: {title}")

        for attempt in range(MAX_LOAD_MORE + 1):
            # All cards that have a "Discover more" button = real project cards
            cards = page.locator("div, article").filter(
                has=page.locator("a:has-text('Discover more')")
            )
            card_count = await cards.count()
            logger.info(f"Found {card_count} project cards on page")

            for i in range(card_count):
                card = cards.nth(i)

                # ── Get project URL ──
                link = card.locator("a:has-text('Discover more')").first
                href = await link.get_attribute("href") or ""
                if not href:
                    continue
                url = href if href.startswith("http") else OPR_BASE + href
                slug = url.rstrip("/").split("/")[-1]

                # ── Skip non-UAE locations ──
                card_text = (await card.inner_text()).lower()
                is_uae = any(kw in card_text for kw in UAE_KEYWORDS)
                if not is_uae:
                    logger.info(f"Skipping non-UAE card: {slug}")
                    continue

                # ── Stop when we hit something already in Supabase ──
                if slug in existing_slugs:
                    logger.info(f"Reached known project '{slug}' — stopping scan")
                    stop = True
                    break

                # ── Thumbnail from wrapper1 background-image ──
                thumbnail = None
                wrapper = card.locator("[class*='wrapper1'], [style*='background-image']").first
                if await wrapper.count() > 0:
                    style = await wrapper.get_attribute("style") or ""
                    thumbnail = _parse_bg_url(style)

                # ── Price text ──
                price_el = card.locator("[class*='price']").first
                price_text = ""
                if await price_el.count() > 0:
                    price_text = (await price_el.inner_text()).strip()

                # ── Project name ──
                name_el = card.locator("h2, h3, [class*='name'], [class*='title']").first
                name = slug.replace("-", " ").title()
                if await name_el.count() > 0:
                    name = (await name_el.inner_text()).strip()

                new_projects.append({
                    "url": url,
                    "slug": slug,
                    "name": name,
                    "price_text": price_text,
                    "thumbnail": thumbnail,
                })

            if stop or attempt >= MAX_LOAD_MORE:
                break

            # ── Click Load More ──
            load_more = page.locator("text=Load More").first
            if await load_more.count() == 0:
                logger.info("No Load More button — end of list")
                break

            await load_more.scroll_into_view_if_needed()
            await load_more.click()
            await asyncio.sleep(3)
            logger.info(f"Clicked Load More ({attempt + 1}/{MAX_LOAD_MORE})")

    except Exception as e:
        logger.error(f"scan_new_projects failed: {e}")
    finally:
        await page.close()

    logger.info(f"scan_new_projects complete — {len(new_projects)} new projects found")
    return new_projects


# ── Step 2: Scrape full detail from individual project page ────────────────────

async def scrape_project_detail(url: str) -> dict | None:
    """
    Scrape full project detail page.
    Returns raw dict — Claude will parse details + rewrite description.
    """
    browser = await get_browser()
    page = await browser.new_page()
    await page.set_extra_http_headers(_stealth_headers())

    for attempt in range(3):
        try:
            logger.info(f"Scraping {url} (attempt {attempt + 1})")
            await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            # Wait for h1 (project name) to confirm page content loaded
            try:
                await page.wait_for_selector("h1", timeout=15_000)
            except Exception:
                logger.warning(f"h1 not found on {url}")
            await asyncio.sleep(2)

            data: dict = {"opr_url": url}

            # ── Project name ──
            h1 = page.locator("h1").first
            data["name"] = (await h1.inner_text()).strip() if await h1.count() > 0 else ""

            # ── Main thumbnail (wrapper1 div) ──
            wrapper1 = page.locator(".wrapper1, [class*='wrapper1']").first
            if await wrapper1.count() > 0:
                style = await wrapper1.get_attribute("style") or ""
                data["image_main"] = _parse_bg_url(style)
            else:
                data["image_main"] = None

            # ── Raw description text ──
            desc_chunks = []
            paras = page.locator("p")
            for j in range(min(await paras.count(), 15)):
                txt = (await paras.nth(j).inner_text()).strip()
                if len(txt) > 50:
                    desc_chunks.append(txt)
            data["description_raw"] = "\n\n".join(desc_chunks)

            # ── All visible text on page (Claude will extract fields from this) ──
            body_text = await page.inner_text("body")
            data["body_text"] = body_text[:8000]  # cap to avoid huge payloads

            # ── Gallery images ──
            images: list[str] = []

            async def _collect_gallery_images():
                # Method 1: href on cr-slider-page-image anchor tags
                links = page.locator(".cr-slider-page-image")
                for j in range(await links.count()):
                    href = await links.nth(j).get_attribute("href") or ""
                    img = _parse_href_url(href)
                    if img and img not in images:
                        images.append(img)

                # Method 2: background-image on inner divs
                inner = page.locator(".cr-slider-page-image div[style*='background-image']")
                for j in range(await inner.count()):
                    style = await inner.nth(j).get_attribute("style") or ""
                    img = _parse_bg_url(style)
                    if img and img not in images:
                        images.append(img)

            # Exteriors tab
            ext_tab = page.locator("text=Exteriors, text=Exterior").first
            if await ext_tab.count() > 0:
                await ext_tab.click()
                await asyncio.sleep(1)
            await _collect_gallery_images()

            # Interiors tab
            int_tab = page.locator("text=Interiors, text=Interior").first
            if await int_tab.count() > 0:
                await int_tab.click()
                await asyncio.sleep(1)
                await _collect_gallery_images()

            data["images_all"] = images
            data["image_count"] = len(images)

            logger.info(
                f"Scraped '{data['name']}' — "
                f"{len(images)} gallery images, "
                f"{len(data['description_raw'])} chars description"
            )
            return data

        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} failed for {url}: {e}")
            if attempt < 2:
                await asyncio.sleep(10)
            else:
                logger.error(f"All attempts failed for {url}")
                return None
        finally:
            if attempt == 2 or "data" in locals():
                await page.close()

    await page.close()
    return None
