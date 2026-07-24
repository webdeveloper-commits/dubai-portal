"""
Property Finder scraper — reads __NEXT_DATA__ JSON embedded in each listing page.
No Playwright needed: plain HTTP + regex to extract the script tag.
"""
from __future__ import annotations
import re
import json
import time
import logging
import gzip
import urllib.request
import urllib.parse
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

PF_BASE     = "https://www.propertyfinder.ae"
PF_LIST_URL = f"{PF_BASE}/en/new-projects"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.0 Mobile/15E148 Safari/604.1"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection":      "keep-alive",
}


# ── Low-level page fetch ────────────────────────────────────────────────────────

def _fetch_next_data(url: str) -> dict | None:
    """GET a PF page and extract the __NEXT_DATA__ JSON blob."""
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            enc = resp.headers.get("Content-Encoding", "")
            if enc == "gzip":
                raw = gzip.decompress(raw)
            html = raw.decode("utf-8", errors="replace")
    except Exception as e:
        logger.error(f"_fetch_next_data error ({url}): {e}")
        return None

    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not m:
        logger.warning(f"No __NEXT_DATA__ on {url}")
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error on {url}: {e}")
        return None


def _extract_projects_from_page_data(data: dict, page: int) -> list[dict]:
    """
    Navigate the Next.js page-props tree to find the projects array.
    PF structure as of 2026: props.pageProps.searchResult.data.projects
    Falls back to several other known paths in case PF changes their structure.
    """
    page_props = data.get("props", {}).get("pageProps", {})

    # Primary path (confirmed working 2026-07-24)
    search_result = page_props.get("searchResult") or {}
    sr_data = search_result.get("data") or {}
    if isinstance(sr_data, dict):
        projects = sr_data.get("projects")
        if isinstance(projects, list) and projects:
            return projects

    # Fallback paths for future PF structure changes
    for key in ("projects", "propertyDevelopments", "items"):
        val = page_props.get(key)
        if isinstance(val, list) and val:
            return val

    for key in ("searchResult", "data", "results"):
        container = page_props.get(key)
        if isinstance(container, dict):
            for subkey in ("projects", "items", "hits", "listings"):
                nested = container.get(subkey)
                if isinstance(nested, list) and nested:
                    return nested

    logger.warning(
        f"PF page {page} — could not find projects list. "
        f"pageProps keys: {list(page_props.keys())}"
    )
    return []


# ── Page fetch ──────────────────────────────────────────────────────────────────

def fetch_pf_listing_page(page: int = 1, sort: str = "mr") -> list[dict]:
    """
    Fetch one page of PF /en/new-projects listing.
    Returns a list of raw PF project dicts from __NEXT_DATA__.
    sort="mr" → most recent (default for incremental scans)
    """
    params = urllib.parse.urlencode({"page": page, "sort": sort})
    url = f"{PF_LIST_URL}?{params}"
    data = _fetch_next_data(url)
    if not data:
        return []
    return _extract_projects_from_page_data(data, page)


def fetch_pf_detail(share_url: str) -> dict | None:
    """
    Fetch the PF project detail page and return the detailResult dict.
    Contains: units (with sqft), description, faqs, brochureUrl,
    masterPlan (has commute times), paymentPlans (structured), images.
    """
    if share_url and not share_url.startswith("http"):
        share_url = PF_BASE + share_url
    data = _fetch_next_data(share_url)
    if not data:
        return None
    page_props = data.get("props", {}).get("pageProps", {})
    # Primary path confirmed 2026-07-24: pageProps.detailResult
    for key in ("detailResult", "project", "propertyDevelopment", "data", "development"):
        val = page_props.get(key)
        if isinstance(val, dict):
            return val
    logger.warning(f"PF detail — no project found. Keys: {list(page_props.keys())}")
    return None


