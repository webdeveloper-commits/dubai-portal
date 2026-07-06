#!/usr/bin/env python3
# extract.py
# Dubai Off-Plan Real Estate Portal — PDF Extractor v3
# Flow: PDF → OPR.ae scrape → OpenAI GPT-4o-mini → 8-tab Review Dashboard → Cloudinary + Supabase
# Tabs: Basic | Pricing | Images | Floor Plans | Amenities | FAQ | SEO+GEO+AEO | Map

import os
import sys
import json
import re
import shutil
import threading
import webbrowser
import urllib.parse
from pathlib import Path

import fitz  # PyMuPDF
import cloudinary
import cloudinary.uploader
from openai import OpenAI
from supabase import create_client
from dotenv import load_dotenv
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
import logging

# ─────────────────────────────────────────────────────────────────────────────
# 0. ENV
# ─────────────────────────────────────────────────────────────────────────────
_ENV = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_ENV)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_KEY   = os.getenv("OPENAI_KEY")

cloudinary.config(
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key    = os.getenv("CLOUDINARY_API_KEY"),
    api_secret = os.getenv("CLOUDINARY_API_SECRET"),
    secure     = True,
)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
ai       = OpenAI(api_key=OPENAI_KEY)

TEMP_DIR = Path(__file__).parent / "temp_images"

logging.getLogger("werkzeug").setLevel(logging.ERROR)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def to_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [x.strip() for x in value.split(",") if x.strip()]
    return [value]

def parse_handover(s):
    if not s:
        return None, None
    s = str(s).strip()
    q = re.search(r"(Q[1-4])", s, re.IGNORECASE)
    y = re.search(r"(20\d{2})", s)
    return (q.group(1).upper() if q else None), (int(y.group(1)) if y else None)

def build_bedroom_types(lo, hi):
    if lo is None or hi is None:
        return []
    return ["Studio" if i == 0 else f"{i}BR" for i in range(int(lo), int(hi) + 1)]

def slugify(text):
    t = re.sub(r"[^a-z0-9\s-]", "", str(text).lower().strip())
    t = re.sub(r"[\s]+", "-", t)
    return re.sub(r"-+", "-", t).strip("-")[:70]

def safe_int(val):
    if val in (None, "", "null", "None"):
        return None
    try:
        return int(str(val).replace(",", "").replace(" ", ""))
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 1. EXTRACT TEXT FROM PDF
# ─────────────────────────────────────────────────────────────────────────────
def extract_text(pdf_path: str) -> str:
    print("\n[1/4] Extracting text from PDF...")
    doc   = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        t = page.get_text()
        if t.strip():
            pages.append(f"--- Page {i+1} ---\n{t}")
    n = len(doc)
    doc.close()
    full = "\n".join(pages)
    print(f"      ✓ {len(full):,} chars from {n} pages")
    return full


# ─────────────────────────────────────────────────────────────────────────────
# 2. EXTRACT IMAGES TO TEMP
# ─────────────────────────────────────────────────────────────────────────────
def extract_images_to_temp(pdf_path: str) -> list:
    print("\n[2/4] Extracting images...")
    if TEMP_DIR.exists():
        shutil.rmtree(TEMP_DIR)
    TEMP_DIR.mkdir(parents=True)

    doc   = fitz.open(pdf_path)
    saved = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        for img_idx, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            base = doc.extract_image(xref)
            w, h = base["width"], base["height"]
            if w < 300 or h < 200:
                continue

            ext  = base["ext"]
            name = f"page{page_num+1}_img{img_idx+1}.{ext}"
            path = TEMP_DIR / name
            path.write_bytes(base["image"])
            sz = path.stat().st_size

            saved.append({
                "filename":   name,
                "filepath":   str(path),
                "size_bytes": sz,
                "size_mb":    round(sz / 1048576, 2),
                "width":      w,
                "height":     h,
                "category":   "exterior",
            })

    doc.close()
    print(f"      ✓ {len(saved)} images saved")
    return saved


# ─────────────────────────────────────────────────────────────────────────────
# 3. SCRAPE OPR.AE FOR SUPPLEMENTAL DATA
# ─────────────────────────────────────────────────────────────────────────────
def scrape_opr_ae(project_name: str, developer: str = "") -> dict:
    from playwright.sync_api import sync_playwright

    query = f"{project_name} {developer}".strip()
    print(f"\n[3/4] Scraping OPR.ae for: {query}")

    found = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            ctx     = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
            )
            page = ctx.new_page()
            page.set_default_timeout(20000)

            try:
                # Build slug variations dynamically — works for any project
                name_slug = slugify(project_name)
                dev_slug  = slugify(developer)

                urls_to_try = [
                    f"https://opr.ae/projects/{name_slug}-{dev_slug}",
                    f"https://opr.ae/projects/{name_slug}",
                    f"https://opr.ae/projects/{name_slug}-by-{dev_slug}",
                    f"https://opr.ae/projects/{dev_slug}-{name_slug}",
                ]

                found_page = False
                for url in urls_to_try:
                    try:
                        page.goto(url, wait_until="domcontentloaded")
                        page.wait_for_timeout(2000)
                        title = page.title().lower()
                        if "404" not in title and "not found" not in title and page.query_selector("h1"):
                            print(f"      ✓ Found: {url}")
                            found_page = True
                            break
                    except Exception:
                        continue

                if not found_page:
                    print(f"      ⚠ Project not found on OPR.ae")
                else:
                    for sel in ["[class*='description']", "[class*='overview']", "p.detail", "p"]:
                        el = page.query_selector(sel)
                        if el:
                            txt = el.inner_text().strip()
                            if len(txt) > 80:
                                found["opr_description"] = txt[:1500]
                                break

                    for sel in ["[class*='amenity']", "[class*='feature'] li", "ul.amenities li", "li"]:
                        els = page.query_selector_all(sel)
                        if els:
                            items = [e.inner_text().strip() for e in els[:20] if e.inner_text().strip()]
                            if items:
                                found["opr_amenities"] = items
                                break

                    for sel in ["[class*='price']", "[data-price]", ".asking-price"]:
                        el = page.query_selector(sel)
                        if el:
                            found["opr_price"] = el.inner_text().strip()
                            break

            except Exception as inner:
                print(f"      ⚠  OPR.ae inner error: {inner}")
            browser.close()

        print(f"      ✓ OPR.ae: {len(found)} fields ({', '.join(found.keys()) or 'none'})")
    except Exception as e:
        print(f"      ⚠  OPR.ae skipped: {e}")

    return found


