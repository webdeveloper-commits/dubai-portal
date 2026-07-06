#!/usr/bin/env python3
"""
Elysian Admin Dashboard  ·  admin.py
Always-on portal management tool.

Run:    python admin.py
Access: http://localhost:5001
Login:  see ADMIN_USERNAME / ADMIN_PASSWORD in .env
"""

import os, sys, json, re, subprocess, threading, time, uuid
from pathlib import Path
from datetime import datetime

from flask import Flask, render_template_string, request, redirect, url_for, session, flash, jsonify
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# ── Load env ──────────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_KEY"]
OPENAI_KEY     = os.environ.get("OPENAI_KEY", os.environ.get("OPENAI_API_KEY", ""))
ANTHROPIC_KEY  = os.environ.get("ANTHROPIC_KEY", "")
ADMIN_USER    = os.environ.get("ADMIN_USERNAME", "elysian")
ADMIN_PASS    = os.environ.get("ADMIN_PASSWORD", "Dubai2026@")
UPLOAD_DIR       = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

CLOUDINARY_CLOUD = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_KEY   = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_SEC   = os.environ.get("CLOUDINARY_API_SECRET", "")
PEXELS_KEY       = os.environ.get("PEXELS_KEY", "")

from supabase import create_client
db = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_image_to_cloudinary(url: str, folder: str = "scraped-projects"):
    try:
        import cloudinary, cloudinary.uploader
        cloudinary.config(cloud_name=CLOUDINARY_CLOUD, api_key=CLOUDINARY_KEY, api_secret=CLOUDINARY_SEC)
        r = cloudinary.uploader.upload(url, folder=folder, resource_type="image", format="webp", quality="auto")
        return r.get("secure_url")
    except Exception:
        return None

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "elysian-admin-secret-2026")

# ── Background job tracker ────────────────────────────────────────────────────
jobs: dict[str, dict] = {}   # job_id → {status, log, pid}

# ─────────────────────────────────────────────────────────────────────────────
# HTML HELPERS
# ─────────────────────────────────────────────────────────────────────────────

BRAND = {"dark": "#192537", "teal": "#7fe2e3", "grey": "#7a8a9e", "bg": "#f4f6f9"}

