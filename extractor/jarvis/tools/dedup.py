"""
Cross-source duplicate detection for project imports (opr.ae vs Property Finder).

Three-tier system:
  Tier 1 (exact)  — same name + developer + area after normalisation → skip silently
  Tier 2 (near)   — same base name + developer + area, but one has a phase suffix → ask user
  Tier 3 (new)    — name differs meaningfully → insert
"""
from __future__ import annotations
import re
import logging

logger = logging.getLogger(__name__)

_STOP = frozenset({"by", "at", "the", "in", "of", "and", "&", "a", "an"})

# Matches trailing phase/number: "Phase 1", "1", "II", "III", "IV" etc.
_PHASE_RE = re.compile(
    r"\s+(?:phase\s*)?\d+$"
    r"|\s+(?:phase\s*)?(?:ii|iii|iv|vi{0,3})$",
    re.IGNORECASE,
)


def normalize(s: str) -> str:
    """Lowercase, strip punctuation, remove stop words."""
    words = re.sub(r"[^\w\s]", "", s.lower()).split()
    return " ".join(w for w in words if w not in _STOP)


def _base_and_phase(name: str) -> tuple[str, bool]:
    """Strip trailing phase marker from a normalised name. Returns (base, has_phase)."""
    norm = normalize(name)
    has_phase = bool(_PHASE_RE.search(norm))
    base = _PHASE_RE.sub("", norm).strip()
    return base, has_phase


def check_duplicate(
    name: str,
    developer_slug: str,
    area_name: str,
    existing_index: list[dict],
) -> tuple[str, dict | None]:
    """
    Check whether a new project duplicates anything in existing_index.

    existing_index: rows from get_existing_projects_index() —
                    each has {name, developer_slug, geo_summary}

    Returns:
        ("exact", existing_row)  — Tier 1: definite dup → skip
        ("near",  existing_row)  — Tier 2: possible phase variant → ask user
        ("new",   None)          — Tier 3: not a duplicate → insert
    """
    norm_name  = normalize(name)
    norm_dev   = normalize(developer_slug.replace("-", " "))
    norm_area  = normalize(area_name)
    new_base, new_has_phase = _base_and_phase(name)

    for row in existing_index:
        ex_dev = normalize((row.get("developer_slug") or "").replace("-", " "))
        if ex_dev != norm_dev:
            continue  # different developer — not a dup

        ex_name = normalize(row.get("name") or "")
        geo     = row.get("geo_summary") or ""
        ex_area = normalize(geo.split(",")[0].strip())

        # Tier 1: exact match on all three fields
        if ex_name == norm_name and ex_area == norm_area:
            return ("exact", row)

        # Tier 2: same developer + area, base names match, one has a phase number
        areas_match = (ex_area == norm_area) or not norm_area or not ex_area
        if areas_match:
            ex_base, ex_has_phase = _base_and_phase(row.get("name") or "")
            if new_base == ex_base and (new_has_phase or ex_has_phase):
                return ("near", row)

    return ("new", None)


def format_near_match_message(db_row: dict, new_name: str, new_dev: str, new_area: str) -> str:
    """Build the Telegram message text for a Tier 2 near match."""
    return (
        f"Possible duplicate — your call:\n"
        f"DB has:  \"{db_row.get('name')}\" | {db_row.get('developer_slug')} | {db_row.get('geo_summary')}\n"
        f"PF has:  \"{new_name}\" | {new_dev} | {new_area}\n"
        f"Same project or a new phase?\n"
        f"Reply: SAME (skip) or NEW (publish it)"
    )
