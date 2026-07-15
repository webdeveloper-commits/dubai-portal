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
    return _BAYUT_INDEX_TITLE in t or not t.strip()


def _sig_words(name: str) -> set:
    return {w for w in re.split(r"[\s\-]+", name.lower()) if len(w) > 2 and w not in _STOP_WORDS}


# ── Bayut area guide — find URL ────────────────────────────────────────────────

def _search_next_data_for_area(nd: dict, area_name: str) -> str | None:
    """
    Recursively search __NEXT_DATA__ JSON for an entry whose name matches area_name.
    Returns a full Bayut URL if found, else None.
    """
    target_sig = _sig_words(area_name)
    if not target_sig:
        return None

    def _search(obj, depth=0) -> str | None:
        if depth > 12:
            return None
        if isinstance(obj, dict):
            name = str(
                obj.get("name") or obj.get("title") or obj.get("communityName") or
                obj.get("displayName") or obj.get("areaName") or ""
            )
            if name:
                name_sig = _sig_words(name)
                if name_sig:
                    shared = len(target_sig & name_sig)
                    ratio  = shared / max(len(target_sig), len(name_sig))
                    if ratio >= 0.5:
                        slug = (
                            obj.get("slug") or obj.get("communitySlug") or
                            obj.get("url") or obj.get("href") or ""
                        )
                        if slug:
                            if slug.startswith("http"):
                                return slug
                            slug = slug.strip("/")
                            if "area-guides" not in slug:
                                slug = f"area-guides/{slug}"
                            return f"https://www.bayut.com/{slug}/"
            for val in obj.values():
                r = _search(val, depth + 1)
                if r:
                    return r
        elif isinstance(obj, list):
            for item in obj:
                r = _search(item, depth + 1)
                if r:
                    return r
        return None

    try:
        return _search(nd)
    except Exception as e:
        logger.warning(f"_search_next_data_for_area failed: {e}")
        return None