def page(title: str, content: str, active: str = "") -> str:
    nav_items = [
        ("dashboard",  "📊", "Dashboard",   "/"),
        ("projects",   "🏢", "Projects",    "/projects"),
        ("blog",       "✍️",  "Blog",        "/blog"),
        ("developers", "👷", "Developers",  "/developers"),
        ("areas",      "🗺️",  "Area Guides", "/areas"),
        ("seo",        "🔍", "SEO Checker", "/seo"),
        ("pagerank",   "📈", "Page Rank",   "/pagerank"),
    ]
    nav_html = ""
    for key, icon, label, href in nav_items:
        is_active = "background:rgba(127,226,227,0.12);color:#7fe2e3;" if active == key else "color:rgba(255,255,255,0.55);"
        nav_html += f"""
        <a href="{href}" style="display:flex;align-items:center;gap:10px;padding:11px 20px;
           border-radius:10px;text-decoration:none;font-family:Verdana;font-size:13px;
           margin-bottom:2px;transition:all 0.15s;{is_active}">
          <span style="font-size:16px">{icon}</span>{label}
        </a>"""

    return render_template_string(f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title} — Elysian Admin</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:Verdana,sans-serif;background:{BRAND["bg"]};color:{BRAND["dark"]};display:flex;min-height:100vh}}
    a{{color:inherit;text-decoration:none}}
    input,select,textarea{{font-family:Verdana,sans-serif;font-size:13px}}
    .card{{background:white;border-radius:16px;padding:28px;box-shadow:0 2px 16px rgba(25,37,55,0.06);border:1px solid rgba(25,37,55,0.06)}}
    .btn{{display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:10px;
          font-family:Verdana;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:all 0.2s}}
    .btn-primary{{background:{BRAND["dark"]};color:white}}
    .btn-primary:hover{{background:{BRAND["teal"]};color:{BRAND["dark"]}}}
    .btn-teal{{background:{BRAND["teal"]};color:{BRAND["dark"]}}}
    .btn-teal:hover{{opacity:0.85}}
    .btn-outline{{background:transparent;color:{BRAND["dark"]};border:1.5px solid #ddd}}
    .btn-outline:hover{{border-color:{BRAND["teal"]};color:{BRAND["teal"]}}}
    .field{{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}}
    .field label{{font-size:11px;color:{BRAND["grey"]};letter-spacing:0.05em;text-transform:uppercase;font-weight:700}}
    .field input,.field select,.field textarea{{
      padding:11px 14px;border:1.5px solid #e0e0e0;border-radius:10px;
      background:white;color:{BRAND["dark"]};outline:none;width:100%;transition:border-color 0.2s}}
    .field input:focus,.field select:focus,.field textarea:focus{{border-color:{BRAND["teal"]}}}
    .badge{{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.08em}}
    .badge-teal{{background:rgba(127,226,227,0.15);color:{BRAND["dark"]}}}
    .badge-green{{background:#dcfce7;color:#166534}}
    .badge-orange{{background:#fff3cd;color:#7c4a00}}
    .flash-msg{{padding:12px 18px;border-radius:10px;margin-bottom:20px;font-size:13px}}
    .flash-ok{{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}}
    .flash-err{{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}}
    table{{width:100%;border-collapse:collapse}}
    th{{text-align:left;padding:12px 16px;font-size:11px;text-transform:uppercase;
        letter-spacing:0.08em;color:{BRAND["grey"]};border-bottom:2px solid #f0f0f0}}
    td{{padding:14px 16px;border-bottom:1px solid #f8f8f8;font-size:13px;vertical-align:middle}}
    tr:hover td{{background:#fafcfc}}
  </style>
</head>
<body>
  <!-- Sidebar -->
  <nav style="width:240px;flex-shrink:0;background:{BRAND["dark"]};min-height:100vh;
              padding:24px 12px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto">
    <div style="padding:0 8px;margin-bottom:32px">
      <div style="font-family:Montserrat,sans-serif;font-weight:900;font-size:20px;color:white;letter-spacing:-0.02em">
        ELYSIAN
      </div>
      <div style="font-size:9px;color:{BRAND["teal"]};letter-spacing:0.3em;margin-top:2px">ADMIN PORTAL</div>
    </div>
    {nav_html}
    <div style="margin-top:auto;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08)">
      <a href="/logout" style="display:flex;align-items:center;gap:10px;padding:11px 20px;
         border-radius:10px;font-family:Verdana;font-size:12px;color:rgba(255,255,255,0.4);
         text-decoration:none">🚪 Log Out</a>
    </div>
  </nav>

  <!-- Main -->
  <div style="flex:1;padding:32px;min-width:0">
    <div style="max-width:1200px;margin:0 auto">
      <!-- Page header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px">
        <h1 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:24px;
                   color:{BRAND["dark"]};letter-spacing:-0.02em">{title}</h1>
        <span style="font-family:Verdana;font-size:11px;color:{BRAND["grey"]}">
          {datetime.now().strftime("%d %b %Y, %H:%M")}
        </span>
      </div>
      <!-- Flash messages -->
      {{% with messages = get_flashed_messages(with_categories=true) %}}
      {{% if messages %}}
        {{% for cat, msg in messages %}}
          <div class="flash-msg {{% if cat=='error' %}}flash-err{{% else %}}flash-ok{{% endif %}}">{{{{ msg }}}}</div>
        {{% endfor %}}
      {{% endif %}}
      {{% endwith %}}
      <!-- Content -->
      {content}
    </div>
  </div>
</body>
</html>""")


# ─────────────────────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────────────────────

LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Login — Elysian Admin</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Verdana,sans-serif;background:#0d1a27;
         display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{background:white;border-radius:20px;padding:40px;width:100%;max-width:400px;box-shadow:0 24px 80px rgba(0,0,0,0.4)}
    .field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
    .field label{font-size:11px;color:#7a8a9e;letter-spacing:0.05em;text-transform:uppercase;font-weight:700}
    .field input{padding:12px 14px;border:1.5px solid #e0e0e0;border-radius:10px;
                 font-family:Verdana;font-size:13px;color:#192537;outline:none}
    .field input:focus{border-color:#7fe2e3}
    .btn{width:100%;padding:13px;border-radius:10px;background:#192537;color:white;
         font-family:Verdana;font-size:13px;font-weight:700;cursor:pointer;border:none;margin-top:8px}
    .btn:hover{background:#7fe2e3;color:#192537}
    .err{background:#fee2e2;color:#991b1b;border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:16px}
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-family:Montserrat,sans-serif;font-weight:900;font-size:26px;color:#192537;letter-spacing:-0.02em">ELYSIAN</div>
      <div style="font-size:9px;color:#7fe2e3;letter-spacing:0.3em;margin-top:4px">ADMIN PORTAL</div>
    </div>
    {% if error %}<div class="err">{{ error }}</div>{% endif %}
    <form method="POST">
      <div class="field"><label>Username</label><input name="username" type="text" autofocus placeholder="elysian" required></div>
      <div class="field"><label>Password</label><input name="password" type="password" placeholder="••••••••" required></div>
      <button class="btn" type="submit">Sign In →</button>
    </form>
  </div>
</body>
</html>"""

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        u = request.form.get("username", "").strip()
        p = request.form.get("password", "")
        if u == ADMIN_USER and p == ADMIN_PASS:
            session["logged_in"] = True
            session["user"] = u
            return redirect(url_for("dashboard"))
        error = "Incorrect username or password."
    return render_template_string(LOGIN_HTML, error=error)

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD HOME
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/")
@login_required
def dashboard():
    try:
        projects   = db.table("projects").select("id,name,status,created_at", count="exact").execute()
        developers = db.table("developers").select("id", count="exact").execute()
        areas      = db.table("areas").select("id", count="exact").execute()
        blogs      = db.table("blog_posts").select("id", count="exact").execute()
        n_proj     = projects.count  or 0
        n_dev      = developers.count or 0
        n_area     = areas.count     or 0
        n_blog     = blogs.count     or 0
        recent     = (projects.data or [])[:5]
    except Exception as e:
        n_proj = n_dev = n_area = n_blog = 0
        recent = []

    stat = lambda val, label, color: f"""
      <div class="card" style="border-top:4px solid {color}">
        <div style="font-family:Montserrat,sans-serif;font-weight:800;font-size:32px;
                    color:{BRAND['dark']};letter-spacing:-0.03em">{val}</div>
        <div style="font-size:11px;color:{BRAND['grey']};margin-top:4px;
                    text-transform:uppercase;letter-spacing:0.08em">{label}</div>
      </div>"""

    rows = "".join(f"""<tr>
      <td><strong>{r.get('name','—')}</strong></td>
      <td><span class="badge badge-teal">{r.get('status','—')}</span></td>
      <td style="color:{BRAND['grey']};font-size:11px">{(r.get('created_at') or '')[:10]}</td>
    </tr>""" for r in recent)

    content = f"""
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:32px">
      {stat(n_proj, "Projects", BRAND["teal"])}
      {stat(n_dev,  "Developers", "#6366f1")}
      {stat(n_area, "Area Guides", "#f97316")}
      {stat(n_blog, "Blog Posts", "#10b981")}
    </div>

    <div class="card">
      <h2 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:16px;
                 margin-bottom:20px;color:{BRAND['dark']}">Recent Projects</h2>
      <table>
        <thead><tr><th>Name</th><th>Status</th><th>Added</th></tr></thead>
        <tbody>{rows if rows else '<tr><td colspan="3" style="color:#bbb;text-align:center;padding:32px">No projects yet</td></tr>'}</tbody>
      </table>
      <div style="margin-top:20px;display:flex;gap:12px">
        <a href="/projects/upload" class="btn btn-primary">+ Upload Brochure</a>
        <a href="/projects/scrape" class="btn btn-teal">🌐 Scrape from Web</a>
      </div>
    </div>"""

    return page("Dashboard", content, "dashboard")


# ─────────────────────────────────────────────────────────────────────────────
# PROJECTS — LIST
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/projects")
@login_required
def projects():
    try:
        res  = db.table("projects").select("id,project_code,name,status,price_from,handover_year,created_at,is_published").order("created_at", desc=True).execute()
        rows_data = res.data or []
    except Exception:
        rows_data = []

    rows = ""
    for r in rows_data:
        pub = "✅ Live" if r.get("is_published") else "⬜ Draft"
        rows += f"""<tr>
          <td style="font-size:11px;color:{BRAND['grey']}">{r.get('project_code','—')}</td>
          <td><strong>{r.get('name','—')}</strong></td>
          <td><span class="badge badge-teal">{r.get('status','—')}</span></td>
          <td>AED {(r.get('price_from') or 0):,.0f}</td>
          <td>{r.get('handover_year','—')}</td>
          <td>{pub}</td>
          <td style="font-size:11px;color:{BRAND['grey']}">{(r.get('created_at') or '')[:10]}</td>
        </tr>"""

    content = f"""
    <div style="display:flex;gap:12px;margin-bottom:24px">
      <a href="/projects/upload" class="btn btn-primary">📄 Upload from Brochure</a>
      <a href="/projects/scrape" class="btn btn-teal">🌐 Scrape from Web</a>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Price From</th><th>Handover</th><th>Published</th><th>Added</th></tr></thead>
        <tbody>{rows if rows else '<tr><td colspan="7" style="color:#bbb;text-align:center;padding:40px">No projects yet. Upload a brochure or scrape from the web.</td></tr>'}</tbody>
      </table>
    </div>"""

    return page("Projects", content, "projects")


# ─────────────────────────────────────────────────────────────────────────────
# PROJECTS — UPLOAD BROCHURE
# ─────────────────────────────────────────────────────────────────────────────

UPLOAD_CONTENT = """
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">

  <!-- Upload form -->
  <div class="card">
    <h2 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:18px;
               color:{dark};margin-bottom:8px">Upload a PDF Brochure</h2>
    <p style="font-size:12px;color:{grey};line-height:1.8;margin-bottom:24px">
      Select a developer brochure PDF. The system will extract all text and images,
      run them through GPT-4, scrape OPR.ae for extra data, then open the
      <strong>review dashboard</strong> so you can verify everything before saving.
    </p>
    <form method="POST" enctype="multipart/form-data" id="uploadForm">
      <div class="field">
        <label>PDF Brochure File</label>
        <input type="file" name="pdf" accept=".pdf" required
               style="padding:10px;border:2px dashed #e0e0e0;border-radius:10px;cursor:pointer">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">
        🚀 Start Processing
      </button>
    </form>
    <div id="status" style="display:none;margin-top:20px;padding:16px;
         background:#f0fbfb;border-radius:10px;border:1px solid {teal}">
      <div style="font-size:13px;font-weight:700;color:{dark};margin-bottom:8px">
        ⏳ Processing your brochure...
      </div>
      <div style="font-size:12px;color:{grey};line-height:1.8">
        This takes 30–60 seconds. The review dashboard will open automatically
        at <a href="http://localhost:5000" target="_blank" style="color:{teal}">localhost:5000</a>
        — or click the button below once processing starts.
      </div>
      <a href="http://localhost:5000" target="_blank"
         style="display:inline-block;margin-top:14px;padding:10px 20px;
                background:{dark};color:white;border-radius:8px;font-size:12px;font-weight:700">
        Open Review Dashboard →
      </a>
    </div>
  </div>

  <!-- Instructions -->
  <div class="card">
    <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:16px;
               color:{dark};margin-bottom:20px">How it works</h3>
    <div style="display:flex;flex-direction:column;gap:16px">
""".replace("{dark}", BRAND["dark"]).replace("{grey}", BRAND["grey"]).replace("{teal}", BRAND["teal"])

STEPS = [
    ("1", "Upload PDF", "Select a developer brochure PDF from your computer."),
    ("2", "Auto-Extract", "System extracts all text and images from the PDF."),
    ("3", "GPT Analysis", "GPT-4o-mini structures the data: prices, units, floor plans, FAQs."),
    ("4", "OPR.ae Scrape", "Automatically scrapes OPR.ae for additional project info."),
    ("5", "Review Dashboard", "Opens at localhost:5000 — review all 8 tabs, tag images."),
    ("6", "Approve & Save", "Click Approve → images upload to Cloudinary, data saves to Supabase."),
]

for num, title, desc in STEPS:
    UPLOAD_CONTENT += f"""
      <div style="display:flex;gap:14px;align-items:flex-start">
        <div style="width:28px;height:28px;border-radius:50%;background:{BRAND['dark']};
                    color:{BRAND['teal']};display:flex;align-items:center;justify-content:center;
                    font-size:11px;font-weight:700;flex-shrink:0">{num}</div>
        <div>
          <div style="font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;
                      color:{BRAND['dark']};margin-bottom:3px">{title}</div>
          <div style="font-size:12px;color:{BRAND['grey']};line-height:1.6">{desc}</div>
        </div>
      </div>"""

UPLOAD_CONTENT += """
    </div>
  </div>
</div>
<script>
document.getElementById('uploadForm').addEventListener('submit', function() {
  setTimeout(function() {
    document.getElementById('status').style.display = 'block';
  }, 500);
});
</script>"""

@app.route("/projects/upload", methods=["GET", "POST"])
@login_required
def upload_brochure():
    if request.method == "POST":
        f = request.files.get("pdf")
        if not f or not f.filename.endswith(".pdf"):
            flash("Please select a valid PDF file.", "error")
            return redirect(url_for("upload_brochure"))

        fname   = secure_filename(f.filename)
        save_to = UPLOAD_DIR / fname
        f.save(str(save_to))

        extract_py = Path(__file__).parent / "extract.py"
        python_bin = sys.executable

        def run():
            subprocess.Popen(
                [python_bin, str(extract_py), str(save_to)],
                cwd=str(Path(__file__).parent),
            )
        threading.Thread(target=run, daemon=True).start()

        flash(f"✅ Processing '{fname}' — review dashboard opening at localhost:5000 in ~30 seconds.", "ok")
        return redirect(url_for("upload_brochure"))

    return page("Upload Brochure", UPLOAD_CONTENT, "projects")


# ─────────────────────────────────────────────────────────────────────────────
# PROJECTS — SCRAPE FROM WEB
# ─────────────────────────────────────────────────────────────────────────────

SCRAPE_FORM = f"""
<div style="display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start">
  <div>
    <div class="card" style="margin-bottom:20px">
      <h2 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:18px;
                 color:{BRAND['dark']};margin-bottom:8px">Scrape Project from Web</h2>
      <p style="font-size:12px;color:{BRAND['grey']};line-height:1.8;margin-bottom:24px">
        Enter a project name + developer to search, or paste a direct URL from
        OPR.ae, PropertyFinder, or Bayut. The system will scrape all available data,
        run it through GPT to structure it, then let you review and save.
      </p>

      <form id="scrapeForm" onsubmit="startScrape(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="field">
            <label>Project Name</label>
            <input id="projectName" name="project_name" type="text" placeholder="e.g. Le Château">
          </div>
          <div class="field">
            <label>Developer</label>
            <input id="developerName" name="developer" type="text" placeholder="e.g. BEYOND">
          </div>
        </div>
        <div class="field">
          <label>— OR — Direct URL (OPR.ae / PropertyFinder / Bayut)</label>
          <input id="directUrl" name="url" type="url" placeholder="https://opr.ae/projects/...">
        </div>
        <div class="field">
          <label>Source to scrape</label>
          <select name="source" id="scrapeSource">
            <option value="opr">OPR.ae (recommended)</option>
            <option value="propertyfinder">PropertyFinder.ae</option>
            <option value="bayut">Bayut.com</option>
            <option value="url">Direct URL</option>
          </select>
        </div>
        <button type="submit" class="btn btn-teal" style="width:100%;justify-content:center">
          🌐 Start Scraping
        </button>
      </form>
    </div>

    <!-- Results appear here -->
    <div id="scrapeStatus" style="display:none" class="card">
      <div id="scrapeLog" style="font-family:monospace;font-size:12px;color:{BRAND['grey']};
           line-height:1.9;white-space:pre-wrap;max-height:200px;overflow-y:auto;
           background:#f8f8f8;padding:14px;border-radius:8px;margin-bottom:20px">Scraping...</div>
    </div>

    <!-- 8 review sections — shown after scrape completes -->
    <div id="scrapeResult" style="display:none">

      <!-- 1. BASIC INFO -->
      <div class="card" style="margin-bottom:20px">
        <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:15px;color:{BRAND['dark']};
                   padding-bottom:10px;border-bottom:3px solid {BRAND['teal']};margin-bottom:20px">1 · Basic Information</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="field"><label>Project Name</label><input id="r_name" type="text"></div>
          <div class="field"><label>Developer</label><input id="r_developer" type="text"></div>
          <div class="field"><label>Area / Community</label><input id="r_area" type="text"></div>
          <div class="field"><label>Emirate</label>
            <select id="r_emirate"><option>Dubai</option><option>Abu Dhabi</option><option>Sharjah</option>
              <option>Ras Al Khaimah</option><option>Ajman</option><option>Fujairah</option></select></div>
        </div>
        <div class="field"><label>Tagline</label><input id="r_tagline" type="text" placeholder="Short SEO heading"></div>
        <div class="field"><label>Property Types (comma-separated)</label>
          <input id="r_property_types" type="text" placeholder="Apartment, Penthouse, Villa"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
          <div class="field"><label>Status</label>
            <select id="r_status"><option value="off_plan">Off-Plan</option>
              <option value="under_construction">Under Construction</option>
              <option value="ready">Ready</option><option value="completed">Completed</option></select></div>
          <div class="field"><label>Total Units</label><input id="r_total_units" type="number"></div>
          <div class="field"><label>Permit Number</label><input id="r_permit" type="text"></div>
        </div>
        <div class="field"><label>Short Description (2–3 sentences)</label>
          <textarea id="r_desc_short" rows="2"></textarea></div>
        <div class="field"><label>Full Description (3–5 paragraphs)</label>
          <textarea id="r_desc_long" rows="6"></textarea></div>
      </div>

      <!-- 2. PRICING & PAYMENT PLAN -->
      <div class="card" style="margin-bottom:20px">
        <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:15px;color:{BRAND['dark']};
                   padding-bottom:10px;border-bottom:3px solid {BRAND['teal']};margin-bottom:20px">2 · Pricing &amp; Payment Plan</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="field"><label>Price From (AED)</label><input id="r_price_from" type="number"></div>
          <div class="field"><label>Price To (AED)</label><input id="r_price_to" type="number"></div>
          <div class="field"><label>Size Min (sqft)</label><input id="r_size_min" type="number"></div>
          <div class="field"><label>Size Max (sqft)</label><input id="r_size_max" type="number"></div>
          <div class="field"><label>Bedroom Min (0=Studio)</label><input id="r_bed_min" type="number"></div>
          <div class="field"><label>Bedroom Max</label><input id="r_bed_max" type="number"></div>
          <div class="field"><label>Handover (e.g. Q4 2027)</label><input id="r_handover" type="text" placeholder="Q4 2027"></div>
          <div class="field"><label>Payment Plan Summary</label><input id="r_payment" type="text" placeholder="60/40"></div>
        </div>
        <label style="font-size:11px;color:{BRAND['grey']};letter-spacing:.05em;text-transform:uppercase;font-weight:700;display:block;margin-bottom:8px">Payment Plan Stages</label>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1.5px solid #eee">
            <th style="text-align:left;padding:6px 8px;font-size:11px;color:{BRAND['grey']}">Stage</th>
            <th style="text-align:left;padding:6px 8px;font-size:11px;color:{BRAND['grey']};width:100px">%</th>
            <th style="width:34px"></th>
          </tr></thead>
          <tbody id="paymentRows"></tbody>
        </table>
        <button type="button" onclick="addPaymentRow()" class="scrape-add-btn">+ Add Stage</button>
      </div>

      <!-- 3. FLOOR PLANS / UNIT TYPES -->
      <div class="card" style="margin-bottom:20px">
        <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:15px;color:{BRAND['dark']};
                   padding-bottom:10px;border-bottom:3px solid {BRAND['teal']};margin-bottom:20px">3 · Unit Types / Floor Plans</h3>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1.5px solid #eee">
            <th style="text-align:left;padding:6px 8px;font-size:11px;color:{BRAND['grey']}">Type</th>
            <th style="padding:6px 8px;font-size:11px;color:{BRAND['grey']};width:62px">Beds</th>
            <th style="padding:6px 8px;font-size:11px;color:{BRAND['grey']};width:62px">Baths</th>
            <th style="padding:6px 8px;font-size:11px;color:{BRAND['grey']};width:90px">Sqft Min</th>
            <th style="padding:6px 8px;font-size:11px;color:{BRAND['grey']};width:90px">Sqft Max</th>
            <th style="width:34px"></th>
          </tr></thead>
          <tbody id="floorPlanRows"></tbody>
        </table>
        <button type="button" onclick="addFloorPlanRow()" class="scrape-add-btn">+ Add Unit Type</button>
      </div>

      <!-- 4. AMENITIES & INVESTMENT -->
      <div class="card" style="margin-bottom:20px">
        <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:15px;color:{BRAND['dark']};
                   padding-bottom:10px;border-bottom:3px solid {BRAND['teal']};margin-bottom:20px">4 · Amenities &amp; Investment</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="field"><label>Amenities (one per line)</label>
            <textarea id="r_amenities" rows="8" placeholder="Swimming Pool&#10;Gymnasium&#10;Concierge&#10;Kids Play Area"></textarea></div>
          <div class="field"><label>Investment Potential (one per line)</label>
            <textarea id="r_investment" rows="8" placeholder="Strong rental yields&#10;Prime location&#10;Freehold ownership"></textarea></div>
        </div>
        <div class="field"><label>Lifestyle Tags (comma-separated)</label>
          <input id="r_lifestyle" type="text" placeholder="beachfront, waterfront, city_center, marina_view">
          <div style="font-size:10px;color:{BRAND['grey']};margin-top:2px">Options: beachfront · waterfront · golf_course · city_center · island_living · marina_view · downtown · forest_living · ski_in_ski_out</div>
        </div>
      </div>

      <!-- 5. FAQ -->
      <div class="card" style="margin-bottom:20px">
        <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:15px;color:{BRAND['dark']};
                   padding-bottom:10px;border-bottom:3px solid {BRAND['teal']};margin-bottom:20px">5 · FAQs (15 buyer Q&amp;As)</h3>
        <div id="faqRows"></div>
        <button type="button" onclick="addFaqRow()" class="scrape-add-btn">+ Add FAQ</button>
      </div>

      <!-- 6. SEO + GEO + AEO -->
      <div class="card" style="margin-bottom:20px">
        <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:15px;color:{BRAND['dark']};
                   padding-bottom:10px;border-bottom:3px solid {BRAND['teal']};margin-bottom:20px">6 · SEO + GEO + AEO</h3>
        <div class="field"><label>SEO Title (max 60 chars)</label><input id="r_seo_title" type="text" maxlength="70"></div>
        <div class="field"><label>Meta Description (150–160 chars)</label>
          <textarea id="r_seo_desc" rows="2" maxlength="170"></textarea></div>
        <div class="field"><label>Keywords (comma-separated)</label>
          <input id="r_seo_keywords" type="text" placeholder="dubai off plan, project name dubai, buy apartment dubai"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:4px">
          <div class="field"><label>Geo Region (ISO)</label><input id="r_geo_region" type="text" placeholder="AE-DU">
            <div style="font-size:10px;color:{BRAND['grey']};margin-top:2px">AE-DU=Dubai · AE-AZ=Abu Dhabi · AE-SH=Sharjah · AE-RK=RAK</div></div>
          <div class="field"><label>Geo Placename</label><input id="r_geo_placename" type="text" placeholder="Dubai, UAE"></div>
        </div>
        <div class="field"><label>AEO Voice/AI Snippet (1 sentence)</label>
          <textarea id="r_aeo_snippet" rows="2"
            placeholder="[Project] by [Developer] is a [type] in [location] from AED [price] with handover in [date]."></textarea></div>
      </div>

      <!-- 7. LOCATION -->
      <div class="card" style="margin-bottom:20px">
        <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:15px;color:{BRAND['dark']};
                   padding-bottom:10px;border-bottom:3px solid {BRAND['teal']};margin-bottom:16px">7 · Location</h3>
        <!-- Live map embed -->
        <div id="mapEmbedWrap" style="display:none;margin-bottom:14px;border-radius:12px;overflow:hidden;border:1.5px solid #e0e0e0">
          <iframe id="mapEmbed" src="" width="100%" height="320" frameborder="0"
            style="display:block" allowfullscreen loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
        <div id="mapNoCoords" style="background:#f4f6f9;border-radius:10px;padding:20px;
             text-align:center;color:{BRAND['grey']};font-size:13px;margin-bottom:14px">
          No coordinates yet — map will appear once lat/lng are populated
        </div>
        <!-- Coordinate inputs -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:10px">
          <div class="field" style="margin-bottom:0">
            <label>Latitude</label>
            <input id="r_lat" type="text" placeholder="e.g. 24.9983" oninput="updMap()">
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Longitude</label>
            <input id="r_lng" type="text" placeholder="e.g. 55.4280" oninput="updMap()">
          </div>
        </div>
        <a id="mapOpenLink" href="#" target="_blank"
           style="font-size:12px;color:{BRAND['teal']};display:none">
          ↗ Open in Google Maps
        </a>
      </div>

      <!-- 8. IMAGES -->
      <div class="card" style="margin-bottom:20px">
        <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:15px;color:{BRAND['dark']};
                   padding-bottom:10px;border-bottom:3px solid {BRAND['teal']};margin-bottom:16px">8 · Images — Tag &amp; Upload to Cloudinary</h3>
        <div id="imageSection">
          <p style="font-size:12px;color:{BRAND['grey']}">No images found — the site may require JavaScript or a session cookie.</p>
        </div>
        <input type="hidden" id="r_image_main">
        <input type="hidden" id="r_images_json">
        <input type="hidden" id="r_images_exterior_json">
        <input type="hidden" id="r_images_interior_json">
        <!-- Manual image add — always available once scrape result is shown -->
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee">
          <p style="font-size:11px;color:{BRAND['grey']};font-weight:700;text-transform:uppercase;
                    letter-spacing:0.05em;margin-bottom:8px">Add Images Manually</p>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="text" id="addImageUrl" placeholder="Paste an image URL (https://...)"
                   style="flex:1;min-width:220px;padding:9px 12px;border:1.5px solid #e0e0e0;
                          border-radius:8px;font-family:Verdana;font-size:12px;color:{BRAND['dark']}">
            <button type="button" onclick="addImageFromUrl()" class="btn btn-outline"
                    style="font-size:12px;padding:9px 18px">+ Add URL</button>
            <input type="file" id="addImageFile" accept="image/*" multiple style="display:none"
                   onchange="addImagesFromFiles(this)">
            <button type="button" onclick="$i('addImageFile').click()" class="btn btn-outline"
                    style="font-size:12px;padding:9px 18px">+ Upload from Computer</button>
          </div>
        </div>
        <div id="imageUploadBar" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid #eee">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <button type="button" id="uploadImagesBtn" onclick="uploadTaggedImages()" class="btn btn-teal"
                    style="font-size:13px">⬆ Upload Selected to Cloudinary</button>
            <span id="uploadImagesStatus" style="font-size:11px;color:{BRAND['grey']}">Tag each image above, then click upload</span>
          </div>
        </div>
      </div>

      <!-- SAVE -->
      <div style="display:flex;gap:12px;margin-bottom:40px">
        <button type="button" onclick="saveProject()" class="btn btn-primary"
                style="flex:1;justify-content:center;padding:14px;font-size:14px">💾 Save to Database</button>
        <button type="button" onclick="document.getElementById('scrapeResult').style.display='none';window.scrollTo(0,0)"
                class="btn btn-outline">Cancel</button>
      </div>
    </div><!-- /scrapeResult -->
  </div>

  <!-- Sources sidebar -->
  <div>
    <div class="card">
      <h3 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:14px;
                 color:{BRAND['dark']};margin-bottom:16px">Supported Sources</h3>
      {"".join(f'''
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f5f5f5">
        <div style="width:8px;height:8px;border-radius:50%;background:{c};flex-shrink:0"></div>
        <div><div style="font-size:13px;font-weight:700;color:{BRAND['dark']}">{n}</div>
             <div style="font-size:11px;color:{BRAND['grey']}">{d}</div></div>
      </div>''' for n,d,c in [
        ("OPR.ae","Best source for UAE off-plan data","#7fe2e3"),
        ("PropertyFinder.ae","Large database, ready properties","#6366f1"),
        ("Bayut.com","Pricing and agent details","#f97316"),
        ("Direct URL","Any page from the above sites","#10b981"),
      ])}
    </div>
  </div>
</div>

<style>
.scrape-add-btn{{margin-top:8px;background:none;border:1.5px dashed {BRAND['teal']};color:{BRAND['teal']};
  border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:700}}
.scrape-add-btn:hover{{background:{BRAND['teal']};color:{BRAND['dark']}}}
.sdel{{background:none;border:1px solid #ddd;color:#bbb;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:12px}}
.sdel:hover{{background:#fee2e2;color:#c00;border-color:#fca5a5}}
.sinp{{width:100%;padding:6px 9px;border:1.5px solid #e8e8e8;border-radius:7px;font-size:12px;color:#192537;background:#fff}}
</style>

<script>
let scrapeData = {{}};

async function startScrape(e) {{
  e.preventDefault();
  document.getElementById('scrapeStatus').style.display = 'block';
  document.getElementById('scrapeResult').style.display = 'none';
  const logEl = document.getElementById('scrapeLog');
  logEl.innerText = 'Starting scrape job...';

  // Start job in background — returns job_id immediately
  let job_id;
  try {{
    const res = await fetch('/projects/scrape/run', {{
      method:'POST', headers:{{'Content-Type':'application/json'}},
      body: JSON.stringify({{
        project_name: document.getElementById('projectName').value,
        developer:    document.getElementById('developerName').value,
        url:          document.getElementById('directUrl').value,
        source:       document.getElementById('scrapeSource').value,
      }})
    }});
    const init = await res.json();
    job_id = init.job_id;
    if (!job_id) {{ logEl.innerText = init.log || 'Error starting job.'; return; }}
  }} catch(err) {{ logEl.innerText = 'Network error: ' + err; return; }}

  logEl.innerText = 'Scraping in background... updating every 3s';

  // Poll every 3 seconds until done
  const poll = setInterval(async () => {{
    try {{
      const pr = await fetch('/projects/scrape/poll/' + job_id);
      const pd = await pr.json();
      if (pd.log) logEl.innerText = pd.log;
      if (pd.status === 'done') {{
        clearInterval(poll);
        if (pd.success && pd.result) {{
          scrapeData = pd.result;
          populateForm(pd.result);
          document.getElementById('scrapeResult').style.display = 'block';
          setTimeout(()=>document.getElementById('scrapeResult').scrollIntoView({{behavior:'smooth'}}),100);
        }} else {{
          logEl.innerText = pd.log || 'Scrape failed.';
        }}
      }}
    }} catch(e) {{ /* keep polling */ }}
  }}, 3000);
}}

const $i = id => document.getElementById(id);
const sv = (id,val) => {{ if($i(id)&&val!=null) $i(id).value=val; }};

function populateForm(d) {{
  sv('r_name',d.name); sv('r_developer',d.developer); sv('r_area',d.area);
  sv('r_tagline',d.tagline); sv('r_property_types',(d.property_types||[]).join(', '));
  sv('r_total_units',d.total_units); sv('r_permit',d.permit_number);
  sv('r_desc_short',d.description_short); sv('r_desc_long',d.description_long);
  if(d.status) $i('r_status').value=d.status;
  if(d.emirate) try{{$i('r_emirate').value=d.emirate}}catch(e){{}}

  sv('r_price_from',d.price_from); sv('r_price_to',d.price_to);
  sv('r_size_min',d.size_sqft_min); sv('r_size_max',d.size_sqft_max);
  sv('r_bed_min',d.bedroom_min); sv('r_bed_max',d.bedroom_max);
  sv('r_handover',d.handover); sv('r_payment',d.payment_plan_summary);

  $i('paymentRows').innerHTML='';
  const stages=Array.isArray(d.payment_plan_detail)?d.payment_plan_detail:[];
  if(stages.length) stages.forEach(s=>addPaymentRow(s.stage||'',s.percentage||''));
  else ['On Booking','During Construction','On Handover'].forEach(s=>addPaymentRow(s,''));

  $i('floorPlanRows').innerHTML='';
  (d.floor_plans||[]).forEach(f=>addFloorPlanRow(f.type||'',f.beds||'',f.baths||'',f.sqft_min||'',f.sqft_max||''));

  sv('r_amenities',(d.amenities||[]).join('\\n'));
  sv('r_investment',(d.investment_potential||[]).join('\\n'));
  sv('r_lifestyle',(d.lifestyle_tags||[]).join(', '));

  $i('faqRows').innerHTML='';
  (d.faqs||[]).forEach((f,i)=>addFaqRow(i+1,f.question||'',f.answer||''));

  sv('r_seo_title',d.seo_title); sv('r_seo_desc',d.seo_description);
  sv('r_seo_keywords',(d.seo_keywords||[]).join(', '));
  sv('r_geo_region',d.geo_region); sv('r_geo_placename',d.geo_placename);
  sv('r_aeo_snippet',d.aeo_snippet);
  sv('r_lat',d.lat); sv('r_lng',d.lng); updMap();

  const imgs=d.images||[];
  const intSet=new Set(d.images_interior||[]);
  window._imgTags={{}};
  $i('imageSection').innerHTML='';
  $i('r_images_json').value='[]';
  if(imgs.length){{
    $i('r_image_main').value=d.image_main||imgs[0];
    imgs.forEach(url=>_addImgToGrid(url, intSet.has(url)?'interior':'exterior'));
  }} else {{
    $i('imageSection').innerHTML='<p style="font-size:12px;color:#888">No images scraped — add manually below.</p>';
  }}
}}

// ── Shared image grid builder ────────────────────────────────────────────────
const _IMG_TAGS=[
  {{key:'exterior',  label:'Ext',   color:'#7fe2e3'}},
  {{key:'interior',  label:'Int',   color:'#6366f1'}},
  {{key:'amenity',   label:'Amen',  color:'#10b981'}},
  {{key:'floor_plan',label:'FP',    color:'#f97316'}},
  {{key:'skip',      label:'Skip',  color:'#ef4444'}},
];
function _addImgToGrid(url, tag){{
  window._imgTags=window._imgTags||{{}};
  if(document.querySelector(`[data-url="${{CSS.escape(url)}}"]`)) return; // no duplicates
  window._imgTags[url]=tag||'exterior';
  const sec=$i('imageSection');
  if(!sec.querySelector('.img-grid')){{
    if(!sec.querySelector('p')){{
      const p=document.createElement('p');
      p.style.cssText='font-size:12px;color:#888;margin-bottom:12px';
      p.innerHTML='Click a tag button under each image. <span style="color:#ef4444;font-weight:700">Skip</span> images will not be uploaded.';
      sec.insertBefore(p,sec.firstChild);
    }}
    const g=document.createElement('div');
    g.className='img-grid';
    g.style.cssText='display:flex;flex-wrap:wrap;gap:14px;margin-top:4px';
    sec.appendChild(g);
  }}
  const grid=sec.querySelector('.img-grid');
  const isFirst=grid.children.length===0;
  const wrap=document.createElement('div');
  wrap.dataset.url=url;
  wrap.style.cssText='display:flex;flex-direction:column;gap:5px;width:140px';
  const imgEl=document.createElement('img');
  imgEl.src=url;
  imgEl.onerror=()=>{{wrap.style.opacity='0.35';}};
  imgEl.style.cssText=`width:140px;height:90px;object-fit:cover;border-radius:8px;cursor:pointer;border:3px solid ${{isFirst?'#7fe2e3':'#e0e0e0'}}`;
  imgEl.onclick=()=>setMain(url);
  const tagBar=document.createElement('div');
  tagBar.style.cssText='display:flex;flex-wrap:wrap;gap:3px';
  _IMG_TAGS.forEach(t=>{{
    const btn=document.createElement('button');
    btn.type='button'; btn.textContent=t.label;
    btn.dataset.tagKey=t.key; btn.dataset.imgUrl=url;
    const active=window._imgTags[url]===t.key;
    btn.style.cssText=`padding:2px 5px;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer;border:1.5px solid ${{t.color}};background:${{active?t.color:'transparent'}};color:${{active?'#192537':t.color}}`;
    btn.onclick=()=>setImgTag(url,t.key);
    tagBar.appendChild(btn);
  }});
  wrap.appendChild(imgEl); wrap.appendChild(tagBar);
  grid.appendChild(wrap);
  // Update hidden list
  const existing=()=>{{try{{return JSON.parse($i('r_images_json').value||'[]');}}catch(e){{return[];}}}};
  const list=existing(); if(!list.includes(url)){{list.push(url);$i('r_images_json').value=JSON.stringify(list);}}
  if(!$i('r_image_main').value) $i('r_image_main').value=url;
  $i('imageUploadBar').style.display='block';
}}
function addImageFromUrl(){{
  const inp=$i('addImageUrl');
  const url=(inp.value||'').trim();
  if(!url.startsWith('http')){{alert('Please paste a valid image URL starting with https://');return;}}
  _addImgToGrid(url,'exterior');
  inp.value='';
}}
function addImagesFromFiles(input){{
  Array.from(input.files||[]).forEach(file=>{{
    const reader=new FileReader();
    reader.onload=e=>_addImgToGrid(e.target.result,'exterior');
    reader.readAsDataURL(file);
  }});
  input.value='';
}}
function setMain(url){{
  $i('r_image_main').value=url;
  document.querySelectorAll('#imageSection img').forEach(img=>img.style.borderColor='#e0e0e0');
  const w=document.querySelector(`[data-url="${{CSS.escape(url)}}"] img`);
  if(w) w.style.borderColor='#7fe2e3';
}}
function setImgTag(url,tag){{
  window._imgTags=window._imgTags||{{}};
  window._imgTags[url]=tag;
  const wrap=document.querySelector(`[data-url="${{CSS.escape(url)}}"]`);
  if(!wrap) return;
  const COLORS={{exterior:'#7fe2e3',interior:'#6366f1',amenity:'#10b981',floor_plan:'#f97316',skip:'#ef4444'}};
  wrap.querySelectorAll('button[data-tag-key]').forEach(btn=>{{
    const isA=btn.dataset.tagKey===tag;
    const c=COLORS[btn.dataset.tagKey]||'#888';
    btn.style.background=isA?c:'transparent';
    btn.style.color=isA?'#192537':c;
  }});
  const imgEl=wrap.querySelector('img');
  if(imgEl) imgEl.style.opacity=tag==='skip'?'0.35':'1';
}}
async function uploadTaggedImages(){{
  const tagged=Object.entries(window._imgTags||{{}})
    .filter(([,tag])=>tag!=='skip')
    .map(([url,tag])=>{{return{{url,tag}};}});
  if(!tagged.length){{alert('No images to upload — all are tagged Skip.');return;}}
  const btn=$i('uploadImagesBtn');
  const status=$i('uploadImagesStatus');
  btn.disabled=true;
  btn.textContent=`Uploading ${{tagged.length}} image(s)...`;
  if(status) status.textContent='Please wait, uploading to Cloudinary...';
  try{{
    const res=await fetch('/projects/scrape/upload-images',{{
      method:'POST',headers:{{'Content-Type':'application/json'}},
      body:JSON.stringify({{images:tagged}})
    }});
    const data=await res.json();
    if(data.success){{
      $i('r_images_json').value=JSON.stringify(data.all||[]);
      if((data.all||[]).length) $i('r_image_main').value=data.all[0];
      $i('r_images_exterior_json').value=JSON.stringify(data.exterior||[]);
      $i('r_images_interior_json').value=JSON.stringify(data.interior||[]);
      btn.textContent=`✓ ${{(data.all||[]).length}} uploaded to Cloudinary!`;
      btn.style.background='#10b981'; btn.style.color='white'; btn.disabled=false;
      if(status) status.textContent='Upload complete — ready to save to database.';
      if(data.url_map){{
        Object.entries(data.url_map).forEach(([orig,cld])=>{{
          if(!cld) return;
          const imgEl=document.querySelector(`[data-url="${{CSS.escape(orig)}}"] img`);
          if(imgEl) imgEl.src=cld;
          const wrap=document.querySelector(`[data-url="${{CSS.escape(orig)}}"]`);
          if(wrap) wrap.dataset.url=cld;
        }});
      }}
    }} else {{
      btn.disabled=false; btn.textContent='⬆ Upload Selected to Cloudinary';
      if(status) status.textContent='Upload failed: '+(data.error||'Unknown');
      alert('Upload error: '+(data.error||'Unknown'));
    }}
  }} catch(e){{
    btn.disabled=false; btn.textContent='⬆ Upload Selected to Cloudinary';
    if(status) status.textContent='Network error';
    alert('Network error: '+e);
  }}
}}
function updMap(){{
  const la=($i('r_lat').value||'').trim(), ln=($i('r_lng').value||'').trim();
  if(la && ln && !isNaN(la) && !isNaN(ln)){{
    const embedSrc=`https://maps.google.com/maps?q=${{la}},${{ln}}&z=16&output=embed`;
    const openSrc=`https://www.google.com/maps?q=${{la}},${{ln}}`;
    $i('mapEmbed').src=embedSrc;
    $i('mapEmbedWrap').style.display='block';
    $i('mapNoCoords').style.display='none';
    $i('mapOpenLink').href=openSrc;
    $i('mapOpenLink').style.display='inline';
  }} else {{
    $i('mapEmbedWrap').style.display='none';
    $i('mapNoCoords').style.display='block';
    $i('mapOpenLink').style.display='none';
  }}
}}
function addPaymentRow(stage='',pct=''){{
  const tr=document.createElement('tr');
  tr.innerHTML=`<td style="padding:4px"><input class="sinp" type="text" value="${{stage}}" placeholder="e.g. On Booking"></td>
    <td style="padding:4px"><input class="sinp" type="number" value="${{pct}}" placeholder="10" style="width:80px"></td>
    <td style="padding:4px;text-align:center"><button type="button" class="sdel" onclick="this.closest('tr').remove()">×</button></td>`;
  $i('paymentRows').appendChild(tr);
}}
function addFloorPlanRow(type='',beds='',baths='',sqMin='',sqMax=''){{
  const tr=document.createElement('tr');
  tr.innerHTML=`<td style="padding:4px"><input class="sinp" type="text" value="${{type}}" placeholder="1BR Apartment"></td>
    <td style="padding:4px"><input class="sinp" type="number" value="${{beds}}" style="width:55px"></td>
    <td style="padding:4px"><input class="sinp" type="number" value="${{baths}}" style="width:55px"></td>
    <td style="padding:4px"><input class="sinp" type="number" value="${{sqMin}}" placeholder="750"></td>
    <td style="padding:4px"><input class="sinp" type="number" value="${{sqMax}}" placeholder="1100"></td>
    <td style="padding:4px;text-align:center"><button type="button" class="sdel" onclick="this.closest('tr').remove()">×</button></td>`;
  $i('floorPlanRows').appendChild(tr);
}}
function addFaqRow(num,q,a){{
  const dv=document.createElement('div');
  dv.style.cssText='display:flex;gap:10px;align-items:flex-start;padding:10px;border:1.5px solid #eee;border-radius:7px;margin-bottom:7px;background:#fafcff';
  dv.innerHTML=`<div style="width:22px;height:22px;background:#192537;color:#7fe2e3;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:3px">${{num||''}}</div>
    <div style="flex:1;display:flex;flex-direction:column;gap:5px">
      <input type="text" class="sinp" value="${{(q||'').replace(/"/g,'&quot;')}}" placeholder="Question">
      <textarea class="sinp" rows="2" placeholder="Answer" style="resize:vertical">${{a||''}}</textarea>
    </div>
    <button type="button" class="sdel" onclick="this.closest('div').remove()">×</button>`;
  $i('faqRows').appendChild(dv);
}}

async function saveProject(){{
  const payRows=$i('paymentRows').querySelectorAll('tr');
  const payDetail=Array.from(payRows).map(r=>{{const ins=r.querySelectorAll('input');return{{stage:ins[0].value,percentage:parseFloat(ins[1].value)||0}};}}).filter(r=>r.stage);
  const fpRows=$i('floorPlanRows').querySelectorAll('tr');
  const floorPlans=Array.from(fpRows).map(r=>{{const ins=r.querySelectorAll('input');return{{type:ins[0].value,beds:parseInt(ins[1].value)||0,baths:parseInt(ins[2].value)||0,sqft_min:parseInt(ins[3].value)||null,sqft_max:parseInt(ins[4].value)||null}};}}).filter(r=>r.type);
  const faqs=Array.from($i('faqRows').children).map(dv=>{{const els=dv.querySelectorAll('input,textarea');return{{question:els[0].value,answer:els[1].value}};}}).filter(f=>f.question);
  let images=[]; try{{images=JSON.parse($i('r_images_json').value||'[]')}}catch(e){{}}

  const payload={{
    name:$i('r_name').value, developer:$i('r_developer').value, area:$i('r_area').value,
    emirate:$i('r_emirate').value, tagline:$i('r_tagline').value, status:$i('r_status').value,
    property_types:$i('r_property_types').value, total_units:$i('r_total_units').value,
    permit_number:$i('r_permit').value, description_short:$i('r_desc_short').value,
    description_long:$i('r_desc_long').value, price_from:$i('r_price_from').value,
    price_to:$i('r_price_to').value, size_sqft_min:$i('r_size_min').value, size_sqft_max:$i('r_size_max').value,
    bedroom_min:$i('r_bed_min').value, bedroom_max:$i('r_bed_max').value,
    handover:$i('r_handover').value, payment_plan_summary:$i('r_payment').value,
    payment_plan_detail:payDetail, floor_plans:floorPlans,
    amenities:$i('r_amenities').value, investment_potential:$i('r_investment').value,
    lifestyle_tags:$i('r_lifestyle').value, faqs,
    seo_title:$i('r_seo_title').value, seo_description:$i('r_seo_desc').value,
    seo_keywords:$i('r_seo_keywords').value, geo_region:$i('r_geo_region').value,
    geo_placename:$i('r_geo_placename').value, aeo_snippet:$i('r_aeo_snippet').value,
    lat:$i('r_lat').value, lng:$i('r_lng').value,
    image_main:$i('r_image_main').value, images_json:JSON.stringify(images),
    images_exterior_json:$i('r_images_exterior_json').value||'[]',
    images_interior_json:$i('r_images_interior_json').value||'[]',
  }};
  const res=await fetch('/projects/scrape/save',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify(payload)}});
  const data=await res.json();
  if(data.success){{alert('✅ Saved! Code: '+(data.project_code||'N/A'));window.location.href='/projects';}}
  else alert('Error: '+(data.error||'Unknown'));
}}
</script>"""

@app.route("/projects/scrape")
@login_required
def scrape_project():
    return page("Scrape from Web", SCRAPE_FORM, "projects")


@app.route("/projects/scrape/poll/<job_id>")
@login_required
def scrape_poll(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"status": "not_found", "log": "Job not found."})
    return jsonify(job)


@app.route("/projects/scrape/run", methods=["POST"])
@login_required
def scrape_run():
    data = request.get_json() or {}
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {"status": "running", "log": "Starting scrape...", "success": False}

    def _run_in_bg():
        _do_scrape(data, job_id)

    threading.Thread(target=_run_in_bg, daemon=True).start()
    return jsonify({"job_id": job_id, "status": "running"})


def _do_scrape(data, job_id):
    project_name = data.get("project_name", "").strip()
    developer    = data.get("developer", "").strip()
    url          = data.get("url", "").strip()
    source       = data.get("source", "opr")

    log_lines = []
    result    = {}

    def _update_log(msg=None):
        if msg: log_lines.append(msg)
        jobs[job_id]["log"] = "\n".join(log_lines)

    try:
        from playwright.sync_api import sync_playwright
        import re as _re

        def slugify(s):
            return _re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

        def scrape_url_with_playwright(target_url: str, source_name: str) -> dict:
            log_lines.append(f"Opening {source_name}: {target_url}")
            found = {}
            with sync_playwright() as pw:
                browser = pw.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-blink-features=AutomationControlled",
                        "--disable-dev-shm-usage",
                        "--disable-infobars",
                        "--window-size=1280,800",
                    ]
                )
                ctx = browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                    viewport={"width": 1280, "height": 800},
                    locale="en-US",
                    timezone_id="Asia/Dubai",
                    extra_http_headers={
                        "Accept-Language": "en-US,en;q=0.9",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    }
                )
                # Remove the webdriver property that sites use to detect bots
                ctx.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3]});
                    Object.defineProperty(navigator, 'languages', {get: () => ['en-US','en']});
                """)
                page = ctx.new_page()
                page.set_default_timeout(90000)
                try:
                    # Use "commit" — fires on first byte, not after full JS parse
                    page.goto(target_url, wait_until="commit", timeout=60000)
                    # Then wait for body content to appear
                    page.wait_for_selector("body", timeout=30000)
                    page.wait_for_timeout(2000)
                except Exception as _nav_err:
                    log_lines.append(f"  ⚠ Page load slow ({_nav_err}) — continuing with whatever loaded")
                    page.wait_for_timeout(2000)
                # Initial scroll to trigger lazy-loaded images
                page.evaluate("window.scrollTo(0, document.body.scrollHeight * 0.4)")
                page.wait_for_timeout(1500)
                page.evaluate("window.scrollTo(0, 0)")
                page.wait_for_timeout(800)

                # Title / project name
                h1 = page.query_selector("h1")
                if h1:
                    found["scraped_title"] = h1.inner_text().strip()
                    log_lines.append(f"  Title: {found['scraped_title']}")

                # Description — grab as much text as possible from content sections
                desc_parts = []
                for sel in ["[class*='description']","[class*='overview']","[class*='about']",
                            "[class*='detail']","[class*='content']","article","main"]:
                    els = page.query_selector_all(sel)
                    for el in els:
                        t = el.inner_text().strip()
                        if len(t) > 120:
                            desc_parts.append(t[:3000])
                            break
                    if desc_parts:
                        break
                if desc_parts:
                    found["scraped_description"] = desc_parts[0]

                # Price
                for sel in ["[class*='price']","[data-price]",".price","[class*='Price']","[class*='starting']"]:
                    el = page.query_selector(sel)
                    if el:
                        found["scraped_price"] = el.inner_text().strip()
                        break

                # Amenities / features
                for sel in ["[class*='amenity'] li","[class*='feature'] li","ul.amenities li",
                            ".facilities li","[class*='facilit'] li","[class*='highlight'] li"]:
                    els = page.query_selector_all(sel)
                    if len(els) > 2:
                        found["scraped_amenities"] = [e.inner_text().strip() for e in els[:30] if e.inner_text().strip()]
                        break

                # ── Floor plans — OPR.ae specific scraping ──────────────────
                # Scroll down to load lazy sections
                page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                page.wait_for_timeout(1500)
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

                floor_plans = []
                # Try OPR.ae floor plan table rows first (most reliable)
                fp_rows = page.query_selector_all("[class*='floor'] tr, [class*='unit-type'] tr, [class*='floorplan'] tr, table tr")
                for row in fp_rows[:20]:
                    cells = row.query_selector_all("td")
                    if len(cells) >= 2:
                        texts = [c.inner_text().strip() for c in cells]
                        row_text = " ".join(texts).lower()
                        # Only rows with bedroom/size info
                        if any(k in row_text for k in ["bedroom","studio","1br","2br","3br","sqft","sq ft","sq.ft","m²","bed"]):
                            floor_plans.append({"raw": " | ".join(texts[:5])})

                # Try individual floor plan cards
                if not floor_plans:
                    fp_cards = page.query_selector_all("[class*='floor-plan'], [class*='floorplan'], [class*='unit-card'], [class*='plan-card']")
                    for card in fp_cards[:10]:
                        txt = card.inner_text().strip()
                        if txt and len(txt) > 5:
                            floor_plans.append({"raw": txt[:200]})

                # Try extracting bedroom/size info from page text as fallback
                if not floor_plans:
                    page_text = page.inner_text("body")
                    import re as _rfp
                    # Pattern: "2 Bedroom | 1,200 - 1,500 sq.ft"
                    pattern = _rfp.findall(
                        r"(\d+\s*(?:bedroom|BR|studio))[^|]{0,80}?(\d[\d,]+)\s*[-to]+\s*(\d[\d,]+)\s*(?:sqft|sq\.ft|m2)",
                        page_text, _rfp.IGNORECASE
                    )
                    for m in pattern[:8]:
                        floor_plans.append({"raw": f"{m[0]} | {m[1]}–{m[2]} sqft"})

                if floor_plans:
                    found["scraped_floor_plans"] = floor_plans
                    log_lines.append(f"  Found {len(floor_plans)} floor plan row(s)")

                # ── Quick scroll to trigger lazy loads ───────────────────────
                try:
                    for _pct in [0.3, 0.7, 1.0]:
                        page.evaluate(f"window.scrollTo(0, document.body.scrollHeight * {_pct})")
                        page.wait_for_timeout(400)
                    page.evaluate("window.scrollTo(0, 0)")
                    page.wait_for_timeout(500)
                except Exception:
                    pass

                # ── DEBUG: log gallery-related class names found on page ───────
                try:
                    _debug_classes = page.evaluate("""() => {
                        const kw = ['swiper','gallery','photo','slide','exterior','interior','image'];
                        const seen = new Set();
                        document.querySelectorAll('*').forEach(el => {
                            const cls = (el.className || '').toString();
                            kw.forEach(k => {
                                if (cls.toLowerCase().includes(k)) seen.add(cls.trim().slice(0,80));
                            });
                            // Also check for any inline background-image URLs
                            const style = el.getAttribute('style') || '';
                            if (style.includes('creatium.io') || style.includes('cdn.opr.ae'))
                                seen.add('BG-FOUND: ' + style.slice(0,120));
                        });
                        return [...seen].slice(0, 30);
                    }""") or []
                    for _dc in _debug_classes:
                        log_lines.append(f"  [debug] {_dc}")
                except Exception:
                    pass

                # ── Google Maps iframe → extract real coordinates ──────────────
                map_src = ""
                try:
                    map_src = page.evaluate("""() => {
                        const iframes = document.querySelectorAll('iframe');
                        for (const f of iframes) {
                            const s = f.src || f.getAttribute('data-src') || '';
                            if (s.includes('maps.google') || s.includes('google.com/maps'))
                                return s;
                        }
                        return '';
                    }""") or ""
                except Exception:
                    pass
                if map_src:
                    _coord = re.search(r'[?&!]q=(-?\d+\.\d+),(-?\d+\.\d+)', map_src)
                    if not _coord:
                        _coord = re.search(r'center=(-?\d+\.\d+)%2C(-?\d+\.\d+)', map_src)
                    if not _coord:
                        _coord = re.search(r'll=(-?\d+\.\d+),(-?\d+\.\d+)', map_src)
                    if _coord:
                        found["map_lat"] = float(_coord.group(1))
                        found["map_lng"] = float(_coord.group(2))
                        log_lines.append(f"  Map coords from iframe: {found['map_lat']}, {found['map_lng']}")
                    else:
                        log_lines.append(f"  Maps iframe found but no coords in src: {map_src[:80]}")
                else:
                    log_lines.append("  No Google Maps iframe found on page")

                # ── Gallery: Creatium CMS uses CSS background-image on divs ─────────
                # Debug revealed class pattern: gallery{N}-image fancybox
                # Navigation arrows:  gallery{N}-next / gallery{N}-previous
                # We collect all CDN image URLs from inline styles.
                gallery_imgs  = []
                exterior_imgs = []
                interior_imgs = []

                _CDN_DOMAINS = ['creatium.io', 'cdn.opr.ae', 'img3.creatium', 'img2.creatium']
                _BAD_WORDS   = ['data:','gif;base64','.gif','.svg','placeholder','blank',
                                '1x1','loading','spinner','undefined','null','check.svg',
                                'opr.svg','next.svg','prev.svg','arrow']

                def _all_cdn_images(pg):
                    """Grab ALL background-image URLs from any element pointing to a CDN domain.
                    Intentionally scans hidden slides too — Creatium pre-loads every slide.
                    Playwright evaluate() only accepts ONE extra arg, so we pass [cdns, bad] as array."""
                    return pg.evaluate("""([cdns, bad]) => {
                        const urls = new Set();
                        const isGood = s => {
                            if (!s || !s.startsWith('http') || s.length < 20) return false;
                            const sl = s.toLowerCase();
                            if (bad.some(b => sl.includes(b))) return false;
                            return cdns.some(c => sl.includes(c));
                        };
                        document.querySelectorAll('*').forEach(el => {
                            const style = el.getAttribute('style') || '';
                            if (style) {
                                const m = style.match(/background(?:-image)?[^:]*:\\s*url\\(['"\\s]?([^'"()\\s]+)['"\\s]?\\)/i);
                                if (m && isGood(m[1])) urls.add(m[1]);
                            }
                            ['data-background','data-bg','data-src','data-lazy'].forEach(a => {
                                const v = el.getAttribute(a) || '';
                                if (isGood(v)) urls.add(v);
                            });
                        });
                        document.querySelectorAll('img').forEach(img => {
                            if (isGood(img.src)) urls.add(img.src);
                        });
                        return [...urls];
                    }""", [_CDN_DOMAINS, _BAD_WORDS]) or []

                def _click_gallery_next(pg):
                    """Click visible next arrow — Creatium uses gallery{N}-next class."""
                    return pg.evaluate("""() => {
                        // Try Creatium-style: gallery{N}-next
                        // Try swiper-style: swiper-button-next
                        // Try any element with "-next" in class that is visible
                        const sels = [
                            '[class*="-next"]', '[class*="next-btn"]',
                            '.swiper-button-next', '[aria-label="Next"]',
                            '[class*="NextBtn"]', '[class*="arrow-next"]'
                        ];
                        for (const sel of sels) {
                            for (const btn of document.querySelectorAll(sel)) {
                                const r = btn.getBoundingClientRect();
                                const st = window.getComputedStyle(btn);
                                if (r.width > 5 && r.height > 5 &&
                                    st.display !== 'none' &&
                                    st.visibility !== 'hidden' &&
                                    parseFloat(st.opacity || '1') > 0.05) {
                                    btn.click();
                                    return true;
                                }
                            }
                        }
                        return false;
                    }""")

                def _find_and_click_tab(pg, keyword):
                    """Find single-word tab button matching keyword. Excludes container divs."""
                    variants = {keyword, keyword + "s"}
                    for sel in ["button","[role='tab']","a","li","span","div",
                                "[class*='tab']","[class*='switch']"]:
                        for btn in pg.query_selector_all(sel):
                            lines = [l.strip().lower() for l in (btn.inner_text() or "").split('\n') if l.strip()]
                            if len(lines) == 1 and lines[0] in variants:
                                try:
                                    btn.scroll_into_view_if_needed()
                                    pg.wait_for_timeout(200)
                                    try:
                                        btn.click()
                                    except Exception:
                                        pg.evaluate("el => el.click()", btn)
                                    pg.wait_for_timeout(2500)
                                    return lines[0]
                                except Exception:
                                    pass
                    return None

                _seen_all = set()   # global dedup across tabs

                for _tab_keyword in ["exterior", "interior"]:
                    try:
                        clicked_txt = _find_and_click_tab(page, _tab_keyword)
                        if not clicked_txt:
                            log_lines.append(f"  Tab '{_tab_keyword}': not found")
                            continue
                        log_lines.append(f"  Clicked tab: '{clicked_txt}'")

                        # Scroll to gallery area to trigger lazy load
                        page.evaluate("""() => {
                            const g = document.querySelector('[class*="gallery"][class*="image"], .swiper-slide');
                            if (g) g.scrollIntoView({behavior:'instant', block:'center'});
                        }""")
                        page.wait_for_timeout(500)

                        # Poll up to 6s for new CDN images to appear
                        _new_found = []
                        for _w in range(12):
                            _cur = _all_cdn_images(page)
                            _new_found = [u for u in _cur if u not in _seen_all]
                            if _new_found:
                                break
                            page.wait_for_timeout(500)
                        log_lines.append(f"  After tab: {len(_all_cdn_images(page))} total, {len(_new_found)} new")

                        # Cycle through slides collecting images
                        _tab_imgs = []
                        _no_new = 0
                        for _si in range(30):
                            _cur = set(_all_cdn_images(page))
                            _new = [u for u in _cur if u not in _seen_all]
                            _tab_imgs.extend(_new)
                            _seen_all.update(_new)

                            had = len(_tab_imgs)
                            advanced = _click_gallery_next(page)
                            if not advanced:
                                log_lines.append(f"  No next-arrow at slide {_si} (end of tab)")
                                break
                            page.wait_for_timeout(400)
                            if len(_tab_imgs) == had:
                                _no_new += 1
                                if _no_new >= 3:
                                    break
                            else:
                                _no_new = 0

                        gallery_imgs.extend(_tab_imgs)
                        if _tab_keyword == "exterior":
                            exterior_imgs = list(_tab_imgs)
                        elif _tab_keyword == "interior":
                            interior_imgs = list(_tab_imgs)
                        log_lines.append(f"  Tab '{_tab_keyword}': {len(_tab_imgs)} images")
                    except Exception as _te:
                        log_lines.append(f"  Tab '{_tab_keyword}' error: {_te}")

                # Filter residual noise
                _bad_words = ["placeholder","1x1","data:","icon","logo","avatar",
                              "sprite","flag","payment","blank","cookie","popup",".gif"]
                def _clean(lst):
                    return list(dict.fromkeys(
                        u for u in lst
                        if u.startswith("http") and not any(b in u.lower() for b in _bad_words)
                    ))
                gallery_imgs  = _clean(gallery_imgs)
                exterior_imgs = _clean(exterior_imgs)
                interior_imgs = _clean(interior_imgs)
                found["exterior_imgs"] = exterior_imgs
                found["interior_imgs"] = interior_imgs
                log_lines.append(f"  Gallery total: {len(gallery_imgs)} | Ext: {len(exterior_imgs)} | Int: {len(interior_imgs)}")

                # OG image — always correct main image
                og_img = page.get_attribute('meta[property="og:image"]', "content") or ""
                if og_img.startswith("http"):
                    log_lines.append(f"  OG image: {og_img[:60]}...")

                # Merge gallery images with position-based fallback
                raw_imgs = page.evaluate("""() => {
                    const pageH = document.body.scrollHeight;
                    const skipClasses = ['related','similar','recommend','featured','other-project',
                                         'card-project','listing-card','project-card','nav','header',
                                         'footer','cookie','popup','modal-backdrop','sidebar'];
                    return Array.from(document.querySelectorAll('img')).filter(img => {
                        // Position filter: skip images in bottom 30% (related projects)
                        const rect = img.getBoundingClientRect();
                        const absTop = rect.top + window.scrollY;
                        if (absTop > pageH * 0.85) return false;

                        // Skip if ancestor has a "related/other" class
                        let el = img;
                        for (let i = 0; i < 8; i++) {
                            el = el.parentElement;
                            if (!el) break;
                            const cls = ((el.className || '') + ' ' + (el.id || '')).toLowerCase();
                            if (skipClasses.some(s => cls.includes(s))) return false;
                        }

                        const src = img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.original || '';
                        if (!src.startsWith('http')) return false;

                        // Skip tiny images (icons, logos)
                        const badWords = ['icon','logo','avatar','1x1','sprite','placeholder',
                                          'flag','payment','partner','brand','badge'];
                        if (badWords.some(b => src.toLowerCase().includes(b))) return false;

                        // Only images with real dimensions
                        if (img.naturalWidth  > 0 && img.naturalWidth  < 250) return false;
                        if (img.naturalHeight > 0 && img.naturalHeight < 150) return false;

                        return true;
                    }).map(img => img.src || img.dataset.src || img.dataset.lazySrc || '').filter(Boolean);
                }""")
                # Combine: gallery tab images first (best quality), then position-based fallback
                combined_imgs = gallery_imgs + (raw_imgs or [])
                all_img_urls = list(dict.fromkeys(combined_imgs))[:20]
                # Put OG image first — always the correct main project image
                if og_img and og_img not in all_img_urls:
                    all_img_urls.insert(0, og_img)
                elif og_img and og_img in all_img_urls:
                    all_img_urls.remove(og_img)
                    all_img_urls.insert(0, og_img)
                found["scraped_images"] = all_img_urls[:16]
                log_lines.append(f"  Gallery imgs: {len(gallery_imgs)}, fallback imgs: {len(raw_imgs or [])}, total: {len(found['scraped_images'])}")
                log_lines.append(f"  Found {len(found['scraped_images'])} project images")

                # Full page text — grab 10k chars for GPT
                found["full_text"] = page.inner_text("body")[:10000]
                browser.close()
            return found

        # ── Determine URL to scrape ──
        if url:
            scraped = scrape_url_with_playwright(url, "direct URL")
        elif source == "opr" and project_name:
            # OPR.ae URLs include community+emirate in the slug (unpredictable).
            # Strategy: search OPR.ae's own project listing to find the canonical URL.
            log_lines.append(f"Searching OPR.ae for: {project_name} {developer}...")
            opr_url = None
            try:
                with sync_playwright() as _pw2:
                    _br2 = _pw2.chromium.launch(
                        headless=True,
                        args=["--no-sandbox","--disable-blink-features=AutomationControlled","--disable-dev-shm-usage"]
                    )
                    _ctx2 = _br2.new_context(
                        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                        viewport={"width": 1280, "height": 800},
                        locale="en-US",
                        timezone_id="Asia/Dubai",
                    )
                    _ctx2.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
                    _pg2 = _ctx2.new_page()
                    _pg2.set_default_timeout(60000)

                    # Try OPR.ae search endpoint
                    search_q = _re.sub(r"[^a-z0-9 ]", "", f"{project_name} {developer}".lower()).strip()
                    try:
                        _pg2.goto(f"https://opr.ae/projects/", wait_until="commit", timeout=60000)
                        _pg2.wait_for_selector("body", timeout=20000)
                    except Exception:
                        pass
                    _pg2.wait_for_timeout(2500)

                    # Find and use search input if available
                    for _sel in ["input[type='search']","input[name='search']",
                                 "input[placeholder*='earch' i]","[class*='search'] input",
                                 "input[type='text']"]:
                        _inp = _pg2.query_selector(_sel)
                        if _inp:
                            _inp.fill(f"{project_name} {developer}".strip())
                            _pg2.keyboard.press("Enter")
                            _pg2.wait_for_timeout(2500)
                            break

                    # Collect all project links on the resulting page
                    _links = _pg2.evaluate("""() => {
                        return [...new Set(
                          Array.from(document.querySelectorAll('a[href]'))
                            .map(a => a.href)
                            .filter(h => /opr\\.ae\\/projects\\/[a-z0-9][a-z0-9\\-]{4,}$/.test(h))
                        )];
                    }""")

                    # Score each link by how many project/developer words appear in the slug
                    all_words = set(
                        w for w in (_re.sub(r"[^a-z0-9 ]","",
                            f"{project_name} {developer}".lower())).split()
                        if len(w) > 2
                    )
                    def _score(link):
                        slug = link.split("/projects/")[-1]
                        return sum(1 for w in all_words if w in slug)

                    if _links:
                        best = max(_links, key=_score)
                        if _score(best) > 0:
                            opr_url = best
                            log_lines.append(f"  ✓ Found on OPR.ae: {opr_url}")
                        else:
                            log_lines.append("  No matching project found in search results")
                    else:
                        log_lines.append("  No project links found on search results page")

                    _br2.close()

            except Exception as _se:
                log_lines.append(f"  OPR.ae search error: {_se}")

            if not opr_url:
                msg = ("\n\n❌ Could not find this project on OPR.ae.\n"
                       "Paste the direct OPR.ae URL into the Direct URL field and try again.")
                jobs[job_id].update({"status":"done","success":False,
                                     "log":"\n".join(log_lines)+msg})
                return

            scraped = scrape_url_with_playwright(opr_url, "OPR.ae")

            # Validate the loaded page is actually about the right project
            page_title = (scraped.get("scraped_title") or "").lower()
            name_words = [w for w in project_name.lower().split() if len(w) > 3]
            if name_words and not any(w in page_title for w in name_words):
                log_lines.append(f"  ⚠ Page title '{scraped.get('scraped_title')}' doesn't match '{project_name}'")
                log_lines.append("  ⚠ Data may be from wrong page — recommend pasting the direct URL")
        elif source == "propertyfinder" and project_name:
            query = "+".join(project_name.split())
            scraped = scrape_url_with_playwright(
                f"https://www.propertyfinder.ae/en/search?q={query}&category=1&purpose=for-sale",
                "PropertyFinder"
            )
        elif source == "bayut" and project_name:
            query = "-".join(project_name.lower().split())
            scraped = scrape_url_with_playwright(
                f"https://www.bayut.com/to-buy/property/dubai/?q={query}",
                "Bayut"
            )
        else:
            jobs[job_id].update({"status":"done","success":False,"log":"Please provide a project name or URL."})
            return

        log_lines.append(f"  Scraped {len(scraped)} fields")

        # ── GPT structuring ──
        if OPENAI_KEY and scraped.get("full_text"):
            log_lines.append("Running GPT to structure data...")
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_KEY)

            prompt = f"""You are a data extraction assistant for a Dubai real estate portal.

Extract structured data from this scraped web page and return ONLY a valid JSON object.
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
  "lat": 0.0,
  "lng": 0.0
}}

COORDINATE RULES:
- lat/lng MUST be precise GPS coordinates for the specific community/masterplan, not generic city center.
- Dubai city center (25.2048, 55.2708) is WRONG for most projects — only use it for Downtown Dubai.
- Sobha Sanctuary/Dubailand ≈ 24.9983, 55.4280
- Al Marjan Island/RAK ≈ 25.6729, 55.9355
- Palm Jumeirah ≈ 25.1124, 55.1390
- Dubai Hills Estate ≈ 25.1133, 55.2523
- Creek Harbour ≈ 25.1974, 55.3433
- Business Bay ≈ 25.1865, 55.2633
- Jumeirah Village Circle ≈ 25.0624, 55.2006
- If unsure, use the known coordinates for the community/emirate from your training data.

RULES:
- property_types, amenities, investment_potential, lifestyle_tags, seo_keywords: always arrays
- lifestyle_tags only from: beachfront waterfront golf_course equestrian city_center
  island_living mountain_view forest_living marina_view downtown desert_living ski_in_ski_out
- payment_plan_detail: array of {{stage, percentage}}
- floor_plans: array of {{type, beds, baths, sqft_min, sqft_max}}
- faqs: exactly 15 {{question, answer}} objects with real content
- status: off_plan | under_construction | ready | completed
- lat/lng: best estimate coordinates for the area

SCRAPED TEXT:
{scraped.get('full_text','')}

SCRAPED FLOOR PLAN DATA (structure these into the floor_plans array):
{scraped.get('scraped_floor_plans', 'None found')}"""

            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role":"user","content":prompt}],
                temperature=0.2,
            )
            raw = resp.choices[0].message.content.strip()
            raw = _re.sub(r"```json|```","",raw).strip()
            result = json.loads(raw)
            log_lines.append("  ✓ GPT structured the data")
        else:
            # Fallback: use raw scraped data
            result = {
                "name":              project_name or scraped.get("scraped_title",""),
                "developer":         developer,
                "area":              "",
                "description_short": scraped.get("scraped_description","")[:200],
                "description_long":  scraped.get("scraped_description",""),
                "amenities":         scraped.get("scraped_amenities",[]),
            }

        # Patch in scraped values if GPT didn't fill them
        if not result.get("name") and scraped.get("scraped_title"):
            result["name"] = scraped["scraped_title"]
        if not result.get("amenities") and scraped.get("scraped_amenities"):
            result["amenities"] = scraped["scraped_amenities"]

        # ── Patch real coordinates from Google Maps iframe (most accurate) ──
        if scraped.get("map_lat"):
            result["lat"] = scraped["map_lat"]
            result["lng"] = scraped["map_lng"]
            log_lines.append(f"  📍 Real coords from page iframe: {result['lat']:.5f}, {result['lng']:.5f}")

        # ── Fallback geocode from area name if still generic ─────────────────
        area_name    = result.get("area","")
        developer_name = result.get("developer","")
        emirate_name = result.get("emirate","Dubai")
        gpt_lat      = result.get("lat", 25.2048)
        gpt_lng      = result.get("lng", 55.2708)
        is_generic   = (abs(gpt_lat - 25.2048) < 0.001 and abs(gpt_lng - 55.2708) < 0.001)

        if area_name and is_generic:
            try:
                import requests as _greq
                from urllib.parse import quote as _uq
                # Try progressively broader queries until one returns a result
                _geo_queries = [
                    f"{area_name}, {emirate_name}, UAE",
                    f"{area_name} {developer_name}, {emirate_name}, UAE",
                    f"{area_name} Dubai UAE",
                    f"{area_name}, UAE",
                ]
                for geo_query in _geo_queries:
                    geo_url  = f"https://nominatim.openstreetmap.org/search?q={_uq(geo_query)}&format=json&limit=1&countrycodes=ae"
                    geo_r    = _greq.get(geo_url, headers={"User-Agent":"ElysianPortal/1.0"}, timeout=8)
                    geo_data = geo_r.json()
                    if geo_data:
                        result["lat"] = float(geo_data[0]["lat"])
                        result["lng"] = float(geo_data[0]["lon"])
                        log_lines.append(f"  📍 Geocoded '{geo_query}' → {result['lat']:.5f}, {result['lng']:.5f}")
                        break
                else:
                    log_lines.append(f"  ⚠ Geocoding: no result for '{area_name}' — check coordinates manually")
            except Exception as geo_err:
                log_lines.append(f"  ⚠ Geocoding failed: {geo_err}")

        # Pass raw scraped images — user tags and uploads from Section 8 UI
        scraped_imgs = scraped.get("scraped_images", [])
        result["images"]          = scraped_imgs
        result["image_main"]      = scraped_imgs[0] if scraped_imgs else None
        result["images_exterior"] = scraped.get("exterior_imgs", [])
        result["images_interior"] = scraped.get("interior_imgs", [])
        if scraped_imgs:
            log_lines.append(f"  Found {len(scraped_imgs)} image(s) — tag and upload from Section 8")

        log_lines.append("✅ Done — review the data below.")
        jobs[job_id].update({"status":"done","success":True,"log":"\n".join(log_lines),"result":result})

    except Exception as e:
        import traceback
        jobs[job_id].update({
            "status":"done","success":False,
            "log":"\n".join(log_lines)+f"\n\n❌ Error: {e}\n{traceback.format_exc()}"
        })


def safe_int(val):
    if val in (None, "", "null", "None"): return None
    try: return int(str(val).replace(",","").replace(" ",""))
    except Exception: return None

def _parse_csv(val):
    if isinstance(val, list):
        return val
    return [x.strip() for x in str(val).split(",") if x.strip()] if val else []

def _safe_float(val):
    try:
        return float(val) if val else None
    except Exception:
        return None

def _parse_json_field(json_str, fallback):
    try:
        return json.loads(json_str) if json_str and json_str.strip() else fallback
    except Exception:
        return fallback


@app.route("/projects/scrape/save", methods=["POST"])
@login_required
def scrape_save():
    data = request.get_json() or {}

    def slugify(s):
        return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

    def _lines_to_list(v):
        if isinstance(v, list): return v
        return [x.strip() for x in str(v).splitlines() if x.strip()] if v else []

    def _parse_handover(s):
        if not s: return None, None
        q = re.search(r"(Q[1-4])", str(s), re.IGNORECASE)
        y = re.search(r"(20\d{2})", str(s))
        return (q.group(1).upper() if q else None), (int(y.group(1)) if y else None)

    name = data.get("name","scraped-project")
    hq, hy = _parse_handover(data.get("handover",""))

    # Images
    try:
        all_images = json.loads(data.get("images_json","") or "[]")
    except Exception:
        all_images = []
    image_main    = data.get("image_main") or (all_images[0] if all_images else None)
    image_gallery = all_images[1:] if len(all_images) > 1 else []

    # Build slug matching extract.py's format
    area     = data.get("area","")
    emirate  = data.get("emirate","")
    dev      = data.get("developer","")
    base_slug = f"{name} by {dev} {area} {emirate}"
    slug      = re.sub(r"[^a-z0-9\s-]","",base_slug.lower().strip())
    slug      = re.sub(r"\s+","-",slug)
    slug      = re.sub(r"-+","-",slug).strip("-")[:70]

    # Auto-link: resolve developer_slug from developers table
    developer_slug = None
    if dev:
        first_word = dev.split()[0]
        try:
            dev_res = db.table("developers").select("slug").ilike("name", f"%{first_word}%").limit(1).execute()
            if dev_res.data:
                developer_slug = dev_res.data[0]["slug"]
        except Exception:
            pass

    # Auto-link: resolve area_slug from areas table
    area_slug_val = None
    if area:
        area_key = area.split(",")[0].strip()
        try:
            area_res = db.table("areas").select("slug").ilike("name", f"%{area_key}%").eq("is_published", True).limit(1).execute()
            if area_res.data:
                area_slug_val = area_res.data[0]["slug"]
        except Exception:
            pass

    record = {
        "slug":                 slug,
        "name":                 name,
        "tagline":              data.get("tagline"),
        "is_published":         False,
        "is_featured":          False,
        "permit_number":        data.get("permit_number"),
        "property_types":       _parse_csv(data.get("property_types","")),
        "status":               data.get("status","off_plan"),
        "completion_pct":       safe_int(data.get("completion_pct")) or 0,
        "total_units":          safe_int(data.get("total_units")),
        "handover_quarter":     hq,
        "handover_year":        hy,
        "price_from":           safe_int(data.get("price_from")),
        "price_to":             safe_int(data.get("price_to")),
        "bedroom_min":          safe_int(data.get("bedroom_min")),
        "bedroom_max":          safe_int(data.get("bedroom_max")),
        "size_sqft_min":        safe_int(data.get("size_sqft_min")),
        "size_sqft_max":        safe_int(data.get("size_sqft_max")),
        "payment_plan_summary": data.get("payment_plan_summary"),
        "payment_plan_detail":  data.get("payment_plan_detail"),
        "description_short":    data.get("description_short"),
        "description_long":     data.get("description_long"),
        "investment_potential": _lines_to_list(data.get("investment_potential","")),
        "amenities":            _lines_to_list(data.get("amenities","")),
        "lifestyle_tags":       _parse_csv(data.get("lifestyle_tags","")),
        "image_main":           image_main,
        "images_all":           all_images,
        "images_exterior":      _parse_json_field(data.get("images_exterior_json",""), [image_main] if image_main else []),
        "images_interior":      _parse_json_field(data.get("images_interior_json",""), image_gallery[:4]),
        "floor_plans":          data.get("floor_plans",[]),
        "aeo_faq":              data.get("faqs",[]),
        "latitude":             _safe_float(data.get("lat")),
        "longitude":            _safe_float(data.get("lng")),
        "geo_summary":          area,
        "whatsapp_share_text":  dev,
        "developer_slug":       developer_slug,
        "area_slug":            area_slug_val,
        "seo_title":            data.get("seo_title"),
        "seo_description":      data.get("seo_description"),
        "seo_keywords":         _parse_csv(data.get("seo_keywords","")),
        "data_source":          "web_scrape",
    }
    record = {k: v for k, v in record.items() if v is not None}

    try:
        res = db.table("projects").insert(record).execute()
        row = res.data[0]
        return jsonify({"success": True, "project_code": row.get("project_code"), "id": row.get("id")})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/projects/scrape/upload-images", methods=["POST"])
@login_required
def scrape_upload_images():
    """Upload tagged images to Cloudinary, organised by tag folder."""
    data   = request.get_json() or {}
    images = data.get("images", [])   # [{url, tag}, ...]
    if not images:
        return jsonify({"success": False, "error": "No images provided"})

    out = {
        "exterior":   [],
        "interior":   [],
        "amenity":    [],
        "floor_plan": [],
        "all":        [],
        "url_map":    {},
    }
    for item in images:
        url = item.get("url", "").strip()
        tag = item.get("tag", "exterior")
        if not url:
            continue
        cld = upload_image_to_cloudinary(url, folder=f"scraped-projects/{tag}")
        final = cld or url   # fall back to original if Cloudinary fails
        out["all"].append(final)
        out["url_map"][url] = final
        if tag in out:
            out[tag].append(final)

    return jsonify({"success": True, **out})


# ─────────────────────────────────────────────────────────────────────────────
# PLACEHOLDER PAGES
# ─────────────────────────────────────────────────────────────────────────────

def placeholder(title: str, icon: str, desc: str, active: str) -> str:
    content = f"""
    <div class="card" style="text-align:center;padding:64px 40px">
      <div style="font-size:48px;margin-bottom:20px">{icon}</div>
      <h2 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:22px;
                 color:{BRAND['dark']};margin-bottom:12px">{title}</h2>
      <p style="font-size:13px;color:{BRAND['grey']};line-height:1.8;max-width:480px;
                margin:0 auto 28px">{desc}</p>
      <span style="display:inline-block;padding:8px 20px;background:rgba(127,226,227,0.12);
                   color:{BRAND['grey']};border-radius:999px;font-size:11px;letter-spacing:0.08em">
        COMING SOON
      </span>
    </div>"""
    return page(title, content, active)

# ─── Blog module ──────────────────────────────────────────────────────────────

BLOG_CATS = ["Market News", "Area Guides", "Investment Tips", "Developer Profiles", "Project Updates"]

BLOG_FORM = r"""<link rel="stylesheet" href="https://cdn.quilljs.com/1.3.7/quill.snow.css">
<style>
  .ql-editor{min-height:380px;font-size:14px;font-family:Verdana,sans-serif;line-height:1.8}
  .ql-container,.ql-toolbar{border-color:#e0e0e0!important}
  .ql-container{border-radius:0 0 10px 10px!important}
  .ql-toolbar{border-radius:10px 10px 0 0!important;background:#fafafa}
  .blbl{display:block;font-size:11px;color:#7a8a9e;letter-spacing:.05em;text-transform:uppercase;font-weight:700;margin-bottom:5px}
  .binp{width:100%;padding:11px 14px;border:1.5px solid #e0e0e0;border-radius:10px;background:white;color:#192537;
        font-family:Verdana,sans-serif;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .2s}
  .binp:focus{border-color:#7fe2e3}
  .char-ct{font-size:11px;color:#bbb;text-align:right;margin-top:3px}
  .faq-row{background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:10px}
  .bsh{font-family:Montserrat,sans-serif;font-size:14px;font-weight:700;color:#192537;
       margin-bottom:16px;display:flex;align-items:center;gap:10px}
  .bsh::before{content:'';display:block;width:4px;height:18px;background:#7fe2e3;border-radius:2px;flex-shrink:0}
  @media(max-width:768px){.b2col{grid-template-columns:1fr!important}}
</style>

<div class="card" style="margin-bottom:20px">
  <div class="bsh">1 &middot; Post Basics</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px" class="b2col">
    <div><label class="blbl">Title *</label>
      <input id="b_title" class="binp" placeholder="How to Buy Off-Plan Property in Dubai" oninput="autoSlug()"></div>
    <div><label class="blbl">Slug (URL path)</label>
      <input id="b_slug" class="binp" placeholder="how-to-buy-off-plan-property-dubai"></div>
    <div><label class="blbl">Category</label>
      <select id="b_cat" class="binp">
        <option value="">&#8212; Select &#8212;</option>
        <option value="Market News">Market News</option>
        <option value="Area Guides">Area Guides</option>
        <option value="Investment Tips">Investment Tips</option>
        <option value="Developer Profiles">Developer Profiles</option>
        <option value="Project Updates">Project Updates</option>
      </select></div>
    <div><label class="blbl">Tags (comma-separated)</label>
      <input id="b_tags" class="binp" placeholder="off-plan, investment, dubai 2026"></div>
    <div><label class="blbl">Read Time (minutes)</label>
      <input id="b_read_time" type="number" class="binp" min="1" max="60" value="5"></div>
    <div><label class="blbl">Cover Image URL</label>
      <input id="b_cover" class="binp" placeholder="https://res.cloudinary.com/..." oninput="previewCover(this.value)"></div>
  </div>
  <div id="coverPreview" style="display:none;margin-top:4px">
    <img id="coverImg" src="" alt="Cover"
      style="max-width:100%;max-height:220px;border-radius:12px;object-fit:cover;display:block">
  </div>
  <div id="imgPickerStatus" style="font-size:12px;color:#7a8a9e;margin-top:8px;display:none"></div>
  <div id="imgPickerWrap" style="display:none;margin-top:12px">
    <div style="font-size:12px;color:#7a8a9e;margin-bottom:8px">Choose a cover image &mdash; click &ldquo;Use This&rdquo; to upload to Cloudinary:</div>
    <div id="imgPickerGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div>
    <div style="font-size:11px;color:#aaa;margin-top:6px">Photos via Pexels</div>
  </div>
</div>

<div class="card" style="margin-bottom:20px">
  <div class="bsh">2 &middot; Content</div>
  <label class="blbl">AEO Direct-Answer Snippet
    <span style="font-weight:400;color:#bbb;text-transform:none;letter-spacing:0">
      &#8212; 1&#8211;2 sentence answer for AI &amp; voice search
    </span>
  </label>
  <textarea id="b_aeo" class="binp" rows="2" style="margin-bottom:18px"
    placeholder="Off-plan properties in Dubai allow buyers to purchase directly from developers at pre-launch prices, typically 20&#8211;40% below market value."></textarea>
  <label class="blbl">Article Body (rich text)</label>
  <div id="quill-editor" style="background:white;margin-bottom:18px"></div>
  <input type="hidden" id="b_content">
  <label class="blbl">Excerpt
    <span style="font-weight:400;color:#bbb;text-transform:none;letter-spacing:0">
      &#8212; listing card summary, 155 chars max
    </span>
  </label>
  <textarea id="b_excerpt" class="binp" rows="2" maxlength="200" oninput="uc('exCt',this,155)"></textarea>
  <div class="char-ct"><span id="exCt">0</span>/155</div>
</div>

<div class="card" style="margin-bottom:20px">
  <div class="bsh">3 &middot; FAQs
    <span style="font-family:Verdana,sans-serif;font-size:11px;font-weight:400;color:#aaa;text-transform:none;letter-spacing:0">
      &#8212; FAQPage schema for Google
    </span>
  </div>
  <div id="faqRows"></div>
  <button type="button" onclick="addFaq('','')" class="btn btn-outline" style="margin-top:4px">+ Add FAQ</button>
</div>

<div class="card" style="margin-bottom:20px">
  <div class="bsh">4 &middot; Author</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px" class="b2col">
    <div><label class="blbl">Author Name</label>
      <input id="b_aname" class="binp" placeholder="Sarah Johnson"></div>
    <div><label class="blbl">Author Photo URL</label>
      <input id="b_aimg" class="binp" placeholder="https://..."></div>
  </div>
  <label class="blbl">Author Bio</label>
  <textarea id="b_abio" class="binp" rows="2"
    placeholder="Sarah is a Dubai property specialist with 8+ years of experience..."></textarea>
</div>

<div class="card" style="margin-bottom:20px">
  <div class="bsh">5 &middot; SEO</div>
  <label class="blbl">SEO Title
    <span style="font-weight:400;color:#bbb;text-transform:none;letter-spacing:0">&#8212; 60 chars max</span>
  </label>
  <input id="b_stitle" class="binp" maxlength="80"
    placeholder="How to Buy Off-Plan in Dubai 2026 | Elysian"
    oninput="uc('stCt',this,60)" style="margin-bottom:3px">
  <div class="char-ct"><span id="stCt">0</span>/60</div>
  <label class="blbl" style="margin-top:14px">SEO Description
    <span style="font-weight:400;color:#bbb;text-transform:none;letter-spacing:0">&#8212; 160 chars max</span>
  </label>
  <textarea id="b_sdesc" class="binp" rows="3" maxlength="200"
    placeholder="Complete guide to buying off-plan property in Dubai..."
    oninput="uc('sdCt',this,160)" style="margin-bottom:3px"></textarea>
  <div class="char-ct"><span id="sdCt">0</span>/160</div>
  <label class="blbl" style="margin-top:14px">SEO Keywords</label>
  <input id="b_skw" class="binp"
    placeholder="off-plan dubai, buy property dubai, dubai real estate 2026">
</div>

<div class="card" style="margin-bottom:20px">
  <div class="bsh">6 &middot; Publish Settings</div>
  <div style="display:flex;gap:32px;margin-bottom:18px;flex-wrap:wrap">
    <label style="display:flex;align-items:center;gap:8px;font-family:Verdana,sans-serif;font-size:13px;cursor:pointer">
      <input type="checkbox" id="b_pub" style="width:16px;height:16px;cursor:pointer">
      Published (live on site)
    </label>
    <label style="display:flex;align-items:center;gap:8px;font-family:Verdana,sans-serif;font-size:13px;cursor:pointer">
      <input type="checkbox" id="b_feat" style="width:16px;height:16px;cursor:pointer">
      Featured (hero card on blog page)
    </label>
  </div>
  <label class="blbl">Related Project Slugs
    <span style="font-weight:400;color:#bbb;text-transform:none;letter-spacing:0">&#8212; comma-separated</span>
  </label>
  <input id="b_rsl" class="binp" placeholder="the-woods-sobha, sobha-one-dubai">
  <div id="suggestedProjects" style="display:none;margin-top:8px">
    <div style="font-size:11px;color:#7a8a9e;margin-bottom:6px">AI-detected related projects &mdash; click to add:</div>
    <div id="suggestedChips" style="display:flex;gap:6px;flex-wrap:wrap"></div>
  </div>
</div>

<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding-bottom:48px">
  <button type="button" onclick="aiDraft()" class="btn btn-outline" id="aiBtn">&#10024; AI Draft</button>
  <button type="button" onclick="humanize()" class="btn btn-outline" id="humanBtn"
    style="border-color:#7fe2e3;color:#192537">&#129504; Humanize</button>
  <button type="button" onclick="saveBlog()" class="btn btn-teal" id="saveBtn">Save Post</button>
  <span id="blogSt" style="font-size:12px;color:#7a8a9e"></span>
</div>

<script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>
<script>
const quill = new Quill('#quill-editor', {
  theme: 'snow',
  modules: { toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'blockquote'],
    ['clean']
  ]},
  placeholder: 'Write your article here...'
});
quill.on('text-change', () => {
  document.getElementById('b_content').value = quill.root.innerHTML;
});

let _fi = 0;

function uc(sid, el, max) {
  const c = document.getElementById(sid);
  if (!c) return;
  c.textContent = el.value.length;
  c.style.color = el.value.length > max ? '#ef4444' : '#bbb';
}

function autoSlug() {
  const t = document.getElementById('b_title').value;
  document.getElementById('b_slug').value = t.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function previewCover(url) {
  const p = document.getElementById('coverPreview'), img = document.getElementById('coverImg');
  if (url && url.startsWith('http')) { img.src = url; p.style.display = 'block'; }
  else p.style.display = 'none';
}

function addFaq(q, a) {
  const idx = _fi++;
  const row = document.createElement('div');
  row.className = 'faq-row'; row.id = 'fr_' + idx;
  const hd = document.createElement('div');
  hd.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';
  const lb = document.createElement('span');
  lb.style.cssText = 'font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase';
  lb.textContent = 'FAQ ' + (idx + 1);
  const dl = document.createElement('button');
  dl.type = 'button'; dl.innerHTML = '&times;';
  dl.style.cssText = 'background:none;border:none;cursor:pointer;color:#ef4444;font-size:22px;line-height:1;padding:0';
  dl.onclick = () => document.getElementById('fr_' + idx).remove();
  hd.appendChild(lb); hd.appendChild(dl);
  const qi = document.createElement('input');
  qi.type = 'text'; qi.placeholder = 'Question'; qi.value = q || '';
  qi.className = 'faq-q';
  qi.style.cssText = 'width:100%;padding:9px 12px;border:1.5px solid #e5e5e5;border-radius:8px;' +
    'font-family:Verdana,sans-serif;font-size:13px;box-sizing:border-box;margin-bottom:8px';
  const at = document.createElement('textarea');
  at.placeholder = 'Answer'; at.rows = 2; at.value = a || '';
  at.className = 'faq-a';
  at.style.cssText = 'width:100%;padding:9px 12px;border:1.5px solid #e5e5e5;border-radius:8px;' +
    'font-family:Verdana,sans-serif;font-size:13px;box-sizing:border-box;resize:vertical';
  row.appendChild(hd); row.appendChild(qi); row.appendChild(at);
  document.getElementById('faqRows').appendChild(row);
}

function getFaqs() {
  return [...document.querySelectorAll('.faq-row')].map(r => ({
    q: r.querySelector('.faq-q').value.trim(),
    a: r.querySelector('.faq-a').value.trim()
  })).filter(f => f.q && f.a);
}

function getBlogData() {
  document.getElementById('b_content').value = quill.root.innerHTML;
  return {
    title:           document.getElementById('b_title').value.trim(),
    slug:            document.getElementById('b_slug').value.trim(),
    category:        document.getElementById('b_cat').value,
    tags:            document.getElementById('b_tags').value.split(',').map(s => s.trim()).filter(Boolean),
    read_time:       parseInt(document.getElementById('b_read_time').value) || 5,
    cover_image:     document.getElementById('b_cover').value.trim(),
    aeo_snippet:     document.getElementById('b_aeo').value.trim(),
    content:         quill.root.innerHTML,
    excerpt:         document.getElementById('b_excerpt').value.trim(),
    faqs:            getFaqs(),
    author_name:     document.getElementById('b_aname').value.trim(),
    author_image:    document.getElementById('b_aimg').value.trim(),
    author_bio:      document.getElementById('b_abio').value.trim(),
    seo_title:       document.getElementById('b_stitle').value.trim(),
    seo_description: document.getElementById('b_sdesc').value.trim(),
    seo_keywords:    document.getElementById('b_skw').value.trim(),
    published:       document.getElementById('b_pub').checked,
    featured:        document.getElementById('b_feat').checked,
    related_project_slugs: document.getElementById('b_rsl').value.split(',').map(s => s.trim()).filter(Boolean),
  };
}

async function saveBlog() {
  const d = getBlogData();
  if (!d.title) { alert('Please enter a title'); return; }
  if (!d.slug) { autoSlug(); d.slug = document.getElementById('b_slug').value.trim(); }
  const btn = document.getElementById('saveBtn'), st = document.getElementById('blogSt');
  btn.disabled = true; st.textContent = 'Saving...'; st.style.color = '#7a8a9e';
  try {
    const pid = (document.getElementById('b_post_id') || {}).value || null;
    const r = await fetch('/blog/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, d, { id: pid }))
    });
    const j = await r.json();
    if (j.success) {
      st.textContent = '✓ Saved!'; st.style.color = '#10b981';
      if (!pid && j.id) {
        const hi = document.createElement('input');
        hi.type = 'hidden'; hi.id = 'b_post_id'; hi.value = j.id;
        document.body.appendChild(hi);
        history.replaceState(null, '', '/blog/edit/' + j.id);
      }
    } else {
      st.textContent = 'Error: ' + (j.error || 'Unknown'); st.style.color = '#ef4444';
    }
  } catch(e) { st.textContent = 'Network error'; st.style.color = '#ef4444'; }
  btn.disabled = false;
}

async function aiDraft() {
  const title = document.getElementById('b_title').value.trim();
  if (!title) { alert('Enter a title first'); return; }
  const btn = document.getElementById('aiBtn'), st = document.getElementById('blogSt');
  btn.disabled = true; btn.textContent = 'Drafting...';
  st.textContent = 'AI writing your article — ~30 seconds...'; st.style.color = '#7a8a9e';
  try {
    const r = await fetch('/blog/ai-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title })
    });
    const j = await r.json();
    if (j.success) {
      if (j.content) {
        quill.root.innerHTML = j.content;
        document.getElementById('b_content').value = j.content;
      }
      const sv = (id, val) => { const e = document.getElementById(id); if (e && val != null) e.value = val; };
      sv('b_aeo', j.aeo_snippet); sv('b_excerpt', j.excerpt);
      sv('b_stitle', j.seo_title); sv('b_sdesc', j.seo_description); sv('b_skw', j.seo_keywords);
      if (j.tags && j.tags.length) sv('b_tags', j.tags.join(', '));
      if (j.read_time) sv('b_read_time', j.read_time);
      if (j.author_name) sv('b_aname', j.author_name);
      if (j.faqs && j.faqs.length) {
        document.getElementById('faqRows').innerHTML = ''; _fi = 0;
        j.faqs.forEach(f => addFaq(f.q || f.question || '', f.a || f.answer || ''));
      }
      if (j.category) {
        const sel = document.getElementById('b_cat');
        [...sel.options].forEach(o => { if (o.value === j.category) o.selected = true; });
      }
      if (j.suggested_projects && j.suggested_projects.length) showSuggestedProjects(j.suggested_projects);
      uc('exCt', document.getElementById('b_excerpt'), 155);
      uc('stCt', document.getElementById('b_stitle'), 60);
      uc('sdCt', document.getElementById('b_sdesc'), 160);
      st.textContent = '✓ AI draft ready — review and save!'; st.style.color = '#10b981';
      searchImages(title);
    } else {
      st.textContent = 'AI error: ' + (j.error || 'Try again'); st.style.color = '#ef4444';
    }
  } catch(e) { st.textContent = 'Network error'; st.style.color = '#ef4444'; }
  btn.disabled = false; btn.textContent = '✨ AI Draft';
}

async function searchImages(query) {
  const wrap = document.getElementById('imgPickerWrap');
  const ps   = document.getElementById('imgPickerStatus');
  ps.style.display = 'block'; ps.textContent = 'Searching for cover images...';
  try {
    const r = await fetch('/blog/search-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query })
    });
    const j = await r.json();
    if (j.success && j.photos && j.photos.length) {
      showImagePicker(j.photos);
      ps.style.display = 'none';
    } else {
      ps.textContent = j.error || 'No images found — add PEXELS_KEY to .env';
    }
  } catch(e) { ps.textContent = 'Image search failed'; }
}

function showImagePicker(photos) {
  const grid = document.getElementById('imgPickerGrid');
  const wrap = document.getElementById('imgPickerWrap');
  grid.innerHTML = '';
  photos.forEach(photo => {
    const cell = document.createElement('div');
    cell.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;background:#f0f0f0';
    const img = document.createElement('img');
    img.src = photo.thumb; img.alt = photo.credit;
    img.style.cssText = 'width:100%;height:90px;object-fit:cover;display:block';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(25,37,55,0.7);padding:4px 6px;display:flex;justify-content:space-between;align-items:center';
    const credit = document.createElement('span');
    credit.style.cssText = 'font-size:10px;color:#ccc;font-family:Verdana,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%';
    credit.textContent = photo.credit;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = 'Use This';
    btn.style.cssText = 'font-size:10px;padding:2px 7px;background:#7fe2e3;color:#192537;border:none;border-radius:4px;cursor:pointer;font-family:Verdana,sans-serif;font-weight:700;white-space:nowrap;flex-shrink:0';
    btn.onclick = () => approveImage(photo.full, btn);
    overlay.appendChild(credit); overlay.appendChild(btn);
    cell.appendChild(img); cell.appendChild(overlay);
    grid.appendChild(cell);
  });
  wrap.style.display = 'block';
}

async function approveImage(url, btn) {
  btn.textContent = '...'; btn.disabled = true;
  try {
    const r = await fetch('/blog/approve-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });
    const j = await r.json();
    if (j.success) {
      document.getElementById('b_cover').value = j.url;
      previewCover(j.url);
      document.getElementById('imgPickerWrap').style.display = 'none';
      document.getElementById('imgPickerStatus').style.display = 'none';
    } else {
      btn.textContent = 'Error'; btn.disabled = false;
      alert('Upload failed: ' + (j.error || 'Check Cloudinary credentials'));
    }
  } catch(e) { btn.textContent = 'Error'; btn.disabled = false; }
}

function showSuggestedProjects(projects) {
  const wrap  = document.getElementById('suggestedProjects');
  const chips = document.getElementById('suggestedChips');
  chips.innerHTML = '';
  projects.forEach(p => {
    const chip = document.createElement('button');
    chip.type = 'button'; chip.textContent = p.name;
    chip.style.cssText = 'font-size:11px;padding:3px 10px;background:#f0f8ff;border:1.5px solid #7fe2e3;border-radius:20px;cursor:pointer;font-family:Verdana,sans-serif;color:#192537';
    chip.onclick = () => {
      const inp = document.getElementById('b_rsl');
      const cur = inp.value.trim();
      inp.value = cur ? cur + ', ' + p.slug : p.slug;
      chip.style.background = '#7fe2e3'; chip.disabled = true;
    };
    chips.appendChild(chip);
  });
  wrap.style.display = 'block';
}

async function humanize() {
  const content = quill.root.innerHTML;
  if (!content || content === '<p><br></p>') { alert('Nothing to humanize — write or draft content first'); return; }
  const btn = document.getElementById('humanBtn'), st = document.getElementById('blogSt');
  btn.disabled = true; btn.textContent = 'Humanizing...';
  st.textContent = 'Rewriting in human voice — ~15 seconds...'; st.style.color = '#7a8a9e';
  try {
    const r = await fetch('/blog/humanize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content })
    });
    const j = await r.json();
    if (j.success && j.content) {
      quill.root.innerHTML = j.content;
      document.getElementById('b_content').value = j.content;
      st.textContent = '✓ Content humanized!'; st.style.color = '#10b981';
    } else {
      st.textContent = 'Error: ' + (j.error || 'Try again'); st.style.color = '#ef4444';
    }
  } catch(e) { st.textContent = 'Network error'; st.style.color = '#ef4444'; }
  btn.disabled = false; btn.textContent = '🧠 Humanize';
}

(function prefill() {
  const p = window.__BLOG_POST__;
  if (!p) return;
  const sv = (id, val) => { const e = document.getElementById(id); if (e && val != null) e.value = val; };
  sv('b_title', p.title); sv('b_slug', p.slug); sv('b_cat', p.category);
  sv('b_tags', (p.tags || []).join(', ')); sv('b_read_time', p.read_time || 5);
  sv('b_cover', p.cover_image || ''); sv('b_aeo', p.aeo_snippet || '');
  sv('b_excerpt', p.excerpt || ''); sv('b_aname', p.author_name || '');
  sv('b_aimg', p.author_image || ''); sv('b_abio', p.author_bio || '');
  sv('b_stitle', p.seo_title || ''); sv('b_sdesc', p.seo_description || '');
  sv('b_skw', p.seo_keywords || '');
  sv('b_rsl', (p.related_project_slugs || []).join(', '));
  if (p.published) document.getElementById('b_pub').checked = true;
  if (p.featured)  document.getElementById('b_feat').checked = true;
  if (p.cover_image) previewCover(p.cover_image);
  if (p.content) {
    quill.root.innerHTML = p.content;
    document.getElementById('b_content').value = p.content;
  }
  if (p.faqs && p.faqs.length) {
    _fi = 0; p.faqs.forEach(f => addFaq(f.q || f.question || '', f.a || f.answer || ''));
  }
  if (p.id) {
    const hi = document.createElement('input');
    hi.type = 'hidden'; hi.id = 'b_post_id'; hi.value = p.id;
    document.body.appendChild(hi);
  }
  uc('exCt', document.getElementById('b_excerpt'), 155);
  uc('stCt', document.getElementById('b_stitle'), 60);
  uc('sdCt', document.getElementById('b_sdesc'), 160);
})();
</script>"""


@app.route("/blog")
@login_required
def blog():
    try:
        rows = db.table("blog_posts").select(
            "id,title,slug,category,published,featured,created_at,read_time"
        ).order("created_at", desc=True).execute().data or []
    except Exception:
        rows = []
    rows_html = ""
    for r in rows:
        status_badge = (
            '<span class="badge badge-green">Published</span>'
            if r.get("published") else
            '<span class="badge badge-orange">Draft</span>'
        )
        feat = " &#9733;" if r.get("featured") else ""
        date = (r.get("created_at") or "")[:10] or "&#8212;"
        rows_html += f"""
        <tr>
          <td>
            <strong style="font-size:14px">{r.get('title', '&#8212;')}</strong>
            <div style="font-size:11px;color:#aaa;margin-top:2px">/blog/{r.get('slug', '')}</div>
          </td>
          <td><span class="badge badge-teal">{r.get('category', '&#8212;')}</span></td>
          <td>{status_badge}{feat}</td>
          <td style="font-size:13px">{r.get('read_time', '&#8212;')} min</td>
          <td style="font-size:13px">{date}</td>
          <td style="white-space:nowrap">
            <a href="/blog/edit/{r['id']}" class="btn btn-outline"
               style="padding:6px 14px;font-size:11px;margin-right:6px">Edit</a>
            <form method="POST" action="/blog/delete/{r['id']}" style="display:inline"
                  onsubmit="return confirm('Delete this post permanently?')">
              <button type="submit" class="btn btn-outline"
                style="padding:6px 14px;font-size:11px;color:#ef4444;border-color:#ef4444">Delete</button>
            </form>
          </td>
        </tr>"""
    empty = ('<tr><td colspan="6" style="text-align:center;padding:48px;color:#aaa;font-size:13px">'
             'No posts yet &#8212; click New Post to create your first article</td></tr>')
    content = f"""
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <p style="font-size:13px;color:{BRAND['grey']}">{len(rows)} post{'s' if len(rows) != 1 else ''} in database</p>
      <a href="/blog/new" class="btn btn-teal">+ New Post</a>
    </div>
    <div class="card">
      <table>
        <thead><tr>
          <th>Title &amp; Slug</th><th>Category</th><th>Status</th>
          <th>Read Time</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>{rows_html or empty}</tbody>
      </table>
    </div>"""
    return page("Blog", content, "blog")


@app.route("/blog/new")
@login_required
def blog_new():
    return page("New Blog Post", BLOG_FORM, "blog")


@app.route("/blog/edit/<blog_id>")
@login_required
def blog_edit(blog_id):
    import base64 as _b64
    row = db.table("blog_posts").select("*").eq("id", blog_id).single().execute().data
    if not row:
        flash("Post not found.", "error")
        return redirect(url_for("blog"))
    b64 = _b64.b64encode(json.dumps(row, default=str).encode()).decode()
    inject = f'<script>window.__BLOG_POST__=JSON.parse(atob("{b64}"));</script>\n'
    return page("Edit Blog Post", inject + BLOG_FORM, "blog")


@app.route("/blog/save", methods=["POST"])
@login_required
def blog_save():
    data = request.get_json() or {}
    if not data.get("title") or not data.get("slug"):
        return jsonify({"success": False, "error": "Title and slug are required"})
    payload = {
        "title":                 str(data.get("title", "")).strip(),
        "slug":                  str(data.get("slug",  "")).strip(),
        "category":              data.get("category", ""),
        "tags":                  data.get("tags", []),
        "read_time":             int(data.get("read_time") or 5),
        "cover_image":           str(data.get("cover_image", "")).strip(),
        "aeo_snippet":           str(data.get("aeo_snippet", "")).strip(),
        "content":               data.get("content", ""),
        "excerpt":               str(data.get("excerpt", "")).strip(),
        "faqs":                  data.get("faqs", []),
        "author_name":           str(data.get("author_name", "")).strip(),
        "author_image":          str(data.get("author_image", "")).strip(),
        "author_bio":            str(data.get("author_bio", "")).strip(),
        "seo_title":             str(data.get("seo_title", "")).strip(),
        "seo_description":       str(data.get("seo_description", "")).strip(),
        "seo_keywords":          str(data.get("seo_keywords", "")).strip(),
        "published":             bool(data.get("published", False)),
        "featured":              bool(data.get("featured", False)),
        "related_project_slugs": data.get("related_project_slugs", []),
        "updated_at":            datetime.utcnow().isoformat(),
    }
    post_id = data.get("id")
    try:
        if post_id:
            db.table("blog_posts").update(payload).eq("id", post_id).execute()
            return jsonify({"success": True, "id": post_id})
        else:
            payload["id"] = str(uuid.uuid4())
            result = db.table("blog_posts").insert(payload).execute()
            new_id = (result.data or [{}])[0].get("id", payload["id"])
            return jsonify({"success": True, "id": new_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/blog/delete/<blog_id>", methods=["POST"])
@login_required
def blog_delete(blog_id):
    try:
        db.table("blog_posts").delete().eq("id", blog_id).execute()
        flash("Post deleted.", "ok")
    except Exception as e:
        flash(f"Delete failed: {e}", "error")
    return redirect(url_for("blog"))


@app.route("/blog/ai-draft", methods=["POST"])
@login_required
def blog_ai_draft():
    data  = request.get_json() or {}
    title = str(data.get("title", "")).strip()
    if not title:
        return jsonify({"success": False, "error": "Title is required"})
    if not ANTHROPIC_KEY:
        return jsonify({"success": False, "error": "Add ANTHROPIC_KEY to .env (console.anthropic.com)"})
    try:
        # Fetch live project names for internal links
        try:
            proj_rows = db.table("projects").select("name,slug").execute().data or []
        except Exception:
            proj_rows = []
        proj_list = "\n".join(f"- {p['name']} → /projects/{p['slug']}" for p in proj_rows) if proj_rows else "none"

        # Pass 1 — structured JSON draft (Sonnet for quality writing)
        sys1 = (
            "You are a Dubai real estate content writer for Elysian, a premium property consultancy. "
            "Write engaging, SEO-optimised blog articles using real Dubai market knowledge. "
            "Format content as clean HTML using only: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>. "
            "No <html>, <body>, <head> tags. No markdown. "
            "Where relevant, hyperlink project names using <a href='/projects/slug'>Name</a> from the provided list. "
            "Return ONLY a valid JSON object — no code fences, no commentary."
        )
        prompt1 = f"""Write a complete blog article for Elysian Dubai real estate portal.

Title: {title}

Available project pages to link (use <a href> in content where relevant):
{proj_list}

Return a JSON object with exactly these fields:
- content: Full HTML article (900-1200 words, h2/h3/p/ul/li only, 2-3 internal <a> links)
- category: exactly one of: "Market News", "Area Guides", "Investment Tips", "Developer Profiles", "Project Updates"
- aeo_snippet: 1-2 sentence direct answer for voice/AI search
- excerpt: 100-155 char listing summary
- seo_title: 50-60 chars including Dubai and 2026
- seo_description: 130-155 chars
- seo_keywords: 5-8 comma-separated keywords
- tags: array of 3-5 lowercase tags
- read_time: reading minutes as integer
- author_name: "Elysian Advisory Team"
- faqs: array of 4-5 objects with q and a keys"""

        raw1  = _claude(sys1, prompt1, model="claude-sonnet-4-6", temp=0.7)
        raw1  = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw1.strip())
        draft = json.loads(raw1)

        # Pass 2 — humanise the HTML content (Sonnet follows style rules better)
        html_draft = draft.get("content", "")
        if html_draft:
            sys2 = (
                "You are editing a Dubai real estate blog article to sound genuinely human-written. "
                "BANNED WORDS — never use: crucial, essential, comprehensive, delve, leverage, utilize, utilise, "
                "pivotal, paramount, robust, navigate, foster, streamline, empower, transformative, game-changer. "
                "STYLE RULES: "
                "1. Mix sentence lengths — some 6-8 words, some 20-25 words, within every paragraph. "
                "2. Open with a hook: a client question, a surprising fact, or a short story. "
                "3. Use conversational phrases: 'you'll find', 'buyers often ask', 'one thing worth knowing'. "
                "4. Max 3 sentences per paragraph. "
                "5. Never start two consecutive paragraphs with the same word. "
                "6. Keep all HTML tags and <a href> links exactly as they are — only rewrite visible text. "
                "7. Include at least 2 specific Dubai numbers, prices, or percentages. "
                "Return ONLY the rewritten HTML — no commentary, no JSON wrapper."
            )
            humanised = _claude(sys2, html_draft, model="claude-sonnet-4-6", temp=0.85)
            draft["content"] = re.sub(r"```html|```", "", humanised).strip()

        # Build suggested_projects list from injected links
        linked_slugs = re.findall(r"/projects/([a-z0-9-]+)", draft.get("content", ""))
        slug_set = set(linked_slugs)
        draft["suggested_projects"] = [
            {"name": p["name"], "slug": p["slug"]}
            for p in proj_rows if p["slug"] in slug_set
        ]

        return jsonify({"success": True, **draft})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/blog/search-images", methods=["POST"])
@login_required
def blog_search_images():
    data  = request.get_json() or {}
    query = str(data.get("query", "")).strip()
    if not query:
        return jsonify({"success": False, "error": "Query required"})
    if not PEXELS_KEY:
        return jsonify({"success": False, "error": "Add PEXELS_KEY to .env — free key at pexels.com/api"})
    try:
        import urllib.request as _ur, urllib.parse as _up
        import re as _re
        clean_query = _re.sub(r'\s+by\s+\w[\w\s]*', '', query, flags=_re.IGNORECASE).strip()
        search_url = (
            "https://api.pexels.com/v1/search?query="
            + _up.quote(clean_query)
            + "&per_page=6&orientation=landscape"
        )
        req = _ur.Request(search_url, headers={
            "Authorization": PEXELS_KEY,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        })
        with _ur.urlopen(req, timeout=8) as resp:
            results = json.loads(resp.read())
        photos = [
            {"thumb": p["src"]["medium"], "full": p["src"]["large2x"], "credit": p["photographer"]}
            for p in results.get("photos", [])
        ]
        return jsonify({"success": True, "photos": photos})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/blog/approve-image", methods=["POST"])
@login_required
def blog_approve_image():
    data = request.get_json() or {}
    url  = str(data.get("url", "")).strip()
    if not url:
        return jsonify({"success": False, "error": "URL required"})
    cdn_url = upload_image_to_cloudinary(url, folder="blog-covers")
    if not cdn_url:
        return jsonify({"success": False, "error": "Cloudinary upload failed — check credentials in .env"})
    return jsonify({"success": True, "url": cdn_url})


@app.route("/blog/humanize", methods=["POST"])
@login_required
def blog_humanize():
    data    = request.get_json() or {}
    content = str(data.get("content", "")).strip()
    if not content:
        return jsonify({"success": False, "error": "No content provided"})
    if not ANTHROPIC_KEY:
        return jsonify({"success": False, "error": "Add ANTHROPIC_KEY to .env (console.anthropic.com)"})
    try:
        system = (
            "You are editing a Dubai real estate blog article to make it sound genuinely human-written. "
            "BANNED WORDS — never use: crucial, essential, comprehensive, delve, leverage, utilize, utilise, "
            "pivotal, paramount, robust, navigate, foster, streamline, empower, transformative, game-changer. "
            "STYLE RULES: "
            "1. Mix sentence lengths — some 6-8 words, some 20-25 words, within every paragraph. "
            "2. Open the first paragraph with a hook: a client question, a surprising fact, or a short story. "
            "3. Use conversational phrases: 'you'll find', 'buyers often ask', 'one thing worth knowing'. "
            "4. Max 3 sentences per paragraph — split long ones. "
            "5. Never start two consecutive paragraphs with the same word. "
            "6. Keep all HTML tags and <a href> links exactly as they are — only rewrite the visible text. "
            "7. Include at least 2 specific Dubai numbers, prices, or percentages. "
            "Return ONLY the rewritten HTML — no commentary, no JSON wrapper."
        )
        result = _claude(system, content, model="claude-sonnet-4-6", temp=0.85)
        result = re.sub(r"```html|```", "", result).strip()
        return jsonify({"success": True, "content": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

# ══════════════════════════════════════════════════════════════════════════════
#  DEVELOPERS MODULE
# ══════════════════════════════════════════════════════════════════════════════

DEV_FORM = r"""
<style>
.dsh{font-family:Montserrat,sans-serif;font-weight:700;font-size:11px;color:#7a8a9e;
  letter-spacing:.12em;text-transform:uppercase;padding:0 0 14px;
  border-bottom:2px solid #7fe2e3;margin-bottom:22px;display:flex;align-items:center;gap:8px}
.dsh::before{content:'';width:4px;height:16px;background:#7fe2e3;border-radius:2px;flex-shrink:0}
.dinp{width:100%;padding:10px 14px;border:1.5px solid #e5e5e5;border-radius:10px;
  font-family:Verdana,sans-serif;font-size:13px;color:#192537;background:white;box-sizing:border-box;
  transition:border-color .2s;outline:none}
.dinp:focus{border-color:#7fe2e3}
.dlbl{display:block;font-family:Verdana,sans-serif;font-size:11px;font-weight:700;
  color:#7a8a9e;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px}
.d2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.d3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.kp-row{background:#f8fafc;border:1px solid #e8ecf0;border-radius:10px;padding:12px 14px;margin-bottom:10px}
@media(max-width:700px){.d2,.d3{grid-template-columns:1fr!important}}
</style>

<div style="max-width:860px">

<!-- 1 · Basics -->
<div class="card" style="margin-bottom:20px">
  <div class="dsh">1 · Basics</div>
  <div class="d2" style="margin-bottom:16px">
    <div><label class="dlbl">Developer Name *</label>
      <input id="d_name" class="dinp" placeholder="Emaar Properties" oninput="autoDevSlug()"></div>
    <div><label class="dlbl">Slug (URL path) *</label>
      <input id="d_slug" class="dinp" placeholder="emaar-properties"></div>
  </div>
  <div class="d2" style="margin-bottom:16px">
    <div><label class="dlbl">Website</label>
      <input id="d_web" class="dinp" placeholder="emaar.com"></div>
    <div><label class="dlbl">Tagline</label>
      <input id="d_tag" class="dinp" placeholder="Building Communities, Creating Value"></div>
  </div>
  <div style="margin-bottom:16px">
    <label class="dlbl">Logo URL</label>
    <div style="display:flex;gap:10px">
      <input id="d_logo" class="dinp" placeholder="https://res.cloudinary.com/..." oninput="previewLogo(this.value)" style="flex:1">
      <button type="button" onclick="scrapeLogo()" id="scrapeBtn"
        class="btn btn-outline" style="white-space:nowrap;padding:10px 18px">🔍 Scrape Logo</button>
    </div>
    <div id="logoSt" style="font-size:12px;color:#7a8a9e;margin-top:6px"></div>
  </div>
  <div id="logoPreview" style="display:none;margin-top:8px;background:#f8fafc;border:1px solid #e8ecf0;border-radius:10px;padding:16px;text-align:center">
    <img id="logoImg" src="" alt="Logo" style="max-height:80px;max-width:240px;object-fit:contain">
  </div>
</div>

<!-- 2 · Company Details -->
<div class="card" style="margin-bottom:20px">
  <div class="dsh">2 · Company Details</div>
  <div class="d3" style="margin-bottom:16px">
    <div><label class="dlbl">Founded Year</label>
      <input id="d_founded" type="number" class="dinp" placeholder="1997"></div>
    <div><label class="dlbl">Total Units Delivered</label>
      <input id="d_units" class="dinp" placeholder="115,000+"></div>
    <div><label class="dlbl">Employees</label>
      <input id="d_emp" class="dinp" placeholder="12,000+"></div>
  </div>
  <div class="d2">
    <div><label class="dlbl">Headquarters</label>
      <input id="d_hq" class="dinp" placeholder="Downtown Dubai, UAE"></div>
    <div><label class="dlbl">RERA / DLD Registration No.</label>
      <input id="d_rera" class="dinp" placeholder="RERA-1234"></div>
  </div>
</div>

<!-- 3 · About -->
<div class="card" style="margin-bottom:20px">
  <div class="dsh">3 · About (shown on profile page)</div>
  <label class="dlbl">Description
    <span style="font-weight:400;color:#bbb;text-transform:none;letter-spacing:0"> — 2-4 paragraphs, separated by a blank line</span>
  </label>
  <textarea id="d_about" class="dinp" rows="8" placeholder="Emaar Properties is one of the world's largest real estate developers...&#10;&#10;Founded in 1997, their flagship development..."></textarea>
</div>

<!-- 4 · Focus & Reach -->
<div class="card" style="margin-bottom:20px">
  <div class="dsh">4 · Focus &amp; Reach</div>
  <div class="d2" style="margin-bottom:16px">
    <div><label class="dlbl">Areas (comma-separated)</label>
      <input id="d_areas" class="dinp" placeholder="Downtown Dubai, MBR City, Dubai Hills"></div>
    <div><label class="dlbl">Property Types (comma-separated)</label>
      <input id="d_ptypes" class="dinp" placeholder="Apartments, Villas, Townhouses"></div>
  </div>
  <div class="d2">
    <div><label class="dlbl">Price Range</label>
      <input id="d_price" class="dinp" placeholder="AED 800K – AED 50M"></div>
    <div><label class="dlbl">AEO Snippet (1-2 sentence direct answer)</label>
      <input id="d_aeo" class="dinp" placeholder="Emaar Properties is Dubai's largest developer..."></div>
  </div>
</div>

<!-- 5 · Strengths -->
<div class="card" style="margin-bottom:20px">
  <div class="dsh">5 · Why Invest (strengths)</div>
  <label class="dlbl">One strength per line</label>
  <textarea id="d_str" class="dinp" rows="5" placeholder="RERA-licensed developer&#10;100% on-time delivery record&#10;Strong resale &amp; rental demand&#10;Integrated community model"></textarea>
</div>

<!-- 6 · Key Projects -->
<div class="card" style="margin-bottom:20px">
  <div class="dsh">6 · Key Projects</div>
  <div id="kpRows"></div>
  <button type="button" onclick="addKP()" class="btn btn-outline" style="margin-top:6px;font-size:12px">+ Add Project</button>
</div>

<!-- 7 · FAQs -->
<div class="card" style="margin-bottom:20px">
  <div class="dsh">7 · FAQs (for Google rich results)</div>
  <div id="devFaqRows"></div>
  <button type="button" onclick="addDevFaq()" class="btn btn-outline" style="margin-top:6px;font-size:12px">+ Add FAQ</button>
</div>

<!-- 8 · SEO -->
<div class="card" style="margin-bottom:20px">
  <div class="dsh">8 · SEO</div>
  <div style="margin-bottom:14px">
    <label class="dlbl">SEO Title <span id="stCt" style="font-size:10px;font-weight:400;color:#bbb"></span></label>
    <input id="d_stitle" class="dinp" placeholder="Emaar Properties Dubai | Off-Plan &amp; Ready Projects 2026"
      oninput="uc('stCt',this,60)">
  </div>
  <div style="margin-bottom:14px">
    <label class="dlbl">SEO Description <span id="sdCt" style="font-size:10px;font-weight:400;color:#bbb"></span></label>
    <textarea id="d_sdesc" class="dinp" rows="2" placeholder="Explore Emaar Properties projects in Dubai..."
      oninput="uc('sdCt',this,155)"></textarea>
  </div>
  <div>
    <label class="dlbl">SEO Keywords</label>
    <input id="d_skw" class="dinp" placeholder="Emaar Properties, Emaar Dubai, Emaar off-plan 2026">
  </div>
</div>

<!-- 9 · Publish -->
<div class="card" style="margin-bottom:20px">
  <div class="dsh">9 · Publish</div>
  <label style="display:flex;align-items:center;gap:8px;font-family:Verdana,sans-serif;font-size:13px;cursor:pointer">
    <input type="checkbox" id="d_pub" style="width:16px;height:16px;cursor:pointer">
    Published (live on /developers page)
  </label>
</div>

<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding-bottom:48px">
  <button type="button" onclick="aiDev()" class="btn btn-outline" id="aiDevBtn">✨ AI Generate</button>
  <button type="button" onclick="saveDev()" class="btn btn-teal" id="saveDevBtn">Save Developer</button>
  <span id="devSt" style="font-size:12px;color:#7a8a9e"></span>
</div>

</div>

<script>
var _ki = 0, _dfi = 0;

function autoDevSlug() {
  const t = document.getElementById('d_name').value;
  document.getElementById('d_slug').value = t.toLowerCase()
    .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}

function previewLogo(url) {
  const p = document.getElementById('logoPreview'), img = document.getElementById('logoImg');
  if (url && url.startsWith('http')) { img.src = url; p.style.display = 'block'; }
  else p.style.display = 'none';
}

function uc(ctId, el, max) {
  const ct = document.getElementById(ctId);
  if (!ct) return;
  const n = (el.value||'').length;
  ct.textContent = n + '/' + max;
  ct.style.color = n > max ? '#ef4444' : '#bbb';
}

function addKP(name, location, type, status) {
  const idx = _ki++;
  const row = document.createElement('div');
  row.className = 'kp-row'; row.id = 'kp_' + idx;
  row.innerHTML = '';
  const hd = document.createElement('div');
  hd.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';
  const lb = document.createElement('span');
  lb.style.cssText = 'font-size:10px;color:#aaa;font-weight:700;text-transform:uppercase';
  lb.textContent = 'Project ' + (idx + 1);
  const dl = document.createElement('button');
  dl.type='button'; dl.innerHTML='&times;';
  dl.style.cssText='background:none;border:none;cursor:pointer;color:#ef4444;font-size:22px;line-height:1;padding:0';
  dl.onclick=()=>document.getElementById('kp_'+idx).remove();
  hd.appendChild(lb); hd.appendChild(dl);
  const grid = document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px';
  [['kp-name','Project Name','Burj Khalifa',name],
   ['kp-loc','Location','Downtown Dubai',location],
   ['kp-type','Type','Mixed-Use',type],
   ['kp-st','Status','Off-Plan / Ongoing / Completed',status]
  ].forEach(([cls,lbl,ph,val])=>{
    const wr=document.createElement('div');
    const la=document.createElement('label');
    la.style.cssText='display:block;font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;margin-bottom:5px';
    la.textContent=lbl;
    const inp=document.createElement('input');
    inp.type='text'; inp.placeholder=ph; inp.value=val||'';
    inp.className='dinp '+cls;
    inp.style.cssText='width:100%;padding:8px 12px;border:1.5px solid #e5e5e5;border-radius:8px;font-family:Verdana,sans-serif;font-size:12px;box-sizing:border-box';
    wr.appendChild(la); wr.appendChild(inp);
    grid.appendChild(wr);
  });
  row.appendChild(hd); row.appendChild(grid);
  document.getElementById('kpRows').appendChild(row);
}

function getKP() {
  return [...document.querySelectorAll('.kp-row')].map(r=>({
    name:     r.querySelector('.kp-name').value.trim(),
    location: r.querySelector('.kp-loc').value.trim(),
    type:     r.querySelector('.kp-type').value.trim(),
    status:   r.querySelector('.kp-st').value.trim()
  })).filter(p=>p.name);
}

function addDevFaq(q,a) {
  const idx=_dfi++;
  const row=document.createElement('div');
  row.className='faq-drow'; row.id='dfr_'+idx;
  row.style.cssText='background:#f8fafc;border:1px solid #e8ecf0;border-radius:10px;padding:12px 14px;margin-bottom:10px';
  const hd=document.createElement('div');
  hd.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';
  const lb=document.createElement('span');
  lb.style.cssText='font-size:10px;color:#aaa;font-weight:700;text-transform:uppercase';
  lb.textContent='FAQ '+(idx+1);
  const dl=document.createElement('button');
  dl.type='button'; dl.innerHTML='&times;';
  dl.style.cssText='background:none;border:none;cursor:pointer;color:#ef4444;font-size:22px;line-height:1;padding:0';
  dl.onclick=()=>document.getElementById('dfr_'+idx).remove();
  hd.appendChild(lb); hd.appendChild(dl);
  const qi=document.createElement('input');
  qi.type='text'; qi.placeholder='Question'; qi.value=q||'';
  qi.className='dfaq-q';
  qi.style.cssText='width:100%;padding:9px 12px;border:1.5px solid #e5e5e5;border-radius:8px;font-family:Verdana,sans-serif;font-size:13px;box-sizing:border-box;margin-bottom:8px';
  const at=document.createElement('textarea');
  at.placeholder='Answer'; at.rows=2; at.value=a||'';
  at.className='dfaq-a';
  at.style.cssText='width:100%;padding:9px 12px;border:1.5px solid #e5e5e5;border-radius:8px;font-family:Verdana,sans-serif;font-size:13px;box-sizing:border-box;resize:vertical';
  row.appendChild(hd); row.appendChild(qi); row.appendChild(at);
  document.getElementById('devFaqRows').appendChild(row);
}

function getDevFaqs() {
  return [...document.querySelectorAll('.faq-drow')].map(r=>({
    q:r.querySelector('.dfaq-q').value.trim(),
    a:r.querySelector('.dfaq-a').value.trim()
  })).filter(f=>f.q&&f.a);
}

function getDevData() {
  return {
    name:           document.getElementById('d_name').value.trim(),
    slug:           document.getElementById('d_slug').value.trim(),
    website:        document.getElementById('d_web').value.trim(),
    tagline:        document.getElementById('d_tag').value.trim(),
    logo_url:       document.getElementById('d_logo').value.trim(),
    founded_year:   parseInt(document.getElementById('d_founded').value)||null,
    total_units:    document.getElementById('d_units').value.trim(),
    employees:      document.getElementById('d_emp').value.trim(),
    headquarters:   document.getElementById('d_hq').value.trim(),
    rera_number:    document.getElementById('d_rera').value.trim(),
    about:          document.getElementById('d_about').value.trim(),
    areas:          document.getElementById('d_areas').value.split(',').map(s=>s.trim()).filter(Boolean),
    property_types: document.getElementById('d_ptypes').value.split(',').map(s=>s.trim()).filter(Boolean),
    price_range:    document.getElementById('d_price').value.trim(),
    aeo_snippet:    document.getElementById('d_aeo').value.trim(),
    strengths:      document.getElementById('d_str').value.split('\n').map(s=>s.trim()).filter(Boolean),
    key_projects:   getKP(),
    faqs:           getDevFaqs(),
    seo_title:      document.getElementById('d_stitle').value.trim(),
    seo_description:document.getElementById('d_sdesc').value.trim(),
    seo_keywords:   document.getElementById('d_skw').value.trim(),
    published:      document.getElementById('d_pub').checked,
  };
}

async function saveDev() {
  const d = getDevData();
  if (!d.name) { alert('Developer name is required'); return; }
  if (!d.slug) { autoDevSlug(); d.slug = document.getElementById('d_slug').value.trim(); }
  const btn = document.getElementById('saveDevBtn'), st = document.getElementById('devSt');
  btn.disabled=true; st.textContent='Saving...'; st.style.color='#7a8a9e';
  try {
    const pid = (document.getElementById('d_dev_id')||{}).value || null;
    const r = await fetch('/developers/save', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(Object.assign({},d,{id:pid}))
    });
    const j = await r.json();
    if (j.success) {
      st.textContent='✓ Saved!'; st.style.color='#10b981';
      if (!pid && j.id) {
        const hi=document.createElement('input');
        hi.type='hidden'; hi.id='d_dev_id'; hi.value=j.id;
        document.body.appendChild(hi);
        history.replaceState(null,'','/developers/edit/'+j.id);
      }
    } else { st.textContent='Error: '+(j.error||'Unknown'); st.style.color='#ef4444'; }
  } catch(e) { st.textContent='Network error'; st.style.color='#ef4444'; }
  btn.disabled=false;
}

async function scrapeLogo() {
  const name    = document.getElementById('d_name').value.trim();
  const website = document.getElementById('d_web').value.trim();
  if (!name && !website) { alert('Enter the developer name first'); return; }
  const btn=document.getElementById('scrapeBtn'), st=document.getElementById('logoSt');
  btn.disabled=true; btn.textContent='Searching...';
  st.textContent='Looking up logo on Wikipedia / website...'; st.style.color='#7a8a9e';
  try {
    const r=await fetch('/developers/scrape-logo',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name, website})
    });
    const j=await r.json();
    if (j.success && j.url) {
      document.getElementById('d_logo').value=j.url;
      previewLogo(j.url);
      const src=j.source?` (via ${j.source})`:'';
      st.textContent='✓ Logo uploaded to Cloudinary'+src; st.style.color='#10b981';
    } else { st.textContent='Error: '+(j.error||'No logo found'); st.style.color='#ef4444'; }
  } catch(e) { st.textContent='Network error'; st.style.color='#ef4444'; }
  btn.disabled=false; btn.textContent='🔍 Scrape Logo';

}

async function aiDev() {
  const name=document.getElementById('d_name').value.trim();
  const website=document.getElementById('d_web').value.trim();
  if (!name) { alert('Enter developer name first'); return; }
  const btn=document.getElementById('aiDevBtn'), st=document.getElementById('devSt');
  btn.disabled=true; btn.textContent='Generating...';
  st.textContent='AI writing developer profile — ~25 seconds...'; st.style.color='#7a8a9e';
  try {
    const r=await fetch('/developers/ai-generate',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name, website})
    });
    const j=await r.json();
    if (j.success) {
      const sv=(id,val)=>{const e=document.getElementById(id);if(e&&val!=null)e.value=val;};
      // Fill all text fields
      if (j.website) sv('d_web', j.website);
      sv('d_tag',j.tagline); sv('d_about',j.about);
      sv('d_hq',j.headquarters); sv('d_founded',j.founded_year);
      sv('d_units',j.total_units); sv('d_emp',j.employees);
      sv('d_areas',(j.areas||[]).join(', ')); sv('d_ptypes',(j.property_types||[]).join(', '));
      sv('d_price',j.price_range); sv('d_aeo',j.aeo_snippet);
      sv('d_str',(j.strengths||[]).join('\n'));
      sv('d_stitle',j.seo_title); sv('d_sdesc',j.seo_description); sv('d_skw',j.seo_keywords);
      if (j.key_projects&&j.key_projects.length) {
        document.getElementById('kpRows').innerHTML=''; _ki=0;
        j.key_projects.forEach(p=>addKP(p.name,p.location,p.type,p.status));
      }
      if (j.faqs&&j.faqs.length) {
        document.getElementById('devFaqRows').innerHTML=''; _dfi=0;
        j.faqs.forEach(f=>addDevFaq(f.q,f.a));
      }
      uc('stCt',document.getElementById('d_stitle'),60);
      uc('sdCt',document.getElementById('d_sdesc'),155);
      st.textContent='✓ Profile ready — fetching logo...'; st.style.color='#10b981';
      // Auto-fetch logo via the working scrape endpoint (uses Wikipedia)
      await scrapeLogo();
      st.textContent='✓ All done — review and save!'; st.style.color='#10b981';
    } else { st.textContent='AI error: '+(j.error||'Try again'); st.style.color='#ef4444'; }
  } catch(e) { st.textContent='Network error'; st.style.color='#ef4444'; }
  btn.disabled=false; btn.textContent='✨ AI Generate';
}

(function prefillDev() {
  const p = window.__DEV__;
  if (!p) return;
  const sv=(id,val)=>{const e=document.getElementById(id);if(e&&val!=null)e.value=val;};
  sv('d_name',p.name); sv('d_slug',p.slug); sv('d_web',p.website||'');
  sv('d_tag',p.tagline||''); sv('d_logo',p.logo_url||'');
  sv('d_founded',p.founded_year||''); sv('d_units',p.total_units||'');
  sv('d_emp',p.employees||''); sv('d_hq',p.headquarters||''); sv('d_rera',p.rera_number||'');
  sv('d_about',p.about||'');
  sv('d_areas',(p.areas||[]).join(', ')); sv('d_ptypes',(p.property_types||[]).join(', '));
  sv('d_price',p.price_range||''); sv('d_aeo',p.aeo_snippet||'');
  sv('d_str',(p.strengths||[]).join('\n'));
  sv('d_stitle',p.seo_title||''); sv('d_sdesc',p.seo_description||''); sv('d_skw',p.seo_keywords||'');
  if (p.published) document.getElementById('d_pub').checked=true;
  if (p.logo_url) previewLogo(p.logo_url);
  if (p.key_projects&&p.key_projects.length) p.key_projects.forEach(pr=>addKP(pr.name,pr.location,pr.type,pr.status));
  if (p.faqs&&p.faqs.length) p.faqs.forEach(f=>addDevFaq(f.q,f.a));
  if (p.id) {
    const hi=document.createElement('input');
    hi.type='hidden'; hi.id='d_dev_id'; hi.value=p.id;
    document.body.appendChild(hi);
  }
  uc('stCt',document.getElementById('d_stitle'),60);
  uc('sdCt',document.getElementById('d_sdesc'),155);
})();
</script>"""


@app.route("/developers")
@login_required
def developers():
    try:
        rows = db.table("developers").select(
            "id,name,slug,logo_url,published,founded_year,headquarters,created_at"
        ).order("created_at", desc=True).execute().data or []
    except Exception:
        rows = []

    rows_html = ""
    for r in rows:
        pub = r.get("published", False)
        badge = (
            '<span style="font-size:10px;padding:3px 10px;border-radius:999px;background:rgba(16,185,129,0.1);color:#10b981;font-family:Verdana,sans-serif;font-weight:700">Live</span>'
            if pub else
            '<span style="font-size:10px;padding:3px 10px;border-radius:999px;background:#f0f0f0;color:#aaa;font-family:Verdana,sans-serif;font-weight:700">Draft</span>'
        )
        logo_thumb = (
            f'<img src="{r["logo_url"]}" alt="{r["name"]}" style="height:32px;max-width:80px;object-fit:contain;border-radius:4px;background:#f8f8f8;padding:2px">'
            if r.get("logo_url") else
            '<div style="width:40px;height:32px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px">🏢</div>'
        )
        rows_html += f"""
        <tr>
          <td style="padding:14px 16px">{logo_thumb}</td>
          <td style="padding:14px 16px">
            <div style="font-family:Montserrat,sans-serif;font-weight:700;font-size:14px;color:#192537">{r['name']}</div>
            <div style="font-size:11px;color:#aaa;margin-top:2px">/developers/{r.get('slug','')}</div>
          </td>
          <td style="padding:14px 16px;font-family:Verdana,sans-serif;font-size:12px;color:#7a8a9e">{r.get('headquarters','—')}</td>
          <td style="padding:14px 16px">{badge}</td>
          <td style="padding:14px 16px;white-space:nowrap">
            <a href="/developers/edit/{r['id']}" class="btn btn-outline" style="font-size:12px;padding:7px 16px;margin-right:6px">Edit</a>
            <form method="POST" action="/developers/delete/{r['id']}" style="display:inline"
              onsubmit="return confirm('Delete {r['name']}?')">
              <button type="submit" class="btn" style="font-size:12px;padding:7px 16px;background:#fef2f2;color:#ef4444;border:1.5px solid #fecaca">Delete</button>
            </form>
          </td>
        </tr>"""

    content = f"""
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <h2 style="font-family:Montserrat,sans-serif;font-weight:700;font-size:22px;color:#192537;margin:0">Developers</h2>
      <a href="/developers/new" class="btn btn-teal">+ New Developer</a>
    </div>
    {"" if rows_html else '<div style="text-align:center;padding:60px;color:#aaa;font-family:Verdana,sans-serif;font-size:14px">No developers yet — click + New Developer</div>'}
    {f'<div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(25,37,55,0.06)"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc;border-bottom:1px solid #e8ecf0"><th style="padding:12px 16px;text-align:left;font-family:Verdana,sans-serif;font-size:10px;color:#7a8a9e;letter-spacing:.08em;text-transform:uppercase">Logo</th><th style="padding:12px 16px;text-align:left;font-family:Verdana,sans-serif;font-size:10px;color:#7a8a9e;letter-spacing:.08em;text-transform:uppercase">Developer</th><th style="padding:12px 16px;text-align:left;font-family:Verdana,sans-serif;font-size:10px;color:#7a8a9e;letter-spacing:.08em;text-transform:uppercase">HQ</th><th style="padding:12px 16px;text-align:left;font-family:Verdana,sans-serif;font-size:10px;color:#7a8a9e;letter-spacing:.08em;text-transform:uppercase">Status</th><th style="padding:12px 16px"></th></tr></thead><tbody style="divide-y:1px solid #f0f0f0">{rows_html}</tbody></table></div>' if rows_html else ""}
    """
    return page("Developers", content, "developers")


@app.route("/developers/new")
@login_required
def developers_new():
    return page("New Developer", DEV_FORM, "developers")


@app.route("/developers/edit/<dev_id>")
@login_required
def developers_edit(dev_id):
    import base64 as _b64
    row = db.table("developers").select("*").eq("id", dev_id).single().execute().data
    if not row:
        flash("Developer not found.", "error")
        return redirect(url_for("developers"))
    b64 = _b64.b64encode(json.dumps(row, default=str).encode()).decode()
    inject = f'<script>window.__DEV__=JSON.parse(atob("{b64}"));</script>\n'
    return page("Edit Developer", inject + DEV_FORM, "developers")


@app.route("/developers/save", methods=["POST"])
@login_required
def developers_save():
    data = request.get_json() or {}
    if not data.get("name") or not data.get("slug"):
        return jsonify({"success": False, "error": "Name and slug are required"})
    payload = {
        "name":            str(data.get("name", "")).strip(),
        "slug":            str(data.get("slug", "")).strip(),
        "website":         str(data.get("website", "")).strip(),
        "tagline":         str(data.get("tagline", "")).strip(),
        "logo_url":        str(data.get("logo_url", "")).strip(),
        "founded_year":    data.get("founded_year"),
        "total_units":     str(data.get("total_units", "")).strip(),
        "employees":       str(data.get("employees", "")).strip(),
        "headquarters":    str(data.get("headquarters", "")).strip(),
        "rera_number":     str(data.get("rera_number", "")).strip(),
        "about":           str(data.get("about", "")).strip(),
        "areas":           data.get("areas", []),
        "property_types":  data.get("property_types", []),
        "price_range":     str(data.get("price_range", "")).strip(),
        "aeo_snippet":     str(data.get("aeo_snippet", "")).strip(),
        "strengths":       data.get("strengths", []),
        "key_projects":    data.get("key_projects", []),
        "faqs":            data.get("faqs", []),
        "seo_title":       str(data.get("seo_title", "")).strip(),
        "seo_description": str(data.get("seo_description", "")).strip(),
        "seo_keywords":    str(data.get("seo_keywords", "")).strip(),
        "published":       bool(data.get("published", False)),
        "updated_at":      datetime.utcnow().isoformat(),
    }
    dev_id = data.get("id")
    try:
        if dev_id:
            db.table("developers").update(payload).eq("id", dev_id).execute()
            return jsonify({"success": True, "id": dev_id})
        else:
            payload["id"] = str(uuid.uuid4())
            result = db.table("developers").insert(payload).execute()
            new_id = (result.data or [{}])[0].get("id", payload["id"])
            return jsonify({"success": True, "id": new_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/developers/delete/<dev_id>", methods=["POST"])
@login_required
def developers_delete(dev_id):
    try:
        db.table("developers").delete().eq("id", dev_id).execute()
        flash("Developer deleted.", "ok")
    except Exception as e:
        flash(f"Delete failed: {e}", "error")
    return redirect(url_for("developers"))



def _upload_bytes_to_cloudinary(img_bytes: bytes, folder: str = "developer-logos") -> str:
    """Upload raw image bytes to Cloudinary (bypasses hotlink blocks). Returns secure_url or ''."""
    try:
        import io, cloudinary, cloudinary.uploader
        cloudinary.config(cloud_name=CLOUDINARY_CLOUD, api_key=CLOUDINARY_KEY, api_secret=CLOUDINARY_SEC)
        r = cloudinary.uploader.upload(io.BytesIO(img_bytes), folder=folder, resource_type="image", format="webp", quality="auto")
        return r.get("secure_url", "")
    except Exception:
        return ""


def _scrape_website_text(url: str, max_chars: int = 4000) -> str:
    """Scrape visible text from developer website for AI context."""
    import urllib.request as _ur, re
    if not url.startswith("http"):
        url = "https://" + url
    HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    try:
        html = _ur.urlopen(_ur.Request(url, headers=HEADERS), timeout=12).read().decode("utf-8", errors="replace")
        # Remove noise blocks
        html = re.sub(r'<(script|style|noscript|svg|iframe)[^>]*>.*?</\1>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
        # Remove tags, collapse whitespace
        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:max_chars]
    except Exception:
        return ""


def _claude(system: str, user: str, model: str = "claude-haiku-4-5-20251001", temp: float = 0.4) -> str:
    """Call Claude and return the text response. Raises if key missing or API error."""
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    msg = client.messages.create(
        model=model,
        max_tokens=4096,
        temperature=temp,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return msg.content[0].text.strip()


def _search_developer_context(name: str, website: str = "") -> str:
    """Search DuckDuckGo for developer info and scrape top property/news results."""
    import urllib.request as _ur, urllib.parse as _up, re
    HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    context_parts = []

    # --- 1. DuckDuckGo HTML search ---
    try:
        query = _up.quote(f"{name} Dubai real estate developer projects")
        url   = f"https://html.duckduckgo.com/html/?q={query}"
        html  = _ur.urlopen(_ur.Request(url, headers=HEADERS), timeout=10).read().decode("utf-8", errors="replace")

        # Extract result titles + snippets
        titles   = re.findall(r'class="result__a"[^>]*>(.*?)</a>', html, re.DOTALL)
        snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
        clean    = lambda s: re.sub(r'<[^>]+>', '', s).replace('&amp;', '&').replace('&#x27;', "'").strip()

        snippet_text = "\n".join(
            f"- {clean(t)}: {clean(s)}"
            for t, s in zip(titles[:6], snippets[:6])
            if clean(s)
        )
        if snippet_text:
            context_parts.append(f"Web search results for '{name} Dubai developer':\n{snippet_text}")

        # --- 2. Scrape first property/news result ---
        TRUSTED = ['arabianbusiness', 'propertyfinder', 'bayut', 'zawya', 'khaleejtimes',
                   'gulfnews', 'providentestate', 'eplogoffplan', 'emiratesestate', 'builtenvironment']
        raw_urls = re.findall(r'uddg=([^"&]+)', html)
        for enc_url in raw_urls[:8]:
            try:
                result_url = _up.unquote(enc_url)
                if any(d in result_url for d in TRUSTED):
                    page = _scrape_website_text(result_url, max_chars=2500)
                    if len(page) > 300:
                        domain = re.search(r'https?://(?:www\.)?([^/]+)', result_url)
                        context_parts.append(f"\nFrom {domain.group(1) if domain else result_url}:\n{page}")
                        break
            except Exception:
                continue
    except Exception:
        pass

    # --- 3. Try developer's own website (may be JS-rendered, but worth a try) ---
    if website:
        own = _scrape_website_text(website, max_chars=2000)
        if len(own) > 300:
            context_parts.append(f"\nDeveloper website ({website}):\n{own}")

    return "\n\n".join(context_parts)[:6000]


def _fetch_logo(dev_name: str, website_url: str = "") -> dict:
    """Try Wikipedia infobox → website header scrape. Downloads bytes → Cloudinary."""
    import urllib.request as _ur, urllib.parse as _up, re
    from html.parser import HTMLParser

    HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    logo_url = None
    source   = ""

    # ── 1. Wikipedia infobox logo (great for major developers) ───────────────
    try:
        title   = _up.quote(dev_name.replace(" ", "_"))
        html    = _ur.urlopen(_ur.Request(f"https://en.wikipedia.org/wiki/{title}", headers=HEADERS), timeout=10).read().decode("utf-8", errors="replace")
        matches = re.findall(r'src="(//upload\.wikimedia\.org/wikipedia/[^"]+(?:[Ll]ogo)[^"]+)"', html)
        if not matches:
            matches = re.findall(r'class="[^"]*infobox[^"]*".*?src="(//upload\.wikimedia\.org/wikipedia/[^"]+\.(?:png|svg\.png|jpg|webp))"', html, re.DOTALL)
        if matches:
            logo_url = "https:" + matches[0]
            source   = "Wikipedia"
    except Exception:
        pass

    # ── 2. Website HTML — smart scraper: header img, dev name in alt, then logo keyword ──
    if not logo_url and website_url:
        try:
            if not website_url.startswith("http"):
                website_url = "https://" + website_url

            # Words from dev name to match in alt text (skip short words)
            name_words = [w.lower() for w in dev_name.split() if len(w) > 3]

            class LogoParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.logo_url   = None   # "logo" keyword match
                    self.header_img = None   # first non-tiny img inside <header>
                    self.name_img   = None   # img whose alt contains developer name
                    self.apple_icon = None
                    self._in_hdr    = 0      # nesting depth inside <header>

                def _abs(self, url):
                    if not url or url.startswith("data:"): return None
                    if url.startswith("//"): return "https:" + url
                    if url.startswith("http"): return url
                    pb = _up.urlparse(website_url)
                    return f"{pb.scheme}://{pb.netloc}/{url.lstrip('/')}"

                def handle_starttag(self, tag, attrs):
                    d = dict(attrs)
                    if tag == "header":
                        self._in_hdr += 1
                    elif tag == "link" and not self.apple_icon:
                        rel = (d.get("rel") or "").lower(); href = d.get("href",""); sz = d.get("sizes","")
                        if href and ("apple-touch-icon" in rel or any(x in sz for x in ("192","180","512"))):
                            self.apple_icon = self._abs(href)
                    elif tag in ("img", "source"):
                        src = d.get("src","") or d.get("srcset","").split()[0]
                        alt = (d.get("alt","") or "").lower()
                        cls = (d.get("class","") or "").lower()
                        iid = (d.get("id","") or "").lower()
                        combined = " ".join([src.lower(), alt, cls, iid])
                        abs_src = self._abs(src)
                        if not abs_src:
                            return
                        # Match by dev name in alt
                        if not self.name_img and any(w in alt for w in name_words):
                            self.name_img = abs_src
                        # Match by "logo" keyword anywhere
                        if not self.logo_url and "logo" in combined:
                            self.logo_url = abs_src
                        # First reasonably-sized img inside <header>
                        if self._in_hdr and not self.header_img:
                            try:
                                w = int(d.get("width","200") or "200")
                                h = int(d.get("height","50") or "50")
                                if w < 20 or h < 10: return
                            except Exception:
                                pass
                            self.header_img = abs_src

                def handle_endtag(self, tag):
                    if tag == "header":
                        self._in_hdr = max(0, self._in_hdr - 1)

            html = _ur.urlopen(_ur.Request(website_url, headers=HEADERS), timeout=12).read().decode("utf-8", errors="replace")
            p    = LogoParser(); p.feed(html[:100000])
            # Priority: logo keyword > dev name in alt > header first img > apple icon
            candidate = p.logo_url or p.name_img or p.header_img or p.apple_icon
            if candidate:
                logo_url = candidate
                source   = "website"
        except Exception:
            pass

    if not logo_url:
        return {}

    # Download bytes → upload to Cloudinary (avoids hotlink blocks from all sources)
    try:
        img_bytes = _ur.urlopen(_ur.Request(logo_url, headers=HEADERS), timeout=10).read()
        if len(img_bytes) < 500:   # skip tiny icons / error pages
            return {}
        cdn_url = _upload_bytes_to_cloudinary(img_bytes)
        return {"url": cdn_url or logo_url, "source": source}
    except Exception:
        return {"url": logo_url, "source": source}


@app.route("/developers/test-logo")
@login_required
def developers_test_logo():
    """Debug endpoint — visit /developers/test-logo in browser to diagnose logo fetching."""
    import urllib.request as _ur, urllib.parse as _up, re, traceback
    HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    steps = []
    try:
        name  = "Emaar Properties"
        title = _up.quote(name.replace(" ", "_"))
        url   = f"https://en.wikipedia.org/wiki/{title}"
        steps.append(f"1. Fetching {url}")
        html  = _ur.urlopen(_ur.Request(url, headers=HEADERS), timeout=10).read().decode("utf-8", errors="replace")
        steps.append(f"2. Got HTML ({len(html)} chars)")
        matches = re.findall(r'src="(//upload\.wikimedia\.org/wikipedia/[^"]+(?:[Ll]ogo)[^"]+)"', html)
        steps.append(f"3. Logo matches: {matches[:2]}")
        if matches:
            logo_url   = "https:" + matches[0]
            img_bytes  = _ur.urlopen(_ur.Request(logo_url, headers=HEADERS), timeout=10).read()
            steps.append(f"4. Downloaded {len(img_bytes)} bytes from {logo_url}")
            cdn = _upload_bytes_to_cloudinary(img_bytes)
            steps.append(f"5. Cloudinary result: {cdn or 'UPLOAD FAILED'}")
        else:
            steps.append("3b. No logo match found in HTML")
    except Exception:
        steps.append(f"ERROR: {traceback.format_exc()}")
    return "<br>".join(steps)


@app.route("/developers/scrape-logo", methods=["POST"])
@login_required
def developers_scrape_logo():
    data    = request.get_json() or {}
    name    = str(data.get("name", "")).strip()
    website = str(data.get("website", "")).strip()
    if not name and not website:
        return jsonify({"success": False, "error": "Developer name or website required"})
    import traceback as _tb
    try:
        result = _fetch_logo(name, website)
        if not result:
            return jsonify({"success": False, "error": "No logo found — try pasting a logo URL manually"})
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e), "trace": _tb.format_exc()})


@app.route("/developers/ai-generate", methods=["POST"])
@login_required
def developers_ai_generate():
    data    = request.get_json() or {}
    name    = str(data.get("name", "")).strip()
    website = str(data.get("website", "")).strip()  # may be empty — AI will provide it
    if not name:
        return jsonify({"success": False, "error": "Developer name is required"})
    if not ANTHROPIC_KEY:
        return jsonify({"success": False, "error": "Add ANTHROPIC_KEY to .env (get from console.anthropic.com)"})
    try:
        # Search web + scrape for real facts about this developer
        web_context = _search_developer_context(name, website)
        print(f"=== WEB CONTEXT ({len(web_context)} chars) ===\n{web_context[:400]}\n===")

        if web_context:
            system = (
                "You are a Dubai real estate expert writing developer profiles for Elysian, a premium property portal. "
                "Web research results are provided below — use them as your ONLY source of facts. "
                "Do NOT invent projects, areas, prices, or any detail not found in the research. "
                "If a field cannot be confirmed from the research, set it to null. "
                "Return ONLY a valid JSON object — no markdown, no code fences, no commentary."
            )
        else:
            system = (
                "You are a Dubai real estate expert writing developer profiles for Elysian, a premium property portal. "
                "Use your knowledge about this developer to fill the profile. "
                "Be conservative — only include facts you are confident about. "
                "Set any uncertain fields to null rather than guessing. "
                "Return ONLY a valid JSON object — no markdown, no code fences, no commentary."
            )

        context_block = f"\n\nWEB RESEARCH (use as primary source — do not invent facts not found here):\n{web_context}" if web_context else ""

        prompt = f"""Write a complete developer profile for the Elysian Dubai portal.

Developer: {name}
Website: {website or 'unknown — infer the correct domain from your knowledge'}{context_block}

Return a JSON object with exactly these fields:
- website: official domain only, no https (e.g. "elysiandevelopments.ae")
- tagline: punchy tagline 5-8 words
- about: 3 paragraphs separated by \\n\\n — factual only
- founded_year: integer year or null
- headquarters: e.g. "Dubai, UAE"
- total_units: string or null
- employees: string or null
- areas: array of area names (Dubai neighbourhoods this developer operates in)
- property_types: array (e.g. ["Apartments", "Villas"])
- price_range: string or null
- aeo_snippet: 1-2 sentence factual answer to "Who is {name}?"
- strengths: array of 5 investor-relevant statements
- key_projects: array of objects with keys: name, location, type, status
- faqs: array of 4 objects with q and a keys
- seo_title: 50-60 chars including "Dubai" and "2026"
- seo_description: 130-155 chars
- seo_keywords: 6-8 comma-separated keywords"""

        raw  = _claude(system, prompt, model="claude-haiku-4-5-20251001", temp=0.4)
        print("=== RAW CLAUDE RESPONSE ===")
        print(raw[:500])
        print("=== END ===")
        # Strip markdown fences then extract first complete JSON object
        raw  = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if not m:
            raise ValueError(f"No JSON in response. Raw start: {raw[:200]}")
        draft = json.loads(m.group())

        return jsonify({"success": True, **draft})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


# ══════════════════════════════════════════════════════════════════════════════
#  AREAS MODULE
# ══════════════════════════════════════════════════════════════════════════════

AREA_FORM = r"""
<style>
.ash{font-family:Montserrat,sans-serif;font-weight:700;font-size:11px;color:#7a8a9e;
  letter-spacing:.12em;text-transform:uppercase;padding:0 0 14px;}
.ainp{width:100%;border:1.5px solid #eef0f3;border-radius:10px;padding:10px 14px;
  font-family:Verdana,sans-serif;font-size:13px;color:#192537;outline:none;
  background:#fafbfc;transition:border .15s;}
.ainp:focus{border-color:#7fe2e3;background:#fff;}
.ainp::placeholder{color:#b0bac8;}
.asec{background:#fff;border-radius:16px;padding:28px 32px;margin-bottom:20px;
  box-shadow:0 2px 12px rgba(25,37,55,.05);border:1px solid rgba(25,37,55,.05);}
.agrid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.agrid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
.agrid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;}
.arow{display:flex;gap:8px;align-items:center;margin-bottom:8px;}
.arow .ainp{flex:1;}
.add-btn{border:1.5px dashed #7fe2e3;background:transparent;color:#7fe2e3;
  border-radius:8px;padding:7px 16px;font-size:12px;font-family:Montserrat,sans-serif;
  font-weight:700;cursor:pointer;transition:.15s;}
.add-btn:hover{background:rgba(127,226,227,.08);}
.rm-btn{background:none;border:none;color:#e05;font-size:16px;cursor:pointer;
  padding:4px 8px;border-radius:6px;flex-shrink:0;}
.rm-btn:hover{background:#fff0f3;}
.img-wrap{border:1.5px dashed #eef0f3;border-radius:10px;overflow:hidden;
  background:#f7f9fb;min-height:80px;display:flex;align-items:center;
  justify-content:center;margin-top:8px;}
.img-wrap img{max-height:120px;max-width:100%;object-fit:contain;}
.price-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:0;
  border:1.5px solid #eef0f3;border-radius:12px;overflow:hidden;}
.price-grid .ph{background:#f4f7fa;padding:10px 12px;font-family:Montserrat,sans-serif;
  font-weight:700;font-size:10px;color:#7a8a9e;text-align:center;
  letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #eef0f3;}
.price-grid .pl{padding:10px 12px;text-align:center;border-bottom:1px solid #eef0f3;
  border-right:1px solid #eef0f3;}
.price-grid .pl:nth-child(5n){border-right:none;}
.price-grid .pl:nth-last-child(-n+5){border-bottom:none;}
.price-grid .ainp{border:none;background:transparent;text-align:center;padding:4px 6px;
  font-size:12px;}
.price-grid .ainp:focus{background:rgba(127,226,227,.06);}
</style>

<div style="max-width:900px;margin:0 auto;padding:24px 16px 100px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;">
    <div>
      <h1 style="font-family:Montserrat,sans-serif;font-weight:800;font-size:22px;color:#192537;margin:0;" id="pageTitle">New Area Guide</h1>
      <p style="font-family:Verdana,sans-serif;font-size:12px;color:#7a8a9e;margin:6px 0 0;">Fill manually or click AI Generate for a first draft.</p>
    </div>
    <a href="/areas" style="font-family:Montserrat,sans-serif;font-weight:700;font-size:12px;color:#7a8a9e;text-decoration:none;">← All Areas</a>
  </div>

  <!-- STATUS -->
  <div id="areaSt" style="display:none;margin-bottom:16px;padding:12px 20px;border-radius:10px;font-family:Verdana,sans-serif;font-size:13px;"></div>

  <!-- 1. BASICS -->
  <div class="asec">
    <div class="ash">1 · Basics</div>
    <div class="agrid2" style="margin-bottom:14px;">
      <div>
        <div class="ash" style="font-size:10px;">Area Name *</div>
        <input id="a_name" class="ainp" placeholder="Dubai Marina" oninput="autoAreaSlug()">
      </div>
      <div>
        <div class="ash" style="font-size:10px;">Slug (URL path) *</div>
        <input id="a_slug" class="ainp" placeholder="dubai-marina">
      </div>
    </div>
    <div style="margin-bottom:14px;">
      <div class="ash" style="font-size:10px;">Tagline</div>
      <input id="a_tagline" class="ainp" placeholder="Waterfront living with world-class dining and skyline views">
    </div>
    <div>
      <div class="ash" style="font-size:10px;">Hero Image URL</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="a_hero" class="ainp" placeholder="https://..." oninput="previewHero()">
        <label style="flex-shrink:0;background:#192537;color:#fff;border-radius:8px;padding:9px 16px;font-size:12px;font-family:Montserrat,sans-serif;font-weight:700;cursor:pointer;white-space:nowrap;">
          Upload <input type="file" accept="image/*" style="display:none;" onchange="uploadAreaImg(this,'a_hero','heroPreview')">
        </label>
      </div>
      <div class="img-wrap" id="heroPreview" style="margin-top:8px;display:none;">
        <img id="heroPreviewImg" src="" alt="Hero">
      </div>
      <div id="heroPickerWrap" style="display:none;margin-top:10px;">
        <div style="font-size:11px;color:#7a8a9e;margin-bottom:6px;">AI-suggested hero images — click Use This to upload to Cloudinary:</div>
        <div id="heroPickerGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;"></div>
        <div style="font-size:10px;color:#bbb;margin-top:4px;">Photos via Pexels</div>
      </div>
      <div id="heroPickerStatus" style="font-size:12px;color:#7a8a9e;margin-top:4px;"></div>
    </div>
  </div>

  <!-- 2. ABOUT -->
  <div class="asec">
    <div class="ash">2 · About</div>
    <div style="margin-bottom:14px;">
      <div class="ash" style="font-size:10px;">Description (3 paragraphs, separated by blank line)</div>
      <textarea id="a_about" class="ainp" rows="6" placeholder="Dubai Marina is a...&#10;&#10;The waterfront promenade...&#10;&#10;Investors benefit from..."></textarea>
    </div>
    <div class="agrid2" style="margin-bottom:14px;">
      <div>
        <div class="ash" style="font-size:10px;">Why Buy Here</div>
        <input id="a_hl_why" class="ainp" placeholder="Consistent 6-8% rental yields">
      </div>
      <div>
        <div class="ash" style="font-size:10px;">Who Lives Here</div>
        <input id="a_hl_who" class="ainp" placeholder="Expats, young professionals, investors">
      </div>
    </div>
    <div class="agrid2">
      <div>
        <div class="ash" style="font-size:10px;">Best Streets / Spots</div>
        <input id="a_hl_streets" class="ainp" placeholder="Marina Walk, JBR, The Beach">
      </div>
      <div>
        <div class="ash" style="font-size:10px;">Vibe</div>
        <input id="a_hl_vibe" class="ainp" placeholder="Vibrant, cosmopolitan, 24/7 energy">
      </div>
    </div>
  </div>

  <!-- 3. PRICE DATA -->
  <div class="asec">
    <div class="ash">3 · Property Prices &amp; Market Data</div>
    <div class="agrid3" style="margin-bottom:14px;">
      <div>
        <div class="ash" style="font-size:10px;">ROI %</div>
        <input id="a_roi" class="ainp" placeholder="7.2" type="number" step="0.1">
      </div>
      <div>
        <div class="ash" style="font-size:10px;">Area Size</div>
        <input id="a_size" class="ainp" placeholder="4.9 sq km">
      </div>
      <div>
        <div class="ash" style="font-size:10px;">Best For</div>
        <input id="a_best_for" class="ainp" placeholder="Investors, Families, Expats">
      </div>
    </div>
    <!-- Price table -->
    <div class="ash" style="font-size:10px;margin-bottom:8px;">Average Prices (AED)</div>
    <div class="price-grid">
      <div class="ph">Type</div><div class="ph">Avg Sale Price</div><div class="ph">Avg Rent / yr</div><div class="ph">Price / sqft</div><div class="ph">ROI %</div>
      <div class="pl" style="background:#f4f7fa;font-family:Montserrat,sans-serif;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;">Studio</div>
      <div class="pl"><input id="a_ps_studio" class="ainp" placeholder="750,000"></div>
      <div class="pl"><input id="a_pr_studio" class="ainp" placeholder="60,000"></div>
      <div class="pl"><input id="a_ppsf_studio" class="ainp" placeholder="1,500"></div>
      <div class="pl"><input id="a_proi_studio" class="ainp" placeholder="7.5"></div>
      <div class="pl" style="background:#f4f7fa;font-family:Montserrat,sans-serif;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;">1 BR</div>
      <div class="pl"><input id="a_ps_1br" class="ainp" placeholder="1,200,000"></div>
      <div class="pl"><input id="a_pr_1br" class="ainp" placeholder="90,000"></div>
      <div class="pl"><input id="a_ppsf_1br" class="ainp" placeholder="1,450"></div>
      <div class="pl"><input id="a_proi_1br" class="ainp" placeholder="7.0"></div>
      <div class="pl" style="background:#f4f7fa;font-family:Montserrat,sans-serif;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;">2 BR</div>
      <div class="pl"><input id="a_ps_2br" class="ainp" placeholder="1,900,000"></div>
      <div class="pl"><input id="a_pr_2br" class="ainp" placeholder="130,000"></div>
      <div class="pl"><input id="a_ppsf_2br" class="ainp" placeholder="1,400"></div>
      <div class="pl"><input id="a_proi_2br" class="ainp" placeholder="6.5"></div>
      <div class="pl" style="background:#f4f7fa;font-family:Montserrat,sans-serif;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;">3 BR</div>
      <div class="pl"><input id="a_ps_3br" class="ainp" placeholder="3,200,000"></div>
      <div class="pl"><input id="a_pr_3br" class="ainp" placeholder="200,000"></div>
      <div class="pl"><input id="a_ppsf_3br" class="ainp" placeholder="1,380"></div>
      <div class="pl"><input id="a_proi_3br" class="ainp" placeholder="6.0"></div>
    </div>
  </div>

  <!-- 4. LIFESTYLE -->
  <div class="asec">
    <div class="ash">4 · Lifestyle</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">
      <div>
        <div class="ash" style="font-size:10px;color:#e07b3a;">Dining &amp; Nightlife</div>
        <textarea id="a_ls_dining_text" class="ainp" rows="3" placeholder="World-class restaurants, rooftop bars..." style="margin-bottom:8px;"></textarea>
        <input id="a_ls_dining_img" class="ainp" placeholder="Image URL..." oninput="prevLs('dining')">
        <label style="display:inline-block;margin-top:6px;background:#f4f7fa;color:#7a8a9e;border-radius:6px;padding:6px 12px;font-size:11px;font-family:Montserrat,sans-serif;font-weight:700;cursor:pointer;">
          Upload <input type="file" accept="image/*" style="display:none;" onchange="uploadAreaImg(this,'a_ls_dining_img','ls_dining_prev')">
        </label>
        <div class="img-wrap" id="ls_dining_prev" style="margin-top:6px;display:none;"><img src="" alt=""></div>
        <div id="diningPickerWrap" style="display:none;margin-top:8px;"><div id="diningPickerGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;"></div><div style="font-size:10px;color:#bbb;margin-top:3px;">via Pexels</div></div>
      </div>
      <div>
        <div class="ash" style="font-size:10px;color:#3a9e6a;">Parks &amp; Leisure</div>
        <textarea id="a_ls_parks_text" class="ainp" rows="3" placeholder="Beach access, cycling tracks, parks..." style="margin-bottom:8px;"></textarea>
        <input id="a_ls_parks_img" class="ainp" placeholder="Image URL..." oninput="prevLs('parks')">
        <label style="display:inline-block;margin-top:6px;background:#f4f7fa;color:#7a8a9e;border-radius:6px;padding:6px 12px;font-size:11px;font-family:Montserrat,sans-serif;font-weight:700;cursor:pointer;">
          Upload <input type="file" accept="image/*" style="display:none;" onchange="uploadAreaImg(this,'a_ls_parks_img','ls_parks_prev')">
        </label>
        <div class="img-wrap" id="ls_parks_prev" style="margin-top:6px;display:none;"><img src="" alt=""></div>
        <div id="parksPickerWrap" style="display:none;margin-top:8px;"><div id="parksPickerGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;"></div><div style="font-size:10px;color:#bbb;margin-top:3px;">via Pexels</div></div>
      </div>
      <div>
        <div class="ash" style="font-size:10px;color:#7060e0;">Shopping</div>
        <textarea id="a_ls_shopping_text" class="ainp" rows="3" placeholder="Marina Mall, The Beach retail..." style="margin-bottom:8px;"></textarea>
        <input id="a_ls_shopping_img" class="ainp" placeholder="Image URL..." oninput="prevLs('shopping')">
        <label style="display:inline-block;margin-top:6px;background:#f4f7fa;color:#7a8a9e;border-radius:6px;padding:6px 12px;font-size:11px;font-family:Montserrat,sans-serif;font-weight:700;cursor:pointer;">
          Upload <input type="file" accept="image/*" style="display:none;" onchange="uploadAreaImg(this,'a_ls_shopping_img','ls_shopping_prev')">
        </label>
        <div class="img-wrap" id="ls_shopping_prev" style="margin-top:6px;display:none;"><img src="" alt=""></div>
        <div id="shoppingPickerWrap" style="display:none;margin-top:8px;"><div id="shoppingPickerGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;"></div><div style="font-size:10px;color:#bbb;margin-top:3px;">via Pexels</div></div>
      </div>
    </div>
  </div>

  <!-- 5. LOCATION -->
  <div class="asec">
    <div class="ash">5 · Location &amp; Connectivity</div>
    <div style="margin-bottom:14px;">
      <div class="ash" style="font-size:10px;">Map Image URL</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="a_map_img" class="ainp" placeholder="https://..." oninput="prevMap()">
        <label style="flex-shrink:0;background:#192537;color:#fff;border-radius:8px;padding:9px 16px;font-size:12px;font-family:Montserrat,sans-serif;font-weight:700;cursor:pointer;white-space:nowrap;">
          Upload <input type="file" accept="image/*" style="display:none;" onchange="uploadAreaImg(this,'a_map_img','mapPreview')">
        </label>
      </div>
      <div class="img-wrap" id="mapPreview" style="margin-top:8px;display:none;"><img id="mapPreviewImg" src="" alt="Map"></div>
    </div>
    <div>
      <div class="ash" style="font-size:10px;">Commute Times</div>
      <div id="commuteRows"></div>
      <button class="add-btn" onclick="addCommute()">+ Add Destination</button>
    </div>
  </div>

  <!-- 6. AMENITIES -->
  <div class="asec">
    <div class="ash">6 · Education, Health &amp; Shopping Centres</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;">
      <div>
        <div class="ash" style="font-size:10px;">Schools</div>
        <div id="schoolRows"></div>
        <button class="add-btn" onclick="addSchool()">+ Add School</button>
      </div>
      <div>
        <div class="ash" style="font-size:10px;">Hospitals &amp; Clinics</div>
        <div id="hospitalRows"></div>
        <button class="add-btn" onclick="addHospital()">+ Add Hospital</button>
      </div>
      <div>
        <div class="ash" style="font-size:10px;">Malls &amp; Retail</div>
        <div id="mallRows"></div>
        <button class="add-btn" onclick="addMall()">+ Add Mall</button>
      </div>
    </div>
  </div>

  <!-- 7. NEARBY AREAS -->
  <div class="asec">
    <div class="ash">7 · Nearby Areas</div>
    <div class="ash" style="font-size:10px;">Area slugs, comma-separated (e.g. downtown-dubai, business-bay)</div>
    <input id="a_nearby" class="ainp" placeholder="downtown-dubai, business-bay, jbr">
  </div>

  <!-- 8. FAQS -->
  <div class="asec">
    <div class="ash">8 · FAQs (Google Rich Results)</div>
    <div id="faqRows"></div>
    <button class="add-btn" onclick="addFaq()">+ Add FAQ</button>
  </div>

  <!-- 9. AGENT -->
  <div class="asec">
    <div class="ash">9 · Agent Contact Card</div>
    <div class="agrid3">
      <div>
        <div class="ash" style="font-size:10px;">Agent Name</div>
        <input id="a_agent_name" class="ainp" placeholder="Sarah Al Mansoori">
      </div>
      <div>
        <div class="ash" style="font-size:10px;">Phone / WhatsApp</div>
        <input id="a_agent_phone" class="ainp" placeholder="+971 50 123 4567">
      </div>
      <div>
        <div class="ash" style="font-size:10px;">Agent Photo URL</div>
        <div style="display:flex;gap:6px;">
          <input id="a_agent_photo" class="ainp" placeholder="https://...">
          <label style="flex-shrink:0;background:#f4f7fa;color:#7a8a9e;border-radius:8px;padding:9px 12px;font-size:11px;font-family:Montserrat,sans-serif;font-weight:700;cursor:pointer;">
            Upload <input type="file" accept="image/*" style="display:none;" onchange="uploadAreaImg(this,'a_agent_photo',null)">
          </label>
        </div>
      </div>
    </div>
  </div>

  <!-- 10. SEO -->
  <div class="asec">
    <div class="ash">10 · SEO</div>
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="ash" style="font-size:10px;">SEO Title <span id="stLen" style="color:#aaa;font-weight:400;text-transform:none;letter-spacing:0;">(0/60)</span></div>
      </div>
      <input id="a_stitle" class="ainp" placeholder="Dubai Marina Area Guide 2026: Prices, ROI & Projects | Elysian" oninput="document.getElementById('stLen').textContent='('+this.value.length+'/60)'">
    </div>
    <div style="margin-bottom:14px;">
      <div class="ash" style="font-size:10px;">Meta Description <span id="sdLen" style="color:#aaa;font-weight:400;text-transform:none;letter-spacing:0;">(0/155)</span></div>
      <textarea id="a_sdesc" class="ainp" rows="2" placeholder="Complete guide to Dubai Marina..." oninput="document.getElementById('sdLen').textContent='('+this.value.length+'/155)'"></textarea>
    </div>
    <div>
      <div class="ash" style="font-size:10px;">Keywords (comma-separated)</div>
      <input id="a_skw" class="ainp" placeholder="Dubai Marina apartments, Dubai Marina ROI, buy property Dubai Marina">
    </div>
  </div>

  <!-- 11. PUBLISH -->
  <div class="asec">
    <div class="ash">11 · Publish</div>
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
      <input type="checkbox" id="a_pub" style="width:18px;height:18px;accent-color:#7fe2e3;">
      <span style="font-family:Verdana,sans-serif;font-size:13px;color:#192537;">Published (live on /area-guides page)</span>
    </label>
  </div>

  <!-- HIDDEN ID -->
  <input type="hidden" id="a_id">

  <!-- BOTTOM BAR -->
  <div style="position:fixed;bottom:0;left:220px;right:0;background:#fff;border-top:1px solid #eef0f3;
    padding:16px 32px;display:flex;align-items:center;gap:12px;z-index:100;box-shadow:0 -4px 20px rgba(25,37,55,.06);">
    <button onclick="aiArea()" id="aiAreaBtn"
      style="background:#192537;color:#fff;border:none;border-radius:999px;padding:11px 24px;
      font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;cursor:pointer;">
      ✦ AI Generate
    </button>
    <button onclick="humanizeArea()" id="humanAreaBtn"
      style="background:transparent;color:#192537;border:1.5px solid #192537;border-radius:999px;padding:11px 22px;
      font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;cursor:pointer;">
      🧠 Humanize
    </button>
    <button onclick="saveArea()"
      style="background:#7fe2e3;color:#192537;border:none;border-radius:999px;padding:11px 28px;
      font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;cursor:pointer;">
      Save Area Guide
    </button>
    <span id="areaSt2" style="font-family:Verdana,sans-serif;font-size:12px;color:#7a8a9e;"></span>
  </div>
  <div id="areaSaveMsg" style="display:none;margin-top:12px;padding:12px 20px;border-radius:10px;
    font-family:Verdana,sans-serif;font-size:13px;"></div>
</div>

<script>
const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
const gv = id => (document.getElementById(id)?.value || '').trim();

// ── Auto-slug ──────────────────────────────────────────────────────────────
function autoAreaSlug() {
  const s = gv('a_name').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  sv('a_slug', s);
}

// ── Image previews ─────────────────────────────────────────────────────────
function previewHero() {
  const u = gv('a_hero');
  const wrap = document.getElementById('heroPreview');
  const img  = document.getElementById('heroPreviewImg');
  if (u) { img.src = u; wrap.style.display = 'flex'; }
  else wrap.style.display = 'none';
}
function prevMap() {
  const u = gv('a_map_img');
  const wrap = document.getElementById('mapPreview');
  if (u) { document.getElementById('mapPreviewImg').src = u; wrap.style.display = 'flex'; }
  else wrap.style.display = 'none';
}
function prevLs(type) {
  const u = gv('a_ls_'+type+'_img');
  const wrap = document.getElementById('ls_'+type+'_prev');
  if (u) { wrap.querySelector('img').src = u; wrap.style.display = 'flex'; }
  else wrap.style.display = 'none';
}

// ── Image upload ───────────────────────────────────────────────────────────
async function uploadAreaImg(input, targetId, previewId) {
  const file = input.files[0]; if (!file) return;
  const fd = new FormData(); fd.append('file', file);
  const st = document.getElementById('areaSt2');
  st.textContent = 'Uploading...'; st.style.color = '#7a8a9e';
  const r = await fetch('/areas/upload-image', { method:'POST', body: fd });
  const j = await r.json();
  if (j.success) {
    sv(targetId, j.url);
    st.textContent = '✓ Uploaded'; st.style.color = '#10b981';
    if (previewId) {
      const wrap = document.getElementById(previewId);
      if (wrap) { wrap.querySelector('img').src = j.url; wrap.style.display = 'flex'; }
    }
  } else {
    st.textContent = 'Upload error: ' + j.error; st.style.color = '#e05';
  }
}

// ── Dynamic rows: Commute ─────────────────────────────────────────────────
function addCommute(label='', minutes='') {
  label = (label && label !== 'null') ? label : '';
  minutes = (minutes && minutes !== 'null') ? minutes : '';
  const d = document.getElementById('commuteRows');
  const row = document.createElement('div'); row.className = 'arow';
  row.innerHTML = `<input class="ainp" placeholder="Downtown Dubai" value="${label}" style="flex:2;">
    <input class="ainp" placeholder="15 min" value="${minutes}" style="flex:1;">
    <button class="rm-btn" onclick="this.parentElement.remove()">×</button>`;
  d.appendChild(row);
}
function getCommutes() {
  return [...document.querySelectorAll('#commuteRows .arow')].map(r => {
    const ins = r.querySelectorAll('input');
    return { label: ins[0].value.trim(), minutes: ins[1].value.trim() };
  }).filter(x => x.label);
}

// ── Dynamic rows: Schools ─────────────────────────────────────────────────
function addSchool(name='', type='', distance='') {
  name     = (name     && name     !== 'null') ? name     : '';
  type     = (type     && type     !== 'null') ? type     : '';
  distance = (distance && distance !== 'null') ? distance : '';
  const d = document.getElementById('schoolRows');
  const row = document.createElement('div'); row.className = 'arow'; row.style.flexWrap='wrap';
  row.innerHTML = `<input class="ainp" placeholder="School name" value="${name}" style="flex:2;min-width:120px;">
    <input class="ainp" placeholder="Type (International)" value="${type}" style="flex:1;min-width:80px;">
    <input class="ainp" placeholder="0.5 km" value="${distance}" style="flex:1;min-width:60px;">
    <button class="rm-btn" onclick="this.parentElement.remove()">×</button>`;
  d.appendChild(row);
}
function getSchools() {
  return [...document.querySelectorAll('#schoolRows .arow')].map(r => {
    const ins = r.querySelectorAll('input');
    return { name: ins[0].value.trim(), type: ins[1].value.trim(), distance: ins[2].value.trim() };
  }).filter(x => x.name);
}

// ── Dynamic rows: Hospitals ───────────────────────────────────────────────
function addHospital(name='', distance='') {
  name     = (name     && name     !== 'null') ? name     : '';
  distance = (distance && distance !== 'null') ? distance : '';
  const d = document.getElementById('hospitalRows');
  const row = document.createElement('div'); row.className = 'arow';
  row.innerHTML = `<input class="ainp" placeholder="Hospital name" value="${name}" style="flex:2;">
    <input class="ainp" placeholder="1.2 km" value="${distance}" style="flex:1;">
    <button class="rm-btn" onclick="this.parentElement.remove()">×</button>`;
  d.appendChild(row);
}
function getHospitals() {
  return [...document.querySelectorAll('#hospitalRows .arow')].map(r => {
    const ins = r.querySelectorAll('input');
    return { name: ins[0].value.trim(), distance: ins[1].value.trim() };
  }).filter(x => x.name);
}

// ── Dynamic rows: Malls ───────────────────────────────────────────────────
function addMall(name='', distance='') {
  name     = (name     && name     !== 'null') ? name     : '';
  distance = (distance && distance !== 'null') ? distance : '';
  const d = document.getElementById('mallRows');
  const row = document.createElement('div'); row.className = 'arow';
  row.innerHTML = `<input class="ainp" placeholder="Mall / retail name" value="${name}" style="flex:2;">
    <input class="ainp" placeholder="0.8 km" value="${distance}" style="flex:1;">
    <button class="rm-btn" onclick="this.parentElement.remove()">×</button>`;
  d.appendChild(row);
}
function getMalls() {
  return [...document.querySelectorAll('#mallRows .arow')].map(r => {
    const ins = r.querySelectorAll('input');
    return { name: ins[0].value.trim(), distance: ins[1].value.trim() };
  }).filter(x => x.name);
}

// ── Dynamic rows: FAQs ────────────────────────────────────────────────────
function addFaq(q='', a='') {
  const d = document.getElementById('faqRows');
  const idx = d.children.length + 1;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:#f7f9fb;border-radius:10px;padding:14px;margin-bottom:10px;position:relative;';
  wrap.innerHTML = `<div class="ash" style="font-size:10px;margin-bottom:6px;">FAQ ${idx}</div>
    <input class="ainp" placeholder="Is Dubai Marina good for investment?" value="${q}" style="margin-bottom:8px;">
    <textarea class="ainp" rows="2" placeholder="Answer...">${a}</textarea>
    <button class="rm-btn" onclick="this.parentElement.remove()" style="position:absolute;top:10px;right:10px;">×</button>`;
  d.appendChild(wrap);
}
function getFaqs() {
  return [...document.querySelectorAll('#faqRows > div')].map(w => {
    const ins = w.querySelector('input');
    const ta  = w.querySelector('textarea');
    return { q: ins?.value.trim() || '', a: ta?.value.trim() || '' };
  }).filter(x => x.q);
}

// ── Collect all form data ─────────────────────────────────────────────────
function collectArea() {
  return {
    id:                     gv('a_id') || null,
    name:                   gv('a_name'),
    slug:                   gv('a_slug'),
    tagline:                gv('a_tagline'),
    hero_image:             gv('a_hero'),
    about:                  gv('a_about'),
    highlight_why_buy:      gv('a_hl_why'),
    highlight_who_lives:    gv('a_hl_who'),
    highlight_best_streets: gv('a_hl_streets'),
    highlight_vibe:         gv('a_hl_vibe'),
    avg_price_studio:       gv('a_ps_studio')   || null,
    avg_price_1br:          gv('a_ps_1br')      || null,
    avg_price_2br:          gv('a_ps_2br')      || null,
    avg_price_3br:          gv('a_ps_3br')      || null,
    avg_rent_studio:        gv('a_pr_studio')   || null,
    avg_rent_1br:           gv('a_pr_1br')      || null,
    avg_rent_2br:           gv('a_pr_2br')      || null,
    avg_rent_3br:           gv('a_pr_3br')      || null,
    avg_ppsf_studio:        gv('a_ppsf_studio') || null,
    avg_ppsf_1br:           gv('a_ppsf_1br')    || null,
    avg_ppsf_2br:           gv('a_ppsf_2br')    || null,
    avg_ppsf_3br:           gv('a_ppsf_3br')    || null,
    avg_roi_studio:         gv('a_proi_studio') || null,
    avg_roi_1br:            gv('a_proi_1br')    || null,
    avg_roi_2br:            gv('a_proi_2br')    || null,
    avg_roi_3br:            gv('a_proi_3br')    || null,
    roi_pct:                gv('a_roi')        || null,
    area_size:              gv('a_size'),
    best_for:               gv('a_best_for'),
    lifestyle_dining_text:    gv('a_ls_dining_text'),
    lifestyle_dining_image:   gv('a_ls_dining_img'),
    lifestyle_parks_text:     gv('a_ls_parks_text'),
    lifestyle_parks_image:    gv('a_ls_parks_img'),
    lifestyle_shopping_text:  gv('a_ls_shopping_text'),
    lifestyle_shopping_image: gv('a_ls_shopping_img'),
    map_image:              gv('a_map_img'),
    commute_times:          getCommutes(),
    schools:                getSchools(),
    hospitals:              getHospitals(),
    malls:                  getMalls(),
    nearby_areas:           gv('a_nearby').split(',').map(s=>s.trim()).filter(Boolean),
    faqs:                   getFaqs(),
    agent_name:             gv('a_agent_name'),
    agent_phone:            gv('a_agent_phone'),
    agent_photo:            gv('a_agent_photo'),
    seo_title:              gv('a_stitle'),
    seo_description:        gv('a_sdesc'),
    seo_keywords:           gv('a_skw'),
    published:              document.getElementById('a_pub').checked,
  };
}

// ── Fill form from object ─────────────────────────────────────────────────
function fillArea(a) {
  sv('a_id',    a.id || '');
  // Preserve name/slug if AI didn't return them
  if (a.name) sv('a_name', a.name);
  if (a.slug) sv('a_slug', a.slug);
  sv('a_tagline', a.tagline); sv('a_hero',    a.hero_image);
  sv('a_about', a.about);
  sv('a_hl_why',     a.highlight_why_buy);
  sv('a_hl_who',     a.highlight_who_lives);
  sv('a_hl_streets', a.highlight_best_streets);
  sv('a_hl_vibe',    a.highlight_vibe);
  sv('a_roi',  a.roi_pct);   sv('a_size', a.area_size);   sv('a_best_for', a.best_for);
  sv('a_ps_studio', a.avg_price_studio); sv('a_pr_studio', a.avg_rent_studio);
  sv('a_ps_1br',    a.avg_price_1br);    sv('a_pr_1br',    a.avg_rent_1br);
  sv('a_ps_2br',    a.avg_price_2br);    sv('a_pr_2br',    a.avg_rent_2br);
  sv('a_ps_3br',    a.avg_price_3br);    sv('a_pr_3br',    a.avg_rent_3br);
  sv('a_ppsf_studio', a.avg_ppsf_studio); sv('a_proi_studio', a.avg_roi_studio);
  sv('a_ppsf_1br',    a.avg_ppsf_1br);   sv('a_proi_1br',    a.avg_roi_1br);
  sv('a_ppsf_2br',    a.avg_ppsf_2br);   sv('a_proi_2br',    a.avg_roi_2br);
  sv('a_ppsf_3br',    a.avg_ppsf_3br);   sv('a_proi_3br',    a.avg_roi_3br);
  sv('a_ls_dining_text', a.lifestyle_dining_text);
  sv('a_ls_dining_img',  a.lifestyle_dining_image);
  sv('a_ls_parks_text',  a.lifestyle_parks_text);
  sv('a_ls_parks_img',   a.lifestyle_parks_image);
  sv('a_ls_shopping_text', a.lifestyle_shopping_text);
  sv('a_ls_shopping_img',  a.lifestyle_shopping_image);
  sv('a_map_img', a.map_image);
  sv('a_nearby', (a.nearby_areas||[]).join(', '));
  sv('a_agent_name', a.agent_name); sv('a_agent_phone', a.agent_phone); sv('a_agent_photo', a.agent_photo);
  sv('a_stitle', a.seo_title); sv('a_sdesc', a.seo_description);
  sv('a_skw', Array.isArray(a.seo_keywords) ? a.seo_keywords.join(', ') : (a.seo_keywords || ''));
  if (a.is_published) document.getElementById('a_pub').checked = true;
  // Dynamic rows
  document.getElementById('commuteRows').innerHTML = '';
  (a.commute_times||[]).forEach(c => addCommute(c.label, c.minutes));
  document.getElementById('schoolRows').innerHTML = '';
  (a.schools||[]).forEach(s => addSchool(s.name, s.type, s.distance));
  document.getElementById('hospitalRows').innerHTML = '';
  (a.hospitals||[]).forEach(h => addHospital(h.name, h.distance));
  document.getElementById('mallRows').innerHTML = '';
  (a.malls||[]).forEach(m => addMall(m.name, m.distance));
  document.getElementById('faqRows').innerHTML = '';
  (a.faqs||[]).forEach(f => addFaq(f.q, f.a));
  // Previews
  if (a.hero_image)  previewHero();
  if (a.map_image)   prevMap();
  if (a.lifestyle_dining_image)   prevLs('dining');
  if (a.lifestyle_parks_image)    prevLs('parks');
  if (a.lifestyle_shopping_image) prevLs('shopping');
}

// ── Image picker helpers ──────────────────────────────────────────────────
function showAreaImagePicker(photos, gridId, wrapId, fieldId, previewId) {
  const grid = document.getElementById(gridId);
  const wrap = document.getElementById(wrapId);
  if (!grid || !photos.length) return;
  grid.innerHTML = '';
  photos.slice(0, 4).forEach(p => {
    const cell = document.createElement('div');
    cell.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;';
    cell.innerHTML = `<img src="${p.thumb}" style="width:100%;height:70px;object-fit:cover;display:block;">
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(25,37,55,.7);padding:4px 6px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:9px;color:rgba(255,255,255,.6);">©${p.credit}</span>
        <button onclick="approveAreaImage('${p.full}',this,'${fieldId}','${previewId}','${wrapId}')"
          style="background:#7fe2e3;color:#192537;border:none;border-radius:4px;padding:2px 8px;font-size:9px;font-family:Montserrat,sans-serif;font-weight:700;cursor:pointer;">
          Use This
        </button>
      </div>`;
    grid.appendChild(cell);
  });
  wrap.style.display = 'block';
}

async function approveAreaImage(url, btn, fieldId, previewId, wrapId) {
  btn.textContent = '...'; btn.disabled = true;
  try {
    const r = await fetch('/blog/approve-image', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ url })
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.error);
    sv(fieldId, j.url);
    if (previewId) {
      const wrap = document.getElementById(previewId);
      if (wrap) { wrap.querySelector('img').src = j.url; wrap.style.display = 'flex'; }
    }
    if (wrapId) document.getElementById(wrapId).style.display = 'none';
  } catch(e) {
    btn.textContent = 'Error'; btn.disabled = false;
  }
}

async function fetchAreaImages(name) {
  const st = document.getElementById('areaSt2');
  // Strip " by Developer" from area name so Pexels doesn't get confused
  const baseName = name.replace(/\s+by\s+\w[\w\s]*/i, '').trim();
  const searches = [
    { query: baseName + ' aerial view skyline',        gridId: 'heroPickerGrid',     wrapId: 'heroPickerWrap',     fieldId: 'a_hero',            previewId: 'heroPreview' },
    { query: baseName + ' Dubai restaurant dining',    gridId: 'diningPickerGrid',   wrapId: 'diningPickerWrap',   fieldId: 'a_ls_dining_img',   previewId: 'ls_dining_prev' },
    { query: baseName + ' park beach outdoor leisure', gridId: 'parksPickerGrid',    wrapId: 'parksPickerWrap',    fieldId: 'a_ls_parks_img',    previewId: 'ls_parks_prev' },
    { query: baseName + ' mall shopping retail',       gridId: 'shoppingPickerGrid', wrapId: 'shoppingPickerWrap', fieldId: 'a_ls_shopping_img', previewId: 'ls_shopping_prev' },
  ];
  st.textContent = 'Fetching images...'; st.style.color = '#7a8a9e';
  let imgCount = 0;
  for (const s of searches) {
    try {
      const r = await fetch('/blog/search-images', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ query: s.query })
      });
      const j = await r.json();
      if (j.success && j.photos && j.photos.length) {
        showAreaImagePicker(j.photos, s.gridId, s.wrapId, s.fieldId, s.previewId);
        imgCount++;
      } else if (!j.success) {
        st.textContent = 'Image search: ' + (j.error || 'no results'); st.style.color = '#e07b3a';
      }
    } catch(e) {
      st.textContent = 'Image fetch error: ' + e.message; st.style.color = '#e07b3a';
    }
  }
  if (imgCount > 0) {
    st.textContent = '✓ All done — choose images, review and save!'; st.style.color = '#10b981';
  } else {
    st.textContent = '✓ Draft ready — add images manually or check Pexels key'; st.style.color = '#e07b3a';
  }
}

// ── Humanize About text ────────────────────────────────────────────────────
async function humanizeArea() {
  const content = gv('a_about');
  if (!content) { alert('Generate or write the About section first.'); return; }
  const btn = document.getElementById('humanAreaBtn');
  const st  = document.getElementById('areaSt2');
  btn.textContent = '⏳ Humanizing...'; btn.disabled = true;
  st.textContent = 'Rewriting...'; st.style.color = '#7a8a9e';
  try {
    const r = await fetch('/areas/humanize', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ content })
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.error);
    sv('a_about', j.content);
    st.textContent = '✓ Humanized!'; st.style.color = '#10b981';
  } catch(e) {
    st.textContent = 'Error: ' + e.message; st.style.color = '#e05';
  } finally {
    btn.textContent = '🧠 Humanize'; btn.disabled = false;
  }
}

// ── AI Generate ───────────────────────────────────────────────────────────
async function aiArea() {
  const name = gv('a_name');
  if (!name) { alert('Enter the area name first.'); return; }
  const btn = document.getElementById('aiAreaBtn');
  const st  = document.getElementById('areaSt2');
  btn.textContent = '⏳ Generating...'; btn.disabled = true;
  st.textContent = 'Searching web for area data...'; st.style.color = '#7a8a9e';
  try {
    const r = await fetch('/areas/ai-generate', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name })
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.error);
    fillArea(j);
    st.textContent = '✓ Draft ready — fetching images...'; st.style.color = '#10b981';
    await fetchAreaImages(name);
  } catch(e) {
    st.textContent = 'AI error: ' + e.message; st.style.color = '#e05';
  } finally {
    btn.textContent = '✦ AI Generate'; btn.disabled = false;
  }
}

