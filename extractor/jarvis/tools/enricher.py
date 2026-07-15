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


# ── Bayut area guide — find URL ────────────────────────────────────────────────

async def find_bayut_area_guide_url(area_name: str) -> str | None:
    """
    Visit bayut.com/area-guides/, click 'View All' for each emirate,
    then find the link whose text best matches our area name.
    """
    browser = await get_browser()
    page = await _new_stealth_page(browser)
    try:
        logger.info(f"Searching Bayut area guides for '{area_name}'...")
        await page.goto(BAYUT_AREA_GUIDES, wait_until="domcontentloaded", timeout=40_000)
        await asyncio.sleep(4)

        # Click all "View All" / "VIEW ALL READY/OFF-PLAN" links to expose full lists
        for _ in range(8):
            try:
                btn = page.locator("a:has-text('VIEW ALL'), a:has-text('View all'), a:has-text('View More')").first
                if await btn.count() == 0:
                    break
                await btn.click()
                await asyncio.sleep(2)
            except Exception:
                break

        area_lower = area_name.lower().strip()

        # Search all anchor tags for one whose visible text closely matches our area name
        found_url: str | None = await page.evaluate(f"""() => {{
            const target = {repr(area_lower)};
            const links = Array.from(document.querySelectorAll('a[href]'));

            // Score each link by how well its text matches the target
            // Prefer exact/starts-with over loose contains to avoid false positives
            let best = null, bestScore = 0;
            for (const a of links) {
                const text = a.innerText.trim().toLowerCase();
                if (!text) continue;
                let score = 0;
                if (text === target)                score = 100;
                else if (text.startsWith(target))   score = 80;
                else if (target.startsWith(text) && text.length > 4) score = 60;
                else if (text.includes(target) && target.length > 6) score = 40;
                // Penalise short link text (likely a card thumbnail label, not a guide link)
                if (text.length < 5) score = 0;
                if (score > bestScore) { bestScore = score; best = a; }
            }
            // Only return if score is strong enough to trust
            return bestScore >= 40 ? (best ? best.href : null) : null;
        }}""")

        if found_url:
            logger.info(f"Bayut area guide URL for '{area_name}': {found_url}")
        else:
            # Fallback: try direct URL pattern
            slug = area_name.lower().replace(" ", "-")
            candidates = [
                f"https://www.bayut.com/area-guides/{slug}-area-guide/",
                f"https://www.bayut.com/area-guides/{slug}-community-overview/",
                f"https://www.bayut.com/area-guides/{slug}/",
            ]
            async with httpx.AsyncClient(timeout=10) as client:
                for url in candidates:
                    try:
                        r = await client.head(url, follow_redirects=True,
                                              headers={"User-Agent": "Mozilla/5.0"})
                        if r.status_code == 200:
                            found_url = url
                            logger.info(f"Bayut area guide fallback URL: {url}")
                            break
                    except Exception:
                        continue

        return found_url

    except Exception as e:
        logger.error(f"find_bayut_area_guide_url failed for '{area_name}': {e}")
        return None
    finally:
        await page.close()


# ── Bayut area guide — scrape detail page ─────────────────────────────────────

