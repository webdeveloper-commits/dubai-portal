"""
Uses Claude to:
1. Extract structured fields from raw scraped body text
2. Rewrite description in a professional, human tone (never AI-sounding)
"""
import json
import re
import logging
import anthropic
from ..config import ANTHROPIC_KEY

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)


def _make_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return slug.strip("-")


EXTRACT_PROMPT = """You are a real estate data extractor. Given raw scraped text from a Dubai/UAE property listing page, extract structured data and return ONLY valid JSON.

IMPORTANT: If the project is NOT in the UAE (Dubai, Abu Dhabi, Sharjah, Ajman, RAK, Fujairah, Umm Al Quwain) — for example if it's in Egypt, Bali, Georgia, Turkey, or any other country — return exactly: {"skip": true}

Extract these fields (use null if not found):
{
  "name": "Project name",
  "developer": "Developer company name",
  "developer_slug": "developer-name-as-slug",
  "geo_summary": "Area, Dubai" or "Area, Abu Dhabi" etc,
  "area_slug": "area-name-as-slug",
  "price_from": 1500000,  // number only, AED, 0 if unknown
  "handover_quarter": "Q2",  // Q1/Q2/Q3/Q4 or null
  "handover_year": 2026,  // number or null
  "bedroom_min": 1,  // number or null
  "bedroom_max": 4,  // number or null
  "property_types": ["Apartment", "Penthouse"],  // from: Apartment, Villa, Townhouse, Penthouse, Studio, Duplex, Office
  "lifestyle_tags": ["Beachfront", "Family"],  // from: Beachfront, Golf, Marina, Downtown, Family, Luxury, Investment, Waterfront, Community
  "status": "off_plan"  // off_plan / ready / new_launch
}

Return ONLY the JSON object. No explanation."""

HUMANIZE_PROMPT = """You are a professional real estate copywriter for a Dubai property portal.

Rewrite the following property description into 3 paragraphs. Rules:
- Sound like a senior human copywriter, NOT an AI
- No clichés: avoid "nestled", "boasting", "seamlessly", "elevate your lifestyle"
- Be specific: mention actual features, views, amenities from the text
- First paragraph: what the project is and what makes it stand out
- Second paragraph: location advantages and community
- Third paragraph: investment angle and handover/payment plan if available
- Maximum 200 words total
- Do not copy sentences from the original text

Original text:
{text}

Project name: {name}
Developer: {developer}
Location: {location}

Write the 3 paragraphs only. No heading. No intro sentence."""


async def parse_and_humanize(raw: dict) -> dict | None:
    """
    Takes raw scraped dict, returns structured + humanized dict ready for Supabase.
    """
    body_text = raw.get("body_text", "") or raw.get("description_raw", "")
    if not body_text:
        logger.error("No body text to parse")
        return None

    # ── Step 1: Extract structured fields ────────────────────────────────────
    structured = None
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=800,
                messages=[{
                    "role": "user",
                    "content": f"{EXTRACT_PROMPT}\n\nRAW TEXT:\n{body_text[:6000]}"
                }],
            )
            text = resp.content[0].text.strip()
            # Strip markdown code fences if present
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            structured = json.loads(text)
            if structured.get("skip"):
                logger.info("Claude flagged project as non-UAE — skipping")
                return None
            break
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Extract attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                logger.error("All extract attempts failed")
                return None

    if not structured:
        return None

    # ── Step 2: Humanize description ──────────────────────────────────────────
    description = ""
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=400,
                messages=[{
                    "role": "user",
                    "content": HUMANIZE_PROMPT.format(
                        text=raw.get("description_raw", body_text)[:3000],
                        name=structured.get("name", ""),
                        developer=structured.get("developer", ""),
                        location=structured.get("geo_summary", ""),
                    )
                }],
            )
            description = resp.content[0].text.strip()
            break
        except Exception as e:
            logger.warning(f"Humanize attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                description = raw.get("description_raw", "")[:500]

    # ── Assemble final payload ────────────────────────────────────────────────
    name = structured.get("name") or raw.get("name", "Unnamed Project")
    slug = _make_slug(name)

    return {
        "slug":             slug,
        "name":             name,
        "developer_slug":   structured.get("developer_slug") or _make_slug(structured.get("developer", "")),
        "geo_summary":      structured.get("geo_summary", "Dubai, UAE"),
        "area_slug":        structured.get("area_slug", ""),
        "price_from":       int(structured.get("price_from") or 0),
        "handover_quarter": structured.get("handover_quarter"),
        "handover_year":    structured.get("handover_year"),
        "bedroom_min":      structured.get("bedroom_min"),
        "bedroom_max":      structured.get("bedroom_max"),
        "property_types":   structured.get("property_types") or [],
        "lifestyle_tags":   structured.get("lifestyle_tags") or [],
        "status":           structured.get("status") or "off_plan",
        "description":      description,
        "opr_url":          raw.get("opr_url", ""),
    }