// ── Save ──────────────────────────────────────────────────────────────────
async function saveArea() {
  const st  = document.getElementById('areaSt');
  const msg = document.getElementById('areaSaveMsg');
  const showMsg = (text, ok) => {
    [st, msg].forEach(el => {
      if (!el) return;
      el.style.display = 'block';
      el.textContent = text;
      el.style.background = ok ? 'rgba(127,226,227,.15)' : '#fff0f3';
      el.style.color      = ok ? '#0f7a7b' : '#cc0033';
    });
  };
  showMsg('Saving…', true);
  try {
    const r = await fetch('/areas/save', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(collectArea())
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.error);
    showMsg('✓ Saved successfully!', true);
    if (j.id) {
      sv('a_id', j.id);
      document.getElementById('pageTitle').textContent = 'Edit Area Guide';
      history.replaceState(null,'','/areas/edit/'+j.id);
    }
  } catch(e) {
    showMsg('Save error: ' + e.message, false);
  }
}

// ── Load edit data on page load ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window.__AREA__) {
    document.getElementById('pageTitle').textContent = 'Edit Area Guide';
    fillArea(window.__AREA__);
  }
});
</script>
"""


@app.route("/areas")
@login_required
def areas():
    rows = db.table("areas").select("id,name,slug,is_published,created_at").order("name").execute().data or []
    cards = ""
    for r in rows:
        pub_color = "#10b981" if r.get("is_published") else "#e07b3a"
        pub_label = "Published" if r.get("is_published") else "Draft"
        cards += f"""
        <tr>
          <td style="padding:14px 20px;font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;color:#192537;">{r['name']}</td>
          <td style="padding:14px 20px;font-family:Verdana,sans-serif;font-size:12px;color:#7a8a9e;">/area-guides/{r['slug']}</td>
          <td style="padding:14px 20px;">
            <span style="background:{'rgba(16,185,129,.1)' if r.get('is_published') else 'rgba(224,123,58,.1)'};
              color:{pub_color};border-radius:999px;padding:3px 12px;font-family:Verdana,sans-serif;font-size:11px;font-weight:700;">
              {pub_label}
            </span>
          </td>
          <td style="padding:14px 20px;display:flex;gap:8px;">
            <a href="/areas/edit/{r['id']}" class="btn btn-outline" style="font-size:12px;padding:7px 16px;margin-right:6px">Edit</a>
            <button onclick="delArea('{r['id']}',this)" style="background:none;border:1px solid #fecaca;color:#e05;border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;font-family:Montserrat,sans-serif;font-weight:700;">Delete</button>
          </td>
        </tr>"""

    if not cards:
        cards = '<tr><td colspan="4" style="padding:48px;text-align:center;font-family:Verdana,sans-serif;font-size:13px;color:#aaa;">No area guides yet — click New Area Guide to add one.</td></tr>'

    html = f"""
    <div style="max-width:960px;margin:0 auto;padding:24px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;">
        <div>
          <h1 style="font-family:Montserrat,sans-serif;font-weight:800;font-size:22px;color:#192537;margin:0;">Area Guides</h1>
          <p style="font-family:Verdana,sans-serif;font-size:12px;color:#7a8a9e;margin:6px 0 0;">{len(rows)} area guide{'s' if len(rows)!=1 else ''} total</p>
        </div>
        <a href="/areas/new" style="background:#7fe2e3;color:#192537;text-decoration:none;border-radius:999px;
          padding:11px 24px;font-family:Montserrat,sans-serif;font-weight:700;font-size:13px;">+ New Area Guide</a>
      </div>
      <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(25,37,55,.05);border:1px solid rgba(25,37,55,.05);">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid #f0f0f0;">
              <th style="padding:12px 20px;font-family:Montserrat,sans-serif;font-size:10px;color:#7a8a9e;text-align:left;text-transform:uppercase;letter-spacing:.1em;">Area</th>
              <th style="padding:12px 20px;font-family:Montserrat,sans-serif;font-size:10px;color:#7a8a9e;text-align:left;text-transform:uppercase;letter-spacing:.1em;">URL</th>
              <th style="padding:12px 20px;font-family:Montserrat,sans-serif;font-size:10px;color:#7a8a9e;text-align:left;text-transform:uppercase;letter-spacing:.1em;">Status</th>
              <th style="padding:12px 20px;font-family:Montserrat,sans-serif;font-size:10px;color:#7a8a9e;text-align:left;text-transform:uppercase;letter-spacing:.1em;">Actions</th>
            </tr>
          </thead>
          <tbody>{cards}</tbody>
        </table>
      </div>
    </div>
    <script>
    async function delArea(id, btn) {{
      if (!confirm('Delete this area guide? This cannot be undone.')) return;
      btn.textContent = '...'; btn.disabled = true;
      const r = await fetch('/areas/delete', {{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{id}})}});
      const j = await r.json();
      if (j.success) btn.closest('tr').remove();
      else {{ btn.textContent = 'Error'; btn.disabled = false; }}
    }}
    </script>"""
    return page("Area Guides", html, "areas")


@app.route("/areas/new")
@login_required
def areas_new():
    return page("New Area Guide", AREA_FORM, "areas")


@app.route("/areas/edit/<area_id>")
@login_required
def areas_edit(area_id):
    import base64 as _b64
    row = db.table("areas").select("*").eq("id", area_id).single().execute().data
    if not row:
        flash("Area not found.", "error")
        return redirect(url_for("areas"))
    b64 = _b64.b64encode(json.dumps(row, default=str).encode()).decode()
    inject = f'<script>window.__AREA__=JSON.parse(atob("{b64}"));</script>\n'
    return page("Edit Area Guide", inject + AREA_FORM, "areas")


@app.route("/areas/save", methods=["POST"])
@login_required
def areas_save():
    data = request.get_json() or {}
    if not data.get("name") or not data.get("slug"):
        return jsonify({"success": False, "error": "Name and slug are required"})

    def num(val):
        try: return float(str(val).replace(",","")) if val else None
        except: return None

    payload = {
        "name":                     str(data.get("name","")).strip(),
        "slug":                     str(data.get("slug","")).strip(),
        "tagline":                  str(data.get("tagline","")).strip(),
        "hero_image":               str(data.get("hero_image","")).strip(),
        "about":                    str(data.get("about","")).strip(),
        "highlight_why_buy":        str(data.get("highlight_why_buy","")).strip(),
        "highlight_who_lives":      str(data.get("highlight_who_lives","")).strip(),
        "highlight_best_streets":   str(data.get("highlight_best_streets","")).strip(),
        "highlight_vibe":           str(data.get("highlight_vibe","")).strip(),
        "avg_price_studio":         num(data.get("avg_price_studio")),
        "avg_price_1br":            num(data.get("avg_price_1br")),
        "avg_price_2br":            num(data.get("avg_price_2br")),
        "avg_price_3br":            num(data.get("avg_price_3br")),
        "avg_rent_studio":          num(data.get("avg_rent_studio")),
        "avg_rent_1br":             num(data.get("avg_rent_1br")),
        "avg_rent_2br":             num(data.get("avg_rent_2br")),
        "avg_rent_3br":             num(data.get("avg_rent_3br")),
        "avg_ppsf_studio":          num(data.get("avg_ppsf_studio")),
        "avg_ppsf_1br":             num(data.get("avg_ppsf_1br")),
        "avg_ppsf_2br":             num(data.get("avg_ppsf_2br")),
        "avg_ppsf_3br":             num(data.get("avg_ppsf_3br")),
        "avg_roi_studio":           num(data.get("avg_roi_studio")),
        "avg_roi_1br":              num(data.get("avg_roi_1br")),
        "avg_roi_2br":              num(data.get("avg_roi_2br")),
        "avg_roi_3br":              num(data.get("avg_roi_3br")),
        "roi_pct":                  num(data.get("roi_pct")),
        "area_size":                str(data.get("area_size","")).strip(),
        "best_for":                 str(data.get("best_for","")).strip(),
        "lifestyle_dining_text":    str(data.get("lifestyle_dining_text","")).strip(),
        "lifestyle_dining_image":   str(data.get("lifestyle_dining_image","")).strip(),
        "lifestyle_parks_text":     str(data.get("lifestyle_parks_text","")).strip(),
        "lifestyle_parks_image":    str(data.get("lifestyle_parks_image","")).strip(),
        "lifestyle_shopping_text":  str(data.get("lifestyle_shopping_text","")).strip(),
        "lifestyle_shopping_image": str(data.get("lifestyle_shopping_image","")).strip(),
        "map_image":                str(data.get("map_image","")).strip(),
        "commute_times":            data.get("commute_times", []),
        "schools":                  data.get("schools", []),
        "hospitals":                data.get("hospitals", []),
        "malls":                    data.get("malls", []),
        "nearby_areas":             data.get("nearby_areas", []),
        "faqs":                     data.get("faqs", []),
        "agent_name":               str(data.get("agent_name","")).strip(),
        "agent_phone":              str(data.get("agent_phone","")).strip(),
        "agent_photo":              str(data.get("agent_photo","")).strip(),
        "seo_title":                str(data.get("seo_title","")).strip(),
        "seo_description":          str(data.get("seo_description","")).strip(),
        "seo_keywords":             [k.strip() for k in str(data.get("seo_keywords","")).split(",") if k.strip()],
        "is_published":             bool(data.get("published", False)),
        "updated_at":               datetime.utcnow().isoformat(),
    }
    try:
        area_id = data.get("id")
        if area_id:
            db.table("areas").update(payload).eq("id", area_id).execute()
            return jsonify({"success": True, "id": area_id})
        else:
            res = db.table("areas").insert(payload).execute()
            new_id = res.data[0]["id"] if res.data else None
            return jsonify({"success": True, "id": new_id})
    except Exception as e:
        print(f"[AREAS SAVE ERROR] {e}", flush=True)
        return jsonify({"success": False, "error": str(e)})


@app.route("/areas/delete", methods=["POST"])
@login_required
def areas_delete():
    data = request.get_json() or {}
    area_id = data.get("id")
    if not area_id:
        return jsonify({"success": False, "error": "ID required"})
    try:
        db.table("areas").delete().eq("id", area_id).execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/areas/upload-image", methods=["POST"])
@login_required
def areas_upload_image():
    f = request.files.get("file")
    if not f:
        return jsonify({"success": False, "error": "No file"})
    try:
        img_bytes = f.read()
        url = _upload_bytes_to_cloudinary(img_bytes, folder="area-guides")
        if not url:
            return jsonify({"success": False, "error": "Cloudinary upload failed"})
        return jsonify({"success": True, "url": url})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/areas/humanize", methods=["POST"])
@login_required
def areas_humanize():
    data    = request.get_json() or {}
    content = str(data.get("content", "")).strip()
    if not content:
        return jsonify({"success": False, "error": "No content provided"})
    if not ANTHROPIC_KEY:
        return jsonify({"success": False, "error": "Add ANTHROPIC_KEY to .env"})
    try:
        system = (
            "You are editing a Dubai real estate area guide description to sound genuinely human-written. "
            "BANNED WORDS — never use: crucial, essential, comprehensive, delve, leverage, utilize, "
            "pivotal, paramount, robust, navigate, foster, streamline, bustling, nestled, vibrant. "
            "STYLE RULES: "
            "1. Mix sentence lengths — some 5-8 words, some 18-25 words, within every paragraph. "
            "2. Open with a hook: a surprising fact, a local insight, or a buyer question. "
            "3. Use conversational phrases: 'you'll find', 'buyers often ask', 'one thing worth knowing'. "
            "4. Max 3 sentences per paragraph — split long ones. "
            "5. Include at least 2 specific numbers (prices, distances, years, percentages). "
            "6. Keep it to 3 paragraphs. "
            "Return ONLY the rewritten plain text — no HTML tags, no commentary."
        )
        result = _claude(system, content, model="claude-sonnet-4-6", temp=0.85)
        return jsonify({"success": True, "content": result.strip()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/areas/ai-generate", methods=["POST"])
@login_required
def areas_ai_generate():
    data = request.get_json() or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"success": False, "error": "Area name is required"})
    if not ANTHROPIC_KEY:
        return jsonify({"success": False, "error": "Add ANTHROPIC_KEY to .env"})
    try:
        web_context = _search_developer_context(name + " Dubai area neighbourhood", "")
        print(f"=== AREA WEB CONTEXT ({len(web_context)} chars) ===\n{web_context[:300]}\n===")

        if web_context:
            system = (
                "You are a Dubai real estate expert writing area guides for Elysian, a premium property portal. "
                "Web research is provided — use it as your ONLY source of facts. "
                "Do NOT invent prices, project names, or statistics not in the research. "
                "Set uncertain fields to null. "
                "Return ONLY a valid JSON object — no markdown, no code fences, no commentary."
            )
        else:
            system = (
                "You are a Dubai real estate expert writing area guides for Elysian, a premium property portal. "
                "Use your knowledge about Dubai areas to fill this profile accurately. "
                "Only include prices and statistics you are confident about; set others to null. "
                "Return ONLY a valid JSON object — no markdown, no code fences, no commentary."
            )

        context_block = f"\n\nWEB RESEARCH:\n{web_context}" if web_context else ""

        prompt = f"""Write a complete area guide for the Elysian Dubai portal.

