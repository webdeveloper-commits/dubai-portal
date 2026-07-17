"""
JARVIS enrichment phase — runs automatically after each Tuesday project scrape.

Areas:
  1. Nominatim geocoding (accurate lat/lng, free, no API key)
  2. Search bayut.com/area-guides/ index for matching area guide URL
  3. Scrape Bayut area guide page for hero image, description, schools, hospitals, lifestyle

Developers:
  1. DuckDuckGo search for "[developer] UAE real estate developer official website"
  2. Scrape official website for logo + about text

Each area/developer is enriched only once — enriched=True flag prevents repeats.
"""
import asyncio
import random
import re
import logging
import httpx
from bs4 import BeautifulSoup
from .scraper import get_browser, _new_stealth_page
from .storage import db

logger = logging.getLogger(__name__)

NOMINATIM_URL      = "https://nominatim.openstreetmap.org/search"
BAYUT_AREA_GUIDES  = "https://www.bayut.com/area-guides/"

# Domains to skip when looking for official developer websites
_PORTAL_DOMAINS = {
    "bayut.com", "propertyfinder.ae", "dubizzle.com", "opr.ae",
    "wikipedia.org", "linkedin.com", "facebook.com", "twitter.com",
    "instagram.com", "youtube.com", "google.com", "bing.com",
    "zawya.com", "gulfnews.com", "khaleejitimes.com", "arabianbusiness.com",
}


# ── Geocoding ──────────────────────────────────────────────────────────────────

async def geocode(name: str, emirate: str = "Dubai") -> tuple[float | None, float | None]:
    """Accurate lat/lng from OpenStreetMap Nominatim — free, no API key."""
    queries = [f"{name}, {emirate}, UAE", f"{name}, UAE"]
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


# Bayut's index/404 page always has this substring in its title
_BAYUT_INDEX_TITLE = "area guides for dubai, abu dhabi"

# Single-segment slugs that are emirate section pages, not area guides
_EMIRATE_SLUGS = {
    "dubai", "abu-dhabi", "sharjah", "ajman",
    "ras-al-khaimah", "fujairah", "umm-al-quwain",
}

# Generic words stripped before word-overlap matching
_STOP_WORDS = {
    "the", "by", "al", "ibn", "um", "abu", "bur", "ras",
    "new", "old", "area", "and", "in", "at", "of",
}


def _bayut_is_index_page(title: str) -> bool:
    t = title.lower()
    return _BAYUT_INDEX_TITLE in t or not t.strip() or "captcha" in t or "access denied" in t or "robot" in t


def _sig_words(name: str) -> set:
    return {w for w in re.split(r"[\s\-]+", name.lower()) if len(w) > 2 and w not in _STOP_WORDS}


# ── Bayut area guide — direct emirate listing pages ───────────────────────────
#
# Dubai Ready has only 4 areas — we know their direct URLs.
# All other areas are found by scraping the emirate-specific listing page.
# Pagination pattern: {base_url}page/{n}/

_DUBAI_READY_URLS: list[str] = [
    "https://www.bayut.com/area-guides/elie-saab/",
    "https://www.bayut.com/area-guides/downtown-dubai/",
    "https://www.bayut.com/area-guides/business-bay/",
    "https://www.bayut.com/area-guides/jumeirah-village-circle/",
]

# Maps normalised emirate name → [ready listing URL, offplan listing URL]
_EMIRATE_LISTING_URLS: dict[str, list[str]] = {
    "dubai":          ["https://www.bayut.com/area-guides/off-plan/dubai/"],
    "abu dhabi":      ["https://www.bayut.com/area-guides/ready/abu-dhabi/",
                       "https://www.bayut.com/area-guides/off-plan/abu-dhabi/"],
    "sharjah":        ["https://www.bayut.com/area-guides/ready/sharjah/",
                       "https://www.bayut.com/area-guides/off-plan/sharjah/"],
    "ajman":          ["https://www.bayut.com/area-guides/ready/ajman/",
                       "https://www.bayut.com/area-guides/off-plan/ajman/"],
    "ras al khaimah": ["https://www.bayut.com/area-guides/ready/ras-al-khaimah/",
                       "https://www.bayut.com/area-guides/off-plan/ras-al-khaimah/"],
    "al ain":         ["https://www.bayut.com/area-guides/ready/al-ain/"],
    "umm al quwain":  ["https://www.bayut.com/area-guides/ready/umm-al-quwain/",
                       "https://www.bayut.com/area-guides/off-plan/umm-al-quwain/"],
    "fujairah":       ["https://www.bayut.com/area-guides/ready/fujairah/",
                       "https://www.bayut.com/area-guides/off-plan/fujairah/"],
}

# URL path segments that are listing-level (not individual area guides)
_LISTING_SEGMENTS = {"ready", "off-plan", "area-guides", "page"}


async def _detect_emirate(area_name: str) -> str:
    """
    Use Claude (Haiku) to determine which UAE emirate an area belongs to.
    Returns a normalised lowercase key matching _EMIRATE_LISTING_URLS.
    """
    import anthropic as _anthropic
    from ..config import ANTHROPIC_KEY
    client = _anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    try:
        resp = await asyncio.to_thread(
            lambda: client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=20,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Which UAE emirate does '{area_name}' belong to? "
                        "Reply with ONLY one of: Dubai, Abu Dhabi, Sharjah, Ajman, "
                        "Ras Al Khaimah, Fujairah, Umm Al Quwain, Al Ain"
                    ),
                }],
            )
        )
        raw = resp.content[0].text.strip().lower()
        for key in _EMIRATE_LISTING_URLS:
            if key in raw:
                logger.info(f"Claude detected emirate for '{area_name}': {key}")
                return key
    except Exception as e:
        logger.warning(f"_detect_emirate failed: {e}")
    return "dubai"


# ── Bayut area guide — find URL ────────────────────────────────────────────────

async def _validate_bayut_url(url: str) -> bool:
    """
    Confirm a Bayut URL is a real area guide page.
    Bayut returns HTTP 200 for invalid slugs but renders the main index page —
    so we check both the redirect URL AND the <title> in the SSR HTML.
    """
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            r = await client.get(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/131.0.0.0 Safari/537.36"
                    ),
                    "Referer": "https://www.bayut.com/area-guides/",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
        final = str(r.url)
        if "/area-guides/" not in final or r.status_code != 200:
            logger.info(f"  Validate {url} → redirected to {final} ✗")
            return False
        # Bayut returns 200 for unknown slugs but renders the index page.
        # The <title> is in the SSR HTML — check it without a browser.
        title_m = re.search(r"<title[^>]*>(.*?)</title>", r.text, re.IGNORECASE | re.DOTALL)
        if title_m:
            page_title = title_m.group(1).strip()
            if _bayut_is_index_page(page_title):
                logger.info(f"  Validate {url} → index/invalid content: '{page_title}' ✗")
                return False
        logger.info(f"  Validate {url} ✓")
        return True
    except Exception as e:
        logger.warning(f"  Validate failed for {url}: {e}")
        return False