async def scrape_bayut_area_guide(url: str, area_name: str) -> dict:
    """
    Scrape a Bayut area guide detail page.
    Extracts: hero image, about/description, community overview,
    schools, hospitals, lifestyle highlights.
    Skips: agent cards, property listings (contain AED prices, beds/baths).
    """
    browser = await get_browser()
    page = await _new_stealth_page(browser)
    result = {}

    try:
        logger.info(f"Scraping Bayut area guide: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
        await asyncio.sleep(3)
        # Scroll to trigger Bayut's lazy-loaded images, then scroll back
        await page.evaluate("window.scrollTo(0, 800)")
        await asyncio.sleep(2)
        await page.evaluate("window.scrollTo(0, 0)")
        await asyncio.sleep(1)

        extracted = await page.evaluate("""() => {
            const r = {
                hero_image: null,
                description: '',
                community_overview: '',
                schools: [],
                hospitals: [],
                attractions: [],
                lifestyle: ''
            };

            // ── Hero image — check data-src for lazy-loaded Bayut images ──────
            function getImgSrc(el) {
                if (!el) return null;
                return el.getAttribute('src') ||
                       el.getAttribute('data-src') ||
                       el.getAttribute('data-lazy-src') ||
                       el.getAttribute('data-original') || null;
            }
            const heroSelectors = [
                '[class*="hero"] img', '[class*="cover"] img',
                '[class*="banner"] img', 'picture img',
                'article img', '[class*="header"] img',
                'main img'
            ];
            for (const sel of heroSelectors) {
                const el = document.querySelector(sel);
                const src = getImgSrc(el);
                if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('logo')) {
                    r.hero_image = src;
                    break;
                }
            }
            // Last fallback: first sizeable img anywhere on page
            if (!r.hero_image) {
                for (const img of document.querySelectorAll('img')) {
                    const src = getImgSrc(img);
                    if (src && src.startsWith('http') && !src.includes('placeholder') &&
                        !src.includes('logo') && !src.includes('icon') && src.length > 40) {
                        r.hero_image = src; break;
                    }
                }
            }

            // ── Section-by-section text extraction ───────────────────────────
            // Bayut area guides are structured with h2/h3 headings.
            // We skip sections that look like property/agent listings.
            const SKIP_PATTERNS = [
                /aed\\s*[\\d,]+/i, /\\d+\\s*bed/i, /\\d+\\s*bath/i,
                /per year/i, /per month/i, /call agent/i,
                /whatsapp/i, /view details/i, /listed by/i,
                /top broker/i, /top agent/i
            ];

            function isListingText(text) {
                return SKIP_PATTERNS.some(p => p.test(text));
            }

            const sections = {};
            let current = '__intro__';
            sections[current] = [];

            const els = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, li'));
            for (const el of els) {
                const text = el.innerText.trim();
                if (!text || text.length < 4) continue;

                if (['H1','H2','H3','H4'].includes(el.tagName)) {
                    current = text;
                    if (!sections[current]) sections[current] = [];
                } else {
                    if (isListingText(text)) continue;
                    sections[current].push(text);
                }
            }

            // ── Map section headings to our fields ────────────────────────────
            for (const [heading, texts] of Object.entries(sections)) {
                const h = heading.toLowerCase();
                const content = texts.join(' ').trim();
                if (!content) continue;

                if (h === '__intro__' || h.includes('about') || h.includes('nutshell') || h.includes('highlights')) {
                    if (!r.description) r.description = content.slice(0, 700);
                } else if (h.includes('community overview') || h.includes('overview')) {
                    r.community_overview = content.slice(0, 500);
                } else if (h.includes('school') || h.includes('education') || h.includes('college') || h.includes('university')) {
                    r.schools = texts.filter(t => t.length > 5 && !isListingText(t)).slice(0, 10);
                } else if (h.includes('hospital') || h.includes('healthcare') || h.includes('medical') || h.includes('clinic')) {
                    r.hospitals = texts.filter(t => t.length > 5 && !isListingText(t)).slice(0, 10);
                } else if (h.includes('shopping') || h.includes('dining') || h.includes('nightlife') || h.includes('leisure') || h.includes('landmark') || h.includes('entertainment')) {
                    r.attractions = r.attractions.concat(texts.filter(t => t.length > 5).slice(0, 5));
                    r.lifestyle += content.slice(0, 300) + '\\n';
                } else if (h.includes('recreation') || h.includes('fitness') || h.includes('outdoor')) {
                    r.lifestyle += content.slice(0, 200) + '\\n';
                }
            }

            r.attractions = [...new Set(r.attractions)].slice(0, 10);
            r.lifestyle = r.lifestyle.trim().slice(0, 600);

            return r;
        }""")

        result = extracted
        logger.info(
            f"Bayut guide '{area_name}' — "
            f"hero={'yes' if result.get('hero_image') else 'no'}, "
            f"desc={len(result.get('description',''))} chars, "
            f"schools={len(result.get('schools',[]))}, "
            f"hospitals={len(result.get('hospitals',[]))}, "
            f"attractions={len(result.get('attractions',[]))}"
        )

    except Exception as e:
        logger.error(f"scrape_bayut_area_guide failed for '{area_name}': {e}")
    finally:
        await page.close()

    return result


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