Area: {name}, Dubai{context_block}

Return a JSON object with exactly these fields:
- tagline: punchy 6-8 word tagline for this area
- about: 3 paragraphs separated by \\n\\n describing the area for buyers/investors
- highlight_why_buy: one sentence on the investment case
- highlight_who_lives: types of residents (e.g. "Expats, young professionals, families")
- highlight_best_streets: notable streets or spots
- highlight_vibe: 3-4 word vibe description
- avg_price_studio: number in AED or null
- avg_price_1br: number in AED or null
- avg_price_2br: number in AED or null
- avg_price_3br: number in AED or null
- avg_rent_studio: annual rent AED or null
- avg_rent_1br: annual rent AED or null
- avg_rent_2br: annual rent AED or null
- avg_rent_3br: annual rent AED or null
- roi_pct: average ROI percentage number or null
- area_size: string e.g. "4.9 sq km" or null
- best_for: comma-separated e.g. "Investors, Expats, Young Professionals"
- lifestyle_dining_text: 2-3 sentences on dining and nightlife
- lifestyle_parks_text: 2-3 sentences on parks, leisure, outdoor activities
- lifestyle_shopping_text: 2-3 sentences on shopping and retail
- commute_times: array of objects with label and minutes keys (5-6 key destinations)
- schools: array of objects with name, type, distance keys (3-5 schools)
- hospitals: array of objects with name, distance keys (2-4 hospitals)
- malls: array of objects with name, distance keys (2-4 malls/retail)
- nearby_areas: array of nearby area names in Dubai
- faqs: array of 10 objects with q and a keys — cover investment, prices, lifestyle, transport, schools
- seo_title: 50-60 chars, include area name + Dubai + 2026
- seo_description: 130-155 chars
- seo_keywords: 6-8 comma-separated keywords"""

        raw = _claude(system, prompt, model="claude-haiku-4-5-20251001", temp=0.4)
        print("=== RAW AREA RESPONSE ==="); print(raw[:300]); print("===")
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if not m:
            raise ValueError(f"No JSON in response. Raw: {raw[:200]}")
        draft = json.loads(m.group())
        return jsonify({"success": True, **draft})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/seo")
@login_required
def seo():
    return placeholder("SEO Checker", "🔍",
        "Audit every project page for SEO completeness — title tags, meta descriptions, "
        "keywords, schema markup, and content length scoring. Coming soon.",
        "seo")

@app.route("/pagerank")
@login_required
def pagerank():
    return placeholder("Page Rank Checker", "📈",
        "Track Google rankings for your target keywords over time. "
        "Monitor competitor positions and identify ranking opportunities. Coming soon.",
        "pagerank")


# ─────────────────────────────────────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "="*52)
    print("  Elysian Admin Dashboard")
    print("  URL:  http://localhost:5001")
    print(f"  User: {ADMIN_USER}")
    print(f"  Pass: {ADMIN_PASS}")
    print("="*52 + "\n")
    app.run(host="0.0.0.0", port=5001, debug=False)