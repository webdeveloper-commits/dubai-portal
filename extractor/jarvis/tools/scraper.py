"""
opr.ae scraper — uses async_playwright, browser singleton.
Handles: dynamic load, Load More button, background-image CSS extraction,
gallery tabs, non-UAE filtering, ad card filtering.
"""
import re
import asyncio
import random
import logging
from playwright.async_api import async_playwright, Browser, Page, Playwright
from playwright_stealth import stealth_async

logger = logging.getLogger(__name__)

OPR_BASE      = "https://opr.ae"
PROJECTS_URL  = "https://opr.ae/projects"
MAX_LOAD_MORE = 5

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

async def scan_new_projects(existing_slugs: set[str], max_new: int = 10) -> list[dict]:
    """
    Visit opr.ae/projects, collect up to max_new new project URLs.
    Uses a single JS call per batch to extract card data fast.
    Stops early when it hits a project already in existing_slugs.
    """
    browser = await get_browser()
    page = await browser.new_page()
    await stealth_async(page)
    await page.set_extra_http_headers(_stealth_headers())

    new_projects: list[dict] = []

    try:
        logger.info("Loading opr.ae/projects...")
        await page.goto(PROJECTS_URL, wait_until="domcontentloaded", timeout=45_000)

        try:
            await page.wait_for_selector("a:has-text('Discover more')", timeout=30_000)
            logger.info("Project cards detected on page")
        except Exception:
            logger.warning("Timed out waiting for project cards — may be blocked")

        await asyncio.sleep(3)

        title = await page.title()
        logger.info(f"Page title: {title}")

        # Extract all card data in one JS call — much faster than per-card Playwright calls
        cards_data: list[dict] = await page.evaluate("""() => {
            const results = [];
            const links = Array.from(document.querySelectorAll('a')).filter(
                a => a.textContent.trim().toLowerCase().includes('discover more')
            );
            links.forEach(link => {
                const card = link.closest('div[class], article') || link.parentElement;
                if (!card) return;
                const href = link.getAttribute('href') || '';
                const text = card.innerText || '';
                // Thumbnail: find element with background-image style
                let thumbnail = '';
                const bgEl = card.querySelector('[style*="background-image"]');
                if (bgEl) {
                    const style = bgEl.getAttribute('style') || '';
                    const m = style.match(/url\\([\"']?(https?:\\/\\/[^\"')]+)[\"']?\\)/);
                    if (m) thumbnail = m[1].replace(/%7B.*$/, '');
                }
                results.push({ href, text, thumbnail });
            });
            return results;
        }""")

        logger.info(f"JS extracted {len(cards_data)} cards")

        for card in cards_data:
            if len(new_projects) >= max_new:
                logger.info(f"Reached max_new limit ({max_new})")
                break

            href = card.get("href", "")
            if not href:
                continue

            url = href if href.startswith("http") else OPR_BASE + href
            slug = url.rstrip("/").split("/")[-1]
            card_text = (card.get("text") or "").lower()

            # Stop at known projects
            if slug in existing_slugs:
                logger.info(f"Reached known project '{slug}' — stopping")
                break

            # Parse name and price from card text
            lines = [l.strip() for l in card_text.split("\n") if l.strip()]
            name = slug.replace("-", " ").title()
            price_text = ""
            for line in lines:
                if "aed" in line and any(c.isdigit() for c in line):
                    price_text = line
                elif len(line) > 3 and "discover" not in line and "from" not in line:
                    name = line.title()
                    break

            new_projects.append({
                "url": url,
                "slug": slug,
                "name": name,
                "price_text": price_text,
                "thumbnail": card.get("thumbnail", ""),
            })
            logger.info(f"Queued: {name} ({slug})")

    except Exception as e:
        logger.error(f"scan_new_projects failed: {e}")
    finally:
        await page.close()

    logger.info(f"scan_new_projects complete — {len(new_projects)} new projects queued")
    return new_projects


# ── Step 2: Scrape full detail from individual project page ────────────────────