# ─────────────────────────────────────────────────────────────────────────────
# 4. STRUCTURE WITH OPENAI
# ─────────────────────────────────────────────────────────────────────────────
def structure_with_openai(raw_text: str, opr_data: dict = None) -> dict:
    print("\n[4/4] Sending to OpenAI GPT-4o-mini...")

    opr_ctx = ""
    if opr_data:
        opr_ctx = f"\n\nSUPPLEMENTAL DATA FROM OPR.AE:\n{json.dumps(opr_data, indent=2)}"

    prompt = f"""You are a data extraction assistant for a Dubai real estate portal.

Extract structured data from this developer brochure and return ONLY a valid JSON object.
No markdown, no code fences, no explanation. Raw JSON only.

PRICE RULES:
- Search for "AED", "starting from", "prices from"
- Convert to integers: 2.5M=2500000, 1,500,000=1500000
- price_from=lowest, price_to=highest. Null if not found.

BEDROOM RULES:
- bedroom_min: lowest count (0=studio), bedroom_max: highest
- "studios to 3BR" → bedroom_min:0, bedroom_max:3

FAQ: Generate exactly 15 buyer-focused Q&As covering price, payment, handover,
location, ROI, unit types, amenities, service charge, freehold, foreign ownership, etc.

FLOOR PLANS: If specific unit types with sizes are mentioned, extract them.

Return this exact structure:
{{
  "name": "Full project name",
  "developer": "Developer company name",
  "area": "Community e.g. Al Marjan Island",
  "emirate": "Dubai or Abu Dhabi or Sharjah or Ras Al Khaimah etc",
  "tagline": "Short SEO-optimised heading",
  "description_short": "2-3 sentence listing header",
  "description_long": "3-5 paragraph full description",
  "price_from": 2150000,
  "price_to": 8000000,
  "bedroom_min": 1,
  "bedroom_max": 3,
  "size_sqft_min": 750,
  "size_sqft_max": 3200,
  "handover": "Q4 2027",
  "payment_plan_summary": "60/40",
  "payment_plan_detail": [
    {{"stage": "On Booking", "percentage": 10}},
    {{"stage": "During Construction", "percentage": 50}},
    {{"stage": "On Handover", "percentage": 40}}
  ],
  "floor_plans": [
    {{"type": "1BR", "beds": 1, "baths": 1, "sqft_min": 750, "sqft_max": 900}},
    {{"type": "2BR", "beds": 2, "baths": 2, "sqft_min": 1200, "sqft_max": 1500}}
  ],
  "property_types": ["Apartment", "Penthouse"],
  "amenities": ["Swimming Pool", "Gym", "Concierge"],
  "investment_potential": ["Strong ROI potential", "Near Wynn Resort"],
  "lifestyle_tags": ["beachfront", "waterfront"],
  "total_units": 240,
  "status": "off_plan",
  "completion_pct": 0,
  "permit_number": null,
  "faqs": [
    {{"question": "What is the starting price?", "answer": "Prices start from AED X."}},
    {{"question": "Who is the developer?", "answer": "Developed by ..."}},
    {{"question": "When is the expected handover?", "answer": "Handover is expected ..."}},
    {{"question": "What payment plan is available?", "answer": "A ... payment plan is available."}},
    {{"question": "Where is the project located?", "answer": "Located in ..."}},
    {{"question": "What unit types are available?", "answer": "The project offers ..."}},
    {{"question": "What amenities does the project offer?", "answer": "Residents enjoy ..."}},
    {{"question": "Is this an off-plan project?", "answer": "Yes, ..."}},
    {{"question": "What is the expected rental yield?", "answer": "Based on the area ..."}},
    {{"question": "Is there a post-handover payment option?", "answer": "..."}},
    {{"question": "How many units are in the development?", "answer": "..."}},
    {{"question": "Can foreign nationals buy here?", "answer": "..."}},
    {{"question": "What are the estimated service charges?", "answer": "..."}},
    {{"question": "Is this in a freehold area?", "answer": "..."}},
    {{"question": "How do I register my interest?", "answer": "Contact us at ..."}}
  ],
  "seo_title": "Project by Developer | Type in Area from AED Price",
  "seo_description": "150-160 char SEO meta description with name, developer, location, price, handover",
  "seo_keywords": ["dubai off plan", "project name dubai", "buy apartment dubai"],
  "geo_region": "AE-DU",
  "geo_placename": "Dubai, UAE",
  "aeo_snippet": "One direct sentence answering: what is this project and why buy?",
  "lat": 25.2048,
  "lng": 55.2708
}}

RULES:
- property_types, amenities, investment_potential, lifestyle_tags, seo_keywords: always arrays
- lifestyle_tags only from: beachfront waterfront golf_course equestrian city_center
  island_living mountain_view forest_living marina_view downtown desert_living ski_in_ski_out
- payment_plan_detail: array of {{stage, percentage}}
- floor_plans: array of {{type, beds, baths, sqft_min, sqft_max}}
- faqs: exactly 15 {{question, answer}} objects with real content
- status: off_plan | under_construction | ready | completed
- lat/lng: best estimate coordinates for the area

BROCHURE TEXT:
{raw_text[:12000]}{opr_ctx}
"""

    resp = ai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    raw = resp.choices[0].message.content.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"^```\s*",     "", raw)
    raw = re.sub(r"\s*```$",     "", raw)

    data = json.loads(raw)

    for f in ["property_types", "amenities", "investment_potential",
              "lifestyle_tags", "seo_keywords"]:
        data[f] = to_list(data.get(f))

    faqs = data.get("faqs", [])
    if not isinstance(faqs, list):
        faqs = []
    while len(faqs) < 15:
        faqs.append({"question": f"Question {len(faqs)+1}", "answer": ""})
    data["faqs"] = faqs[:15]

    fps = data.get("floor_plans", [])
    data["floor_plans"] = fps if isinstance(fps, list) else []

    q, y = parse_handover(data.get("handover"))
    data["handover_quarter"] = q
    data["handover_year"]    = y
    data["bedroom_types"]    = build_bedroom_types(
        data.get("bedroom_min"), data.get("bedroom_max")
    )
    data["slug"] = slugify(
        f"{data.get('name','project')} by {data.get('developer','')} "
        f"{data.get('area','')} {data.get('emirate','')}"
    )
    data.setdefault("lat", 25.2048)
    data.setdefault("lng", 55.2708)

    print(f"      ✓ {data.get('name')} by {data.get('developer')}")
    print(f"        Slug:   {data.get('slug')}")
    print(f"        FAQs:   {len(data['faqs'])}")
    print(f"        Plans:  {len(data['floor_plans'])} types")
    if data.get("price_from"):
        print(f"        Price:  AED {data['price_from']:,} – {data.get('price_to') or 'TBC'}")

    return data


