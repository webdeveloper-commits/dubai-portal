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

async def find_bayut_area_guide_url(area_name: str, emirate: str = "") -> str | None:
    """
    Find the Bayut area guide URL for an area using direct emirate listing pages.

    Strategy:
      1. Determine emirate (from DB field → Claude fallback)
      2. For Dubai: slug-match against 4 hardcoded ready URLs first, then
         search paginated off-plan listing (/off-plan/dubai/page/N/)
      3. For all other emirates: search ready then off-plan listing pages
      4. On each listing page: extract all area links, score by text + slug
         word-overlap, title-validate the best match before returning
    """
    # Normalise emirate
    emirate_key = emirate.lower().strip() if emirate else ""
    if not emirate_key or emirate_key not in _EMIRATE_LISTING_URLS:
        emirate_key = await _detect_emirate(area_name)
    logger.info(f"Bayut search for '{area_name}' in emirate '{emirate_key}'")

    target_lower  = area_name.lower().strip()
    target_sig    = _sig_words(area_name)

    def _score_link(text: str, slug: str) -> int:
        """Return match score 0–100 between area_name and a Bayut link."""
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
        if best >= 0.6 and bwd >= 0.4:
            return 70
        if best >= 0.5:
            return 50
        return 0

    browser = await get_browser()
    page = await _new_stealth_page(browser)

    try:
        # ── Dubai Ready: check 4 known hardcoded URLs by slug ─────────────
        if emirate_key == "dubai":
            for url in _DUBAI_READY_URLS:
                slug = url.rstrip("/").split("/")[-1]
                if _score_link("", slug) >= 50:
                    logger.info(f"Matched Dubai ready URL by slug: {url}")
                    return url

        # ── Paginated listing pages ────────────────────────────────────────
        base_urls = _EMIRATE_LISTING_URLS.get(emirate_key, _EMIRATE_LISTING_URLS["dubai"])

        for base_url in base_urls:
            for page_num in range(1, 10):  # up to 9 pages per listing
                listing_url = base_url if page_num == 1 else f"{base_url}page/{page_num}/"
                logger.info(f"  Checking: {listing_url}")

                try:
                    await page.goto(listing_url, wait_until="load", timeout=45_000)
                except Exception:
                    pass
                await asyncio.sleep(3)

                # If Bayut returned the generic index page, this listing URL doesn't exist
                pg_title = await page.title()
                if _bayut_is_index_page(pg_title):
                    logger.info(f"  → Hit index page, no more pages for {base_url}")
                    break

                # Extract all area-guide links from this listing page
                links: list = await page.evaluate("""(args) => {
                    const stop = new Set(args.stop);
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
                        // Skip emirate slugs, numeric pagination, listing segments
                        if (emir.has(slug) || !slug || /^\\d+$/.test(slug)) return;
                        if (listingSegs.has(slug)) return;
                        const text = (a.innerText||a.textContent||'').trim();
                        out.push({ href, text, slug });
                    });
                    return out;
                }""", {
                    "stop": list(_STOP_WORDS),
                    "emir": list(_EMIRATE_SLUGS),
                    "listingSegs": list(_LISTING_SEGMENTS),
                })

                logger.info(f"  Found {len(links)} area links on page {page_num}")
                if not links:
                    break  # no area cards on this page → done paginating

                # Log all links for debugging
                for lnk in links:
                    logger.info(f"    slug='{lnk['slug']}' text='{lnk['text'][:60]}'")

                # Score and pick best
                best_score = 0
                best_url: str | None = None
                for lnk in links:
                    s = _score_link(lnk["text"], lnk["slug"])
                    if s > best_score:
                        best_score = s
                        best_url = lnk["href"]

                if best_url and best_score >= 50:
                    logger.info(f"  Match score={best_score}: {best_url}")
                    # Validate: navigate and check we landed on an actual area guide
                    try:
                        await page.goto(best_url, wait_until="load", timeout=40_000)
                    except Exception:
                        pass
                    await asyncio.sleep(3)
                    final_url = page.url.split("?")[0].rstrip("/")
                    confirmed_title = await page.title()
                    # Reject if redirected away from /area-guides/ (ghost URL → property listings)
                    if "/area-guides/" not in final_url:
                        logger.warning(f"  Redirected to non-guide page: {final_url} — skipping")
                        continue
                    if _bayut_is_index_page(confirmed_title):
                        logger.warning(f"  URL leads to index/captcha — skipping")
                        continue
                    logger.info(f"  Confirmed area guide: {confirmed_title} → {final_url}")
                    return final_url

        logger.warning(f"No Bayut area guide found for '{area_name}' [{emirate_key}]")
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
            result["hero_image"] = img
        elif isinstance(img, dict):
            result["hero_image"] = img.get("url") or img.get("src") or ""

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

    Strategy:
      1. Load with 'load' event + 5 s React render time
      2. Scroll full page height to trigger lazy-loaded images
      3. Try window.__NEXT_DATA__ for structured JSON (cleanest path)
      4. DOM fallback: exclude nav/header/footer; skip navigation link text;
         check CSS background-image for Bayut's hero
    """
    browser = await get_browser()
    page = await _new_stealth_page(browser)
    result = {}

    try:
        logger.info(f"Scraping Bayut area guide: {url}")
        try:
            await page.goto(url, wait_until="load", timeout=60_000)
        except Exception:
            pass  # timeout OK — React may still finish rendering
        await asyncio.sleep(5)  # let React hydrate

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

        # ── Step 2: DOM extraction fills gaps ──────────────────────────────
        dom_result = await page.evaluate("""() => {
            const r = {
                hero_image: null, tagline: '',
                description: '', community_overview: '',
                schools: [], hospitals: [], attractions: [], lifestyle: ''
            };

            // Exclude navigation, sidebar, footer, enquiry form
            function isInExcludedArea(el) {
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

            function getImgSrc(el) {
                if (!el) return null;
                return el.getAttribute('src') || el.getAttribute('data-src') ||
                       el.getAttribute('data-lazy-src') || el.getAttribute('data-original') || null;
            }

            // Hero: CSS background-image first (Bayut's hero is usually a bg-image div)
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
                    if (m && m[1].startsWith('http')) { r.hero_image = m[1]; break; }
                }
            }
            // picture source srcset
            if (!r.hero_image) {
                for (const src of document.querySelectorAll('picture source')) {
                    const ss = src.getAttribute('srcset') || src.getAttribute('data-srcset') || '';
                    const firstUrl = ss.split(',')[0].trim().split(' ')[0];
                    if (firstUrl.startsWith('http') && !firstUrl.includes('logo') && !firstUrl.includes('icon')) {
                        r.hero_image = firstUrl; break;
                    }
                }
            }
            // img src/data-src not in excluded area
            if (!r.hero_image) {
                const imgSels = [
                    '[class*="_hero"] img', '[class*="_banner"] img',
                    '[class*="_cover"] img', 'picture img', 'main img'
                ];
                for (const sel of imgSels) {
                    const el = document.querySelector(sel);
                    if (!el || isInExcludedArea(el)) continue;
                    const src = getImgSrc(el);
                    if (src && src.startsWith('http') && !src.includes('placeholder') &&
                        !src.includes('logo') && !src.includes('icon') && !src.includes('spinner')) {
                        r.hero_image = src; break;
                    }
                }
            }
            // Very first content img on page
            if (!r.hero_image) {
                for (const img of document.querySelectorAll('img')) {
                    if (isInExcludedArea(img)) continue;
                    const src = getImgSrc(img);
                    if (src && src.startsWith('http') && src.length > 40 &&
                        !src.includes('placeholder') && !src.includes('logo') &&
                        !src.includes('icon') && !src.includes('avatar') && !src.includes('spinner')) {
                        r.hero_image = src; break;
                    }
                }
            }

            // Skip patterns: listing prices, nav links, form labels
            const SKIP = [
                /aed\\s*[\\d,]+/i, /\\d+\\s*bed/i, /\\d+\\s*bath/i,
                /per year/i, /per month/i, /call agent/i,
                /whatsapp/i, /view details/i, /listed by/i,
                /top broker/i, /top agent/i,
                /apartments for sale/i, /villas for sale/i,
                /for rent in/i, /floor plans/i, /truestimate/i,
                /new projects/i, /send enquiry/i, /free consultation/i,
                /no obligation/i, /reply within/i, /your name/i,
                /email address/i, /phone.*whatsapp/i,
                /^buy$/i, /^rent$/i, /^agents$/i,
            ];
            function isSkip(t) { return SKIP.some(p => p.test(t)); }

            // Walk content scoped to <main> or <article>
            const scope = document.querySelector('main') || document.querySelector('article') || document.body;
            const els = Array.from(scope.querySelectorAll('h1,h2,h3,h4,p,li'));
            const sections = {};
            let current = '__intro__';
            sections[current] = [];

            for (const el of els) {
                if (isInExcludedArea(el)) continue;
                const text = el.innerText.trim();
                if (!text || text.length < 10) continue;
                if (isSkip(text)) continue;
                // Skip elements that are mostly anchor link text (navigation blobs)
                const anchors = el.querySelectorAll('a');
                if (anchors.length > 2) {
                    const aLen = Array.from(anchors).reduce((s, a) => s + a.innerText.length, 0);
                    if (aLen > text.length * 0.5) continue;
                }
                if (['H1','H2','H3','H4'].includes(el.tagName)) {
                    current = text;
                    if (!sections[current]) sections[current] = [];
                } else {
                    sections[current].push(text);
                }
            }

            for (const [heading, texts] of Object.entries(sections)) {
                const h = heading.toLowerCase();
                const content = texts.join('\\n').trim();
                if (!content) continue;
                if (h === '__intro__' || h.includes('about') || h.includes('nutshell') ||
                    h.includes('highlights') || h.includes('overview') || h.includes('community')) {
                    if (!r.description) r.description = content.slice(0, 800);
                } else if (h.includes('school') || h.includes('education') || h.includes('university')) {
                    r.schools = texts.filter(t => t.length > 5 && !isSkip(t)).slice(0, 10);
                } else if (h.includes('hospital') || h.includes('healthcare') || h.includes('clinic')) {
                    r.hospitals = texts.filter(t => t.length > 5 && !isSkip(t)).slice(0, 10);
                } else if (h.includes('shopping') || h.includes('dining') || h.includes('nightlife') ||
                           h.includes('leisure') || h.includes('landmark') || h.includes('entertainment') ||
                           h.includes('lifestyle') || h.includes('recreation') || h.includes('fitness')) {
                    r.attractions = r.attractions.concat(texts.filter(t => t.length > 5).slice(0, 5));
                    r.lifestyle += content.slice(0, 300) + '\\n';
                }
            }

            // Tagline: first short <p> right after the h1
            const h1 = scope.querySelector('h1');
            if (h1) {
                let sib = h1.nextElementSibling;
                for (let i = 0; i < 4 && sib; i++, sib = sib.nextElementSibling) {
                    const t = sib.innerText.trim();
                    if (t.length > 10 && t.length < 200 && !isSkip(t)) { r.tagline = t; break; }
                }
            }

            r.attractions = [...new Set(r.attractions)].slice(0, 10);
            r.lifestyle = r.lifestyle.trim().slice(0, 600);
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
            f"schools={len(result.get('schools',[]))}, "
            f"hospitals={len(result.get('hospitals',[]))}"
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

    # ── Phase 2: find URL via emirate listing pages ──────────────────────
    lines.append("\nPhase 2: Finding Bayut URL via emirate listing pages...")
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
            return Array.from(scope.querySelectorAll('p'))
                .map(p => p.innerText.trim())
                .filter(t => t.length > 30)
                .slice(0, 5);
        }""")
        lines.append(f"First <p> texts in <main>: {len(sample)} found")
        for i, t in enumerate(sample, 1):
            lines.append(f"  {i}. {t[:120]}")

    except Exception as e:
        lines.append(f"Scrape error: {e}")
    finally:
        await page.close()

    return "\n".join(lines)


# ── Developer website search ───────────────────────────────────────────────────

async def find_developer_website(dev_name: str) -> str | None:
    """
    DuckDuckGo search for the developer's official UAE website.
    Searches: '[developer name] UAE real estate developer official website'
    Returns the first non-portal result URL, or None.
    """
    query = f'"{dev_name}" UAE real estate developer official website'
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
        soup = BeautifulSoup(r.text, "html.parser")

        for result in soup.select(".result__a"):
            href = result.get("href", "")
            # DuckDuckGo wraps result URLs in /l/?uddg= redirects
            m = re.search(r'uddg=(https?[^&]+)', href)
            if m:
                import urllib.parse
                href = urllib.parse.unquote(m.group(1))

            if not href.startswith("http"):
                continue

            domain = re.sub(r'^https?://(www\.)?', '', href).split('/')[0].lower()
            if not any(skip in domain for skip in _PORTAL_DOMAINS):
                logger.info(f"Developer website found for '{dev_name}': {href}")
                return href

    except Exception as e:
        logger.warning(f"find_developer_website failed for '{dev_name}': {e}")

    return None


async def scrape_developer_website(url: str, dev_name: str) -> dict:
    """Scrape developer's official website for cover image, about text, contact, founding year."""
    browser = await get_browser()
    page = await _new_stealth_page(browser)
    result = {}

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        await asyncio.sleep(3)
        await page.evaluate("window.scrollTo(0, 600)")
        await asyncio.sleep(1)
        await page.evaluate("window.scrollTo(0, 0)")

        extracted = await page.evaluate("""() => {
            const r = {};

            // Cover / hero image (not logo — a large banner image)
            function getImgSrc(el) {
                if (!el) return null;
                return el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || null;
            }
            const coverSels = [
                '[class*="hero"] img', '[class*="banner"] img',
                '[class*="cover"] img', '[class*="header"] img',
                'section img', 'main img'
            ];
            for (const sel of coverSels) {
                const el = document.querySelector(sel);
                const src = getImgSrc(el);
                if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon') && !src.includes('placeholder')) {
                    r.cover_image_url = src;
                    break;
                }
            }

            // About / company description — longer version
            const aboutSels = [
                '[class*="about"] p', '[id*="about"] p',
                '[class*="company"] p', '[class*="who-we"] p',
                '[class*="story"] p', '[class*="overview"] p',
                'main p', 'section p'
            ];
            const parts = [];
            const seen = new Set();
            for (const sel of aboutSels) {
                document.querySelectorAll(sel).forEach(p => {
                    const t = p.innerText.trim();
                    if (t.length > 80 && !seen.has(t)) { seen.add(t); parts.push(t); }
                });
                if (parts.length >= 4) break;
            }
            r.about     = parts.slice(0, 4).join('\\n\\n').slice(0, 1000);
            r.intro_long = r.about;

            // Founded / established year
            const bodyText = document.body.innerText;
            const yearM = bodyText.match(/(?:founded|established|since|est\\.?)\\s*(in\\s*)?(1[89]\\d{2}|20[0-2]\\d)/i);
            r.founded_year = yearM ? parseInt(yearM[2]) : null;

            // Phone number
            const phoneM = bodyText.match(/(?:\\+971|00971|\\(971\\)|0)\\s*[\\d\\s\\-]{7,14}/);
            r.phone = phoneM ? phoneM[0].trim() : null;

            // Email
            const emailM = bodyText.match(/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/);
            r.email = emailM ? emailM[0] : null;

            return r;
        }""")

        result = extracted
        logger.info(
            f"Developer site scraped '{dev_name}' — "
            f"cover={'yes' if result.get('cover_image_url') else 'no'}, "
            f"about={len(result.get('about',''))} chars, "
            f"year={result.get('founded_year')}"
        )

    except Exception as e:
        logger.error(f"scrape_developer_website failed for '{dev_name}' ({url}): {e}")
    finally:
        await page.close()

    return result


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
            guide_url = await find_bayut_area_guide_url(area_name, emirate=emirate)
            if guide_url:
                await asyncio.sleep(random.uniform(2, 4))
                bayut = await scrape_bayut_area_guide(guide_url, area_name)

                if bayut.get("hero_image"):
                    updates["hero_image"]      = bayut["hero_image"]
                    updates["image_url"]       = bayut["hero_image"]
                    updates["cover_image_url"] = bayut["hero_image"]
                if bayut.get("description"):
                    updates["about"] = bayut["description"]
                    if not area.get("description_short"):
                        updates["description_short"] = bayut["description"][:500]
                if bayut.get("community_overview"):
                    updates["description_long"] = bayut["community_overview"]
                if bayut.get("schools"):
                    updates["nearby_schools"] = bayut["schools"]
                    updates["schools"]         = bayut["schools"]
                if bayut.get("hospitals"):
                    updates["nearby_hospitals"] = bayut["hospitals"]
                    updates["hospitals"]         = bayut["hospitals"]
                if bayut.get("attractions"):
                    updates["nearby_attractions"] = bayut["attractions"]
                if bayut.get("lifestyle"):
                    updates["lifestyle_dining_text"] = bayut["lifestyle"][:400]

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

            # Search DuckDuckGo for official website (only if not already known)
            website_url = dev.get("website_url") or await find_developer_website(dev_name)
            if website_url:
                updates["website_url"] = website_url
                # Store domain-only in website column too
                import re as _re
                domain = _re.sub(r'^https?://(www\.)?', '', website_url).split('/')[0]
                updates["website"] = domain

                await asyncio.sleep(random.uniform(2, 4))
                site_data = await scrape_developer_website(website_url, dev_name)

                # Never overwrite logo_url if already set from opr.ae scrape
                if site_data.get("cover_image_url"):
                    updates["cover_image_url"] = site_data["cover_image_url"]
                if site_data.get("about") and not dev.get("intro_short"):
                    updates["about"]      = site_data["about"]
                    updates["intro_long"] = site_data["intro_long"]
                elif site_data.get("about"):
                    updates["about"]      = site_data["about"]
                    updates["intro_long"] = site_data["intro_long"]
                if site_data.get("founded_year"):
                    updates["founded_year"]      = site_data["founded_year"]
                    updates["established_year"]  = site_data["founded_year"]
                if site_data.get("phone"):
                    updates["phone"] = site_data["phone"]
                if site_data.get("email"):
                    updates["email"] = site_data["email"]

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