async def find_bayut_area_guide_url(area_name: str) -> str | None:
    """
    Find the actual Bayut area guide URL by scraping the index page.

    URL slugs cannot be guessed — Bayut uses their own naming, e.g.:
      'The Acres Dubailand' → /area-guides/the-acres-by-meraas/

    Strategy:
      1. Load bayut.com/area-guides/ with networkidle, scroll to trigger lazy-load
      2. Extract window.__NEXT_DATA__ from the index page — Bayut stores all areas
         as JSON inside the Next.js data blob. Parse and match there first.
      3. Fall back: click all 'View All' buttons via proper Playwright clicks
         (not raw JS el.click() — React ignores those), scroll between clicks,
         then match by link text/slug using word-overlap scoring.
      4. Title-validate the found URL before returning.
    """
    browser = await get_browser()
    page = await _new_stealth_page(browser)

    try:
        logger.info(f"Loading Bayut area guides index for '{area_name}'...")
        try:
            await page.goto(BAYUT_AREA_GUIDES, wait_until="networkidle", timeout=60_000)
        except Exception:
            pass
        await asyncio.sleep(5)

        # Slow scroll to trigger lazy-loading of area cards throughout the page
        scroll_height = await page.evaluate("() => document.body.scrollHeight")
        for y in range(0, min(scroll_height, 8000), 600):
            await page.evaluate(f"window.scrollTo(0, {y})")
            await asyncio.sleep(0.3)
        await page.evaluate("window.scrollTo(0, 0)")
        await asyncio.sleep(2)

        # ── Step 1: __NEXT_DATA__ search ──────────────────────────────────
        nd = await page.evaluate(
            "() => { try { return window.__NEXT_DATA__ || null; } catch(e) { return null; } }"
        )
        if nd:
            import json as _json
            try:
                with open("/tmp/bayut_index_debug.json", "w") as f:
                    _json.dump(nd, f)
                logger.info("Saved index __NEXT_DATA__ to /tmp/bayut_index_debug.json")
            except Exception:
                pass
            url = _search_next_data_for_area(nd, area_name)
            if url:
                logger.info(f"Found via __NEXT_DATA__: {url}")
                # Quick title validation
                try:
                    await page.goto(url, wait_until="load", timeout=40_000)
                    await asyncio.sleep(3)
                    title = await page.title()
                    if not _bayut_is_index_page(title):
                        logger.info(f"  Confirmed: {title}")
                        return url
                    logger.warning(f"  __NEXT_DATA__ URL leads to index page — continuing")
                except Exception:
                    pass

        # ── Step 2: Expand lists via proper Playwright clicks ──────────────
        logger.info("Trying View All button expansion...")
        try:
            await page.goto(BAYUT_AREA_GUIDES, wait_until="networkidle", timeout=60_000)
        except Exception:
            pass
        await asyncio.sleep(5)

        prev_count = 0
        for attempt in range(25):
            # Scroll down incrementally so buttons enter viewport (Playwright won't
            # click off-screen elements, and React won't trigger without real events)
            cur_height = await page.evaluate("() => document.body.scrollHeight")
            for y in range(0, min(cur_height, 10000), 800):
                await page.evaluate(f"window.scrollTo(0, {y})")
                await asyncio.sleep(0.2)

            # Find all expand buttons visible right now
            btns = page.locator(
                "button:has-text('View All'), a:has-text('View All'), "
                "button:has-text('View More'), a:has-text('View More'), "
                "button:has-text('VIEW ALL'), a:has-text('VIEW ALL'), "
                "button:has-text('Show All'), a:has-text('Show All')"
            )
            count = await btns.count()
            clicked_this_pass = 0
            for i in range(count):
                try:
                    btn = btns.nth(i)
                    if await btn.is_visible():
                        await btn.scroll_into_view_if_needed()
                        await asyncio.sleep(0.3)
                        await btn.click()
                        await asyncio.sleep(1.5)
                        clicked_this_pass += 1
                except Exception:
                    continue

            await asyncio.sleep(2)
            cur_count = await page.evaluate(
                "() => document.querySelectorAll('a[href*=\"/area-guides/\"]').length"
            )
            logger.info(f"  expand pass {attempt+1}: clicked={clicked_this_pass}, links={cur_count}")
            if clicked_this_pass == 0 or cur_count == prev_count:
                break
            prev_count = cur_count

        await asyncio.sleep(2)

        # ── Step 3: Score-match all visible area-guide links ───────────────
        target_lower = area_name.lower().strip()
        target_sig   = list(_sig_words(area_name))

        all_links: list = await page.evaluate("""(args) => {
            const stopWords  = new Set(args.stopWords);
            const emirSlug   = new Set(args.emirateSlugs);

            function sigW(str) {
                return str.toLowerCase().split(/[\\s\\-]+/)
                    .filter(w => w.length > 2 && !stopWords.has(w));
            }

            const seen = new Set();
            const results = [];
            document.querySelectorAll('a[href*="/area-guides/"]').forEach(a => {
                const href = (a.href || '').split('?')[0].replace(/\\/+$/, '');
                if (seen.has(href)) return;
                seen.add(href);
                const parts = href.replace('https://www.bayut.com', '').split('/').filter(Boolean);
                if (parts.length < 2) return;
                const slug = parts[parts.length - 1];
                if (emirSlug.has(slug) || !slug) return;
                const text = (a.innerText || a.textContent || '').trim().toLowerCase();
                results.push({ href, text, slug, slugWords: sigW(slug) });
            });
            return results;
        }""", {"stopWords": list(_STOP_WORDS), "emirateSlugs": list(_EMIRATE_SLUGS)})

        logger.info(f"Total area-guide links after expansion: {len(all_links)}")
        # Log first 30 so we can debug what's actually on the page
        for lnk in all_links[:30]:
            logger.info(f"  link text='{lnk['text'][:60]}' slug='{lnk['slug']}'")

        # Score each link
        best_url   = None
        best_score = 0
        for lnk in all_links:
            text     = lnk["text"]
            slug_sig = set(lnk["slugWords"])

            score = 0
            if text == target_lower:
                score = 100
            elif text.startswith(target_lower) or target_lower.startswith(text):
                score = 85
            else:
                text_sig  = _sig_words(text)
                t_sig_set = set(target_sig)
                if text_sig and t_sig_set:
                    shared_t = len(t_sig_set & text_sig)
                    fwd = shared_t / len(t_sig_set)
                    bwd = shared_t / len(text_sig)
                elif not text_sig:
                    fwd = bwd = 0
                else:
                    fwd = bwd = 0

                shared_s  = len(set(target_sig) & slug_sig)
                slug_fwd  = shared_s / max(len(target_sig), 1) if target_sig else 0

                best_overlap = max(fwd, slug_fwd)
                if best_overlap >= 0.6 and bwd >= 0.4:
                    score = 70
                elif best_overlap >= 0.5:
                    score = 50

            logger.info(f"  scored {score}: text='{text[:50]}' slug='{lnk['slug']}'")
            if score > best_score:
                best_score = score
                best_url   = lnk["href"]

        if not best_url or best_score < 50:
            logger.warning(f"No good match in Bayut index for '{area_name}' (best score: {best_score})")
            return None

        logger.info(f"Best match (score={best_score}): {best_url}")

        # Title validate
        try:
            await page.goto(best_url, wait_until="load", timeout=40_000)
        except Exception:
            pass
        await asyncio.sleep(3)
        title = await page.title()
        if _bayut_is_index_page(title):
            logger.warning(f"Best match leads to index page — rejecting")
            return None

        logger.info(f"Confirmed Bayut area guide for '{area_name}': {best_url}")
        return best_url

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
    Debug helper: loads Bayut index, shows link texts + scores, finds URL,
    then scrapes that URL. All intermediate data saved to /tmp/ for inspection.
    Called by TEST AREA [name] Telegram command.
    """
    import json as _json
    lines = [f"TEST AREA: {area_name}\n"]

    # ── Phase 1: index page inspection ──────────────────────────────────
    lines.append("Phase 1: Loading bayut.com/area-guides/ index...")
    browser = await get_browser()
    idx_page = await _new_stealth_page(browser)
    try:
        try:
            await idx_page.goto(BAYUT_AREA_GUIDES, wait_until="networkidle", timeout=60_000)
        except Exception:
            pass
        await asyncio.sleep(5)

        # scroll
        h = await idx_page.evaluate("() => document.body.scrollHeight")
        for y in range(0, min(h, 6000), 500):
            await idx_page.evaluate(f"window.scrollTo(0, {y})")
            await asyncio.sleep(0.2)
        await idx_page.evaluate("window.scrollTo(0, 0)")

        # __NEXT_DATA__ from index
        nd = await idx_page.evaluate(
            "() => { try { return window.__NEXT_DATA__ || null; } catch(e) { return null; } }"
        )
        if nd:
            try:
                with open("/tmp/bayut_index_debug.json", "w") as f:
                    _json.dump(nd, f)
                lines.append("Index __NEXT_DATA__: YES → /tmp/bayut_index_debug.json")
                nd_url = _search_next_data_for_area(nd, area_name)
                lines.append(f"  Area found in ND: {'YES → ' + nd_url if nd_url else 'NO'}")
            except Exception as e:
                lines.append(f"Index __NEXT_DATA__: YES but failed: {e}")
        else:
            lines.append("Index __NEXT_DATA__: NOT FOUND")

        idx_title = await idx_page.title()
        lines.append(f"Index page title: {idx_title}")

        # Dump ALL area-guide link texts from the current DOM (before expansion)
        raw_links = await idx_page.evaluate("""(args) => {
            const stop = new Set(args.stop);
            const emir = new Set(args.emir);
            const seen = new Set();
            const out = [];
            document.querySelectorAll('a[href*="/area-guides/"]').forEach(a => {
                const href = (a.href||'').split('?')[0].replace(/\\/+$/,'');
                if (seen.has(href)) return;
                seen.add(href);
                const parts = href.replace('https://www.bayut.com','').split('/').filter(Boolean);
                if (parts.length < 2) return;
                const slug = parts[parts.length-1];
                if (emir.has(slug)||!slug) return;
                const text = (a.innerText||a.textContent||'').trim().slice(0,80);
                out.push(slug + ' | ' + text);
            });
            return out;
        }""", {"stop": list(_STOP_WORDS), "emir": list(_EMIRATE_SLUGS)})

        lines.append(f"Area-guide links (before expansion): {len(raw_links)}")
        for lnk in raw_links[:25]:
            lines.append(f"  {lnk}")
    except Exception as e:
        lines.append(f"Index page error: {e}")
    finally:
        await idx_page.close()

    # ── Phase 2: find URL (uses full expansion logic) ────────────────────
    lines.append("\nPhase 2: Finding Bayut URL...")
    await asyncio.sleep(3)  # brief pause to avoid rate-limiting
    url = await find_bayut_area_guide_url(area_name)
    if not url:
        lines.append("Bayut URL: NOT FOUND")
        return "\n".join(lines)
    lines.append(f"Bayut URL: {url}")

    # ── Phase 3: scrape the found URL ────────────────────────────────────
    lines.append("\nPhase 3: Scraping found URL...")
    browser2 = await get_browser()
    page = await _new_stealth_page(browser2)
    try:
        try:
            await page.goto(url, wait_until="load", timeout=60_000)
        except Exception:
            pass
        await asyncio.sleep(5)
        for y in [400, 1000, 2000, 3500, 0]:
            await page.evaluate(f"window.scrollTo(0, {y})")
            await asyncio.sleep(0.8)

        nd2 = await page.evaluate(
            "() => { try { return window.__NEXT_DATA__ || null; } catch(e) { return null; } }"
        )
        if nd2:
            try:
                with open("/tmp/bayut_debug.json", "w") as f:
                    _json.dump(nd2, f, indent=2)
                nd_result = _parse_next_data(nd2, area_name)
                lines.append(f"Page __NEXT_DATA__: YES → /tmp/bayut_debug.json")
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
            guide_url = await find_bayut_area_guide_url(area_name)
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