# ─────────────────────────────────────────────────────────────────────────────
# COMPRESS IMAGE
# ─────────────────────────────────────────────────────────────────────────────
def compress_image_if_needed(filepath: str) -> str:
    MAX_BYTES = 8 * 1024 * 1024
    MAX_PX    = 2000
    if os.path.getsize(filepath) <= MAX_BYTES:
        return filepath
    print(f"        Compressing {Path(filepath).name}...")
    try:
        img = Image.open(filepath)
        w, h = img.size
        if max(w, h) > MAX_PX:
            r = MAX_PX / max(w, h)
            img = img.resize((int(w * r), int(h * r)), Image.LANCZOS)
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        out = filepath.rsplit(".", 1)[0] + "_c.jpg"
        img.save(out, "JPEG", quality=85, optimize=True)
        return out
    except Exception as e:
        print(f"        Compression failed: {e}")
        return filepath


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD TO CLOUDINARY
# ─────────────────────────────────────────────────────────────────────────────
def upload_images_by_category(images_with_categories: list, slug: str) -> dict:
    result = {"exterior": [], "interior": [], "amenities": [], "floor_plan": [], "all": []}
    todo   = [i for i in images_with_categories if i.get("category") != "skip"]
    print(f"\n  Uploading {len(todo)} images to Cloudinary...")

    for idx, item in enumerate(todo):
        cat      = item.get("category", "exterior")
        filepath = item["filepath"]
        try:
            up = compress_image_if_needed(filepath)
            r  = cloudinary.uploader.upload(
                up,
                folder          = f"projects/{slug}/{cat}",
                format          = "webp",
                quality         = "auto",
                fetch_format    = "auto",
                use_filename    = True,
                unique_filename = True,
            )
            url = r["secure_url"]
            if cat in result:
                result[cat].append(url)
            result["all"].append(url)
            print(f"      ✓ [{idx+1}/{len(todo)}] {Path(filepath).name} → {cat}")
        except Exception as e:
            print(f"      ✗ [{idx+1}/{len(todo)}] {Path(filepath).name} — {e}")

    return result


# ─────────────────────────────────────────────────────────────────────────────
# INSERT TO SUPABASE
# ─────────────────────────────────────────────────────────────────────────────
def insert_to_supabase(data: dict, img_result: dict, floor_plans: list) -> str:
    print("\n  Inserting into Supabase...")
    all_urls = img_result.get("all", [])

    record = {
        "slug":                 data.get("slug"),
        "name":                 data.get("name"),
        "tagline":              data.get("tagline"),
        "is_published":         False,
        "is_featured":          False,
        "permit_number":        data.get("permit_number"),
        "property_types":       to_list(data.get("property_types")),
        "status":               data.get("status", "off_plan"),
        "completion_pct":       data.get("completion_pct", 0),
        "total_units":          data.get("total_units"),
        "handover_quarter":     data.get("handover_quarter"),
        "handover_year":        data.get("handover_year"),
        "price_from":           data.get("price_from"),
        "price_to":             data.get("price_to"),
        "bedroom_min":          data.get("bedroom_min"),
        "bedroom_max":          data.get("bedroom_max"),
        "bedroom_types":        to_list(data.get("bedroom_types")),
        "size_sqft_min":        data.get("size_sqft_min"),
        "size_sqft_max":        data.get("size_sqft_max"),
        "payment_plan_summary": data.get("payment_plan_summary"),
        "payment_plan_detail":  data.get("payment_plan_detail"),
        "description_short":    data.get("description_short"),
        "description_long":     data.get("description_long"),
        "investment_potential": to_list(data.get("investment_potential")),
        "amenities":            to_list(data.get("amenities")),
        "lifestyle_tags":       to_list(data.get("lifestyle_tags")),
        "image_main":           all_urls[0] if all_urls else None,
        "images_all":           all_urls,
        "images_exterior":      img_result.get("exterior", []),
        "images_interior":      img_result.get("interior", []),
        "images_amenities":     img_result.get("amenities", []),
        "floor_plans":          floor_plans,
        "aeo_faq":              data.get("faqs", []),
        "latitude":             data.get("lat"),
        "longitude":            data.get("lng"),
        "geo_summary":          data.get("area"),
        "whatsapp_share_text":  data.get("developer"),
        "seo_title":            data.get("seo_title"),
        "seo_description":      data.get("seo_description"),
        "seo_keywords":         to_list(data.get("seo_keywords")),
        "data_source":          "official_brochure",
        "brochure_url":         "",
    }

    record = {k: v for k, v in record.items() if v is not None}
    res    = supabase.table("projects").insert(record).execute()
    row    = res.data[0]
    print(f"      ✓ Inserted! Code: {row.get('project_code','N/A')} | ID: {row['id']}")
    return row["id"]


