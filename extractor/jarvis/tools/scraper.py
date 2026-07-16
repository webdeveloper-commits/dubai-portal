"""
opr.ae scraper — uses async_playwright, browser singleton.
Handles: dynamic load, Load More button, background-image CSS extraction,
gallery tabs, non-UAE filtering, ad card filtering.
"""
import re
import asyncio
import random
import logging
from urllib.parse import unquote
from playwright.async_api import async_playwright, Browser, Page, Playwright

logger = logging.getLogger(__name__)

OPR_BASE      = "https://opr.ae"
PROJECTS_URL  = "https://opr.ae/projects"
MAX_LOAD_MORE = 5

# ── Browser singleton ──────────────────────────────────────────────────────────

_pw: Playwright | None = None
_browser: Browser | None = None


_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

_STEALTH_JS = """
// Remove webdriver flag at JS level (--disable-blink-features handles C++ level)
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});

// Realistic plugin array
Object.defineProperty(navigator, 'plugins', {get: () => {
    const arr = [
        {name:'Chrome PDF Plugin', filename:'internal-pdf-viewer', description:'Portable Document Format'},
        {name:'Chrome PDF Viewer',  filename:'mhjfbmdgcfjbbpaeojofohoefgiehjai', description:''},
        {name:'Native Client',      filename:'internal-nacl-plugin', description:''},
    ];
    Object.setPrototypeOf(arr, PluginArray.prototype);
    return arr;
}});

Object.defineProperty(navigator, 'languages',           {get: () => ['en-US', 'en']});
Object.defineProperty(navigator, 'platform',            {get: () => 'Win32'});
Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => 8});
Object.defineProperty(navigator, 'deviceMemory',        {get: () => 8});
Object.defineProperty(navigator, 'maxTouchPoints',      {get: () => 0});

// Full chrome object — headless omits these
window.chrome = {
    app: {isInstalled: false, InstallState: {DISABLED:'a',INSTALLED:'b',NOT_INSTALLED:'c'}, RunningState: {CANNOT_RUN:'a',READY_TO_RUN:'b',RUNNING:'c'}},
    runtime: {id: undefined},
    loadTimes: function(){return {requestTime:Date.now()/1000};},
    csi: function(){return {startE:Date.now(),onloadT:Date.now(),pageT:1,tran:15};},
};

// Notifications permission — headless returns 'denied' which bots checkers test
try {
    const origQuery = window.navigator.permissions.query.bind(navigator.permissions);
    window.navigator.permissions.query = (p) =>
        p.name === 'notifications'
            ? Promise.resolve({state: 'default', onchange: null})
            : origQuery(p);
} catch(e) {}

// Prevent iframe contentWindow.navigator.webdriver check
try {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
            const win = this.__contentWindow || Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get.call(this);
            try { Object.defineProperty(win.navigator, 'webdriver', {get: () => undefined}); } catch(e) {}
            return win;
        }
    });
} catch(e) {}
""".strip()


async def get_browser() -> Browser:
    global _pw, _browser
    if _browser is None or not _browser.is_connected():
        _pw = await async_playwright().start()
        _browser = await _pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--window-size=1920,1080",
                "--disable-extensions",
                "--no-first-run",
                "--ignore-certificate-errors",
            ],
        )
        logger.info("Chromium launched (stealth mode)")
    return _browser


