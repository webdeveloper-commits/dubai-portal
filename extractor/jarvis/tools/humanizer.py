"""
Uses Claude to:
1. Extract every structured field from raw scraped body text
2. Generate humanized copy, SEO fields, FAQ, tagline, and WhatsApp share text
"""
import json
import re
import logging
import anthropic
from ..config import ANTHROPIC_KEY

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)


def _clean_json(text: str) -> str:
    """
    Strip markdown fences then fix literal newlines/tabs inside JSON strings.
    Uses a state machine so it handles nested quotes and escapes correctly.
    """
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    # Walk character by character, replacing bare newlines inside strings
    result = []
    in_string = False
    escape_next = False
    for ch in text:
        if escape_next:
            result.append(ch)
            escape_next = False
        elif ch == "\\" and in_string:
            result.append(ch)
            escape_next = True
        elif ch == '"':
            result.append(ch)
            in_string = not in_string
        elif in_string and ch == "\n":
            result.append("\\n")
        elif in_string and ch == "\r":
            pass  # drop bare carriage returns
        elif in_string and ch == "\t":
            result.append("\\t")
        else:
            result.append(ch)
    return "".join(result)


def _make_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return slug.strip("-")


EXTRACT_PROMPT = """You are a real estate data extractor. Given raw scraped text from a UAE property page, extract structured data and return ONLY valid JSON.

IMPORTANT: If the project is NOT in the UAE (Dubai, Abu Dhabi, Sharjah, Ajman, RAK, Fujairah, Umm Al Quwain) — return exactly: {"skip": true}

Extract ALL fields below. Use null for anything not found on the page.

{
  "name": "Project name",
  "developer_name": "Developer company — exact spelling, preserve capitals (e.g. DAMAC Properties)",
  "developer_slug": "damac-properties",
  "developer_about": "1-2 sentences about the developer from the page text, or null",
  "area_name": "Community/area only (e.g. Dubai Marina — not Dubai Marina, Dubai)",
  "area_slug": "dubai-marina",
  "emirate": "Dubai",
  "geo_summary": "Area, Emirate (e.g. Dubai Marina, Dubai)",
  "price_from": 1500000,
  "price_to": null,
  "handover_quarter": "Q4",
  "handover_year": 2027,
  "bedroom_min": 1,
  "bedroom_max": 3,
  "bedroom_types": ["1BR", "2BR", "3BR"],
  "size_sqft_min": 650,
  "size_sqft_max": 2100,
  "property_types": ["Apartment"],
  "lifestyle_tags": ["waterfront", "luxury"],
  "status": "off_plan",
  "amenities": ["Swimming Pool", "Gym", "Concierge", "Children Play Area"],
  "payment_plan_summary": "60/40",
  "payment_plan_detail": [
    {"stage": "On Booking", "percentage": 20},
    {"stage": "During Construction", "percentage": 40},
    {"stage": "On Handover", "percentage": 40}
  ],
  "investment_potential": ["Strong rental demand in Dubai Marina", "Freehold ownership"],
  "floor_plans": [
    {"type": "1BR", "beds": 1, "baths": 1, "sqft_min": 650, "sqft_max": 750}
  ],
  "commute_times": [
    "Dubai Mall — 15 min by car",
    "DXB Airport — 25 min by car"
  ],
  "nearby_attractions": ["Burj Khalifa", "Dubai Frame"],
  "nearby_hospitals": ["Mediclinic City Hospital — 5 min"],
  "nearby_schools": ["GEMS Wellington — 8 min"]
}

Rules:
- bedroom_types: derive from text. "Studio" for 0-bed. Format: "Studio", "1BR", "2BR", "3BR", "4BR", "5BR+"
- lifestyle_tags must be from (lowercase, exact): waterfront, golf, luxury, branded, beachfront, community
  Rules — use each tag ONLY when clearly evidenced in the text:
  • waterfront  — canal/creek/lagoon/river view or direct water frontage (not ocean/sea beach)
  • golf        — project is within a golf community or has golf-course-facing units
  • luxury      — price > AED 3M average, hotel-grade finishes, penthouses, sky villas, or ultra-premium positioning
  • branded     — hotel-branded residences: Four Seasons, Ritz-Carlton, Bulgari, Armani, W Hotels, Dorchester, Fairmont, Marriott, etc.
  • beachfront  — oceanfront, seafront, or beach-access within the development
  • community   — family-oriented gated community with parks, retail, schools on-site (e.g. townhouses, villas, master-planned)
  Multiple tags allowed. Use [] if none clearly apply — do NOT guess.
- property_types must be from: Apartment, Villa, Townhouse, Penthouse, Studio, Duplex, Office
- status: off_plan / ready / new_launch
- payment_plan_detail: look for percentages at booking/construction/handover. Return as array of stage objects.
- floor_plans: extract from any unit type table/list. Include beds, baths, sqft per type.
- commute_times: extract ALL distance/time mentions to landmarks, malls, airports, metro.
- investment_potential: 2-4 specific bullet points (not generic). Mention actual location advantages.
- developer_name: preserve exact company name with correct capitalisation — this is shown on the site.
- nearby_attractions: look for sections titled "Attractions" or "Landmarks" — extract all listed items.
- nearby_hospitals: look for "Premier Healthcare", "Healthcare", "Medical" sections — extract all listed items.
- nearby_schools: look for "Elite Education", "Education", "Schools" sections — extract all listed items.

Return ONLY valid JSON. No explanation. No markdown."""