def merge_pf_detail(raw: dict, detail: dict) -> None:
    """
    Enrich a raw dict (from pf_to_raw) with detail-page data in-place.
    Adds: floor plans with sqft, commute times, structured payment plan,
    stripped FAQs, brochure URL, master plan image, better images.
    """
    s = raw.get("_pf_structured", {})

    # ── Floor plans from nested units ──
    floor_plans = _extract_floor_plans(detail.get("units") or [])
    if floor_plans:
        s["floor_plans"] = floor_plans
        # Backfill bedroom_min/max if listing page had empty bedrooms[]
        if s.get("bedroom_min") is None:
            beds = [fp["beds"] for fp in floor_plans if fp.get("beds") is not None]
            if beds:
                s["bedroom_min"] = min(beds)
                s["bedroom_max"] = max(beds)
                s["bedroom_types"] = list(dict.fromkeys(
                    "Studio" if b == 0 else f"{b}BR" for b in sorted(set(beds))
                ))
        # Backfill sqft
        sqfts_min = [fp["sqft_min"] for fp in floor_plans if fp.get("sqft_min")]
        sqfts_max = [fp["sqft_max"] for fp in floor_plans if fp.get("sqft_max")]
        if sqfts_min:
            s["size_sqft_min"] = min(sqfts_min)
        if sqfts_max:
            s["size_sqft_max"] = max(sqfts_max)

    # ── Ownership type (freehold / leasehold) ──
    ownership = (detail.get("ownershipType") or "").lower()
    if "freehold" in ownership:
        s.setdefault("investment_potential", [])
        if "Freehold ownership" not in s["investment_potential"]:
            s["investment_potential"].append("Freehold ownership")

    # ── Structured payment plan ──
    pf_plans = detail.get("paymentPlans") or []
    pd = _parse_pf_payment_plan(pf_plans)
    if pd:
        s["payment_plan_detail"] = pd
        # Also set summary from first plan
        if not s.get("payment_plan_summary") and pf_plans:
            phases = pf_plans[0].get("phases", [])
            s["payment_plan_summary"] = "/".join(str(p.get("value", 0)) for p in phases)

    # ── Full description (HTML → plain text, richer than listing) ──
    desc_html = detail.get("description") or ""
    desc_plain = _strip_html(desc_html)
    if desc_plain and len(desc_plain) > len(raw.get("description_raw", "")):
        raw["description_raw"] = desc_plain

    # ── Commute times from masterPlan.description ──
    master = detail.get("masterPlan") or {}
    master_html = master.get("description") or ""
    if master_html:
        commute = _extract_commute_times(master_html)
        if commute:
            s["commute_times"] = commute
        # Master plan image
        if master.get("image"):
            raw.setdefault("master_plan_image", master["image"])

    # ── Better images from detail (objects with source/variants) ──
    detail_images = detail.get("images") or []
    detail_urls = []
    for img in detail_images:
        if isinstance(img, dict):
            url = img.get("source") or img.get("url") or ""
            if url:
                detail_urls.append(url)
        elif isinstance(img, str):
            detail_urls.append(img)
    if detail_urls:
        raw["images_all"] = detail_urls
        raw["image_main"] = detail_urls[0]

    # ── Brochure URL ──
    if detail.get("brochureUrl"):
        raw["brochure_url"] = detail["brochureUrl"]

    # ── FAQs (strip HTML from answers) ──
    detail_faqs = detail.get("faqs") or []
    clean_faqs = []
    for faq in detail_faqs:
        if isinstance(faq, dict):
            q = _strip_html(faq.get("question") or "")
            a = _strip_html(faq.get("answer") or "")
            if q:
                clean_faqs.append({"question": q, "answer": a})
    if clean_faqs:
        raw["scraped_faqs"] = clean_faqs

    # ── Location tree — canonical area slug from PF ──
    location_tree = detail.get("locationTree") or []
    for node in location_tree:
        if isinstance(node, dict) and node.get("type") == "COMMUNITY":
            community_slug = node.get("slug") or ""
            if community_slug:
                s["area_slug"] = community_slug
                break

    # ── Update body_text with richer description ──
    amenities = s.get("amenities") or []
    commute_lines = "\n".join(s.get("commute_times") or [])
    body_parts = [
        f"Project: {s.get('name', '')}",
        f"Developer: {s.get('developer_name', '')}",
        f"Location: {s.get('geo_summary', '')}",
        f"Price from: AED {s['price_from']:,}" if s.get("price_from") else "",
        f"Delivery: {raw.get('_pf_delivery_date', '')}",
        f"Payment plan: {s.get('payment_plan_summary', '')}",
        f"Ownership: {ownership.title()}" if ownership else "",
        "",
        raw.get("description_raw", ""),
        "",
        f"Nearby:\n{commute_lines}" if commute_lines else "",
        "",
        f"Amenities: {', '.join(amenities)}" if amenities else "",
    ]
    raw["body_text"] = "\n".join(p for p in body_parts if p)