async def _new_stealth_page(browser: Browser) -> Page:
    """Create a new page with full stealth fingerprint applied."""
    page = await browser.new_page(
        viewport={"width": 1920, "height": 1080},
        user_agent=_UA,
    )
    await page.add_init_script(_STEALTH_JS)
    await page.set_extra_http_headers(_stealth_headers())
    return page


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
        "User-Agent":      _UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Fetch-Dest":  "document",
        "Sec-Fetch-Mode":  "navigate",
        "Sec-Fetch-Site":  "none",
        "Sec-Fetch-User":  "?1",
        "Upgrade-Insecure-Requests": "1",
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
    Clicks Load More up to MAX_LOAD_MORE times to expose more cards.
    Skips (does not break at) known projects — listing order isn't guaranteed newest-first.
    """
    browser = await get_browser()
    page = await _new_stealth_page(browser)

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

        # Click Load More to expose additional project cards before extracting
        for load_n in range(MAX_LOAD_MORE):
            try:
                btn = page.locator("a:has-text('Load more'), button:has-text('Load more'), a:has-text('Show more'), button:has-text('Show more')").first
                if await btn.count() == 0:
                    logger.info(f"No Load More button after {load_n} click(s) — stopping pagination")
                    break
                await btn.click()
                await asyncio.sleep(3)
                logger.info(f"Clicked Load More ({load_n + 1}/{MAX_LOAD_MORE})")
            except Exception as e:
                logger.info(f"Load More stopped at click {load_n + 1}: {e}")
                break

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

        logger.info(f"JS extracted {len(cards_data)} total cards")

        for card in cards_data:
            if len(new_projects) >= max_new:
                logger.info(f"Reached max_new limit ({max_new})")
                break

            href = card.get("href", "")
            if not href:
                continue

            url = href if href.startswith("http") else OPR_BASE + href
            slug = unquote(url.rstrip("/").split("/")[-1])
            card_text = (card.get("text") or "").lower()

            # Skip known projects (don't break — listing order isn't guaranteed newest-first)
            if slug in existing_slugs:
                logger.debug(f"Known project '{slug}' — skipping")
                continue

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
    page = await _new_stealth_page(browser)

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

                // All paragraph text for description — filter out cookie/privacy/tracking text
                const paras = Array.from(document.querySelectorAll('p, .description, [class*="desc"], [class*="text"]'));
                const descParts = paras
                    .map(p => p.innerText.trim())
                    .filter(t => {
                        const low = t.toLowerCase();
                        return t.length > 60
                            && !t.includes('©')
                            && !low.includes('cookie')
                            && !low.includes('personalization')
                            && !low.includes('advertising')
                            && !low.includes('data collected')
                            && !low.includes('privacy policy')
                            && !low.includes('consent')
                            && !low.includes('purposes of')
                            && !low.includes('third party');
                    });
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

                // Latitude/longitude from map iframe or data attributes
                let lat = null, lng = null;
                const mapIframe = document.querySelector('iframe[src*="maps.google"], iframe[src*="google.com/maps"]');
                if (mapIframe) {
                    const src = mapIframe.getAttribute('src') || '';
                    const m = src.match(/[?&](?:q|center)=(-?\\d+\\.?\\d*),(-?\\d+\\.?\\d*)/);
                    if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
                }
                if (!lat) {
                    const latEl = document.querySelector('[data-lat],[data-latitude]');
                    const lngEl = document.querySelector('[data-lng],[data-longitude]');
                    if (latEl) lat = parseFloat(latEl.getAttribute('data-lat') || latEl.getAttribute('data-latitude') || '');
                    if (lngEl) lng = parseFloat(lngEl.getAttribute('data-lng') || lngEl.getAttribute('data-longitude') || '');
                }
                result.latitude  = (lat && !isNaN(lat)) ? lat : null;
                result.longitude = (lng && !isNaN(lng)) ? lng : null;

                // Developer logo
                const devLogo = document.querySelector('[class*="developer"] img[src], [class*="partner"] img[src]');
                result.developer_logo = devLogo ? devLogo.getAttribute('src') : null;

                // ── Area "About [AreaName]" section ──────────────────────────────────
                result.area_description = null;
                result.area_image = null;
                const aboutH2 = Array.from(document.querySelectorAll('h2')).find(
                    h => /^about\\s/i.test(h.innerText.trim())
                );
                if (aboutH2) {
                    // Look for description paragraph in the same .cont container or as sibling
                    const cont = aboutH2.closest('[class*="cont"]') || aboutH2.parentElement;
                    const dp = cont ? cont.querySelector('p') : null;
                    if (dp && dp.innerText.trim().length > 30) {
                        result.area_description = dp.innerText.trim();
                    } else {
                        let sib = aboutH2.nextElementSibling;
                        for (let i = 0; i < 5 && sib; i++) {
                            if (['H2','H3','H4'].includes(sib.tagName)) break;
                            let pt = '';
                            if (sib.tagName === 'P') pt = sib.innerText.trim();
                            else { const p2 = sib.querySelector('p'); if (p2) pt = p2.innerText.trim(); }
                            if (pt.length > 30) { result.area_description = pt; break; }
                            sib = sib.nextElementSibling;
                        }
                    }
                    // Find area background image: walk up and check DIRECT children only
                    // (querySelector would find the project's main .wrapper1 instead)
                    let areaNode = aboutH2;
                    for (let i = 0; i < 8 && areaNode && areaNode !== document.body; i++) {
                        const par = areaNode.parentElement;
                        if (!par) break;
                        const directChildren = Array.from(par.children);
                        const wrapper = directChildren.find(c =>
                            (c.className && typeof c.className === 'string' && c.className.includes('wrapper')) ||
                            ((c.getAttribute('style') || '').includes('background-image'))
                        );
                        if (wrapper) {
                            const ws = wrapper.getAttribute('style') || '';
                            const wm = ws.match(/url\\([\"']?(https?:\\/\\/[^\"')\\s]+)[\"']?\\)/);
                            if (wm) { result.area_image = wm[1].replace(/%7B.*$/, ''); break; }
                        }
                        areaNode = par;
                    }
                }

                // ── Nearby sections: Attractions / Premier Healthcare / Elite Education ──
                result.nearby_attractions_raw = [];
                result.nearby_hospitals_raw   = [];
                result.nearby_schools_raw     = [];
                const nearbyDefs = [
                    ['nearby_attractions_raw', ['attraction', 'landmark', 'entertainment']],
                    ['nearby_hospitals_raw',   ['healthcare', 'hospital', 'medical', 'clinic']],
                    ['nearby_schools_raw',     ['education', 'school', 'universit', 'academy']]
                ];
                Array.from(document.querySelectorAll('h2, h3, h4')).forEach(heading => {
                    const ht = heading.innerText.trim().toLowerCase();
                    const def = nearbyDefs.find(d => d[1].some(t => ht.includes(t)));
                    if (!def || result[def[0]].length > 0) return;
                    const items = [];
                    // Walk siblings to collect list items
                    let sib2 = heading.nextElementSibling;
                    for (let i = 0; i < 10 && sib2; i++) {
                        if (['H2','H3','H4'].includes(sib2.tagName)) break;
                        sib2.querySelectorAll('li').forEach(li => {
                            const t = li.innerText.trim(); if (t.length > 2) items.push(t);
                        });
                        if (sib2.tagName === 'LI') { const t2 = sib2.innerText.trim(); if (t2.length > 2) items.push(t2); }
                        sib2 = sib2.nextElementSibling;
                    }
                    // Fallback: check parent container's list items
                    if (items.length === 0) {
                        const cnt = heading.closest('[class*="col"], [class*="grid"]') || heading.parentElement;
                        if (cnt) cnt.querySelectorAll('li').forEach(li => {
                            const t = li.innerText.trim(); if (t.length > 2) items.push(t);
                        });
                    }
                    if (items.length > 0) result[def[0]] = [...new Set(items)].slice(0, 10);
                });

                return result;
            }""")

            data["name"]                   = extracted.get("name", "")
            data["image_main"]             = extracted.get("image_main") or None
            data["description_raw"]        = extracted.get("description_raw", "")
            data["body_text"]              = extracted.get("body_text", "")
            data["images_all"]             = extracted.get("images_all", [])
            data["latitude"]               = extracted.get("latitude")
            data["longitude"]              = extracted.get("longitude")
            data["developer_logo"]         = extracted.get("developer_logo")
            data["area_description"]       = extracted.get("area_description")
            data["area_image"]             = extracted.get("area_image")
            data["nearby_attractions_raw"] = extracted.get("nearby_attractions_raw", [])
            data["nearby_hospitals_raw"]   = extracted.get("nearby_hospitals_raw", [])
            data["nearby_schools_raw"]     = extracted.get("nearby_schools_raw", [])

            # If gallery sparse (≤2), try clicking tabs to trigger slider load
            if len(data["images_all"]) < 3:
                for tab_text in ["Exteriors", "Exterior", "Gallery"]:
                    tab = page.locator(f"text={tab_text}").first
                    if await tab.count() > 0:
                        await tab.click()
                        await asyncio.sleep(4)
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
                f"{len(data['description_raw'])} chars desc, "
                f"area_desc={bool(data.get('area_description'))}, "
                f"nearby a={len(data['nearby_attractions_raw'])} "
                f"h={len(data['nearby_hospitals_raw'])} "
                f"s={len(data['nearby_schools_raw'])}"
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