async def _slug_find_bayut_url(area_name: str) -> str | None:
    """
    Construct the most likely Bayut slug from the area name and validate it.
    Works for ~90% of areas: 'Jumeirah Village Circle' → jumeirah-village-circle.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", area_name.lower().strip()).strip("-")
    url  = f"https://www.bayut.com/area-guides/{slug}/"
    logger.info(f"Trying direct slug: {url}")
    if await _validate_bayut_url(url):
        return url
    return None


async def _search_find_bayut_url(area_name: str) -> str | None:
    """
    Search Bing for '[area name] area guide site:bayut.com' and return the
    first bayut.com/area-guides/ result. Bing is accessible from server IPs
    and returns direct hrefs (no redirect wrapping like DDG).
    Handles non-obvious slugs: 'The Acres Dubai' → /area-guides/the-acres-by-meraas/
    """
    query = f'"{area_name}" area guide site:bayut.com'
    logger.info(f"Bing search: {query}")
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(
                "https://www.bing.com/search",
                params={"q": query},
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/131.0.0.0 Safari/537.36"
                    ),
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
        logger.info(f"Bing response: {r.status_code}, {len(r.text)} chars")
        soup = BeautifulSoup(r.text, "html.parser")

        # Bing: result links are in <h2><a href="https://..."> — direct URLs
        for a in soup.select("h2 a"):
            href = a.get("href", "")
            if "bayut.com/area-guides/" in href:
                url  = href.split("?")[0].rstrip("/") + "/"
                slug = url.split("/area-guides/")[-1].strip("/")
                if slug and slug not in _LISTING_SEGMENTS and slug not in _EMIRATE_SLUGS:
                    logger.info(f"Bing found: {url}")
                    return url

        # Log what Bing returned for debugging
        for i, a in enumerate(soup.select("h2 a")[:5], 1):
            logger.info(f"  Bing result {i}: {a.get('href','')[:120]}")
        logger.info(f"Bing: no /area-guides/ result for '{area_name}'")

    except Exception as e:
        logger.warning(f"Bing search failed for '{area_name}': {e}")
    return None


async def find_bayut_area_guide_url(area_name: str, emirate: str = "") -> str | None:
    """
    Find the Bayut area guide URL for an area.

    Strategy (fastest first):
      1. Direct slug construction + httpx validation — works for ~90% of areas,
         no browser needed: 'Jumeirah Village Circle' → /area-guides/jumeirah-village-circle/
      2. DuckDuckGo search — handles non-obvious slugs like 'The Acres Dubailand'
         NOTE: may be rate-limited from server IPs
      3. Emirate listing page pagination via Playwright — last resort
    """
    # ── Step 1: Direct slug (fast, no browser) ────────────────────────────
    url = await _slug_find_bayut_url(area_name)
    if url:
        return url

    # ── Step 2: Bing search (handles non-obvious slugs) ──────────────────
    url = await _search_find_bayut_url(area_name)
    if url:
        return url

    # ── Step 3: Emirate listing page fallback ─────────────────────────────
    emirate_key = emirate.lower().strip() if emirate else ""
    if not emirate_key or emirate_key not in _EMIRATE_LISTING_URLS:
        emirate_key = await _detect_emirate(area_name)
    logger.info(f"Slug+Bing failed — using listing pages for '{area_name}' [{emirate_key}]")

    target_lower = area_name.lower().strip()
    target_sig   = _sig_words(area_name)

    def _score_link(text: str, slug: str) -> int:
        if not text and not slug:
            return 0
        t = text.strip().lower()
        slug_words = {w for w in re.split(r"[\s\-]+", slug.lower()) if len(w) > 2 and w not in _STOP_WORDS}
        if t == target_lower:
            return 100
        if len(t) >= 3 and (t.startswith(target_lower) or target_lower.startswith(t)):
            return 85
        text_sig = _sig_words(t) if t else set()
        if text_sig and target_sig:
            shared = len(target_sig & text_sig)
            fwd = shared / len(target_sig)
            bwd = shared / len(text_sig)
        else:
            fwd = bwd = 0.0
        slug_shared = len(target_sig & slug_words) if slug_words else 0
        slug_fwd = slug_shared / len(target_sig) if target_sig else 0.0
        best = max(fwd, slug_fwd)
        if best >= 0.6 and bwd >= 0.6:
            return 70
        return 0

    browser = await get_browser()
    page = await _new_stealth_page(browser)

    try:
        base_urls = _EMIRATE_LISTING_URLS.get(emirate_key, _EMIRATE_LISTING_URLS["dubai"])

        for base_url in base_urls:
            for page_num in range(1, 10):
                listing_url = base_url if page_num == 1 else f"{base_url}page/{page_num}/"
                logger.info(f"  Checking: {listing_url}")
                try:
                    await page.goto(listing_url, wait_until="load", timeout=45_000)
                except Exception:
                    pass
                await asyncio.sleep(3)

                pg_title = await page.title()
                if _bayut_is_index_page(pg_title):
                    logger.info(f"  → Hit index/captcha, stopping pagination for {base_url}")
                    break

                links: list = await page.evaluate("""(args) => {
                    const emir = new Set(args.emir);
                    const listingSegs = new Set(args.listingSegs);
                    const seen = new Set();
                    const out = [];
                    document.querySelectorAll('a[href*="/area-guides/"]').forEach(a => {
                        const href = (a.href||'').split('?')[0].replace(/\\/+$/,'');
                        if (seen.has(href)) return;
                        seen.add(href);
                        const segs = href.replace('https://www.bayut.com','')
                                         .split('/').filter(Boolean);
                        if (segs.length < 2) return;
                        const slug = segs[segs.length - 1];
                        if (emir.has(slug) || !slug || /^\\d+$/.test(slug)) return;
                        if (listingSegs.has(slug)) return;
                        const text = (a.innerText||a.textContent||'').trim();
                        out.push({ href, text, slug });
                    });
                    return out;
                }""", {"emir": list(_EMIRATE_SLUGS), "listingSegs": list(_LISTING_SEGMENTS)})

                logger.info(f"  Found {len(links)} area links on page {page_num}")
                if not links:
                    break

                for lnk in links:
                    logger.info(f"    slug='{lnk['slug']}' text='{lnk['text'][:60]}'")

                best_score, best_url = 0, None
                for lnk in links:
                    s = _score_link(lnk["text"], lnk["slug"])
                    if s > best_score:
                        best_score, best_url = s, lnk["href"]

                if best_url and best_score >= 70:
                    logger.info(f"  Match score={best_score}: {best_url}")
                    try:
                        await page.goto(best_url, wait_until="load", timeout=40_000)
                    except Exception:
                        pass
                    await asyncio.sleep(3)
                    final_url = page.url.split("?")[0].rstrip("/")
                    confirmed_title = await page.title()
                    if "/area-guides/" not in final_url:
                        logger.warning(f"  Redirected away from area-guides: {final_url}")
                        continue
                    if _bayut_is_index_page(confirmed_title):
                        logger.warning(f"  Captcha/index on detail page — skipping")
                        continue
                    logger.info(f"  Confirmed: {confirmed_title}")
                    return final_url + "/"

        logger.warning(f"No Bayut area guide found for '{area_name}'")
        return None

    except Exception as e:
        logger.error(f"find_bayut_area_guide_url failed for '{area_name}': {e}")
        return None
    finally:
        await page.close()


# ── Bayut area guide — scrape detail page ─────────────────────────────────────

def _parse_next_data(nd: dict, area_name: str) -> dict:
    """
    Extract area guide data from window.__NEXT_DATA__ (Next.js SSR JSON blob).
    Bayut embeds all page props here — much cleaner than parsing rendered HTML.
    """
    result = {}
    try:
        props = nd.get("props", {}).get("pageProps", {})
        # Try common key names Bayut may use
        guide = (
            props.get("areaGuide") or props.get("community") or
            props.get("area") or props.get("data") or {}
        )
        if not guide:
            for val in props.values():
                if isinstance(val, dict) and any(k in val for k in ("description", "about", "name")):
                    guide = val
                    break

        if not guide:
            return result

        desc = (
            guide.get("description") or guide.get("about") or
            guide.get("communityDescription") or guide.get("overview") or ""
        )
        if isinstance(desc, str) and len(desc) > 20:
            result["description"] = desc[:800]

        img = guide.get("heroImage") or guide.get("coverImage") or guide.get("image") or ""
        if isinstance(img, str) and img.startswith("http"):
            il = img.lower()
            if "logo" not in il and ".svg" not in il and "icon" not in il:
                result["hero_image"] = img
        elif isinstance(img, dict):
            src = img.get("url") or img.get("src") or ""
            if src and "logo" not in src.lower() and ".svg" not in src.lower():
                result["hero_image"] = src

        for field, keys in [
            ("schools",   ["schools", "nearbySchools"]),
            ("hospitals", ["hospitals", "nearbyHospitals"]),
        ]:
            for k in keys:
                items = guide.get(k)
                if isinstance(items, list) and items:
                    result[field] = [
                        (s if isinstance(s, str) else s.get("name", "")) for s in items[:10]
                    ]
                    break

        tagline = guide.get("tagline") or guide.get("subtitle") or guide.get("shortDescription") or ""
        if isinstance(tagline, str) and tagline:
            result["tagline"] = tagline[:200]

        logger.info(f"__NEXT_DATA__ parsed for '{area_name}': desc={len(result.get('description',''))} chars")
    except Exception as e:
        logger.warning(f"_parse_next_data failed: {e}")
    return result


async def scrape_bayut_area_guide(url: str, area_name: str) -> dict:
    """
    Scrape a Bayut area guide detail page (fully client-side Next.js app).
    Hard 90 s timeout on the entire operation — prevents hanging on CAPTCHA.
    """
    try:
        return await asyncio.wait_for(_scrape_bayut_area_guide_inner(url, area_name), timeout=90)
    except asyncio.TimeoutError:
        logger.warning(f"scrape_bayut_area_guide timed out for '{area_name}' — skipping")
        return {}


async def _scrape_bayut_area_guide_inner(url: str, area_name: str) -> dict:
    browser = await get_browser()
    page = await _new_stealth_page(browser)
    result = {}

    try:
        logger.info(f"Scraping Bayut area guide: {url}")
        try:
            await page.goto(BAYUT_AREA_GUIDES, wait_until="load", timeout=25_000)
        except Exception:
            pass
        await asyncio.sleep(2)
        try:
            await page.goto(url, wait_until="load", timeout=45_000)
        except Exception:
            pass
        await asyncio.sleep(4)

        # Scroll progressively to trigger all lazy-loaded images
        for y in [400, 1000, 2000, 3500, 0]:
            await page.evaluate(f"window.scrollTo(0, {y})")
            await asyncio.sleep(1)

        # ── Step 1: __NEXT_DATA__ structured extraction ────────────────────
        nd = await page.evaluate(
            "() => { try { return window.__NEXT_DATA__ || null; } catch(e) { return null; } }"
        )
        if nd:
            result = _parse_next_data(nd, area_name)

        # ── Step 2: Section-ID-based DOM extraction ────────────────────────
        dom_result = await page.evaluate("""() => {
            const r = {
                hero_image: null,
                description: '',
                nutshell: [],
                community_overview: '',
                transport: '',
                schools: [],
                hospitals: [],
                nearby_areas: [],
                lifestyle: '',
                shopping: '',
                faqs: [],
                location: '',
                malls: [],
            };

            // ── Helpers ──────────────────────────────────────────────────────
            function getImgSrc(el) {
                if (!el) return null;
                return el.getAttribute('src') || el.getAttribute('data-src') ||
                       el.getAttribute('data-lazy-src') || el.getAttribute('data-original') || null;
            }
            function isBadImg(src) {
                if (!src || !src.startsWith('http')) return true;
                const sl = src.toLowerCase();
                return sl.includes('logo') || sl.includes('.svg') || sl.includes('icon') ||
                       sl.includes('placeholder') || sl.includes('avatar') || sl.includes('spinner') ||
                       sl.includes('bayutlogo') || sl.includes('default') || sl.includes('map');
            }
            function isExcluded(el) {
                let p = el ? el.parentElement : null;
                while (p && p !== document.body) {
                    const tag = p.tagName;
                    const cls = typeof p.className === 'string' ? p.className.toLowerCase() : '';
                    if (tag === 'NAV' || tag === 'FOOTER') return true;
                    if (cls.includes('navigation') || cls.includes('breadcrumb') ||
                        cls.includes('enquir') || cls.includes('topbar') ||
                        cls.includes('contactForm') || cls.includes('agentInfo') ||
                        cls.includes('sidebar') || cls.includes('_footer') ||
                        cls.includes('searchWidget') || cls.includes('_header')) return true;
                    p = p.parentElement;
                }
                return false;
            }
            const NOISE = [
                /keyboard_arrow/i, /chevron_right/i, /arrow_forward/i,
                /^building guides?$/i, /^school guides?$/i, /^area guides?$/i,
                /^dubai transactions$/i, /^truestimate/i,
                /^areas?$/i, /^ready$/i, /^off.?plan$/i, /^rent$/i, /^buy$/i,
                /aed\\s*[\\d,]+/i, /\\d+\\s*bed/i, /per year/i, /per month/i,
                /call agent/i, /whatsapp/i, /view details/i, /listed by/i,
                /apartments for sale/i, /villas for sale/i, /for rent in/i,
                /send enquiry/i, /free consultation/i, /no obligation/i,
                /^view properties/i, /^view all/i, /^see all/i,
                /^floor plans$/i, /^new projects$/i, /^agents?$/i,
            ];
            function isNoise(t) { return !t || NOISE.some(p => p.test(t)); }

            // ── Hero image ────────────────────────────────────────────────────
            const bgSels = [
                '[class*="pageHeader"]', '[class*="_hero"]', '[class*="_banner"]',
                '[class*="_cover"]', '[class*="communityHeader"]', '[class*="headerImage"]'
            ];
            for (const sel of bgSels) {
                const el = document.querySelector(sel);
                if (!el) continue;
                const bg = window.getComputedStyle(el).backgroundImage;
                if (bg && bg !== 'none') {
                    const m = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
                    if (m && !isBadImg(m[1])) { r.hero_image = m[1]; break; }
                }
            }
            if (!r.hero_image) {
                for (const src of document.querySelectorAll('picture source')) {
                    const ss = src.getAttribute('srcset') || src.getAttribute('data-srcset') || '';
                    const u = ss.split(',')[0].trim().split(' ')[0];
                    if (!isBadImg(u)) { r.hero_image = u; break; }
                }
            }
            if (!r.hero_image) {
                for (const sel of ['[class*="_hero"] img','[class*="_banner"] img','picture img','main img']) {
                    const el = document.querySelector(sel);
                    if (!el || isExcluded(el)) continue;
                    const src = getImgSrc(el);
                    if (!isBadImg(src)) { r.hero_image = src; break; }
                }
            }
            if (!r.hero_image) {
                for (const img of document.querySelectorAll('img')) {
                    if (isExcluded(img)) continue;
                    const src = getImgSrc(img);
                    if (!isBadImg(src) && src && src.length > 40) { r.hero_image = src; break; }
                }
            }

            // ── Section extractor using Bayut's id= anchors ───────────────────
            // Returns all paragraph/list text between a section anchor and the next [id] element.
            // Uses compareDocumentPosition for reliable DOM-order checks:
            //   anchor.compareDocumentPosition(el) & 4 → el FOLLOWS anchor
            //   boundary.compareDocumentPosition(el) & 2 → el PRECEDES boundary
            function _sectionBounds(sectionId) {
                const anchor = document.getElementById(sectionId);
                if (!anchor) return null;
                // Use document-level query so anchor is always found even if outside <main>
                const allTagged = Array.from(document.querySelectorAll('[id]'));
                const anchorIdx = allTagged.indexOf(anchor);
                const boundary = anchorIdx >= 0 ? allTagged[anchorIdx + 1] : null;
                const scope = document.querySelector('main') || document.body;
                return { anchor, boundary, scope };
            }

            function extractSection(sectionId) {
                const b = _sectionBounds(sectionId);
                if (!b) return '';
                const { anchor, boundary, scope } = b;
                const allEls = Array.from(scope.querySelectorAll('p,li'));
                const parts = [];
                for (const el of allEls) {
                    // Must come after anchor in DOM order
                    if (!(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
                    // Stop when we reach or pass the boundary
                    if (boundary && !(boundary.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) break;
                    if (isExcluded(el)) continue;
                    // Skip LI/P that have block children (avoid double-collecting)
                    if (el.querySelector('ul,ol,div,p')) continue;
                    const t = (el.innerText || '').trim();
                    if (t.length < 15 || isNoise(t)) continue;
                    const anchors = el.querySelectorAll('a');
                    const aLen = Array.from(anchors).reduce((s,a) => s + a.innerText.length, 0);
                    if (anchors.length > 2 && aLen > t.length * 0.6) continue;
                    parts.push(t);
                }
                return parts.join('\\n\\n');
            }

            // Variant that collects items as an array (for bullet-list / named-list sections)
            function extractSectionList(sectionId) {
                const b = _sectionBounds(sectionId);
                if (!b) return [];
                const { anchor, boundary, scope } = b;
                const allEls = Array.from(scope.querySelectorAll('li,p'));
                const items = [];
                for (const el of allEls) {
                    if (!(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
                    if (boundary && !(boundary.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) break;
                    if (isExcluded(el)) continue;
                    if (el.querySelector('ul,ol,div,p')) continue;
                    const t = (el.innerText || '').trim();
                    if (t.length > 5 && !isNoise(t)) items.push(t);
                }
                return [...new Set(items)];
            }

            // ── FAQs: find any id that has "faq" in it ───────────────────────
            function extractFaqs() {
                const faqEl = document.querySelector('[id*="faq" i]') ||
                              document.querySelector('[id*="question" i]');
                if (!faqEl) return [];
                const scope = document.querySelector('main') || document.body;
                const allTagged = Array.from(scope.querySelectorAll('[id]'));
                const anchorIdx = allTagged.indexOf(faqEl);
                const boundary = anchorIdx >= 0 ? allTagged[anchorIdx + 1] : null;

                const faqs = [];
                // Collect all h3/h4 (questions) and p (answers) after the faq anchor
                const allEls = Array.from(scope.querySelectorAll('h3,h4,p'));
                let pendingQ = null;
                for (const el of allEls) {
                    if (!(faqEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
                    if (boundary && !(boundary.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) break;
                    if (isExcluded(el)) continue;
                    const tag = el.tagName;
                    const t = (el.innerText || '').trim();
                    if (!t || t.length < 10) continue;

                    if (['H3','H4'].includes(tag)) {
                        if (pendingQ) faqs.push({ question: pendingQ, answer: '' });
                        pendingQ = t;
                    } else if (tag === 'P' && pendingQ) {
                        if (el.querySelector('p')) continue;
                        if (t.length > 20 && !isNoise(t)) {
                            faqs.push({ question: pendingQ, answer: t });
                            pendingQ = null;
                        }
                    }
                }
                if (pendingQ) faqs.push({ question: pendingQ, answer: '' });
                return faqs.slice(0, 15);
            }

            // ── Extract all known Bayut section IDs ──────────────────────────
            // About section: id starts with "about-"
            const aboutAnchor = document.querySelector('[id^="about-"]');
            if (aboutAnchor) r.description = extractSection(aboutAnchor.id);

            // In a nutshell bullets
            const nutshellAnchor = document.getElementById('in-a-nutshell') ||
                                   document.querySelector('[id*="nutshell" i]');
            if (nutshellAnchor) r.nutshell = extractSectionList(nutshellAnchor.id);

            // Neighbourhood overview (usually more detail than "about")
            const neighbourhoodAnchor = document.getElementById('neighbourhood') ||
                                        document.querySelector('[id*="neighbourhood" i]');
            if (neighbourhoodAnchor) {
                const t = extractSection(neighbourhoodAnchor.id);
                if (t) r.description = r.description ? r.description + '\\n\\n' + t : t;
            }

            // Community overview
            const communityAnchor = document.getElementById('community-overview') ||
                                    document.querySelector('[id*="community-overview" i]');
            if (communityAnchor) {
                const t = extractSection(communityAnchor.id);
                r.community_overview = t;
                if (t) r.description = r.description ? r.description + '\\n\\n' + t : t;
            }

            // Transport / commute — try both transport and the longer public-transportation-in-* id
            const transportAnchor = document.getElementById('transport') ||
                                    document.querySelector('[id^="public-transportation" i]') ||
                                    document.querySelector('[id*="transport" i]');
            if (transportAnchor) r.transport = extractSection(transportAnchor.id);

            // Amenities / schools / healthcare section (descriptive paragraphs)
            const amenitiesAnchor = document.querySelector('[id*="amenities" i]') ||
                                    document.querySelector('[id*="amenities,-schools" i]');
            // Schools: id ending in "-schools" (e.g. "al-raha-beach-schools")
            // Avoid "amenities,-schools-and-healthcare" which is just a section header
            const schoolsAnchor = document.querySelector('[id$="-schools"]') ||
                                  document.querySelector('[id$="schools"]') ||
                                  document.querySelector('[id*="school" i]:not([id*="amenities" i])');
            if (schoolsAnchor) {
                r.schools = extractSectionList(schoolsAnchor.id);
                if (!r.schools.length) {
                    const txt = extractSection(schoolsAnchor.id);
                    if (txt) r.schools = txt.split('\\n\\n').filter(t => t.length > 5);
                }
            }
            // If still empty, use amenities section for schools
            if (!r.schools.length && amenitiesAnchor) {
                const txt = extractSection(amenitiesAnchor.id);
                if (txt) r.schools = txt.split('\\n\\n').filter(t => t.length > 10 &&
                    (t.toLowerCase().includes('school') || t.toLowerCase().includes('university') ||
                     t.toLowerCase().includes('nursery') || t.toLowerCase().includes('education')));
            }

            // Hospitals / clinics
            const hospAnchor = document.querySelector('[id*="hospital" i]') ||
                               document.querySelector('[id*="clinic" i]') ||
                               document.querySelector('[id*="healthcare" i]');
            if (hospAnchor) {
                r.hospitals = extractSectionList(hospAnchor.id);
                if (!r.hospitals.length) {
                    const txt = extractSection(hospAnchor.id);
                    if (txt) r.hospitals = txt.split('\\n\\n').filter(t => t.length > 5);
                }
            }

            // Nearby areas
            const nearbyAnchor = document.getElementById('nearby-areas') ||
                                 document.querySelector('[id*="nearby-area" i]');
            if (nearbyAnchor) r.nearby_areas = extractSectionList(nearbyAnchor.id);

            // Shopping / dining / nightlife
            const shoppingAnchor = document.querySelector('[id*="shopping,-dining" i]') ||
                                   document.querySelector('[id*="shopping" i]') ||
                                   document.querySelector('[id*="dining" i]');
            if (shoppingAnchor) r.shopping = extractSection(shoppingAnchor.id);

            // Malls
            const mallsAnchor = document.querySelector('[id*="mall" i]');
            if (mallsAnchor) r.malls = extractSectionList(mallsAnchor.id);

            // Lifestyle: the 'lifestyle' id is just a nav header — real content is in sub-sections
            // outdoor-activities,fitness,beauty is the main content section
            const lifestyleAnchor = document.querySelector('[id*="outdoor-activities" i]') ||
                                    document.querySelector('[id*="fitness" i]') ||
                                    document.querySelector('[id*="recreation" i]') ||
                                    document.getElementById('lifestyle');
            if (lifestyleAnchor) r.lifestyle = extractSection(lifestyleAnchor.id);

            // Location / distances
            const locationAnchor = document.getElementById('location') ||
                                   document.querySelector('[id*="location" i]');
            if (locationAnchor) r.location = extractSection(locationAnchor.id);

            // FAQs
            r.faqs = extractFaqs();

            // Fallback: if description still empty, collect first 6 <p> > 80 chars from main
            if (!r.description) {
                const BAD = ['keyboard_arrow','Apartments for sale','Building Guides',
                             'Dubai Transactions','for rent in Dubai','New Projects','TrueEstimate',
                             'bayut.com','propertyfinder'];
                const scope = document.querySelector('main') || document.body;
                const paras = [];
                for (const p of scope.querySelectorAll('p')) {
                    if (isExcluded(p)) continue;
                    const t = p.innerText.trim();
                    if (t.length < 80 || isNoise(t)) continue;
                    if (BAD.some(b => t.includes(b))) continue;
                    paras.push(t);
                    if (paras.length >= 6) break;
                }
                r.description = paras.join('\\n\\n');
            }

            return r;
        }""")

        # Merge: __NEXT_DATA__ takes priority, DOM fills any gaps
        for key, val in dom_result.items():
            if not result.get(key) and val:
                result[key] = val

        logger.info(
            f"Bayut guide '{area_name}' — "
            f"hero={'yes' if result.get('hero_image') else 'no'}, "
            f"desc={len(result.get('description',''))} chars, "
            f"nutshell={len(result.get('nutshell',[]))}, "
            f"schools={len(result.get('schools',[]))}, "
            f"hospitals={len(result.get('hospitals',[]))}, "
            f"faqs={len(result.get('faqs',[]))}, "
            f"transport={len(result.get('transport',''))} chars, "
            f"lifestyle={len(result.get('lifestyle',''))} chars"
        )

    except Exception as e:
        logger.error(f"scrape_bayut_area_guide failed for '{area_name}': {e}")
    finally:
        await page.close()

    return result


async def test_area_scrape(area_name: str) -> str:
    """
    Debug helper: detects emirate, finds Bayut URL via emirate listing pages,
    then scrapes that URL. Called by TEST AREA [name] Telegram command.
    """
    import json as _json
    lines = [f"TEST AREA: {area_name}\n"]

    # ── Phase 1: detect emirate ──────────────────────────────────────────
    lines.append("Phase 1: Detecting emirate...")
    emirate = await _detect_emirate(area_name)
    lines.append(f"Emirate detected: {emirate}")

    # ── Phase 2: find URL (slug → Bing → listing pages) ─────────────────
    lines.append("\nPhase 2: Finding Bayut URL...")
    url = await find_bayut_area_guide_url(area_name, emirate=emirate)
    if not url:
        lines.append("Bayut URL: NOT FOUND")
        return "\n".join(lines)
    lines.append(f"Bayut URL: {url}")

    # ── Phase 3: scrape the found URL ────────────────────────────────────
    lines.append("\nPhase 3: Scraping found URL...")
    browser = await get_browser()
    page = await _new_stealth_page(browser)
    try:
        try:
            await page.goto(url, wait_until="load", timeout=60_000)
        except Exception:
            pass
        await asyncio.sleep(5)
        for y in [400, 1000, 2000, 3500, 0]:
            await page.evaluate(f"window.scrollTo(0, {y})")
            await asyncio.sleep(0.8)

        nd = await page.evaluate(
            "() => { try { return window.__NEXT_DATA__ || null; } catch(e) { return null; } }"
        )
        if nd:
            try:
                with open("/tmp/bayut_debug.json", "w") as f:
                    _json.dump(nd, f, indent=2)
                nd_result = _parse_next_data(nd, area_name)
                lines.append("Page __NEXT_DATA__: YES → /tmp/bayut_debug.json")
                lines.append(f"  desc={len(nd_result.get('description',''))} chars  hero={'yes' if nd_result.get('hero_image') else 'no'}")
            except Exception as e:
                lines.append(f"Page __NEXT_DATA__: YES but failed: {e}")
        else:
            lines.append("Page __NEXT_DATA__: NOT FOUND")

        title = await page.title()
        lines.append(f"Page title: {title}")

        sample = await page.evaluate("""() => {
            const scope = document.querySelector('main') || document.body;
            // Collect all [id] anchors to understand section structure
            const ids = Array.from(scope.querySelectorAll('[id]')).map(el => el.id).filter(Boolean);
            const paras = Array.from(scope.querySelectorAll('p'))
                .map(p => p.innerText.trim())
                .filter(t => t.length > 40)
                .slice(0, 5);
            return { ids: ids.slice(0, 30), paras };
        }""")
        lines.append(f"Section IDs found: {sample.get('ids', [])}")
        paras = sample.get('paras', [])
        lines.append(f"First <p> texts in <main>: {len(paras)} found")
        for i, t in enumerate(paras, 1):
            lines.append(f"  {i}. {t[:120]}")

        # Also show what the full scraper extracts
        lines.append("\nPhase 4: Full extraction preview...")
        scraped = await scrape_bayut_area_guide(url, area_name)
        lines.append(f"  description: {len(scraped.get('description',''))} chars — {scraped.get('description','')[:200]}")
        lines.append(f"  nutshell: {scraped.get('nutshell', [])[:3]}")
        lines.append(f"  transport: {scraped.get('transport','')[:150]}")
        lines.append(f"  schools: {scraped.get('schools', [])[:3]}")
        lines.append(f"  hospitals: {scraped.get('hospitals', [])[:3]}")
        lines.append(f"  lifestyle: {scraped.get('lifestyle','')[:150]}")
        lines.append(f"  faqs: {len(scraped.get('faqs', []))} found")
        lines.append(f"  nearby_areas: {scraped.get('nearby_areas', [])[:5]}")

    except Exception as e:
        lines.append(f"Scrape error: {e}")
    finally:
        await page.close()

    return "\n".join(lines)


# ── Developer website search ───────────────────────────────────────────────────

async def _ddg_find_developer_website(dev_name: str) -> str | None:
    """DuckDuckGo search for developer's official website."""
    query = f'"{dev_name}" UAE real estate developer official website'
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            r = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9"},
            )
        soup = BeautifulSoup(r.text, "html.parser")
        import urllib.parse as _ulp
        for a in soup.select(".result__a"):
            href = a.get("href", "")
            m = re.search(r'uddg=(https?[^&]+)', href)
            if m:
                href = _ulp.unquote(m.group(1))
            if not href.startswith("http"):
                continue
            domain = re.sub(r'^https?://(www\.)?', '', href).split('/')[0].lower()
            if not any(s in domain for s in _PORTAL_DOMAINS):
                logger.info(f"DDG found developer site for '{dev_name}': {href}")
                return href
    except Exception as e:
        logger.warning(f"DDG dev search failed for '{dev_name}': {e}")
    return None


async def _bing_find_developer_website(dev_name: str) -> str | None:
    """Bing search fallback for developer's official website."""
    query = f'"{dev_name}" UAE real estate developer official site'
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            r = await client.get(
                "https://www.bing.com/search",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9"},
            )
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.select("h2 a"):
            href = a.get("href", "")
            if not href.startswith("http"):
                continue
            href = href.split("?")[0]
            domain = re.sub(r'^https?://(www\.)?', '', href).split('/')[0].lower()
            if not any(s in domain for s in _PORTAL_DOMAINS) and domain:
                logger.info(f"Bing found developer site for '{dev_name}': {href}")
                return href
    except Exception as e:
        logger.warning(f"Bing dev search failed for '{dev_name}': {e}")
    return None


async def find_developer_website(dev_name: str) -> str | None:
    """DDG → Bing fallback. Returns first non-portal result URL."""
    url = await _ddg_find_developer_website(dev_name)
    if url:
        return url
    logger.info(f"DDG failed for '{dev_name}', trying Bing...")
    return await _bing_find_developer_website(dev_name)


async def scrape_developer_website(url: str, dev_name: str) -> dict:
    """
    Scrape developer's official website for: logo, hero image, about text,
    founding year, HQ, unit/employee stats, contact. Then supplement with
    Claude-generated FAQs, strengths, key projects, intro_short.
    """
    # Always use the root homepage — sub-pages from search results miss hero/logo
    from urllib.parse import urlparse as _urlparse
    parsed = _urlparse(url)
    root_url = f"{parsed.scheme}://{parsed.netloc}/"

    browser = await get_browser()
    page = await _new_stealth_page(browser)
    scraped = {}

    try:
        # Load root homepage; try networkidle for JS-heavy SPAs, fall back on timeout
        try:
            await page.goto(root_url, wait_until="networkidle", timeout=35_000)
        except Exception:
            try:
                await page.goto(root_url, wait_until="load", timeout=25_000)
            except Exception:
                pass
        await asyncio.sleep(4)
        # Scroll to trigger lazy-loads, then back to top
        for y in [600, 1400, 2500, 0]:
            await page.evaluate(f"window.scrollTo(0, {y})")
            await asyncio.sleep(0.8)

        scraped = await page.evaluate("""() => {
            const r = {
                logo_url: null, cover_image_url: null,
                tagline: '', about: '',
                founded_year: null, total_units: null, employees: null,
                years_active: null, headquarters: null,
                phone: null, email: null, about_url: null,
            };

            function getSrc(el) {
                if (!el) return null;
                return el.getAttribute('src') || el.getAttribute('data-src') ||
                       el.getAttribute('data-lazy-src') || el.getAttribute('data-original') || null;
            }
            function badSrc(src) {
                if (!src || !src.startsWith('http')) return true;
                const sl = src.toLowerCase();
                return sl.includes('placeholder') || sl.includes('spinner') || sl.includes('blank');
            }

            // ── Logo (header / nav) ───────────────────────────────────────────
            const logoSels = [
                'header img[class*="logo" i]', 'header img[alt*="logo" i]',
                'nav img[class*="logo" i]',   'nav img[alt*="logo" i]',
                '[class*="navbar"] img',       '[class*="header"] img[class*="logo" i]',
                '.logo img', '#logo img',      '[class*="brand"] img',
                'header a > img',              'nav a > img',
                'header img',                  'nav img',
            ];
            for (const sel of logoSels) {
                const el = document.querySelector(sel);
                const src = getSrc(el);
                if (src && src.startsWith('http') && !badSrc(src)) {
                    r.logo_url = src; break;
                }
            }

            // ── Cover / hero image (large banner, NOT logo) ───────────────────
            // Try CSS background-image first (common pattern)
            const bgSels = [
                '[class*="hero"]', '[class*="banner"]', '[class*="slider"]',
                '[class*="cover"]', '[class*="intro"]', 'section:first-of-type',
            ];
            for (const sel of bgSels) {
                const el = document.querySelector(sel);
                if (!el) continue;
                const bg = window.getComputedStyle(el).backgroundImage;
                if (bg && bg !== 'none') {
                    const m = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
                    if (m && m[1].startsWith('http') && !m[1].includes('.svg') && !m[1].toLowerCase().includes('logo')) {
                        r.cover_image_url = m[1]; break;
                    }
                }
            }
            if (!r.cover_image_url) {
                // Try <picture> source srcset
                for (const src of document.querySelectorAll('picture source')) {
                    const ss = src.getAttribute('srcset') || src.getAttribute('data-srcset') || '';
                    const u = ss.split(',')[0].trim().split(' ')[0];
                    if (u && u.startsWith('http') && !u.includes('logo') && !u.includes('.svg')) {
                        r.cover_image_url = u; break;
                    }
                }
            }
            if (!r.cover_image_url) {
                // Try <video> poster as fallback cover
                const vid = document.querySelector('video[poster]');
                const poster = vid?.getAttribute('poster');
                if (poster && poster.startsWith('http')) r.cover_image_url = poster;
            }
            if (!r.cover_image_url) {
                const imgSels = [
                    '[class*="hero"] img', '[class*="banner"] img', '[class*="slider"] img',
                    '[class*="cover"] img', 'section img', 'main img',
                ];
                for (const sel of imgSels) {
                    for (const el of document.querySelectorAll(sel)) {
                        const src = getSrc(el);
                        if (!src || badSrc(src)) continue;
                        const sl = src.toLowerCase();
                        if (sl.includes('logo') || sl.includes('icon') || sl.includes('.svg')) continue;
                        r.cover_image_url = src; break;
                    }
                    if (r.cover_image_url) break;
                }
            }

            // ── Tagline (hero subtitle) ────────────────────────────────────────
            const taglineSels = [
                '[class*="hero"] h1', '[class*="hero"] h2', '[class*="hero"] p',
                '[class*="banner"] h1', '[class*="banner"] h2',
                '[class*="tagline"]', '[class*="subtitle"]', '[class*="slogan"]',
                'section:first-of-type h1', 'section:first-of-type h2',
            ];
            for (const sel of taglineSels) {
                const el = document.querySelector(sel);
                const t = (el?.innerText || '').trim();
                if (t.length > 8 && t.length < 160) { r.tagline = t; break; }
            }

            // ── About text ────────────────────────────────────────────────────
            const aboutSels = [
                '[class*="about"] p',   '[id*="about"] p',
                '[class*="company"] p', '[class*="who-we"] p',
                '[class*="story"] p',   '[class*="overview"] p',
                '[class*="mission"] p', '[class*="vision"] p',
                '[class*="history"] p', '[class*="description"] p',
                'main p',               'section p',
            ];
            const parts = [];
            const seen = new Set();
            for (const sel of aboutSels) {
                for (const p of document.querySelectorAll(sel)) {
                    const t = (p.innerText || '').trim();
                    if (t.length > 80 && !seen.has(t)) { seen.add(t); parts.push(t); }
                }
                if (parts.length >= 6) break;
            }
            r.about = parts.slice(0, 6).join('\\n\\n');

            // ── Stats from full page text ──────────────────────────────────────
            const body = document.body.innerText;

            // Founded year
            const yrM = body.match(/(?:founded|established|since|est\\.?|incorporated)\\s*(?:in\\s*)?(1[89]\\d{2}|20[0-2]\\d)/i)
                      || body.match(/(1[89]\\d{2}|20[0-2]\\d)\\s*[-–]\\s*(?:present|today)/i);
            r.founded_year = yrM ? parseInt(yrM[1] || yrM[2] || yrM[0].match(/\\d{4}/)?.[0]) : null;

            // Units / homes delivered
            const unitsM = body.match(/(\\d[\\d,]+\\+?)\\s*(?:\\+\\s*)?(?:homes?|units?|residences?|properties|apartments?)\\s*(?:delivered|completed|handed|built)/i)
                         || body.match(/(?:delivered|completed|handed\\s*over)\\s+(\\d[\\d,]+\\+?)\\s*(?:homes?|units?)/i)
                         || body.match(/(\\d[\\d,]+\\+?)\\s*(?:homes?|units?)/i);
            r.total_units = unitsM ? (unitsM[1] || unitsM[2]) : null;

            // Employees / team
            const empM = body.match(/(\\d[\\d,]+\\+?)\\s*(?:employees?|team\\s*members?|staff|people|professionals?|workforce)/i);
            r.employees = empM ? empM[1] : null;

            // Years active / in UAE
            const yearsM = body.match(/(\\d+)\\+?\\s*years?\\s*(?:of\\s*)?(?:experience|in\\s*UAE|in\\s*Dubai|active|in\\s*real\\s*estate)/i);
            r.years_active = yearsM ? yearsM[1] : null;

            // Headquarters
            const hqM = body.match(/(?:headquarters?|head\\s*office|hq|offices?|based\\s*in|located\\s*in)[:\\s]+([A-Z][^\\n,\\.]{3,60}(?:Dubai|Abu Dhabi|UAE|Sharjah)[^\\n,\\.]{0,30})/i);
            r.headquarters = hqM ? hqM[1].trim().replace(/\\s+/g, ' ') : null;

            // Phone
            const phM = body.match(/(?:\\+971|00971|04\\b|02\\b|06\\b)\\s*[\\d\\s\\-\\.]{6,14}/);
            r.phone = phM ? phM[0].replace(/\\s+/g, ' ').trim() : null;

            // Email
            const emlM = body.match(/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/);
            r.email = emlM ? emlM[0] : null;

            // About page link (for secondary scrape)
            const aboutLinks = Array.from(document.querySelectorAll('a'))
                .map(a => ({ href: a.href || '', text: (a.innerText || '').trim().toLowerCase() }))
                .filter(a => a.href.startsWith('http') && !a.href.includes('#') &&
                    (a.text.includes('about') || a.href.includes('/about')))
                .map(a => a.href);
            r.about_url = aboutLinks[0] || null;

            return r;
        }""")

        logger.info(
            f"Developer homepage scraped '{dev_name}' — "
            f"logo={'yes' if scraped.get('logo_url') else 'no'}, "
            f"cover={'yes' if scraped.get('cover_image_url') else 'no'}, "
            f"about={len(scraped.get('about',''))} chars, "
            f"year={scraped.get('founded_year')}"
        )

        # ── Secondary scrape: About page for richer text ──────────────────────
        about_url = scraped.get("about_url")
        if about_url and about_url != root_url and len(scraped.get("about", "")) < 400:
            try:
                page2 = await _new_stealth_page(browser)
                await page2.goto(about_url, wait_until="domcontentloaded", timeout=25_000)
                await asyncio.sleep(3)
                extra = await page2.evaluate("""() => {
                    const sels = ['[class*="about"] p','[id*="about"] p','main p','section p'];
                    const parts = []; const seen = new Set();
                    for (const sel of sels) {
                        for (const p of document.querySelectorAll(sel)) {
                            const t = (p.innerText||'').trim();
                            if (t.length > 80 && !seen.has(t)) { seen.add(t); parts.push(t); }
                        }
                        if (parts.length >= 6) break;
                    }
                    return parts.slice(0,6).join('\\n\\n');
                }""")
                await page2.close()
                if extra and len(extra) > len(scraped.get("about", "")):
                    scraped["about"] = extra
                    logger.info(f"About page gave richer text for '{dev_name}': {len(extra)} chars")
            except Exception as e:
                logger.warning(f"About page scrape failed for '{dev_name}': {e}")

    except Exception as e:
        logger.error(f"scrape_developer_website failed for '{dev_name}' ({url}): {e}")
    finally:
        await page.close()

    # ── Claude enrichment: generate FAQs, strengths, key projects, intro ─────
    scraped.update(await _claude_generate_developer_profile(dev_name, scraped, url))
    return scraped


async def _claude_generate_developer_profile(dev_name: str, scraped: dict, website_url: str) -> dict:
    """
    Use Claude Sonnet to generate structured developer profile data:
    intro_short, tagline (if missing), FAQs, investment strengths,
    key projects, areas, property types, price range.
    """
    import anthropic as _anthropic
    import json as _json
    from ..config import ANTHROPIC_KEY

    about_text = scraped.get("about", "") or ""
    founded    = scraped.get("founded_year") or "unknown"
    hq         = scraped.get("headquarters") or "UAE"
    units      = scraped.get("total_units") or "not stated"
    employees  = scraped.get("employees") or "not stated"
    tagline    = scraped.get("tagline") or ""

    prompt = f"""You are enriching a developer profile for a UAE real estate portal called Elysian.

Developer: {dev_name}
Website: {website_url}
Founded: {founded}
Headquarters: {hq}
Total units delivered: {units}
Team size: {employees}
Current tagline from site: {tagline}

About text scraped from their website:
\"\"\"
{about_text[:2000] if about_text else "Not available — use your knowledge of this developer."}
\"\"\"

Generate a JSON object with EXACTLY these fields. Use the scraped text first; fill gaps from your knowledge of this UAE real estate developer.

{{
  "intro_short": "2-3 sentence professional introduction for the portal listing",
  "tagline": "Short memorable phrase under 12 words (use existing if good, else write new)",
  "strengths": ["5 compelling investment reason bullet points (15-30 words each)"],
  "faqs": [
    {{"q": "question ending with ?", "a": "concise factual answer (2-3 sentences)"}},
    ... 5 total FAQs covering: property types, locations, investment value, buying process, notable projects
  ],
  "key_projects": [
    {{"name": "Project Name", "type": "Residential|Commercial|Mixed-Use|Hospitality", "status": "Completed|Ongoing|Upcoming", "location": "Area, Emirate"}},
    ... up to 6 notable projects
  ],
  "areas": ["area names where this developer builds — max 6"],
  "property_types": ["types they build e.g. Apartments, Villas, Townhouses, Commercial"],
  "price_range": "AED X – AED Y (realistic range for their portfolio)"
}}

Return ONLY valid JSON. No markdown, no explanation."""

    try:
        client = _anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        resp = await asyncio.to_thread(
            lambda: client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        raw = resp.content[0].text.strip()
        # Strip any accidental markdown fences
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw.strip())
        generated = _json.loads(raw)
        logger.info(f"Claude generated developer profile for '{dev_name}': "
                    f"faqs={len(generated.get('faqs',[]))}, "
                    f"projects={len(generated.get('key_projects',[]))}")
        return generated
    except Exception as e:
        logger.warning(f"_claude_generate_developer_profile failed for '{dev_name}': {e}")
        return {}


# ── Area content rewriter ──────────────────────────────────────────────────────

_AREA_REWRITE_PROMPT = """You are a professional copywriter for Elysian, a Dubai property portal.
Rewrite the scraped area guide content below for {area_name} into clean, human-written copy.

Rules:
- REMOVE all mentions of Bayut, bayut.com, PropertyFinder, Dubizzle, Zoopla, or any portal/brand name
- REMOVE generic SEO filler ("nestled", "boasting", "seamlessly blends", "vibrant community")
- KEEP all specific facts: prices, distances, school names, hospital names, transport lines, years
- Write in second person or neutral third person — never "I" or "we"
- Max 3 short paragraphs for `about` (200 words total)
- `highlight_why_buy`: 1 punchy sentence, max 15 words
- `highlight_who_lives`: 1 sentence describing the resident profile, max 15 words
- `highlight_vibe`: 3-5 bullet lines separated by \\n (each under 12 words), capturing what the area feels like
- `best_streets`: comma-separated list of notable streets/sub-communities (omit if unknown)
- For schools/hospitals/malls — if they are long paragraph sentences, extract ONLY the actual institution names as a JSON array of plain strings. If no specific names are found, return []

Return ONLY valid JSON with exactly these keys:
{{
  "about": "rewritten 3-paragraph description",
  "highlight_why_buy": "...",
  "highlight_who_lives": "...",
  "highlight_vibe": "line1\\nline2\\nline3",
  "best_streets": "Street A, District B",
  "schools": ["School Name 1", "School Name 2"],
  "hospitals": ["Hospital Name 1"],
  "malls": ["Mall Name 1"],
  "nearby_areas": ["Area Name 1", "Area Name 2"]
}}

RAW CONTENT TO REWRITE:
About/description: {about}
Nutshell bullets: {nutshell}
Schools text: {schools}
Hospitals text: {hospitals}
Malls text: {malls}
Nearby areas text: {nearby_areas}
Lifestyle text: {lifestyle}
Shopping text: {shopping}
Transport text: {transport}"""


async def _claude_rewrite_area_content(area_name: str, bayut: dict) -> dict:
    """
    Rewrites raw Bayut-scraped area content with Claude.
    Returns a dict of cleaned fields ready to merge into the Supabase update.
    Falls back gracefully — if Claude fails, returns empty dict (caller uses raw data).
    """
    import anthropic as _anthropic
    import json as _json
    from ..config import ANTHROPIC_KEY

    def _fmt(val):
        if isinstance(val, list):
            return "; ".join(str(v) for v in val[:10]) if val else "N/A"
        return str(val or "N/A")[:800]

    prompt = _AREA_REWRITE_PROMPT.format(
        area_name=area_name,
        about=_fmt(bayut.get("description") or bayut.get("community_overview")),
        nutshell=_fmt(bayut.get("nutshell")),
        schools=_fmt(bayut.get("schools")),
        hospitals=_fmt(bayut.get("hospitals")),
        malls=_fmt(bayut.get("malls")),
        nearby_areas=_fmt(bayut.get("nearby_areas")),
        lifestyle=_fmt(bayut.get("lifestyle")),
        shopping=_fmt(bayut.get("shopping")),
        transport=_fmt(bayut.get("transport")),
    )

    for attempt in range(2):
        try:
            client = _anthropic.Anthropic(api_key=ANTHROPIC_KEY)
            resp = await asyncio.to_thread(
                lambda: client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=2000,
                    messages=[{"role": "user", "content": prompt}],
                )
            )
            raw = resp.content[0].text.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw.strip())
            result = _json.loads(raw)
            logger.info(f"Claude rewrote area content for '{area_name}'")
            return result
        except Exception as e:
            logger.warning(f"_claude_rewrite_area_content attempt {attempt + 1} failed for '{area_name}': {e}")

    return {}


# ── Enrichment runners ─────────────────────────────────────────────────────────

async def enrich_areas() -> list[dict]:
    """Geocode + Bayut-enrich all unenriched areas. Returns list of {name, slug}."""
    try:
        res = (
            db().table("areas")
            .select("id, name, slug, emirate, description_short, image_url")
            .eq("enriched", False)
            .execute()
        )
        areas = res.data or []
    except Exception as e:
        logger.error(f"fetch unenriched areas failed: {e}")
        return []

    if not areas:
        logger.info("No unenriched areas")
        return []

    logger.info(f"Enriching {len(areas)} areas...")
    enriched_records = []

    for area in areas:
        try:
            area_id   = area["id"]
            area_name = area["name"]
            area_slug = area.get("slug", "")
            emirate   = area.get("emirate", "Dubai")
            updates   = {}

            # 1. Accurate geocoding via Nominatim
            lat, lng = await geocode(area_name, emirate)
            if lat:
                updates["latitude"]  = lat
                updates["longitude"] = lng

            # 2. Find Bayut area guide and scrape it
            # Small delay before each DDG search to avoid rate-limiting across areas
            await asyncio.sleep(random.uniform(3, 6))
            guide_url = await find_bayut_area_guide_url(area_name, emirate=emirate)
            if guide_url:
                await asyncio.sleep(random.uniform(2, 4))
                bayut = await scrape_bayut_area_guide(guide_url, area_name)

                # Hero image (no rewrite needed)
                if bayut.get("hero_image"):
                    updates["hero_image"]      = bayut["hero_image"]
                    updates["image_url"]       = bayut["hero_image"]
                    updates["cover_image_url"] = bayut["hero_image"]

                # FAQs — keep raw (already scraped, no Bayut branding in Q&A)
                if bayut.get("faqs"):
                    updates["faqs"] = bayut["faqs"]

                # location text (distances to landmarks)
                if bayut.get("location"):
                    updates["geo_summary"] = bayut["location"]

                # transport / commute (factual data, kept as-is)
                if bayut.get("transport"):
                    updates["public_transport"] = bayut["transport"]

                # ── Claude rewrite: humanize copy + extract clean names ──────────
                rewritten = await _claude_rewrite_area_content(area_name, bayut)

                if rewritten.get("about"):
                    updates["about"] = rewritten["about"]
                    if not area.get("description_short"):
                        updates["description_short"] = rewritten["about"][:500]
                elif bayut.get("description"):
                    updates["about"] = bayut["description"]

                if rewritten.get("highlight_why_buy"):
                    updates["highlight_why_buy"] = rewritten["highlight_why_buy"]
                if rewritten.get("highlight_who_lives"):
                    updates["highlight_who_lives"] = rewritten["highlight_who_lives"]
                if rewritten.get("highlight_vibe"):
                    updates["highlight_vibe"] = rewritten["highlight_vibe"]
                elif bayut.get("nutshell"):
                    updates["highlight_vibe"] = "\n".join(bayut["nutshell"])
                if rewritten.get("best_streets"):
                    updates["highlight_best_streets"] = rewritten["best_streets"]

                # Schools — prefer Claude-extracted names (clean strings), else raw
                schools = rewritten.get("schools") or bayut.get("schools")
                if schools:
                    updates["nearby_schools"] = schools
                    updates["schools"]         = schools

                # Hospitals
                hospitals = rewritten.get("hospitals") or bayut.get("hospitals")
                if hospitals:
                    updates["nearby_hospitals"] = hospitals
                    updates["hospitals"]         = hospitals

                # Malls
                malls = rewritten.get("malls") or bayut.get("malls")
                if malls:
                    updates["malls"]          = malls
                    updates["nearby_shopping"] = malls

                # Nearby areas — Claude returns short name strings, not paragraphs
                nearby = rewritten.get("nearby_areas") or bayut.get("nearby_areas")
                if nearby:
                    updates["nearby_areas"] = nearby

                # Lifestyle / shopping text (kept raw — these are factual descriptions)
                if bayut.get("lifestyle"):
                    updates["lifestyle_dining_text"] = bayut["lifestyle"]
                if bayut.get("shopping"):
                    updates["lifestyle_shopping_text"] = bayut["shopping"]

            updates["enriched"] = True
            db().table("areas").update(updates).eq("id", area_id).execute()
            logger.info(f"Area '{area_name}' enriched — lat={lat}, bayut={'yes' if guide_url else 'no'}")
            enriched_records.append({"name": area_name, "slug": area_slug})

        except Exception as e:
            logger.error(f"enrich_areas error for '{area.get('name')}': {e}")
            try:
                db().table("areas").update({"enriched": True}).eq("id", area["id"]).execute()
            except Exception:
                pass

        await asyncio.sleep(random.uniform(5, 9))

    return enriched_records


async def enrich_developers() -> list[dict]:
    """Search official website + scrape to enrich unenriched developers. Returns list of {name, slug}."""
    try:
        res = (
            db().table("developers")
            .select("id, name, slug, logo_url, intro_short, website_url")
            .eq("enriched", False)
            .execute()
        )
        developers = res.data or []
    except Exception as e:
        logger.error(f"fetch unenriched developers failed: {e}")
        return []

    if not developers:
        logger.info("No unenriched developers")
        return []

    logger.info(f"Enriching {len(developers)} developers...")
    enriched_records = []

    for dev in developers:
        try:
            dev_id   = dev["id"]
            dev_name = dev["name"]
            dev_slug = dev.get("slug", "")
            updates  = {}

            # Find official website: use existing URL or search DDG → Bing
            website_url = dev.get("website_url") or await find_developer_website(dev_name)
            if website_url:
                domain = re.sub(r'^https?://(www\.)?', '', website_url).split('/')[0]
                updates["website_url"] = website_url
                updates["website"]     = domain

                await asyncio.sleep(random.uniform(2, 4))
                s = await scrape_developer_website(website_url, dev_name)

                # Logo: only set if not already a Cloudinary URL from opr.ae
                existing_logo = dev.get("logo_url", "") or ""
                if s.get("logo_url") and "cloudinary" not in existing_logo:
                    updates["logo_url"]       = s["logo_url"]
                    updates["logo_color_url"] = s["logo_url"]

                # Cover / hero image
                if s.get("cover_image_url"):
                    updates["cover_image_url"] = s["cover_image_url"]

                # Tagline
                if s.get("tagline"):
                    updates["tagline"] = s["tagline"]

                # About text (intro_long) + intro_short
                if s.get("about"):
                    updates["about"]      = s["about"]
                    updates["intro_long"] = s["about"]
                if s.get("intro_short"):
                    updates["intro_short"] = s["intro_short"]

                # Founding year
                if s.get("founded_year"):
                    updates["founded_year"]     = s["founded_year"]
                    updates["established_year"] = s["founded_year"]

                # Headquarters
                if s.get("headquarters"):
                    updates["headquarters"]  = s["headquarters"]
                    updates["office_address"] = s["headquarters"]

                # Stats
                if s.get("total_units"):
                    updates["total_units"] = s["total_units"]
                if s.get("employees"):
                    updates["employees"] = s["employees"]
                if s.get("years_active"):
                    updates["years_in_uae"] = s["years_active"]

                # Contact
                if s.get("phone"):
                    updates["phone"] = s["phone"]
                if s.get("email"):
                    updates["email"] = s["email"]

                # Claude-generated structured data
                if s.get("faqs"):
                    updates["faqs"]     = s["faqs"]
                    updates["aeo_faq"]  = s["faqs"]
                if s.get("strengths"):
                    updates["strengths"] = s["strengths"]
                if s.get("key_projects"):
                    updates["key_projects"]    = s["key_projects"]
                    updates["notable_projects"] = s["key_projects"]
                if s.get("areas"):
                    updates["areas"] = s["areas"]
                if s.get("property_types"):
                    updates["property_types"] = s["property_types"]
                if s.get("price_range"):
                    updates["price_range"] = s["price_range"]

            updates["enriched"] = True
            db().table("developers").update(updates).eq("id", dev_id).execute()
            logger.info(f"Developer '{dev_name}' enriched — site={'yes' if website_url else 'no'}")
            enriched_records.append({"name": dev_name, "slug": dev_slug})

        except Exception as e:
            logger.error(f"enrich_developers error for '{dev.get('name')}': {e}")
            try:
                db().table("developers").update({"enriched": True}).eq("id", dev["id"]).execute()
            except Exception:
                pass

        await asyncio.sleep(random.uniform(6, 10))

    return enriched_records


async def run_enrichment() -> str:
    """Full enrichment pass: areas + developers. Returns summary string with site URLs."""
    logger.info("Enrichment pass starting...")
    area_records = await enrich_areas()
    dev_records  = await enrich_developers()

    parts = []
    if area_records:
        parts.append(f"Areas enriched ({len(area_records)}):")
        for r in area_records:
            parts.append(f"  • {r['name']}")
            parts.append(f"    dubai-portal.vercel.app/area-guides/{r['slug']}")
    if dev_records:
        parts.append(f"Developers enriched ({len(dev_records)}):")
        for r in dev_records:
            parts.append(f"  • {r['name']}")
            parts.append(f"    dubai-portal.vercel.app/developers/{r['slug']}")
    if not parts:
        parts.append("No areas or developers pending enrichment.")

    return "\n".join(parts)
