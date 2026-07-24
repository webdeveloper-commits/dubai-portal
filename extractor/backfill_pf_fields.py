"""
Backfill missing fields for already-imported PF projects.

For each project where pf_id is set, reconstructs the PF detail URL from
developer_slug + slug, fetches the detail page, and patches:
  - floor_plans (with sqft)
  - commute_times
  - payment_plan_detail
  - size_sqft_min / size_sqft_max
  - bedroom_min / bedroom_max (if missing)
  - lifestyle_tags (Claude inference)
  - investment_potential (Claude inference)
  - brochure_url
  - data_source_url

Safe to re-run — skips projects whose fields are already populated.
"""
import os
import sys
import json
import time
import logging
import anthropic
sys.path.insert(0, os.path.dirname(__file__))

from supabase import create_client
from jarvis.tools.pf_scraper import (
    fetch_pf_detail, merge_pf_detail, pf_to_raw,
    _extract_floor_plans, _parse_pf_payment_plan,
    _extract_commute_times, _strip_html,
    PF_BASE,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_KEY", "")

PF_INFER_PROMPT = """You are a UAE real estate data analyst. Given the project info below, return ONLY valid JSON with these exact keys:

"lifestyle_tags": Choose ONLY from this exact list — use each ONLY if clearly evidenced in the text:
  waterfront (canal/creek/lagoon/river frontage — NOT sea/ocean), golf (golf course within community),
  luxury (price > AED 3M avg, hotel-grade finishes, sky villas), branded (hotel-branded residences),
  beachfront (oceanfront / sea beach access), community (gated family community with parks, schools on-site)
  Return [] if none clearly apply.

"investment_potential": 3-4 specific bullets. Mention actual price, location, rental/ROI signals.
  Example: ["Strong rental demand in Business Bay — 7-9% gross yields", "Freehold ownership for all nationalities"]
  Never generic filler.

Return ONLY the JSON object. No markdown fences.

Project: {name}
Developer: {developer}
Location: {location}
Price from: {price}
Handover: {handover}
Ownership: {ownership}
Payment plan: {payment_plan}

Description:
{text}"""


def infer_lifestyle_and_investment(
    client: anthropic.Anthropic,
    name: str,
    developer: str,
    location: str,
    price: str,
    handover: str,
    ownership: str,
    payment_plan: str,
    description: str,
) -> dict:
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=600,
                messages=[{
                    "role": "user",
                    "content": PF_INFER_PROMPT.format(
                        name=name,
                        developer=developer,
                        location=location,
                        price=price,
                        handover=handover,
                        ownership=ownership,
                        payment_plan=payment_plan,
                        text=description[:2500],
                    )
                }],
            )
            text = resp.content[0].text.strip()
            import re
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            return json.loads(text)
        except Exception as e:
            logger.warning(f"  Infer attempt {attempt+1} failed: {e}")
    return {}


