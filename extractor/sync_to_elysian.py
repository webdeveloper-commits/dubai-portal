"""
Sync new OPR projects from Supabase → elysian.com MySQL via Laravel API.

Fetches all Supabase projects with opr_id > 7936 (Ice Beach) that are not
yet on elysian.com, maps fields to the new_dev_data table structure, and
POSTs each one to the Laravel sync endpoint.

Safe to re-run — the endpoint skips projects whose opr_id already exists.
"""
import os
import sys
import json
import time
import requests
from datetime import datetime, timezone

# Self-load .env
_env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(_env_path) as _f:
    for _line in _f:
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

sys.path.insert(0, os.path.dirname(__file__))
from supabase import create_client

SUPABASE_URL       = os.environ["SUPABASE_URL"]
SUPABASE_KEY       = os.environ["SUPABASE_KEY"]
ELYSIAN_API_URL    = os.environ.get("ELYSIAN_API_URL", "https://laravel.elysian.com/api/sync/offplan")
ELYSIAN_SYNC_SECRET = os.environ.get("OFFPLAN_SYNC_SECRET", "")

OPR_ID_CUTOFF = 7936  # Ice Beach — last project already on elysian.com


def format_price(price_from: int | None) -> str | None:
    if not price_from:
        return None
    if price_from >= 1_000_000:
        val = price_from / 1_000_000
        return f"AED {val:.1f}M".replace(".0M", "M")
    if price_from >= 1_000:
        return f"AED {price_from // 1000}K"
    return f"AED {price_from:,}"


def format_bedrooms(bed_min: int | None, bed_max: int | None) -> str | None:
    if bed_min is None:
        return None
    if bed_max and bed_max != bed_min:
        return f"{bed_min}-{bed_max}"
    return str(bed_min)


def format_handover(quarter: str | None, year: int | None) -> str | None:
    if not year:
        return None
    if quarter:
        return f"{quarter} {year}"
    return str(year)


def build_header_heading(p: dict) -> str:
    beds = format_bedrooms(p.get("bedroom_min"), p.get("bedroom_max"))
    types = p.get("property_types") or []
    type_str = types[0].title() if types else "Property"
    area = (p.get("geo_summary") or "").split(",")[0].strip()
    name = p.get("name", "")
    parts = []
    if beds:
        parts.append(f"{beds} Bed")
    parts.append(f"{type_str}s for Sale in {name}")
    if area:
        parts.append(area)
    return ", ".join(parts) if area else f"{' '.join(parts[:2])}"


def format_gallery(images_all: list | None) -> str | None:
    if not images_all:
        return None
    return ",".join(images_all)


def extract_area_name(geo_summary: str | None) -> str:
    if not geo_summary:
        return ""
    return geo_summary.split(",")[0].strip()


def extract_area_state(geo_summary: str | None) -> str:
    if not geo_summary:
        return "Dubai"
    parts = geo_summary.split(",")
    return parts[-1].strip() if len(parts) > 1 else "Dubai"


def format_faq_schema(aeo_faq: list | None) -> str | None:
    if not aeo_faq:
        return None
    schema = []
    for item in aeo_faq:
        if isinstance(item, dict) and item.get("question"):
            schema.append({
                "@type": "Question",
                "name": item["question"],
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.get("answer", ""),
                },
            })
    return json.dumps(schema) if schema else None


def sync_project(p: dict) -> dict:
    """Build payload and POST one project to elysian.com."""
    geo = p.get("geo_summary") or ""
    types_list = p.get("property_types") or []
    prop_type_str = ",".join(t.title() for t in types_list) if types_list else None

    amenities_list = p.get("amenities") or []
    amenities_str  = ",".join(str(a) for a in amenities_list) if amenities_list else None

    payload = {
        "opr_id":            p["opr_id"],
        "name":              p["name"],
        "slug":              p["slug"],
        "developer_slug":    p.get("developer_slug"),
        "developer_name":    (p.get("developer_slug") or "").replace("-", " ").title(),
        "area_name":         extract_area_name(geo),
        "area_state":        extract_area_state(geo),
        "property_types":    prop_type_str,
        "price_from":        format_price(p.get("price_from")),
        "bedrooms":          format_bedrooms(p.get("bedroom_min"), p.get("bedroom_max")),
        "image_main":        p.get("image_main"),
        "og_image":          p.get("image_main"),
        "gallery":           format_gallery(p.get("images_all")),
        "handover":          format_handover(p.get("handover_quarter"), p.get("handover_year")),
        "content":           p.get("seo_description"),
        "header_heading":    build_header_heading(p),
        "header_subheading": f"Luxury living in {geo}" if geo else None,
        "meta_title":        p.get("seo_title") or p["name"],
        "meta_description":  p.get("seo_description"),
        "focus_keyword":     f"{p['name']} {extract_area_name(geo)}".strip(),
        "schema_faq":        format_faq_schema(p.get("aeo_faq")),
        "payment_plan":      p.get("payment_plan_summary"),
        "amenities":         amenities_str,
        "units":             str(p["total_units"]) if p.get("total_units") else None,
        "size":              (
            f"{p['size_sqft_min']:,}-{p['size_sqft_max']:,} sqft"
            if p.get("size_sqft_min") and p.get("size_sqft_max")
            else None
        ),
    }

    resp = requests.post(
        ELYSIAN_API_URL,
        json=payload,
        headers={"X-Sync-Secret": ELYSIAN_SYNC_SECRET},
        timeout=30,
    )
    try:
        body = resp.json()
    except Exception:
        body = {"_raw": resp.text[:500]}
    return {"status_code": resp.status_code, "body": body}


def main():
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"Fetching Supabase projects with opr_id > {OPR_ID_CUTOFF}...\n")
    res = db.table("projects") \
        .select(
            "opr_id, name, slug, developer_slug, geo_summary, property_types, "
            "price_from, bedroom_min, bedroom_max, image_main, images_all, "
            "handover_quarter, handover_year, seo_description, seo_title, "
            "aeo_faq, payment_plan_summary, amenities, total_units, size_sqft_min, size_sqft_max"
        ) \
        .gt("opr_id", OPR_ID_CUTOFF) \
        .not_.is_("opr_id", "null") \
        .order("opr_id", desc=False) \
        .execute()

    projects = res.data or []
    print(f"Found {len(projects)} projects to sync\n")

    if not projects:
        print("Nothing to sync.")
        return

    synced  = 0
    skipped = 0
    errors  = []

    for p in projects:
        name = p.get("name", "?")
        opr_id = p.get("opr_id")
        try:
            result = sync_project(p)
            code = result["status_code"]
            body = result["body"]
            status = body.get("status", "?")

            if code == 201:
                synced += 1
                print(f"  ✓ [{synced}] '{name}' (opr_id={opr_id}) → nd_id={body.get('nd_id')}")
            elif status == "skipped":
                skipped += 1
                print(f"  – '{name}' already on elysian.com — skipped")
            else:
                errors.append(name)
                print(f"  ✗ '{name}' failed: {code} {body}")

        except Exception as e:
            errors.append(name)
            print(f"  ✗ '{name}' error: {e}")

        time.sleep(0.3)

    print(f"\n=== Done — synced {synced}, skipped {skipped}, failed {len(errors)} ===")
    if errors:
        print("Failed:")
        for n in errors:
            print(f"  • {n}")


if __name__ == "__main__":
    main()