# ── Detail-page helpers ─────────────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    """Remove HTML tags and normalise whitespace."""
    import html as html_module
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"</(?:p|li|h[1-6]|div|tr)>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = html_module.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _extract_commute_times(html: str) -> list[str]:
    """
    Parse commute times from masterPlan description HTML.
    PF uses list items like: "Downtown Dubai – ~7 min"
    """
    plain = _strip_html(html)
    times = []
    for line in plain.splitlines():
        line = line.strip()
        # Match lines that look like "Place – Xmin" or "Place — X min"
        if re.search(r"\d+\s*min", line, re.IGNORECASE) and len(line) < 80:
            times.append(line)
    return times[:10]


def _extract_floor_plans(units_raw: list) -> list[dict]:
    """
    Flatten PF's nested units structure into our floor_plans format.
    PF: units[building].units[group].list[item] → {bedrooms, areaFrom, areaTo, bathroomsFrom}
    """
    plans = []
    seen_beds = set()
    for building in units_raw:
        for group in (building.get("units") or []):
            for item in (group.get("list") or []):
                beds = item.get("bedrooms")
                if beds is None:
                    continue
                beds = int(beds)
                if beds in seen_beds:
                    # Already have this bedroom count — update sqft range if wider
                    for p in plans:
                        if p["beds"] == beds:
                            area_from = item.get("areaFrom") or 0
                            area_to   = item.get("areaTo") or 0
                            if area_from and area_from < (p["sqft_min"] or 9999):
                                p["sqft_min"] = area_from
                            if area_to and area_to > (p["sqft_max"] or 0):
                                p["sqft_max"] = area_to
                    continue
                seen_beds.add(beds)
                plans.append({
                    "type":     "Studio" if beds == 0 else f"{beds}BR",
                    "beds":     beds,
                    "baths":    item.get("bathroomsFrom"),
                    "sqft_min": item.get("areaFrom"),
                    "sqft_max": item.get("areaTo"),
                })
    return sorted(plans, key=lambda p: p["beds"])


# ── Incremental scan ────────────────────────────────────────────────────────────

def scan_pf_new_projects(existing_pf_ids: set[str], max_new: int = 20) -> list[dict]:
    """
    Check PF listing pages (sorted most-recent) for new projects.
    Stops early when a full page's worth of projects are all known.
    Returns raw PF project dicts for new items.
    """
    new_projects: list[dict] = []
    page = 1

    while len(new_projects) < max_new:
        projects = fetch_pf_listing_page(page, sort="mr")
        if not projects:
            logger.info(f"PF scan: no projects on page {page} — stopping")
            break

        all_known = True
        for item in projects:
            pf_id = _pf_id(item)
            if pf_id and pf_id in existing_pf_ids:
                continue
            all_known = False
            if pf_id:
                new_projects.append(item)
                if len(new_projects) >= max_new:
                    break

        if all_known:
            logger.info(f"PF scan: all items on page {page} are known — done")
            break

        page += 1
        time.sleep(0.6)

    logger.info(f"PF scan complete — {len(new_projects)} new projects found")
    return new_projects[:max_new]


# ── Bulk page iteration (for import) ───────────────────────────────────────────

def iter_pf_all_pages(max_pages: int = 130, delay: float = 0.6):
    """
    Generator: yield each PF project dict across all listing pages.
    Use for the one-time bulk import.
    """
    for page in range(1, max_pages + 1):
        projects = fetch_pf_listing_page(page, sort="mr")
        if not projects:
            logger.info(f"PF bulk iter: empty page {page} — done")
            break
        logger.info(f"PF bulk iter: page {page} — {len(projects)} projects")
        yield from projects
        time.sleep(delay)


# ── Data mapping: PF → our raw dict format ──────────────────────────────────────