# ─────────────────────────────────────────────────────────────────────────────
# FLASK DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────
def run_dashboard(structured_data: dict, image_list: list):
    app      = Flask(__name__)
    shutdown = threading.Event()

    @app.route("/")
    def index():
        return DASHBOARD_HTML

    @app.route("/temp_images/<filename>")
    def serve_image(filename):
        return send_from_directory(TEMP_DIR, filename)

    @app.route("/dashboard.js")
    def serve_js():
        return send_from_directory(Path(__file__).parent, "dashboard.js")

    @app.route("/api/data")
    def get_data():
        return jsonify({"structured": structured_data, "images": image_list})

    @app.route("/api/approve", methods=["POST"])
    def approve():
        try:
            payload     = request.json
            edited      = payload["data"]
            images      = payload["images"]       # [{filepath, category}, ...]
            fp_from_tab = payload["floor_plans"]  # [{filepath?, type, beds, baths, ...}, ...]

            print(f"\n{'='*52}")
            print(f"  Approved — processing...")
            print(f"{'='*52}")

            # Integer fields
            for f in ["price_from", "price_to", "size_sqft_min", "size_sqft_max",
                      "total_units", "completion_pct", "bedroom_min", "bedroom_max"]:
                edited[f] = safe_int(edited.get(f))

            # Float lat/lng
            for f in ["lat", "lng"]:
                v = edited.get(f)
                try:
                    edited[f] = float(v) if v not in (None, "") else None
                except Exception:
                    edited[f] = None

            # Textarea → list
            for f in ["amenities", "investment_potential"]:
                v = edited.get(f, "")
                if isinstance(v, str):
                    edited[f] = [l.strip() for l in v.splitlines() if l.strip()]

            # Comma → list
            for f in ["lifestyle_tags", "seo_keywords", "property_types"]:
                v = edited.get(f, "")
                if isinstance(v, str):
                    edited[f] = [t.strip() for t in v.split(",") if t.strip()]

            q, y = parse_handover(edited.get("handover"))
            edited["handover_quarter"] = q
            edited["handover_year"]    = y
            edited["bedroom_types"]    = build_bedroom_types(
                edited.get("bedroom_min"), edited.get("bedroom_max")
            )
            edited["slug"] = slugify(
                f"{edited.get('name','')} by {edited.get('developer','')} "
                f"{edited.get('area','')} {edited.get('emirate','')}"
            )

            slug = edited["slug"]

            # Upload images by category
            img_result = upload_images_by_category(images, slug)

            # Upload floor plan images
            final_fps = []
            for fp in fp_from_tab:
                item  = {k: v for k, v in fp.items() if k != "filepath"}
                fpath = fp.get("filepath", "")
                if fpath and os.path.exists(fpath):
                    try:
                        up = compress_image_if_needed(fpath)
                        r  = cloudinary.uploader.upload(
                            up,
                            folder          = f"projects/{slug}/floor_plans",
                            format          = "webp",
                            quality         = "auto",
                            use_filename    = True,
                            unique_filename = True,
                        )
                        item["image_url"] = r["secure_url"]
                        print(f"      ✓ Floor plan: {Path(fpath).name}")
                    except Exception as e:
                        print(f"      ✗ Floor plan upload: {e}")
                # Parse ints
                for k in ["beds", "baths", "sqft_min", "sqft_max"]:
                    item[k] = safe_int(item.get(k))
                final_fps.append(item)

            # Fall back to AI-extracted floor plans if no image-based ones
            if not final_fps:
                fps_ai = edited.get("floor_plans", [])
                if isinstance(fps_ai, list):
                    final_fps = fps_ai

            inserted_id = insert_to_supabase(edited, img_result, final_fps)

            shutil.rmtree(TEMP_DIR, ignore_errors=True)
            print(f"\n  Temp images deleted")
            print(f"\n{'='*52}")
            print(f"  DONE! {edited.get('name')} saved.")
            print(f"{'='*52}\n")

            shutdown.set()
            return jsonify({"success": True, "id": inserted_id})

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"success": False, "error": str(e)}), 500

    @app.route("/api/cancel", methods=["POST"])
    def cancel():
        shutil.rmtree(TEMP_DIR, ignore_errors=True)
        print("\n  Cancelled. Temp images deleted.\n")
        shutdown.set()
        return jsonify({"success": True})

    threading.Thread(
        target=lambda: (shutdown.wait(), os._exit(0)), daemon=True
    ).start()

    print(f"\n{'='*52}")
    print(f"  Review Dashboard ready!")
    print(f"  Opening http://localhost:5000")
    print(f"{'='*52}\n")
    threading.Timer(1.2, lambda: webbrowser.open("http://localhost:5000")).start()
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)


# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD HTML — 8 TABS
# ─────────────────────────────────────────────────────────────────────────────
DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dubai Portal — Review Dashboard</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --dark:#192537;--accent:#7fe2e3;--accent2:#5dd0d1;
  --bg:#f0f4f8;--white:#fff;--text:#192537;
  --muted:#7a8a99;--border:#e0e7ef;--red:#e05252;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:var(--bg);color:var(--text);font-size:14px}

/* HEADER */
header{
  background:var(--dark);color:#fff;padding:14px 28px;
  display:flex;align-items:center;gap:14px;
  position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.35)}
header h1{font-size:17px;font-weight:700;letter-spacing:-.3px}
.badge{background:var(--accent);color:var(--dark);padding:3px 13px;
  border-radius:20px;font-size:12px;font-weight:700}
.header-slug{margin-left:auto;color:#5a7080;font-size:11px;font-family:monospace}

/* TABS */
.tab-nav{
  background:var(--dark);display:flex;gap:2px;padding:0 28px;
  border-bottom:2px solid #253547;overflow-x:auto}
.tab-nav::-webkit-scrollbar{height:3px}
.tab-nav::-webkit-scrollbar-thumb{background:var(--accent)}
.tab-btn{
  padding:10px 16px;font-size:12px;font-weight:600;color:#7a8a99;
  border:none;background:transparent;cursor:pointer;white-space:nowrap;
  border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s}
.tab-btn:hover{color:var(--accent)}
.tab-btn.active{color:var(--accent);border-bottom-color:var(--accent)}

/* PANELS */
.tab-panel{display:none;padding:22px 28px 110px;max-width:1400px;margin:0 auto}
.tab-panel.active{display:block}

/* CARD */
.card{background:var(--white);border-radius:10px;padding:22px;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:16px}
.card h3{font-size:11px;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.8px;
  margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid var(--accent)}

/* FORM GRID */
.row-2{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:13px}
.row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;margin-bottom:13px}
.row-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:13px;margin-bottom:13px}
.field{margin-bottom:13px}
label{display:block;font-size:10px;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
input,select,textarea{
  width:100%;padding:8px 11px;border:1.5px solid var(--border);border-radius:7px;
  font-size:13px;color:var(--text);background:#f9fbfc;font-family:inherit;
  transition:border-color .15s}
input:focus,select:focus,textarea:focus{
  outline:none;border-color:var(--accent);background:var(--white)}
textarea{resize:vertical}
.hint{font-size:10px;color:#aab4be;margin-top:3px}
.char-count{font-size:10px;color:var(--muted);text-align:right;margin-top:2px}

/* TABLE */
.data-table{width:100%;border-collapse:collapse;margin-bottom:10px}
.data-table th{font-size:10px;font-weight:700;color:var(--muted);
  text-transform:uppercase;padding:6px 9px;text-align:left;
  border-bottom:1.5px solid var(--border)}
.data-table td{padding:4px 6px}
.data-table td input{padding:5px 8px;font-size:13px}

.del-btn{background:none;border:1px solid #ddd;color:var(--muted);
  border-radius:5px;padding:3px 8px;cursor:pointer;font-size:12px}
.del-btn:hover{background:var(--red);color:#fff;border-color:var(--red)}
.add-btn{background:none;border:1.5px dashed var(--accent);color:var(--accent);
  border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600}
.add-btn:hover{background:var(--accent);color:var(--dark)}

/* IMAGE GRID */
.cat-bar{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;
  padding:12px 14px;background:var(--dark);border-radius:8px}
.cat-stat{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#8fa0b0}
.cat-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex-shrink:0}
.d-ext{background:#4caf50}.d-int{background:#2196f3}
.d-ame{background:#ff9800}.d-fp{background:#9c27b0}.d-skip{background:#9e9e9e}
.cat-stat strong{color:var(--accent)}

.img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.img-card{border:2px solid var(--border);border-radius:8px;overflow:hidden;background:var(--white)}
.img-card img{width:100%;height:120px;object-fit:cover;display:block;cursor:zoom-in;transition:opacity .1s}
.img-card img:hover{opacity:.85}
.img-info{padding:5px 8px;font-size:10px;color:var(--muted);background:#f9fbfc}
.img-info strong{display:block;color:var(--text);font-size:11px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cat-btns{display:flex;flex-wrap:wrap;gap:3px;padding:5px 7px;background:#eef1f5}
.cb{padding:3px 7px;font-size:10px;font-weight:600;border:1.5px solid var(--border);
  border-radius:4px;cursor:pointer;background:var(--white);color:var(--muted);transition:all .1s}
.cb:hover{border-color:#aaa}
.cb.act-exterior  {background:#4caf50;color:#fff;border-color:#4caf50}
.cb.act-interior  {background:#2196f3;color:#fff;border-color:#2196f3}
.cb.act-amenities {background:#ff9800;color:#fff;border-color:#ff9800}
.cb.act-floor_plan{background:#9c27b0;color:#fff;border-color:#9c27b0}
.cb.act-skip      {background:#9e9e9e;color:#fff;border-color:#9e9e9e}

/* FLOOR PLANS */
.fp-row{display:flex;gap:12px;align-items:flex-start;
  padding:12px;border:1.5px solid var(--border);border-radius:8px;
  margin-bottom:10px;background:#fafcff}
.fp-thumb{width:100px;height:68px;object-fit:cover;border-radius:5px;
  flex-shrink:0;cursor:zoom-in}
.fp-fields{flex:1}
.fp-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:8px;margin-top:6px}
.fp-name{font-size:11px;color:var(--muted);font-weight:600}
.empty-note{color:var(--muted);font-style:italic;padding:16px 0}

/* FAQ */
.faq-row{display:flex;gap:10px;align-items:flex-start;
  padding:10px;border:1.5px solid var(--border);border-radius:7px;
  margin-bottom:7px;background:#fafcff}
.faq-num{width:24px;height:24px;background:var(--dark);color:var(--accent);
  border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;flex-shrink:0;margin-top:2px}
.faq-fields{flex:1;display:flex;flex-direction:column;gap:5px}
.faq-fields input,.faq-fields textarea{font-size:13px}

/* MAP */
#map{height:420px;border-radius:8px;border:1.5px solid var(--border)}
.geocode-row{display:flex;gap:8px;margin-bottom:12px}
.geocode-btn{background:var(--dark);color:var(--accent);border:none;
  padding:8px 16px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600}
.geocode-btn:hover{background:#253547}

/* BOTTOM BAR */
.bottom-bar{
  position:fixed;bottom:0;left:0;right:0;background:var(--dark);
  padding:11px 28px;display:flex;align-items:center;justify-content:space-between;
  box-shadow:0 -2px 12px rgba(0,0,0,.3);z-index:200}
.btn-approve{background:var(--accent);color:var(--dark);border:none;
  padding:10px 30px;border-radius:8px;font-size:14px;font-weight:700;
  cursor:pointer;transition:all .15s}
.btn-approve:hover{background:var(--accent2);transform:translateY(-1px)}
.btn-approve:disabled{background:#4a5a6a;color:#7a8a99;cursor:not-allowed;transform:none}
.btn-cancel{background:transparent;color:var(--muted);border:1.5px solid #3a4f63;
  padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer}
.btn-cancel:hover{color:#fff;border-color:#fff}
.bar-info{color:var(--accent);font-size:12px;font-weight:600;text-align:center}

/* MODAL + OVERLAY */
#img-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);
  z-index:500;align-items:center;justify-content:center;cursor:zoom-out}
#img-modal.open{display:flex}
#img-modal img{max-width:92vw;max-height:92vh;border-radius:6px}
#overlay{display:none;position:fixed;inset:0;background:rgba(25,37,55,.92);
  z-index:400;flex-direction:column;align-items:center;justify-content:center;gap:16px}
#overlay.open{display:flex}
.spinner{width:42px;height:42px;border:4px solid #3a4f63;border-top-color:var(--accent);
  border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#overlay p{color:#fff;font-size:15px;font-weight:500}
</style>
</head>
<body>

<header>
  <h1>Dubai Portal &mdash; Review Dashboard</h1>
  <span class="badge" id="project-badge">Loading...</span>
  <span class="header-slug" id="header-slug"></span>
</header>

<div class="tab-nav">
  <button class="tab-btn active" onclick="switchTab(0)">1 &middot; Basic Info</button>
  <button class="tab-btn"        onclick="switchTab(1)">2 &middot; Pricing</button>
  <button class="tab-btn"        onclick="switchTab(2)">3 &middot; Images</button>
  <button class="tab-btn"        onclick="switchTab(3)">4 &middot; Floor Plans</button>
  <button class="tab-btn"        onclick="switchTab(4)">5 &middot; Amenities</button>
  <button class="tab-btn"        onclick="switchTab(5)">6 &middot; FAQ</button>
  <button class="tab-btn"        onclick="switchTab(6)">7 &middot; SEO + GEO + AEO</button>
  <button class="tab-btn"        onclick="switchTab(7)">8 &middot; Map</button>
</div>

<!-- ══ TAB 1: BASIC INFO ═══════════════════════════════════════════ -->
<div class="tab-panel active" id="tab-0">
  <div class="card">
    <h3>Identity</h3>
    <div class="row-2">
      <div class="field"><label>Project Name</label><input type="text" id="f-name"></div>
      <div class="field"><label>Developer</label><input type="text" id="f-developer"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>Area / Community</label><input type="text" id="f-area"></div>
      <div class="field"><label>Emirate</label>
        <select id="f-emirate">
          <option>Dubai</option><option>Abu Dhabi</option><option>Sharjah</option>
          <option>Ras Al Khaimah</option><option>Ajman</option>
          <option>Fujairah</option><option>Umm Al Quwain</option>
        </select>
      </div>
    </div>
    <div class="field"><label>Tagline</label><input type="text" id="f-tagline"></div>
  </div>
  <div class="card">
    <h3>Descriptions</h3>
    <div class="field">
      <label>Short Description &mdash; 2&ndash;3 sentences, listing header</label>
      <textarea id="f-desc-short" rows="3"></textarea>
    </div>
    <div class="field">
      <label>Long Description &mdash; 3&ndash;5 paragraphs, detail page</label>
      <textarea id="f-desc-long" rows="8"></textarea>
    </div>
  </div>
  <div class="card">
    <h3>Project Details</h3>
    <div class="row-4">
      <div class="field"><label>Status</label>
        <select id="f-status">
          <option value="off_plan">Off Plan</option>
          <option value="under_construction">Under Construction</option>
          <option value="ready">Ready</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div class="field"><label>Total Units</label><input type="number" id="f-units"></div>
      <div class="field"><label>Completion %</label><input type="number" id="f-completion" min="0" max="100"></div>
      <div class="field"><label>Permit Number</label><input type="text" id="f-permit"></div>
    </div>
    <div class="field">
      <label>Property Types (comma separated)</label>
      <input type="text" id="f-property-types" placeholder="Apartment, Penthouse, Villa">
    </div>
  </div>
</div>

<!-- ══ TAB 2: PRICING ══════════════════════════════════════════════ -->
<div class="tab-panel" id="tab-1">
  <div class="card">
    <h3>Pricing &amp; Sizes</h3>
    <div class="row-2">
      <div class="field"><label>Price From (AED)</label><input type="number" id="f-price-from"></div>
      <div class="field"><label>Price To (AED)</label><input type="number" id="f-price-to"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>Size Min (sqft)</label><input type="number" id="f-size-min"></div>
      <div class="field"><label>Size Max (sqft)</label><input type="number" id="f-size-max"></div>
    </div>
    <div class="row-3">
      <div class="field">
        <label>Bedroom Min</label>
        <input type="number" id="f-bed-min" min="0" max="20">
        <div class="hint">0 = Studio</div>
      </div>
      <div class="field"><label>Bedroom Max</label><input type="number" id="f-bed-max" min="0" max="20"></div>
      <div class="field">
        <label>Handover</label>
        <input type="text" id="f-handover" placeholder="Q4 2027">
        <div class="hint">Format: Q4 2027</div>
      </div>
    </div>
  </div>
  <div class="card">
    <h3>Payment Plan</h3>
    <div class="row-2" style="margin-bottom:18px">
      <div class="field"><label>Summary</label><input type="text" id="f-payment" placeholder="60/40"></div>
      <div></div>
    </div>
    <table class="data-table">
      <thead><tr><th>Stage</th><th style="width:100px">Percentage %</th><th style="width:44px"></th></tr></thead>
      <tbody id="payment-tbody"></tbody>
    </table>
    <button class="add-btn" onclick="addPaymentRow()">+ Add Stage</button>
  </div>
</div>

<!-- ══ TAB 3: IMAGES ═══════════════════════════════════════════════ -->
<div class="tab-panel" id="tab-2">
  <div class="card">
    <h3>Images &mdash; Assign a Category to Each</h3>
    <div class="cat-bar">
      <span class="cat-stat"><span class="cat-dot d-ext"></span>Exterior: <strong id="cnt-exterior">0</strong></span>
      <span class="cat-stat"><span class="cat-dot d-int"></span>Interior: <strong id="cnt-interior">0</strong></span>
      <span class="cat-stat"><span class="cat-dot d-ame"></span>Amenities: <strong id="cnt-amenities">0</strong></span>
      <span class="cat-stat"><span class="cat-dot d-fp"></span>Floor Plan: <strong id="cnt-floor_plan">0</strong></span>
      <span class="cat-stat"><span class="cat-dot d-skip"></span>Skip: <strong id="cnt-skip">0</strong></span>
    </div>
    <div class="img-grid" id="img-grid"></div>
  </div>
</div>

<!-- ══ TAB 4: FLOOR PLANS ══════════════════════════════════════════ -->
<div class="tab-panel" id="tab-3">
  <div class="card">
    <h3>Tagged Floor Plan Images</h3>
    <p class="hint" style="margin-bottom:12px">
      Images tagged &ldquo;Floor Plan&rdquo; in Tab 3 appear here. Fill in unit details.
    </p>
    <div id="fp-img-container">
      <p class="empty-note">No floor plan images tagged yet &mdash; go to Tab 3 and tag some.</p>
    </div>
  </div>
  <div class="card">
    <h3>AI-Extracted Unit Types</h3>
    <p class="hint" style="margin-bottom:12px">
      Unit types extracted from the brochure. Saved even without images.
    </p>
    <table class="data-table">
      <thead><tr><th>Type</th><th>Beds</th><th>Baths</th><th>Sqft Min</th><th>Sqft Max</th><th style="width:44px"></th></tr></thead>
      <tbody id="fp-ai-tbody"></tbody>
    </table>
    <button class="add-btn" onclick="addFPRow()">+ Add Unit Type</button>
  </div>
</div>

<!-- ══ TAB 5: AMENITIES ════════════════════════════════════════════ -->
<div class="tab-panel" id="tab-4">
  <div class="card">
    <h3>Amenities &amp; Investment Highlights</h3>
    <div class="row-2">
      <div class="field">
        <label>Amenities (one per line)</label>
        <textarea id="f-amenities" rows="12"
          placeholder="Swimming Pool&#10;Gymnasium&#10;Concierge&#10;Kids Play Area&#10;Rooftop Lounge"></textarea>
      </div>
      <div class="field">
        <label>Investment Potential (one per line)</label>
        <textarea id="f-investment" rows="12"
          placeholder="Strong rental yields&#10;Near Wynn Resort&#10;Freehold ownership&#10;High capital appreciation"></textarea>
      </div>
    </div>
  </div>
  <div class="card">
    <h3>Lifestyle Tags</h3>
    <div class="field">
      <label>Tags (comma separated)</label>
      <input type="text" id="f-lifestyle" placeholder="beachfront, waterfront, island_living">
      <div class="hint">
        Options: beachfront &middot; waterfront &middot; golf_course &middot; equestrian &middot; city_center &middot;
        island_living &middot; mountain_view &middot; forest_living &middot; marina_view &middot;
        downtown &middot; desert_living &middot; ski_in_ski_out
      </div>
    </div>
  </div>
</div>

<!-- ══ TAB 6: FAQ ══════════════════════════════════════════════════ -->
<div class="tab-panel" id="tab-5">
  <div class="card">
    <h3>Frequently Asked Questions &mdash; 15 AI-generated, edit as needed</h3>
    <div id="faq-container"></div>
    <button class="add-btn" style="margin-top:8px" onclick="addFAQRow()">+ Add Question</button>
  </div>
</div>

<!-- ══ TAB 7: SEO + GEO + AEO ═════════════════════════════════════ -->
<div class="tab-panel" id="tab-6">
  <div class="card">
    <h3>SEO</h3>
    <div class="field">
      <label>SEO Title <span style="font-weight:400;color:#aab4be;text-transform:none">(max 60 chars)</span></label>
      <input type="text" id="f-seo-title" maxlength="70" oninput="charCount(this,'cc-seo-title',60)">
      <div class="char-count" id="cc-seo-title">0 / 60</div>
    </div>
    <div class="field">
      <label>Meta Description <span style="font-weight:400;color:#aab4be;text-transform:none">(150&ndash;160 chars)</span></label>
      <textarea id="f-seo-desc" rows="3" maxlength="170" oninput="charCount(this,'cc-seo-desc',160)"></textarea>
      <div class="char-count" id="cc-seo-desc">0 / 160</div>
    </div>
    <div class="field">
      <label>Keywords (comma separated)</label>
      <input type="text" id="f-seo-keywords" placeholder="dubai off plan, project name dubai, buy apartment dubai">
    </div>
  </div>
  <div class="card">
    <h3>GEO &mdash; Geographic Meta Tags</h3>
    <div class="row-2">
      <div class="field">
        <label>Geo.region <span style="font-weight:400;color:#aab4be;text-transform:none">(ISO 3166)</span></label>
        <input type="text" id="f-geo-region" placeholder="AE-DU">
        <div class="hint">AE-DU = Dubai &middot; AE-AZ = Abu Dhabi &middot; AE-SH = Sharjah &middot; AE-RK = Ras Al Khaimah</div>
      </div>
      <div class="field">
        <label>Geo.placename</label>
        <input type="text" id="f-geo-placename" placeholder="Dubai, UAE">
      </div>
    </div>
  </div>
  <div class="card">
    <h3>AEO &mdash; Answer Engine Optimisation</h3>
    <div class="field">
      <label>
        Voice / AI Search Snippet
        <span style="font-weight:400;color:#aab4be;text-transform:none">
          &mdash; 1 sentence, shown by AI assistants &amp; voice search
        </span>
      </label>
      <textarea id="f-aeo-snippet" rows="3"
        placeholder="e.g. Elysian Shores by Emaar is a luxury off-plan apartment development on Al Marjan Island, Ras Al Khaimah, starting from AED 1.95M with handover in Q4 2027."></textarea>
      <div class="hint" style="margin-top:5px">
        Formula: [Project] by [Developer] is a [type] development in [location] starting from AED [price] with handover in [date].
      </div>
    </div>
  </div>
</div>

<!-- ══ TAB 8: MAP ══════════════════════════════════════════════════ -->
<div class="tab-panel" id="tab-7">
  <div class="card">
    <h3>Location &mdash; Drag the marker to the exact position</h3>
    <div class="geocode-row">
      <input type="text" id="f-address"
        placeholder="Search e.g. Al Marjan Island, Ras Al Khaimah" style="flex:1">
      <button class="geocode-btn" onclick="geocodeAddress()">&#128269; Search Map</button>
    </div>
    <div id="map"></div>
    <div class="row-2" style="margin-top:14px">
      <div class="field"><label>Latitude</label><input type="text" id="f-lat" oninput="syncMap()"></div>
      <div class="field"><label>Longitude</label><input type="text" id="f-lng" oninput="syncMap()"></div>
    </div>
  </div>
</div>

<!-- BOTTOM BAR -->
<div class="bottom-bar">
  <button class="btn-cancel" onclick="cancelAll()">Cancel</button>
  <span class="bar-info" id="bar-info">Review all tabs &mdash; then approve</span>
  <button class="btn-approve" id="btn-approve" onclick="approveAll()">
    &#10003; Approve &amp; Save to Supabase
  </button>
</div>

<!-- IMAGE MODAL -->
<div id="img-modal" onclick="closeModal()"><img id="modal-img" src="" alt=""></div>

<!-- PROCESSING OVERLAY -->
<div id="overlay">
  <div class="spinner"></div>
  <p id="overlay-msg">Processing...</p>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="/dashboard.js"></script>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print("Usage: python extract.py /path/to/brochure.pdf")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)

    print(f"\n{'='*52}")
    print(f"  Dubai Portal — PDF Extractor v3")
    print(f"  File: {Path(pdf_path).name}")
    print(f"{'='*52}")

    try:
        raw_text   = extract_text(pdf_path)
        image_list = extract_images_to_temp(pdf_path)

        # Extract structured data (includes slug, name, developer for OPR search)
        structured = structure_with_openai(raw_text)

        # Supplement from OPR.ae — merge only if fields are missing
        opr_data = scrape_opr_ae(
            structured.get("name", ""),
            structured.get("developer", ""),
        )
        if opr_data.get("opr_description") and not structured.get("description_long"):
            structured["description_long"] = opr_data["opr_description"]
        if opr_data.get("opr_amenities") and not structured.get("amenities"):
            structured["amenities"] = opr_data["opr_amenities"]

        run_dashboard(structured, image_list)

    except json.JSONDecodeError as e:
        print(f"\n  OpenAI returned invalid JSON: {e}")
        print("  Try again — GPT output can occasionally be malformed")
    except Exception:
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