HUMANIZE_PROMPT = """You are a professional real estate copywriter for a Dubai property portal.

Return a JSON object with exactly these keys:

"tagline": One punchy line (max 12 words) capturing what makes this project special. Examples: "Waterfront apartments in Dubai Islands from AED 1.6M" / "Golf-view villas in Emirates Hills with 60/40 plan"

"short": 1-2 sentences (max 40 words). Standalone teaser. No clichés (no nestled, boasting, seamlessly).

"long": 3 paragraphs (max 200 words total). Sound human, not AI. Be specific — mention actual features, views, amenities.
  Para 1: What the project is and what makes it stand out
  Para 2: Location and community advantages
  Para 3: Investment angle, payment plan, handover

"seo_title": Under 60 chars. Format: "{name} by {developer} | {type} in {area} from AED {price}"

"seo_description": "140-160 chars EXACTLY. Must name the project, developer, area, price from AED X, and handover. No clichés. Example: 'Sobha Orbis by Sobha Realty — 1-3BR apartments in Motor City from AED 890K. Q4 2027 handover with 60/40 plan.'"

"seo_keywords": ["exactly 6 specific search phrases. Include the project name, developer + city/type, area + off-plan, bedroom type + area, price range phrase, and handover year phrase."],

"aeo_faq": Rewrite and expand the SOURCE FAQs below into 8 polished Q&A pairs. If source FAQs are empty, generate from project data. Each object: {{"question": "ends with ?", "answer": "2-3 sentences with SPECIFIC facts — price, location, developer, sizes, handover. Never say 'Please contact us' or generic filler."}}

"whatsapp_share_text": 4 short lines someone would forward to a friend. Use developer exact name (not slug). Last line: dubai-portal.vercel.app/projects/{slug}

CRITICAL: Return ONLY a single valid JSON object. Use \\n for line breaks inside strings — never literal newlines. No markdown fences.

Project name: {name}
Developer: {developer}
Location: {location}
Price from: {price}
Handover: {handover}
Bedrooms: {bedrooms}
Status: {status}
Payment plan: {payment_plan}
Slug: {slug}

Raw description:
{text}

SOURCE FAQs from opr.ae (rewrite these — improve wording, expand answers with specifics):
{scraped_faqs}

Return ONLY the JSON object. No markdown fences. No explanation."""


ENTITY_SEO_PROMPT = """You are an SEO copywriter for a UAE real estate portal.

Write SEO content for this {entity_type}. Return ONLY valid JSON with these exact keys:

{{
  "tagline": "One punchy line max 12 words — what makes {name} special",
  "seo_title": "Under 60 chars — e.g. '{name} Properties | Dubai Real Estate Portal'",
  "seo_description": "140-155 chars, compelling, mentions what makes {name} notable.",
  "seo_keywords": ["6 real search phrases people type — e.g. 'properties in {name} dubai'"],
  "aeo_faq": [
    {{"question": "...", "answer": "..."}},
    {{"question": "...", "answer": "..."}},
    {{"question": "...", "answer": "..."}},
    {{"question": "...", "answer": "..."}},
    {{"question": "...", "answer": "..."}},
    {{"question": "...", "answer": "..."}}
  ]
}}

{entity_type}: {name}
{extra_context}

FAQ should cover what someone searching for '{name}' in a UAE property context would ask.
Return ONLY the JSON object. No markdown fences."""


