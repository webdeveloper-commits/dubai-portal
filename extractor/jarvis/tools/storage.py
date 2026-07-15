"""
Supabase read/write helpers for JARVIS.
"""
import logging
from supabase import create_client, Client
from ..config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

_client: Client | None = None


def db() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


# ── Projects ───────────────────────────────────────────────────────────────────

def get_existing_slugs() -> set[str]:
    """
    Return all known slugs — both the DB slug and the opr.ae URL slug.
    This prevents re-scraping projects where the URL slug (e.g. 'eira-by-neoterra-...')
    differs from the stored slug (e.g. 'eira').
    """
    try:
        res = db().table("projects").select("slug, data_source_url").execute()
        slugs: set[str] = set()
        for r in (res.data or []):
            if r.get("slug"):
                slugs.add(r["slug"])
            url = r.get("data_source_url") or ""
            if "/projects/" in url:
                url_slug = url.rstrip("/").split("/")[-1]
                if url_slug:
                    slugs.add(url_slug)
        return slugs
    except Exception as e:
        logger.error(f"get_existing_slugs failed: {e}")
        return set()


def get_unindexed_projects() -> list[dict]:
    """Return published projects not yet submitted to Google."""
    try:
        res = (
            db().table("projects")
            .select("id, name, slug")
            .eq("is_published", True)
            .eq("google_indexed", False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"get_unindexed_projects failed: {e}")
        return []


def publish_project(data: dict) -> str | None:
    """Insert project into Supabase. Returns the new row id or None on failure."""
    try:
        payload = {**data, "is_published": True, "google_indexed": False}
        # Strip private runner-only keys
        payload.pop("_developer", None)
        payload.pop("_area", None)
        # opr_url → data_source_url
        if "opr_url" in payload:
            payload["data_source_url"] = payload.pop("opr_url")
            payload.setdefault("data_source", "opr.ae")
        res = db().table("projects").insert(payload).execute()
        row_id = res.data[0]["id"] if res.data else None
        logger.info(f"Published project '{data.get('name')}' id={row_id}")
        return row_id
    except Exception as e:
        logger.error(f"publish_project failed: {e}")
        return None


# ── Developers ─────────────────────────────────────────────────────────────────

def upsert_developer(data: dict) -> str | None:
    """
    Find existing developer by slug or create new one.
    Returns the developer id, or None on failure.
    """
    slug = data.get("slug", "").strip()
    if not slug:
        return None
    try:
        res = db().table("developers").select("id").eq("slug", slug).execute()
        if res.data:
            logger.info(f"Developer '{slug}' already exists — reusing id")
            return res.data[0]["id"]
        payload = {
            "name":            data.get("name", ""),
            "slug":            slug,
            "intro_short":     data.get("intro_short", "") or "",
            "logo_url":        data.get("logo_url"),
            "logo_color_url":  data.get("logo_url"),
            "tagline":         data.get("tagline", "") or "",
            "seo_title":       data.get("seo_title", "") or "",
            "seo_description": data.get("seo_description", "") or "",
            "seo_keywords":    data.get("seo_keywords") or [],
            "aeo_faq":         data.get("aeo_faq") or [],
            "is_published":    True,
            "published":       True,
            "data_source":     "opr.ae",
        }
        res = db().table("developers").insert(payload).execute()
        dev_id = res.data[0]["id"] if res.data else None
        logger.info(f"Created developer '{slug}' id={dev_id}")
        return dev_id
    except Exception as e:
        logger.error(f"upsert_developer failed for '{slug}': {e}")
        return None


# ── Areas ──────────────────────────────────────────────────────────────────────

def upsert_area(data: dict) -> str | None:
    """
    Find existing area by slug or create new one.
    Returns the area id, or None on failure.
    """
    slug = data.get("slug", "").strip()
    if not slug:
        return None
    try:
        res = db().table("areas").select("id").eq("slug", slug).execute()
        if res.data:
            logger.info(f"Area '{slug}' already exists — reusing id")
            return res.data[0]["id"]
        payload = {
            "name":               data.get("name", ""),
            "slug":               slug,
            "emirate":            data.get("emirate", "Dubai"),
            "description_short":  data.get("description_short", "") or "",
            "image_url":          data.get("image_url"),
            "cover_image_url":    data.get("cover_image_url") or data.get("image_url"),
            "tagline":            data.get("tagline", "") or "",
            "seo_title":          data.get("seo_title", "") or "",
            "seo_description":    data.get("seo_description", "") or "",
            "seo_keywords":       data.get("seo_keywords") or [],
            "aeo_faq":            data.get("aeo_faq") or [],
            "nearby_attractions": data.get("nearby_attractions") or [],
            "nearby_hospitals":   data.get("nearby_hospitals") or [],
            "nearby_schools":     data.get("nearby_schools") or [],
            "is_published":       True,
            "data_source":        "opr.ae",
        }
        res = db().table("areas").insert(payload).execute()
        area_id = res.data[0]["id"] if res.data else None
        logger.info(f"Created area '{slug}' id={area_id}")
        return area_id
    except Exception as e:
        logger.error(f"upsert_area failed for '{slug}': {e}")
        return None


def mark_google_indexed(project_ids: list[str]) -> bool:
    """Set google_indexed=True for the given project ids."""
    try:
        db().table("projects").update({"google_indexed": True}).in_("id", project_ids).execute()
        return True
    except Exception as e:
        logger.error(f"mark_google_indexed failed: {e}")
        return False


# ── Blog posts ─────────────────────────────────────────────────────────────────

def get_unindexed_blog_posts() -> list[dict]:
    try:
        res = (
            db().table("blog_posts")
            .select("id, title, slug")
            .eq("published", True)
            .eq("google_indexed", False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"get_unindexed_blog_posts failed: {e}")
        return []


def publish_blog_post(data: dict) -> str | None:
    try:
        payload = {**data, "published": True, "google_indexed": False}
        res = db().table("blog_posts").insert(payload).execute()
        row_id = res.data[0]["id"] if res.data else None
        logger.info(f"Published blog post '{data.get('title')}' id={row_id}")
        return row_id
    except Exception as e:
        logger.error(f"publish_blog_post failed: {e}")
        return None


# ── JARVIS learning log ────────────────────────────────────────────────────────

def log_error(site: str, error_type: str, fix_applied: str, success: bool) -> None:
    """Store scraping error/fix in jarvis_learning table for self-improvement."""
    try:
        db().table("jarvis_learning").insert({
            "site": site,
            "error_type": error_type,
            "fix_applied": fix_applied,
            "success": success,
        }).execute()
    except Exception:
        pass  # Learning log failure should never break the main flow


def get_known_failures(site: str) -> list[dict]:
    """Retrieve past failure patterns for a site before attempting scrape."""
    try:
        res = (
            db().table("jarvis_learning")
            .select("error_type, fix_applied, success")
            .eq("site", site)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        return res.data or []
    except Exception:
        return []