def pf_to_raw(pf_item: dict) -> dict:
    """
    Convert a PF __NEXT_DATA__ project dict to our internal 'raw' dict.
    Populates _pf_structured with clean structured data so humanizer can
    skip the Claude extraction step.

    Confirmed PF structure (2026-07-24):
    - images: list of plain URL strings
    - shareUrl: relative path like /en/new-projects/developer/slug
    - bedrooms: list of strings like ["1", "2"]
    - propertyTypes: list of strings like ["apartment", "penthouse"]
    - amenities: list of {id, name} objects
    - location.coordinates: {lat, lng, lon}
    """
    pf_id      = _pf_id(pf_item)
    title      = pf_item.get("title", "")
    share_url  = pf_item.get("shareUrl", "")
    # shareUrl is relative — prepend base domain
    if share_url and not share_url.startswith("http"):
        share_url = PF_BASE + share_url
    description = pf_item.get("description") or pf_item.get("overview") or ""

    # ── Developer ──
    dev      = pf_item.get("developer") or {}
    dev_name = dev.get("name") or dev.get("title") or ""
    dev_logo = dev.get("logoUrl") or dev.get("logo") or dev.get("imageUrl") or None

    # ── Location ──
    loc = pf_item.get("location") or {}
    full_location = loc.get("fullName", "")
    # Format: "Dubai,Business Bay,Project Name" — parts are Emirate, Area, SubArea
    location_parts = [p.strip() for p in full_location.split(",")]
    emirate   = location_parts[0] if location_parts else "Dubai"
    area_name = location_parts[1] if len(location_parts) > 1 else ""

    coords = loc.get("coordinates") or {}
    lat = coords.get("lat") if isinstance(coords, dict) else None
    lng = coords.get("lng") or coords.get("lon") if isinstance(coords, dict) else None

    # ── Images — plain URL strings on listing pages ──
    images     = pf_item.get("images") or []
    image_urls = []
    for img in images:
        if isinstance(img, str) and img.startswith("http"):
            image_urls.append(img)
        elif isinstance(img, dict):
            url = img.get("original") or img.get("large") or img.get("url") or img.get("medium") or ""
            if url:
                image_urls.append(url)

    # ── Payment plans ──
    plans = pf_item.get("paymentPlans") or []
    payment_plan_summary = plans[0] if plans else None

    # ── Amenities ──
    amenities_raw = pf_item.get("amenities") or []
    amenities = []
    for a in amenities_raw:
        if isinstance(a, dict):
            name = a.get("name") or a.get("title") or ""
            if name:
                amenities.append(name)
        elif isinstance(a, str) and a:
            amenities.append(a)
    amenities = amenities[:30]

    # ── Bedrooms — list of strings like ["1", "2"] ──
    bedroom_strs = pf_item.get("bedrooms") or []
    bedroom_nums  = []
    bedroom_types = []
    for b in bedroom_strs:
        try:
            n = int(b)
            bedroom_nums.append(n)
            bedroom_types.append("Studio" if n == 0 else f"{n}BR")
        except (ValueError, TypeError):
            pass

    # ── Property types — list of strings like ["apartment", "penthouse"] ──
    pt_raw     = pf_item.get("propertyTypes") or []
    prop_types = set()
    _PT_MAP    = {
        "villa": "Villa", "townhouse": "Townhouse", "penthouse": "Penthouse",
        "studio": "Studio", "duplex": "Duplex", "office": "Office",
        "apartment": "Apartment",
    }
    for pt in pt_raw:
        key = str(pt).lower()
        prop_types.add(_PT_MAP.get(key, "Apartment"))

    # ── Delivery / status ──
    delivery_date = pf_item.get("deliveryDate")
    sales_start   = pf_item.get("salesStartDate")
    construction  = (pf_item.get("constructionPhase") or "").lower()
    sales_phase   = (pf_item.get("salesPhase") or "").lower()

    handover_year = _parse_year(delivery_date)
    handover_q    = _parse_quarter(delivery_date)

    if "complet" in construction or "handover" in construction or "ready" in construction:
        status = "ready"
    elif "new_launch" in sales_phase or "new launch" in sales_phase or "launch" in sales_phase:
        status = "new_launch"
    else:
        status = "off_plan"

    # ── FAQs ──
    faqs_raw     = pf_item.get("faqs") or []
    scraped_faqs = []
    for faq in faqs_raw:
        if isinstance(faq, dict):
            q = faq.get("question") or faq.get("title") or ""
            a = faq.get("answer") or faq.get("content") or ""
            if q:
                scraped_faqs.append({"question": q, "answer": a})

    # ── Build body_text for Claude to humanize ──
    body_parts = [
        f"Project: {title}",
        f"Developer: {dev_name}",
        f"Location: {full_location}",
        f"Price from: AED {pf_item['startingPrice']:,}" if pf_item.get("startingPrice") else "",
        f"Delivery: {delivery_date}" if delivery_date else "",
        f"Payment plan: {payment_plan_summary}" if payment_plan_summary else "",
        f"Construction: {pf_item.get('constructionPhase', '')}",
        "",
        description,
        "",
        f"Amenities: {', '.join(amenities)}" if amenities else "",
    ]
    body_text = "\n".join(p for p in body_parts if p)

    dev_slug  = _make_slug(dev_name)
    area_slug = _make_slug(area_name)

    return {
        # ── Pre-extracted structure (skip Claude extraction step) ──
        "_pf_structured": {
            "name":                 title,
            "developer_name":       dev_name,
            "developer_slug":       dev_slug,
            "developer_about":      None,
            "area_name":            area_name,
            "area_slug":            area_slug,
            "emirate":              emirate,
            "geo_summary":          f"{area_name}, {emirate}" if area_name else emirate,
            "price_from":           pf_item.get("startingPrice"),
            "price_to":             None,
            "handover_quarter":     handover_q,
            "handover_year":        handover_year,
            "bedroom_min":          min(bedroom_nums) if bedroom_nums else None,
            "bedroom_max":          max(bedroom_nums) if bedroom_nums else None,
            "bedroom_types":        list(dict.fromkeys(bedroom_types)),
            "size_sqft_min":        None,
            "size_sqft_max":        None,
            "property_types":       list(prop_types) or ["Apartment"],
            "lifestyle_tags":       [],
            "status":               status,
            "amenities":            amenities,
            "payment_plan_summary": payment_plan_summary,
            "payment_plan_detail":  None,
            "investment_potential": [],
            "floor_plans":          None,
            "commute_times":        [],
            "nearby_attractions":   [],
            "nearby_hospitals":     [],
            "nearby_schools":       [],
        },
        # ── Raw text for humanizer ──
        "description_raw":  description,
        "body_text":         body_text,
        "images_all":        image_urls,
        "image_main":        image_urls[0] if image_urls else None,
        "scraped_faqs":      scraped_faqs,
        # ── Source metadata ──
        "pf_url":            share_url,
        "pf_id":             pf_id,
        "latitude":          lat,
        "longitude":         lng,
        "developer_logo":    dev_logo,
        # ── For created_at ordering ──
        "_pf_delivery_date": delivery_date,
        "_pf_sales_start":   sales_start,
    }