def main():
    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    ai = anthropic.Anthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None

    # ── Fetch all PF projects from Supabase ──────────────────────────────────
    res = db.table("projects").select(
        "id, name, slug, developer_slug, geo_summary, price_from, "
        "handover_quarter, handover_year, payment_plan_summary, "
        "floor_plans, commute_times, lifestyle_tags, investment_potential, "
        "bedroom_min, bedroom_max, size_sqft_min, size_sqft_max, "
        "payment_plan_detail, brochure_url, data_source_url, pf_id"
    ).not_.is_("pf_id", "null").execute()

    projects = res.data or []
    print(f"Found {len(projects)} PF projects to backfill\n")

    ok = 0
    fail = 0

    for i, p in enumerate(projects, 1):
        name = p.get("name", "?")
        dev_slug = p.get("developer_slug", "")
        slug = p.get("slug", "")
        pf_id = p.get("pf_id", "")
        db_id = p["id"]

        print(f"[{i}/{len(projects)}] {name}")

        # Construct PF detail URL from slugs
        pf_url = f"{PF_BASE}/en/new-projects/{dev_slug}/{slug}"
        print(f"  URL: {pf_url}")

        # Fetch PF detail page — also try ASCII-normalised slug as fallback
        detail = fetch_pf_detail(pf_url)
        if not detail:
            import unicodedata
            slug_ascii = "".join(
                c for c in unicodedata.normalize("NFD", slug)
                if unicodedata.category(c) != "Mn"
            )
            if slug_ascii != slug:
                pf_url = f"{PF_BASE}/en/new-projects/{dev_slug}/{slug_ascii}"
                print(f"  Retrying with ASCII slug: {pf_url}")
                detail = fetch_pf_detail(pf_url)

        if not detail:
            print(f"  ✗ Could not fetch detail page — skipping")
            fail += 1
            time.sleep(1)
            continue

        patch: dict = {}

        # ── Floor plans + sqft ──
        units_raw = detail.get("units") or []
        floor_plans = _extract_floor_plans(units_raw)
        if floor_plans:
            patch["floor_plans"] = floor_plans
            sqfts_min = [fp["sqft_min"] for fp in floor_plans if fp.get("sqft_min")]
            sqfts_max = [fp["sqft_max"] for fp in floor_plans if fp.get("sqft_max")]
            if sqfts_min:
                patch["size_sqft_min"] = min(sqfts_min)
            if sqfts_max:
                patch["size_sqft_max"] = max(sqfts_max)
            # Backfill bedrooms if missing
            if not p.get("bedroom_min"):
                beds = [fp["beds"] for fp in floor_plans if fp.get("beds") is not None]
                if beds:
                    patch["bedroom_min"] = min(beds)
                    patch["bedroom_max"] = max(beds)
            print(f"  floor_plans: {len(floor_plans)} types, sqft {patch.get('size_sqft_min')}-{patch.get('size_sqft_max')}")

        # ── Commute times from masterPlan ──
        master = detail.get("masterPlan") or {}
        master_html = master.get("description") or ""
        if master_html:
            commute = _extract_commute_times(master_html)
            if commute:
                patch["commute_times"] = commute
                print(f"  commute_times: {len(commute)} entries")

        # ── Payment plan detail ──
        pf_plans = detail.get("paymentPlans") or []
        pd = _parse_pf_payment_plan(pf_plans)
        if pd:
            patch["payment_plan_detail"] = pd
            print(f"  payment_plan_detail: {len(pd)} stages")

        # ── Brochure URL ──
        if detail.get("brochureUrl") and not p.get("brochure_url"):
            patch["brochure_url"] = detail["brochureUrl"]
            print(f"  brochure_url: set")

        # ── data_source_url ──
        if not p.get("data_source_url"):
            patch["data_source_url"] = pf_url
            patch["data_source"] = "propertyfinder.ae"

        # ── Ownership (freehold) ──
        ownership = (detail.get("ownershipType") or "").lower()
        ownership_label = "Freehold" if "freehold" in ownership else ""

        # ── Claude inference: lifestyle_tags + investment_potential ──
        if ai:
            desc_html = detail.get("description") or ""
            desc_text = _strip_html(desc_html)
            if not desc_text:
                # Fallback: use masterPlan description
                desc_text = _strip_html(master_html)

            if desc_text:
                price_s = f"AED {p['price_from']:,}" if p.get("price_from") else "Price on request"
                handover = f"{p.get('handover_quarter') or ''} {p.get('handover_year') or ''}".strip() or "TBA"
                payment = p.get("payment_plan_summary") or "Flexible"
                location = p.get("geo_summary") or ""

                inferred = infer_lifestyle_and_investment(
                    ai,
                    name=name,
                    developer=dev_slug.replace("-", " ").title(),
                    location=location,
                    price=price_s,
                    handover=handover,
                    ownership=ownership_label or "Unknown",
                    payment_plan=payment,
                    description=desc_text,
                )

                tags = inferred.get("lifestyle_tags") or []
                if tags:
                    patch["lifestyle_tags"] = tags
                    print(f"  lifestyle_tags: {tags}")

                inv = inferred.get("investment_potential") or []
                if ownership_label and f"{ownership_label} ownership" not in inv:
                    inv.insert(0, f"{ownership_label} ownership")
                if inv:
                    patch["investment_potential"] = inv
                    print(f"  investment_potential: {len(inv)} bullets")

        # ── Apply patch ──
        if patch:
            try:
                db.table("projects").update(patch).eq("id", db_id).execute()
                print(f"  ✓ Updated {len(patch)} fields")
                ok += 1
            except Exception as e:
                print(f"  ✗ Update failed: {e}")
                fail += 1
        else:
            print(f"  — Nothing to update")
            ok += 1

        time.sleep(1.5)  # polite delay between PF requests

    print(f"\n=== Done ===")
    print(f"  Updated: {ok}")
    print(f"  Failed:  {fail}")


if __name__ == "__main__":
    main()