def _generate_entity_seo(entity_type: str, name: str, extra_context: str = "") -> dict:
    """Generate tagline + SEO fields for an area or developer via Claude."""
    if not name:
        return {}
    prompt = ENTITY_SEO_PROMPT.format(
        entity_type=entity_type,
        name=name,
        extra_context=extra_context.strip(),
    )
    for attempt in range(2):
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text.strip()
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            result = json.loads(text)
            logger.info(f"Generated SEO for {entity_type} '{name}'")
            return result
        except Exception as e:
            logger.warning(f"Entity SEO attempt {attempt + 1} failed for {entity_type} '{name}': {e}")
    return {}


async def parse_and_humanize(raw: dict) -> dict | None:
    """
    Takes raw scraped dict, returns full structured + humanized dict ready for Supabase.
    Private keys (_developer, _area) are for the runner to use for upserts — not sent to DB.
    """
    body_text = raw.get("body_text", "") or raw.get("description_raw", "")
    if not body_text:
        logger.error("No body text to parse")
        return None

    # ── Step 1: Extract all structured fields ─────────────────────────────────
    structured = None
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                messages=[{
                    "role": "user",
                    "content": f"{EXTRACT_PROMPT}\n\nRAW TEXT:\n{body_text[:6000]}"
                }],
            )
            text = _clean_json(resp.content[0].text)
            structured = json.loads(text)
            if structured.get("skip"):
                logger.info("Claude flagged project as non-UAE — skipping")
                return {"_skip": True}
            break
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Extract attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                logger.error("All extract attempts failed")
                return None

    if not structured:
        return None

    # ── Step 2: Generate copy, SEO, FAQ, tagline ──────────────────────────────
    name     = structured.get("name") or raw.get("name", "Unnamed Project")
    slug     = _make_slug(name)
    dev_name = structured.get("developer_name", "")
    location = structured.get("geo_summary", "")
    handover = f"{structured.get('handover_quarter') or ''} {structured.get('handover_year') or ''}".strip() or "TBA"
    price    = f"AED {structured['price_from']:,}" if structured.get("price_from") else "Price on request"
    bmin     = structured.get("bedroom_min")
    bmax     = structured.get("bedroom_max")
    bedrooms = f"{bmin}–{bmax} BR" if bmin and bmax else (f"{bmin} BR" if bmin else "Various")
    payment  = structured.get("payment_plan_summary") or "Flexible"

    humanized: dict = {}
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4000,
                messages=[{
                    "role": "user",
                    "content": HUMANIZE_PROMPT.format(
                        text=raw.get("description_raw", body_text)[:3000],
                        name=name,
                        developer=dev_name,
                        location=location,
                        price=price,
                        handover=handover,
                        bedrooms=bedrooms,
                        status=structured.get("status", "off_plan"),
                        payment_plan=payment,
                        slug=slug,
                        scraped_faqs=json.dumps(raw.get("scraped_faqs", []), ensure_ascii=False) if raw.get("scraped_faqs") else "None — generate from project data",
                    )
                }],
            )
            text = _clean_json(resp.content[0].text)
            humanized = json.loads(text)
            break
        except Exception as e:
            logger.warning(f"Humanize attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                fallback = raw.get("description_raw", "")[:500]
                humanized = {
                    "tagline":            name,
                    "short":              fallback[:120],
                    "long":               fallback,
                    "seo_title":          name[:60],
                    "seo_description":    fallback[:155],
                    "seo_keywords":       [],
                    "aeo_faq":            [],
                    "whatsapp_share_text": f"{name} by {dev_name}\n{location}\n{price}\ndubai-portal.vercel.app/projects/{slug}",
                }

    # ── Assemble slugs ────────────────────────────────────────────────────────
    developer_slug = structured.get("developer_slug") or _make_slug(dev_name)
    area_slug      = structured.get("area_slug") or _make_slug(structured.get("area_name", ""))

    # ── Generate SEO for area and developer ───────────────────────────────────
    area_name = structured.get("area_name", "")
    area_nearby = (
        raw.get("nearby_attractions_raw") or
        structured.get("nearby_attractions") or []
    )
    area_seo = _generate_entity_seo(
        "area",
        area_name,
        f"Emirate: {structured.get('emirate', 'Dubai')}\n"
        f"Description: {raw.get('area_description', '')}\n"
        f"Nearby landmarks: {', '.join(area_nearby[:5])}"
    ) if area_name else {}

    dev_seo = _generate_entity_seo(
        "developer",
        dev_name,
        f"About: {structured.get('developer_about', '')}\n"
        f"Projects in UAE: apartments, villas, mixed-use"
    ) if dev_name else {}

    return {
        # ── Core project fields ───────────────────────────────────────────────
        "slug":                  slug,
        "name":                  name,
        "tagline":               humanized.get("tagline", ""),
        "geo_summary":           location,
        "area_slug":             area_slug,
        "developer_slug":        developer_slug,
        "price_from":            int(structured.get("price_from") or 0),
        "price_to":              structured.get("price_to"),
        "handover_quarter":      structured.get("handover_quarter"),
        "handover_year":         structured.get("handover_year"),
        "bedroom_min":           structured.get("bedroom_min"),
        "bedroom_max":           structured.get("bedroom_max"),
        "bedroom_types":         structured.get("bedroom_types") or [],
        "size_sqft_min":         structured.get("size_sqft_min"),
        "size_sqft_max":         structured.get("size_sqft_max"),
        "property_types":        structured.get("property_types") or [],
        "lifestyle_tags":        structured.get("lifestyle_tags") or [],
        "status":                structured.get("status") or "off_plan",
        "amenities":             structured.get("amenities") or [],
        "payment_plan_summary":  structured.get("payment_plan_summary"),
        "payment_plan_detail":   structured.get("payment_plan_detail"),
        "investment_potential":  structured.get("investment_potential") or [],
        "floor_plans":           structured.get("floor_plans"),
        "commute_times":         structured.get("commute_times") or [],
        "latitude":              raw.get("latitude"),
        "longitude":             raw.get("longitude"),
        # ── Descriptions & copy ───────────────────────────────────────────────
        "description_short":     humanized.get("short", ""),
        "description_long":      humanized.get("long", ""),
        # ── SEO ───────────────────────────────────────────────────────────────
        "seo_title":             humanized.get("seo_title", ""),
        "seo_description":       humanized.get("seo_description", ""),
        "seo_keywords":          humanized.get("seo_keywords") or [],
        # ── AEO ───────────────────────────────────────────────────────────────
        "aeo_faq":               humanized.get("aeo_faq") or [],
        # ── Social ────────────────────────────────────────────────────────────
        "whatsapp_share_text":   humanized.get("whatsapp_share_text", ""),
        # ── Source ────────────────────────────────────────────────────────────
        "opr_url":               raw.get("opr_url", ""),
        # ── Private: for runner to upsert to developers / areas tables ────────
        "_developer": {
            "name":           dev_name,
            "slug":           developer_slug,
            "intro_short":    structured.get("developer_about") or "",
            "logo_url":       raw.get("developer_logo") or None,
            **dev_seo,
        },
        "_area": {
            "name":               area_name,
            "slug":               area_slug,
            "emirate":            structured.get("emirate", "Dubai"),
            "description_short":  raw.get("area_description") or "",
            "image_url":          raw.get("area_image"),
            "cover_image_url":    raw.get("area_image"),
            "nearby_attractions": raw.get("nearby_attractions_raw") or structured.get("nearby_attractions") or [],
            "nearby_hospitals":   raw.get("nearby_hospitals_raw") or structured.get("nearby_hospitals") or [],
            "nearby_schools":     raw.get("nearby_schools_raw") or structured.get("nearby_schools") or [],
            **area_seo,
        },
    }