async def scrape_project_detail(url: str) -> dict | None:
    """
    Scrape full project detail page.
    Returns raw dict — Claude will parse details + rewrite description.
    """
    browser = await get_browser()
    page = await browser.new_page()
    await stealth_async(page)
    await page.set_extra_http_headers(_stealth_headers())

    for attempt in range(3):
        try:
            logger.info(f"Scraping {url} (attempt {attempt + 1})")
            await page.goto(url, wait_until="domcontentloaded", timeout=45_000)

            # Wait for page content — opr.ae detail pages are JS-rendered
            # Try multiple selectors that indicate real content has loaded
            content_loaded = False
            for selector in [".wrapper1", "[style*='background-image']", "h1", "h2"]:
                try:
                    await page.wait_for_selector(selector, timeout=20_000)
                    content_loaded = True
                    logger.info(f"Content detected via '{selector}' on {url}")
                    break
                except Exception:
                    continue

            if not content_loaded:
                logger.warning(f"No content selectors found on {url}")

            # Extra wait for JS to finish rendering
            await asyncio.sleep(random.uniform(4, 7))

            data: dict = {"opr_url": url}

            # ── Use JS to extract everything in one call (faster + more reliable) ──
            extracted = await page.evaluate("""() => {
                const result = {};

                // Project name — try h1, h2, title
                const h1 = document.querySelector('h1');
                const h2 = document.querySelector('h2');
                result.name = (h1 && h1.innerText.trim()) || (h2 && h2.innerText.trim()) || document.title || '';

                // Main image from wrapper1 background-image
                const wrapper = document.querySelector('.wrapper1, [class*="wrapper1"]');
                if (wrapper) {
                    const style = wrapper.getAttribute('style') || wrapper.style.backgroundImage || '';
                    const m = style.match(/url\\([\"']?(https?:\\/\\/[^\"')\\s]+)[\"']?\\)/);
                    result.image_main = m ? m[1].replace(/%7B.*$/, '') : '';
                }

                // All paragraph text for description
                const paras = Array.from(document.querySelectorAll('p, .description, [class*="desc"], [class*="text"]'));
                const descParts = paras
                    .map(p => p.innerText.trim())
                    .filter(t => t.length > 60 && !t.includes('cookie') && !t.includes('©'));
                result.description_raw = [...new Set(descParts)].slice(0, 8).join('\\n\\n');

                // Full body text for Claude to extract structured fields
                result.body_text = document.body.innerText.slice(0, 8000);

                // Gallery images — try multiple approaches
                const galleryImages = [];

                // Approach 1: cr-slider links with href
                document.querySelectorAll('.cr-slider-page-image').forEach(el => {
                    const href = el.getAttribute('href') || '';
                    if (href.startsWith('http')) {
                        galleryImages.push(href.replace(/%7B.*$/, '').replace(/\\{.*$/, ''));
                    }
                    // background-image on child div
                    const inner = el.querySelector('[style*="background-image"]');
                    if (inner) {
                        const s = inner.getAttribute('style') || '';
                        const m = s.match(/url\\([\"']?(https?:\\/\\/[^\"')]+)[\"']?\\)/);
                        if (m) galleryImages.push(m[1].replace(/%7B.*$/, ''));
                    }
                });

                // Approach 2: any div with background-image containing img3.creatium.ru
                if (galleryImages.length === 0) {
                    document.querySelectorAll('[style*="background-image"]').forEach(el => {
                        const s = el.getAttribute('style') || '';
                        const m = s.match(/url\\([\"']?(https?:\\/\\/[^\"')]+)[\"']?\\)/);
                        if (m && m[1].includes('creatium')) {
                            galleryImages.push(m[1].replace(/%7B.*$/, ''));
                        }
                    });
                }

                // Approach 3: any img tags
                if (galleryImages.length === 0) {
                    document.querySelectorAll('img[src*="creatium"], img[src*="cloudinary"], img[data-src]').forEach(img => {
                        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                        if (src.startsWith('http') && !src.includes('gif') && src.length > 30) {
                            galleryImages.push(src);
                        }
                    });
                }

                result.images_all = [...new Set(galleryImages)].slice(0, 20);
                return result;
            }""")

            data["name"]            = extracted.get("name", "")
            data["image_main"]      = extracted.get("image_main") or None
            data["description_raw"] = extracted.get("description_raw", "")
            data["body_text"]       = extracted.get("body_text", "")
            data["images_all"]      = extracted.get("images_all", [])

            # If gallery still empty, try clicking tabs then re-extracting
            if not data["images_all"]:
                for tab_text in ["Exteriors", "Exterior", "Gallery"]:
                    tab = page.locator(f"text={tab_text}").first
                    if await tab.count() > 0:
                        await tab.click()
                        await asyncio.sleep(2)
                        extra_imgs = await page.evaluate("""() => {
                            const imgs = [];
                            document.querySelectorAll('[style*="background-image"]').forEach(el => {
                                const s = el.getAttribute('style') || '';
                                const m = s.match(/url\\([\"']?(https?:\\/\\/[^\"')]+)[\"']?\\)/);
                                if (m) imgs.push(m[1].replace(/%7B.*$/, ''));
                            });
                            document.querySelectorAll('.cr-slider-page-image').forEach(el => {
                                const href = el.getAttribute('href') || '';
                                if (href.startsWith('http')) imgs.push(href.replace(/%7B.*$/, ''));
                            });
                            return [...new Set(imgs)].slice(0, 20);
                        }""")
                        if extra_imgs:
                            data["images_all"] = extra_imgs
                            break

            data["image_count"] = len(data["images_all"])

            logger.info(
                f"Scraped '{data['name']}' — "
                f"{data['image_count']} images, "
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