def compute_pf_created_at(pf_raw: dict) -> str:
    """
    Return a synthetic ISO created_at string for ordering:
    salesStartDate → deliveryDate−18months → now
    Capped at now(), floored at 5 years ago.
    """
    now   = datetime.now(timezone.utc)
    floor = now - timedelta(days=365 * 5)

    for field, offset_days in [("_pf_sales_start", 0), ("_pf_delivery_date", 548)]:
        raw_date = pf_raw.get(field)
        if not raw_date:
            continue
        try:
            dt = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
            dt = dt - timedelta(days=offset_days)
            if dt > now:
                dt = now - timedelta(hours=1)
            if dt < floor:
                dt = floor
            return dt.isoformat()
        except Exception:
            continue

    return (now - timedelta(hours=1)).isoformat()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _pf_id(item: dict) -> str:
    return str(item.get("id") or item.get("uuid") or "")


def _make_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return slug.strip("-")


def _parse_pf_payment_plan(plans: list) -> list[dict]:
    """
    Convert PF's paymentPlans structure to our [{stage, percentage}] format.
    PF: [{phases: [{label: "down_payment", value: 10}, ...], title: "Standard"}]
    """
    _LABELS = {
        "down_payment":          "On Booking",
        "during_construction":   "During Construction",
        "handover":              "On Handover",
        "post_handover":         "Post Handover",
    }
    if not plans:
        return []
    first = plans[0]
    phases = first.get("phases") or []
    result = []
    for phase in phases:
        label = _LABELS.get(phase.get("label", ""), phase.get("label", "").replace("_", " ").title())
        value = phase.get("value")
        if value is not None:
            result.append({"stage": label, "percentage": value})
    return result


def _parse_year(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(str(date_str).replace("Z", "+00:00")).year
    except Exception:
        try:
            return int(str(date_str)[:4])
        except Exception:
            return None


def _parse_quarter(date_str: str | None) -> str | None:
    if not date_str:
        return None
    try:
        month = datetime.fromisoformat(str(date_str).replace("Z", "+00:00")).month
        return f"Q{(month - 1) // 3 + 1}"
    except Exception:
        return None
