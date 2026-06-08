"""
LIMEN Helix — FastAPI Backend
SEC EDGAR proxy with quarterly series extraction.
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import pathlib
import time
import uuid
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from thing2 import (
    ALL_PHASES,
    LIMEN,
    PHASE_META,
    build_company_data,
    get_dominant_phase,
    run_pipeline,
)
from thing2 import KERNEL_ID as THING2_KERNEL_ID
from thing2 import KERNEL_RUNTIME as THING2_KERNEL_RUNTIME
from thing2 import KERNEL_VERSION as THING2_KERNEL_VERSION

import thing1 as thing1_pkg
from audit import build_log_entry as _build_audit_entry, emit as _emit_audit

# ─── Polyvagal context — server-side auto-population ────────────────
#
# Pass 3 wire-up for the polyvagal coupling layer added in commit
# 1dcd11cb1b8 (see memory: limen_thing2_polyvagal_coupling.md). When a
# /api/limen/score call doesn't supply polyvagal_context explicitly in
# the request body, we attempt to build it from server-side data so
# coupling fires automatically in production traffic.
#
# Sources wired so far (initial Pass 3 scope):
#   - assets/data/command-board-data.json — per-CIK phase + domain + ds
#     (each company entry carries the brain-reported domain stress and
#     its own Thing 2 phase + trajectory; aggregates to peer cohort)
#
# Sources NOT yet wired (data-source decisions pending):
#   - counterparties (suppliers/customers graph)  — needs company portal
#     functionalNetwork lookup; available for the 163 named portals
#   - capitalStructure (lenders, credit spreads)   — needs lender graph
#   - laborContext (sector attrition, wages)       — needs labor feed
#   - regulatoryContext (enforcement velocity)     — needs regulator feed
#   - macro (credit cycle, real rate, demand idx)  — partially in via FRED
#
# When auto-population yields no signal, coupling stays in intrinsic_only
# mode and the response narrative declares it honestly.

_CB_PATH = pathlib.Path(__file__).resolve().parents[1] / "assets" / "data" / "command-board-data.json"
# Fallback path — Vercel bundle root differs from working dir; try a
# couple of candidate locations.
_CB_PATH_CANDIDATES = [
    _CB_PATH,
    pathlib.Path("assets/data/command-board-data.json"),
    pathlib.Path("/var/task/assets/data/command-board-data.json"),
]
_CB_CACHE: dict | None = None
_CB_CACHE_AT: float = 0.0
_CB_CACHE_TTL_SECONDS = 600  # 10 min — refresh per cold start typical

_MANIFEST_PATH_CANDIDATES = [
    pathlib.Path(__file__).resolve().parents[1] / "assets" / "data" / "companies-manifest.json",
    pathlib.Path("assets/data/companies-manifest.json"),
    pathlib.Path("/var/task/assets/data/companies-manifest.json"),
]
_MANIFEST_CACHE: dict | None = None
_MANIFEST_CACHE_AT: float = 0.0

_PORTAL_DIR_CANDIDATES = [
    pathlib.Path(__file__).resolve().parents[1] / "assets" / "data" / "companies",
    pathlib.Path("assets/data/companies"),
    pathlib.Path("/var/task/assets/data/companies"),
]
_PORTAL_CACHE: dict[str, dict] = {}  # slug → portal dict (per cold start)


def _load_command_board() -> dict | None:
    """Load command-board-data.json from disk with module-level cache.
    Returns None if not findable in the function bundle."""
    global _CB_CACHE, _CB_CACHE_AT
    now = time.time()
    if _CB_CACHE is not None and (now - _CB_CACHE_AT) < _CB_CACHE_TTL_SECONDS:
        return _CB_CACHE
    for candidate in _CB_PATH_CANDIDATES:
        try:
            if candidate.exists():
                _CB_CACHE = json.loads(candidate.read_text(encoding="utf-8"))
                _CB_CACHE_AT = now
                return _CB_CACHE
        except (OSError, ValueError, json.JSONDecodeError):
            continue
    return None


def _load_companies_manifest() -> dict | None:
    """Load companies-manifest.json with module cache.
    Returns None if file not bundled."""
    global _MANIFEST_CACHE, _MANIFEST_CACHE_AT
    now = time.time()
    if _MANIFEST_CACHE is not None and (now - _MANIFEST_CACHE_AT) < _CB_CACHE_TTL_SECONDS:
        return _MANIFEST_CACHE
    for candidate in _MANIFEST_PATH_CANDIDATES:
        try:
            if candidate.exists():
                _MANIFEST_CACHE = json.loads(candidate.read_text(encoding="utf-8"))
                _MANIFEST_CACHE_AT = now
                return _MANIFEST_CACHE
        except (OSError, ValueError, json.JSONDecodeError):
            continue
    return None


def _load_portal(slug: str) -> dict | None:
    """Read a portal JSON by slug. Cached per cold-start."""
    if not slug:
        return None
    if slug in _PORTAL_CACHE:
        return _PORTAL_CACHE[slug]
    for dir_candidate in _PORTAL_DIR_CANDIDATES:
        try:
            fp = dir_candidate / (slug + ".json")
            if fp.exists():
                p = json.loads(fp.read_text(encoding="utf-8"))
                _PORTAL_CACHE[slug] = p
                return p
        except (OSError, ValueError, json.JSONDecodeError):
            continue
    return None


def _slug_for_cik(cik: str) -> str | None:
    """Resolve a CIK to a portal slug via companies-manifest. Returns None
    when manifest is unavailable or the CIK isn't indexed."""
    manifest = _load_companies_manifest()
    if not manifest:
        return None
    idx = manifest.get("index") or {}
    norm_focal = _normalize_cik(cik)
    for slug, entry in idx.items():
        if not isinstance(entry, dict):
            continue
        if _normalize_cik(entry.get("cik")) == norm_focal:
            return slug
    return None


def _phase_for_cik_in_cb(cb: dict | None, cik: Any) -> str | None:
    """Look up a CIK's phase from a loaded command-board. None when absent."""
    if not cb or not cik:
        return None
    companies = cb.get("companies") or []
    if not isinstance(companies, list):
        return None
    norm = _normalize_cik(cik)
    for c in companies:
        if isinstance(c, dict) and _normalize_cik(c.get("c")) == norm:
            return c.get("p")
    return None


def _build_counterparties_context(focal_cik: str, cb: dict | None) -> dict | None:
    """Pass 3B: counterparties block from the focal portal's
    functionalNetwork. For each supplier / customer, resolve to the
    counterparty's command-board phase (the spider-web propagation
    signal). exposureShare defaults to 1/N when the portal entry
    doesn't carry an explicit share. Returns None when nothing to
    populate (focal has no portal, or no resolvable counterparty
    phases)."""
    slug = _slug_for_cik(focal_cik)
    if not slug:
        return None
    portal = _load_portal(slug)
    if not portal:
        return None
    fn = portal.get("functionalNetwork") or {}
    if not isinstance(fn, dict):
        return None

    def _build_one_side(category: str) -> list:
        entries = fn.get(category)
        if not isinstance(entries, list) or not entries:
            return []
        # Skip auto-reciprocity-fill stubs — they're structural placeholders
        # without real edge weights yet.
        real_entries = [e for e in entries
                        if isinstance(e, dict) and not e.get("_autoReciprocityFill")]
        if not real_entries:
            return []
        n = len(real_entries)
        out = []
        for e in real_entries:
            cp_cik = e.get("cik")
            ph = _phase_for_cik_in_cb(cb, cp_cik)
            if not ph:
                continue  # counterparty not on command board — no phase signal
            # exposureShare: explicit if present, else uniform 1/N.
            explicit = e.get("exposureShare") or e.get("concentrationShare")
            try:
                share = float(explicit) if explicit is not None else (1.0 / n)
            except (TypeError, ValueError):
                share = 1.0 / n
            out.append({
                "cik": cp_cik,
                "name": e.get("name"),
                "exposureShare": round(share, 4),
                "phase": ph,
            })
        return out

    suppliers = _build_one_side("suppliers")
    customers = _build_one_side("customers")
    if not suppliers and not customers:
        return None
    block: dict = {}
    if suppliers:
        block["suppliers"] = suppliers
    if customers:
        # Phase engine expects 'concentrationShare' for customers
        block["customers"] = [
            {"cik": c["cik"], "name": c.get("name"),
             "concentrationShare": c["exposureShare"], "phase": c["phase"]}
            for c in customers
        ]
    return block


def _normalize_cik(cik: Any) -> str:
    """Strip leading zeros; '0000104169' → '104169'."""
    if cik is None:
        return ""
    s = str(cik).strip()
    return s.lstrip("0") or "0"


def _build_polyvagal_context_from_server(cik: str, sic: int) -> dict:
    """Auto-build polyvagal_context from server-side data sources.

    Returns {} when no context can be derived (focal CIK not in command
    board, or command-board file not bundled). Empty context → Thing 2
    falls back to intrinsic_only mode and declares it.

    Current scope:
      - domainPhase + peerCohort      (from command-board)
      - counterparties                (Pass 3B — from focal portal's
                                       functionalNetwork × command-board
                                       phase lookup; spider-web edge signal)
    Other families populate when their data sources land in the bundle
    (capitalStructure, laborContext, regulatoryContext, macro).
    """
    ctx: dict = {}
    cb = _load_command_board()
    if not cb:
        return ctx

    companies = cb.get("companies") or []
    if not isinstance(companies, list) or not companies:
        return ctx

    focal_norm = _normalize_cik(cik)
    focal = None
    for c in companies:
        if not isinstance(c, dict):
            continue
        if _normalize_cik(c.get("c")) == focal_norm:
            focal = c
            break

    if not focal:
        # Off-CB portal — no domainPhase / peerCohort signal available, but the
        # portal's own functionalNetwork still gives us counterparty edges.
        # Don't fail-fast; build whatever context we can. K2 must fire for every
        # portal regardless of CB membership (relaxed 2026-05-29).
        try:
            cp_block = _build_counterparties_context(focal_norm, cb)
            if cp_block:
                ctx["counterparties"] = cp_block
        except Exception:
            pass
        return ctx

    domain = focal.get("d")
    focal_stress = focal.get("ds")
    try:
        focal_stress = float(focal_stress) if focal_stress is not None else None
    except (TypeError, ValueError):
        focal_stress = None

    # ─── Domain phase ─────────────────────────────────────────────
    # Use the focal company's domain-stress signal (ds) as the domain
    # phase stress proxy. The 'phase' here is the focal's own Thing 2
    # phase — it's "the domain's phase as anchored to this company's
    # cohort position" rather than the brain's domain-level phase
    # (the latter requires server-side reading of the browser brain
    # state, which isn't currently piped server-side).
    if domain and focal_stress is not None:
        ctx["domainPhase"] = {
            "domainId": domain,
            "phase": focal.get("p") or "p0",
            "stress": focal_stress,
            "trajectory": focal.get("tr") or "STABLE",
        }

    # ─── Peer cohort (same domain) ────────────────────────────────
    if domain:
        peers = []
        for c in companies:
            if not isinstance(c, dict):
                continue
            if c.get("d") != domain:
                continue
            if _normalize_cik(c.get("c")) == focal_norm:
                continue
            peers.append(c)

        if peers:
            # Median stress across cohort
            stresses = []
            for p in peers:
                try:
                    v = float(p.get("ds")) if p.get("ds") is not None else None
                    if v is not None and not math.isnan(v):
                        stresses.append(v)
                except (TypeError, ValueError):
                    continue
            stresses.sort()
            median_stress = (
                stresses[len(stresses) // 2]
                if stresses
                else 0.0
            )

            # Phase distribution
            phase_dist: dict[str, int] = {}
            for p in peers:
                ph = p.get("p") or "p0"
                phase_dist[ph] = phase_dist.get(ph, 0) + 1
            n = len(peers)
            phase_dist_frac = {ph: round(cnt / n, 4) for ph, cnt in phase_dist.items()}

            # First 25 peer summaries (CIK + phase + stress) for visibility
            peer_summaries = []
            for p in peers[:25]:
                try:
                    s = float(p.get("ds")) if p.get("ds") is not None else None
                except (TypeError, ValueError):
                    s = None
                peer_summaries.append({
                    "cik": p.get("c"),
                    "ticker": p.get("t"),
                    "phase": p.get("p"),
                    "stress": s,
                })

            ctx["peerCohort"] = {
                "domainId": domain,
                "sicCode": int(sic) if sic else None,
                "medianStress": round(median_stress, 4),
                "phaseDistribution": phase_dist_frac,
                "peerCount": n,
                "peers": peer_summaries,
            }

    # ─── Counterparties (Pass 3B — spider-web edge signal) ────────────
    # Pull supplier + customer lists off the focal portal's
    # functionalNetwork. For each counterparty CIK present on the
    # command board, propagate that counterparty's phase into the
    # bias function. This is the load-bearing wire for fractal stress
    # propagation: supplier rupture → focal P1 bias; customer demand
    # collapse → focal P3/P7b bias.
    try:
        cp_block = _build_counterparties_context(focal_norm, cb)
        if cp_block:
            ctx["counterparties"] = cp_block
    except Exception:
        # Best-effort: a portal-read failure must not break the request.
        pass

    # Note: capitalStructure, laborContext, regulatoryContext, and macro
    # remain unwired pending upstream feeds (lender exposure data, BLS
    # sectoral attrition / wage growth, SEC enforcement velocity feed,
    # FRED real-rate + sector-demand snapshots respectively).
    return ctx

# ─── App ────────────────────────────────────────────────────────

app = FastAPI(
    title="LIMEN Helix API",
    description="SEC EDGAR proxy for the 11-phase business stress engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SEC_UA = "limenhelix@gmail.com"

# ─── Provider Map ──────────────────────────────────────────────

PROVIDER_MAP: dict[str, dict] = {
    "p0": {
        "context": "Stable baseline, autopilot.",
        "providers": [
            "Bookkeepers",
            "Compliance CPAs",
            "Payroll services",
            "Insurance brokers",
        ],
    },
    "p1": {
        "context": "First disruption, lost key client.",
        "providers": [
            "Business consultants",
            "Crisis communications",
            "Emergency CFO",
            "Cash flow analysts",
        ],
    },
    "p2": {
        "context": "Seeking co-regulation, partnerships.",
        "providers": [
            "Mastermind groups",
            "Advisory boards",
            "Strategic partnerships",
            "Mentor networks",
            "Fractional COO",
        ],
    },
    "p3": {
        "context": "Deep distress, bleeding cash.",
        "providers": [
            "Restructuring attorneys",
            "Turnaround consultants",
            "Debt negotiation",
            "HR crisis management",
        ],
    },
    "p4": {
        "context": "Stabilized, breathing room.",
        "providers": [
            "Fractional CFO",
            "SOPs/process documentation",
            "Team wellness",
            "Culture consultants",
        ],
    },
    "p5": {
        "context": "Stress-building capacity, grinding.",
        "providers": [
            "Operational efficiency firms",
            "Lean consultants",
            "Working capital advisors",
            "Talent retention specialists",
        ],
    },
    "p6": {
        "context": "Structured growth, scaling.",
        "providers": [
            "ERP implementation",
            "CRM buildout",
            "KPI dashboards",
            "Management training",
            "Compliance upgrades",
        ],
    },
    "p7": {
        "context": "Identity shift, pivot, rebrand.",
        "providers": [
            "M&A advisors",
            "Brand strategists",
            "Succession planners",
            "Business brokers",
            "IP attorneys",
        ],
    },
    "p7a": {
        "context": "Terminal divergence, accelerating deterioration post-break.",
        "providers": [
            "Restructuring attorneys",
            "Liquidation specialists",
            "Crisis management firms",
            "Distressed debt advisors",
            "Bankruptcy counsel",
        ],
    },
    "p7b": {
        "context": "Controlled separation, managed transition post-break.",
        "providers": [
            "Spin-off advisors",
            "Divestiture consultants",
            "Transition management",
            "Change management firms",
            "New venture capital",
        ],
    },
    "p8": {
        "context": "Reflective leadership, evaluating.",
        "providers": [
            "Executive coaches",
            "Board governance",
            "ESG/values alignment",
            "Strategic planning facilitators",
        ],
    },
    "p9": {
        "context": "Major transition imminent.",
        "providers": [
            "Investment bankers",
            "IPO counsel",
            "Liquidation specialists",
            "Transition managers",
            "PE firms",
        ],
    },
    "p10": {
        "context": "New identity consolidated.",
        "providers": [
            "Growth capital",
            "Market expansion consultants",
            "New channel partners",
            "PR/launch agencies",
            "Recruiting firms",
        ],
    },
}


# ─── Helpers ────────────────────────────────────────────────────

def _sanitize_floats(obj):
    """Replace NaN/Inf with None for JSON serialization."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_floats(v) for v in obj]
    return obj


async def _fetch_sec_facts(cik: str) -> dict:
    padded = cik.lstrip("0").zfill(10)
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{padded}.json"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers={
            "User-Agent": SEC_UA,
            "Accept": "application/json",
        })
        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"SEC EDGAR returned {resp.status_code}",
            )
        return resp.json()


async def _fetch_sic_code(cik: str) -> int:
    """Fetch SIC code from SEC EDGAR submissions endpoint."""
    padded = cik.lstrip("0").zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{padded}.json"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers={
            "User-Agent": SEC_UA,
            "Accept": "application/json",
        })
        if resp.status_code != 200:
            return 0
        data = resp.json()
        return int(data.get("sic", "0") or "0")


# ─── Routes ─────────────────────────────────────────────────────

@app.get("/api/helix/health")
async def health():
    """Liveness probe. Does NOT expose constants_hash or kernel internals."""
    return {
        "status": "ok",
        "engine": "limen-helix-phase-v1",
    }


@app.get("/api/helix/edgar/facts/{cik}")
async def edgar_company_facts(cik: str):
    """Proxy to SEC EDGAR companyfacts — avoids browser CORS."""
    return await _fetch_sec_facts(cik)


@app.get("/api/helix/edgar/extract/{cik}")
async def edgar_extract(cik: str):
    """Fetch SEC facts and extract quarterly series (financial-aware)."""
    facts, sic = await asyncio.gather(_fetch_sec_facts(cik), _fetch_sic_code(cik))
    is_financial = 6000 <= sic <= 6999
    company_data = build_company_data(facts, is_financial=is_financial)
    return {
        "cik": cik,
        "entity_name": facts.get("entityName", ""),
        "sic_code": sic,
        "metric_set": "financial_5metric" if is_financial else "standard_4metric",
        "data": _sanitize_floats(company_data),
    }


# ── Phase Engine — Safe-Packet Bridge ──────────────────────────
#
# The kernel runs server-side. The browser receives a labels-and-bands
# packet only — never formulas, weights, thresholds, raw feature rows,
# or accumulator charge terms.
#
# Banks (SIC 6000–6999) currently have no bank-specific adapter. Until
# one exists, financial-sector reports return BANK_ADAPTER_REQUIRED and
# the renderer suppresses terminal narrative.

# Allowed inbound report types — anything else → 400.
_REPORT_TYPES = {
    "validated_financial_distress",  # Routes to validated kernel ONLY when non-financial AND parity reached. Today → partial.
    "partial_phase_snapshot",        # Routes to phase_engine.py (current Python port).
    "bank_safe_summary",             # Bank-aware response, suppressed terminal language.
    "domain_signal",                 # Civilization domain panels — minimal label-only response.
}

# Allowed inbound source surfaces (for telemetry; non-enforcing).
_SOURCE_SURFACES = {
    "civilization", "command_board", "company_portal", "company_lookup",
    "business", "manual", "helix_report_direct", "domain_command",
    "agriculture_command", "communication_command", "culture_command",
    "defense_command", "economy_command", "education_command",
    "energy_command", "environment_command", "finance_command",
    "governance_command", "industry_command", "infrastructure_command",
    "intelligence_command", "law_command", "medicine_command",
    "population_command", "religion_command", "science_command",
    "technology_command", "trade_command", "energy_opportunities",
    "domain_clarity_operator",
}


class HelixReportRequest(BaseModel):
    """Inbound contract. CIK + safe context only.

    Any field not listed here is rejected by Pydantic config below.
    The browser CANNOT submit companyData, feature rows, thresholds,
    or kernel internals through this endpoint.
    """
    cik: str = Field(..., min_length=1, max_length=10, pattern=r"^\d{1,10}$")
    requested_report_type: str = Field(default="partial_phase_snapshot")
    source_surface: Optional[str] = None
    source_opportunity_id: Optional[str] = Field(default=None, max_length=128)
    ticker: Optional[str] = Field(default=None, max_length=10)
    company_name: Optional[str] = Field(default=None, max_length=120)
    domain: Optional[str] = Field(default=None, max_length=40)
    lane: Optional[str] = Field(default=None, max_length=40)
    idempotency_key: Optional[str] = Field(default=None, max_length=80)
    timestamp: Optional[int] = None  # unix seconds; advisory only

    model_config = {"extra": "forbid"}


def _composite_band(c: float) -> str:
    if c is None or (isinstance(c, float) and math.isnan(c)):
        return "unknown"
    if c < 0.5:
        return "low"
    if c < 1.1:
        return "medium"
    return "high"


def _c_t_bucket(c_t: Any) -> Optional[str]:
    """Bucket the accumulator without leaking numeric thresholds."""
    if c_t is None:
        return None
    if isinstance(c_t, float) and math.isnan(c_t):
        return None
    try:
        v = float(c_t)
    except (TypeError, ValueError):
        return None
    if v <= 0:
        return None  # Python kernel currently never computes C(t); represented as not-present.
    if v < 0.3:
        return "low"
    if v < 0.7:
        return "elevated"
    if v < 1.5:
        return "high"
    return "critical"


def _runway_classification(runway: Any, is_financial: bool) -> str:
    """Bank balance sheets do not have an industrial cash runway."""
    if is_financial:
        return "n/a"
    if runway is None:
        return "n/a"
    if isinstance(runway, float) and (math.isnan(runway) or math.isinf(runway)):
        return "n/a"
    try:
        r = float(runway)
    except (TypeError, ValueError):
        return "n/a"
    if r >= 12:
        return "ample"
    if r >= 6:
        return "watch"
    if r >= 2:
        return "tight"
    return "critical"


def _input_presence(company_data: dict) -> dict:
    return {
        "revenue_quarters": len((company_data.get("Revenue") or {})),
        "ocf_quarters": len((company_data.get("OCF") or {})),
        "cash_quarters": len((company_data.get("Cash") or {})),
        "debt_quarters": len((company_data.get("Debt") or {})),
        "deposits_quarters": len((company_data.get("Deposits") or {})),
        "fred_present": False,
    }


# Neutral phase-state labels (no loaded language). Used in the Thing 2
# section's `phase_state_label`. "instability," "terminal," "collapse,"
# "alert" are NOT permitted here.
_PHASE_STATE_LABELS = {
    "p0":  "p0 baseline state",
    "p1":  "p1 rupture state",
    "p2":  "p2 rhythm state",
    "p3":  "p3 elevated-variance state",
    "p4":  "p4 stabilization state",
    "p5":  "p5 endurance state",
    "p6":  "p6 ordered state",
    "p7":  "p7 structural-divergence state",
    "p7a": "p7a structural-divergence state",
    "p7b": "p7b structural-divergence state",
    "p8":  "p8 pivot state",
    "p9":  "p9 threshold state",
    "p10": "p10 post-event state",
}

_DISTRESS_PHASE_SET = {"p3", "p7", "p7a", "p9"}
_STABLE_PHASE_SET = {"p0", "p4", "p5", "p6", "p10"}

# Forbidden phrases — server filters these out of any narrative_safe[] entry
# unless validated_signal.alert === True. The renderer enforces the same list
# as defense in depth.
_FORBIDDEN_PHRASES = [
    "ALERT FIRED",
    "TERMINAL DIVERGENCE",
    "TERMINAL_DIVERGENCE",
    "validated financial distress",
    "Validated decision kernel",
    "M&A advisor",
    "M and A advisor",
    "M & A advisor",
    "Bankruptcy",  # only as referral context; filter strips full sentence containing it
    "Chapter 11",
    "Chapter 7",
    "intervention window closing",
    "terminal path",
    "point of no return",
]


def _filter_forbidden(narrative_safe: list[str], allow_terminal: bool) -> tuple[list[str], int]:
    """Strip any sentence containing a forbidden phrase unless allow_terminal.

    Returns (filtered_list, dropped_count). The count is logged so the audit
    log can show whether the filter ever fired for this request.
    """
    if allow_terminal:
        return list(narrative_safe), 0
    out: list[str] = []
    dropped = 0
    for s in narrative_safe:
        if not isinstance(s, str):
            dropped += 1
            continue
        lower = s.lower()
        hit = False
        for token in _FORBIDDEN_PHRASES:
            if token.lower() in lower:
                hit = True
                break
        if hit:
            dropped += 1
        else:
            out.append(s)
    return out, dropped


def _history_sufficiency(history_quarters: int) -> str:
    """Bucket the history length. Short histories cannot produce high confidence."""
    if history_quarters >= 20:
        return "ample"
    if history_quarters >= 12:
        return "minimum"
    if history_quarters >= 5:
        return "low"
    return "insufficient"


def _confidence_status(history_sufficiency: str, validation_status: str) -> str:
    """Confidence is a function of history sufficiency AND validation status."""
    if validation_status != "validated":
        # Even with ample history, an unvalidated tracker cannot produce high confidence.
        if history_sufficiency in ("ample", "minimum"):
            return "moderate"
        if history_sufficiency == "low":
            return "low"
        return "unsupported"
    # Validated kernel with good history can be high.
    if history_sufficiency == "ample":
        return "high"
    if history_sufficiency == "minimum":
        return "moderate"
    if history_sufficiency == "low":
        return "low"
    return "unsupported"


# ── Section builders ───────────────────────────────────────────

def _build_thing2_section(
    is_financial: bool,
    company_data: dict,
    result: dict,
    rows: list,
    history_quarters: int,
) -> dict:
    """Long-arc recursive phase tracker (Thing 2). Interpretive only.

    Cannot carry alert. Cannot carry validation_status='validated'. Cannot
    use loaded language. The neutral phase_state_label is the only verdict
    text the renderer is permitted to display from this section.
    """
    # No data → not available.
    if not rows or history_quarters < 5:
        return {
            "available": False,
            "kernel_id": THING2_KERNEL_ID,
            "kernel_runtime": THING2_KERNEL_RUNTIME,
            "kernel_version": THING2_KERNEL_VERSION,
            "validation_status": "unsupported",
            "interpretive_only": True,
            "phase_state_label": None,
            "dominant_phase": None,
            "phase_scores": {p: 0.0 for p in ALL_PHASES},
            "state_summary": {
                "C_t_present": False,
                "C_t_bucket": None,
                "H_length_quarters": None,
                "hysteresis_active": None,
                "runway_classification": "n/a",
            },
            "narrative_safe": [
                "Long-arc phase tracker did not run (insufficient history or extraction failure).",
            ],
            "unsupported_reasons": (
                ["fewer than 5 quarters of features"] if history_quarters > 0
                else ["no quarterly features available"]
            ),
        }

    latest = rows[-1]

    # Coupling mode and intrinsic-vs-coupled fields come from run_pipeline.
    # When coupling fired, the OUTPUT dominant_phase / phase_scores are the
    # coupled values; intrinsic is preserved separately for audit. When
    # coupling did not fire (no polyvagal_context supplied or no signal),
    # dominant_phase == intrinsic and we omit the coupled-* keys entirely.
    coupling_mode = result.get("coupling_mode") or "intrinsic_only"
    if coupling_mode == "polyvagal_coupled":
        output_scores = result.get("phase_scores") or {}
        dominant = result.get("dominant_phase") or get_dominant_phase(latest) or "p0"
    else:
        output_scores = {p: latest.get(p, 0.0) for p in ALL_PHASES}
        dominant = get_dominant_phase(latest) or "p0"

    phase_scores = {
        p: round(_sanitize_floats(output_scores.get(p, 0.0)) or 0.0, 4)
        for p in ALL_PHASES
    }
    phase_state_label = _PHASE_STATE_LABELS.get(dominant)

    state_summary = {
        "C_t_present": bool(latest.get("C_t")),
        "C_t_bucket": _c_t_bucket(latest.get("C_t")),
        "H_length_quarters": int(latest.get("H_length") or 0),
        "hysteresis_active": bool(latest.get("hysteresis_alert")) if "hysteresis_alert" in latest else None,
        "runway_classification": _runway_classification(latest.get("runway"), is_financial),
    }

    narrative = [
        "Long-arc phase tracker is interpretive only. It is not a validated distress alert.",
        "Phase posture is descriptive, not diagnostic. Authority for distress assertions belongs to Thing 1.",
    ]
    if is_financial:
        narrative.append(
            "Bank entity: tracker is annotated BANK · INTERPRETIVE; industrial cash-runway and debt heuristics do not apply."
        )
    # Honesty about coupling mode in the renderer-visible narrative.
    if coupling_mode == "polyvagal_coupled":
        narrative.append(
            "Polyvagal coupling active: intrinsic financial phase has been biased "
            "by supporting-cast context (domain, peer cohort, counterparties, "
            "capital structure, labor, regulatory, macro). Both intrinsic and "
            "coupled phase vectors are emitted; coupled is the displayed phase."
        )
    else:
        narrative.append(
            "Polyvagal coupling inactive: phase scored on intrinsic SEC EDGAR "
            "financials only. Supporting-cast context not supplied; output is "
            "single-channel ECG-equivalent, not phase-complete."
        )

    section: dict = {
        "available": True,
        "kernel_id": THING2_KERNEL_ID,
        "kernel_runtime": THING2_KERNEL_RUNTIME,
        "kernel_version": THING2_KERNEL_VERSION,
        "validation_status": "experimental",
        "interpretive_only": True,
        "phase_state_label": phase_state_label,
        "dominant_phase": dominant,
        "phase_scores": phase_scores,
        "state_summary": state_summary,
        "narrative_safe": narrative,
        "unsupported_reasons": [],
        # ── Polyvagal coupling provenance (always emitted) ────────────
        "coupling_mode": coupling_mode,
    }

    # When coupling fired, surface intrinsic + bias contributions for audit.
    if coupling_mode == "polyvagal_coupled":
        intrinsic_scores_raw = result.get("intrinsic_phase_scores") or {}
        coupled_scores_raw = result.get("coupled_phase_scores") or {}
        section["intrinsic_dominant_phase"] = result.get("intrinsic_dominant_phase")
        section["intrinsic_phase_scores"] = {
            p: round(_sanitize_floats(intrinsic_scores_raw.get(p, 0.0)) or 0.0, 4)
            for p in ALL_PHASES
        }
        section["coupled_phase_scores"] = {
            p: round(_sanitize_floats(coupled_scores_raw.get(p, 0.0)) or 0.0, 4)
            for p in ALL_PHASES
        }
        section["bias_contributions"] = result.get("bias_contributions") or {}

    # Provenance of the polyvagal context that fed (or did not feed) Pass 2:
    #   'request_body' — caller-supplied
    #   'server_auto'  — auto-built from command-board peer cohort
    #   'none'         — no context applied (intrinsic_only)
    section["polyvagal_context_source"] = result.get("_polyvagal_context_source") or "none"

    return section


def _build_reconciliation(
    validated_signal: dict,
    phase_tracker_signal: dict,
) -> dict:
    """Server picks reconciliation summary from a fixed template set.

    Renderer cannot freelance. `primacy` is hard-coded "thing1". Thing 2 cannot
    override Thing 1.
    """
    t1_alert = validated_signal.get("alert")
    t1_status = validated_signal.get("validation_status")
    t2_avail = phase_tracker_signal.get("available")
    t2_phase = phase_tracker_signal.get("dominant_phase")

    t1_unavailable = t1_status in (
        "unavailable", "unvalidated_after_modification",
        "bank_adapter_required", "insufficient_data",
    )

    # Eight-case matrix.
    if t1_unavailable:
        if t1_status == "bank_adapter_required":
            return {
                "primacy": "thing1",
                "agree": "indeterminate",
                "summary": (
                    "Validated bank scorer not yet available. "
                    "Long-arc tracker posture is interpretive only and is not a validated distress assessment."
                ),
                "action_authority": "none",
                "language_constraints": _language_constraints(False),
            }
        if t1_status == "insufficient_data":
            return {
                "primacy": "thing1",
                "agree": "indeterminate",
                "summary": (
                    "Insufficient quarterly history for the validated distress scorer. "
                    "Long-arc tracker may be interpretive but has reduced reliability."
                ),
                "action_authority": "none",
                "language_constraints": _language_constraints(False),
            }
        if t1_status == "unvalidated_after_modification":
            return {
                "primacy": "thing1",
                "agree": "indeterminate",
                "summary": (
                    "Validated distress scorer has been modified since validation; refusing to score. "
                    "Long-arc tracker is interpretive only and cannot substitute for validated assessment."
                ),
                "action_authority": "none",
                "language_constraints": _language_constraints(False),
            }
        # Generic unavailable
        return {
            "primacy": "thing1",
            "agree": "indeterminate",
            "summary": (
                "Validated distress scorer unavailable. "
                "Long-arc tracker is interpretive only and cannot substitute for validated assessment."
            ),
            "action_authority": "none",
            "language_constraints": _language_constraints(False),
        }

    # T1 is available (this branch is currently unreachable in Phases 1-3
    # because Thing 1 is stubbed; included for forward compatibility).
    t2_distress = t2_avail and t2_phase in _DISTRESS_PHASE_SET
    t2_stable = t2_avail and t2_phase in _STABLE_PHASE_SET

    if t1_alert is True and t2_distress:
        return {
            "primacy": "thing1", "agree": True,
            "summary": "Validated distress scorer fired alert; long-arc tracker shows distress-side posture. Both signals indicate distress.",
            "action_authority": "thing1",
            "language_constraints": _language_constraints(True),
        }
    if t1_alert is True and not t2_distress:
        return {
            "primacy": "thing1", "agree": False,
            "summary": "Validated distress scorer fired alert; long-arc tracker does not show distress-side posture. Thing 1 has primacy. Investigate the divergence; do not dismiss the validated alert.",
            "action_authority": "thing1",
            "language_constraints": _language_constraints(True),
        }
    if t1_alert is False and t2_distress:
        return {
            "primacy": "thing1", "agree": False,
            "summary": "No validated distress alert. Long-arc tracker shows interpretive distress-side posture; this is unvalidated and does not by itself authorize distress action.",
            "action_authority": "none",
            "language_constraints": _language_constraints(False),
        }
    if t1_alert is False and t2_stable:
        return {
            "primacy": "thing1", "agree": True,
            "summary": "No validated distress alert; long-arc tracker shows stable-side posture. Both signals consistent.",
            "action_authority": "none",
            "language_constraints": _language_constraints(False),
        }
    # Fallback (e.g., t2 unavailable, t1 false)
    return {
        "primacy": "thing1",
        "agree": "indeterminate",
        "summary": "Validated distress scorer ran. Long-arc tracker not available for reconciliation.",
        "action_authority": "thing1" if t1_alert is True else "none",
        "language_constraints": _language_constraints(t1_alert is True),
    }


def _language_constraints(alert_active: bool) -> list[str]:
    """The renderer must enforce these. They are duplicated client-side as
    defense in depth, but the server-side filter on narrative_safe[] is the
    primary gate.
    """
    constraints = [
        "thing2_section_must_label_unvalidated",
        "thing2_section_no_alert_field",
        "validated_brand_only_when_kernel_id_is_limen_backtest_py_and_validation_status_is_validated",
    ]
    if not alert_active:
        constraints.extend([
            "do_not_use_term:ALERT FIRED",
            "do_not_use_term:TERMINAL DIVERGENCE",
            "do_not_use_term:validated financial distress",
            "do_not_use_phrase:M&A advisor",
            "do_not_use_phrase:Bankruptcy referral",
            "do_not_use_phrase:Chapter 11",
            "do_not_use_phrase:intervention window closing",
            "suppress_PHASE_INTERVENTIONS_referral_blocks",
            "suppress_PHASE_CLINICAL_bioAnalog_clinicalSeq_businessSeq_researchFlag",
        ])
    return constraints


def _build_safe_packet(
    cik: str,
    facts: dict,
    sic: int,
    is_financial: bool,
    company_data: dict,
    result: dict,
    rows: list,
    requested_report_type: str,
    request_id: str | None = None,
) -> dict:
    """Sectioned safe packet: validated_signal + phase_tracker_signal + reconciliation + warnings.

    Server-only fields (formulas, constants, raw rows, accumulator math) never
    appear here. The browser only sees labels, bands, counts, and curated
    narrative strings.
    """
    entity_name = facts.get("entityName", "") if facts else ""
    quarters = [r.get("quarter") for r in rows if r.get("quarter")]
    latest_quarter = quarters[-1] if quarters else None
    history_quarters = len(rows)
    cik_padded = str(cik).lstrip("0").zfill(10) if cik else ""
    history_sufficiency = _history_sufficiency(history_quarters)

    # ── Section 1: Thing 1 (validated distress scorer) ─────────
    # Always returns unavailable in Phases 1-3 because real limen_backtest.py
    # is not imported. Bank entities short-circuit to bank_adapter_required.
    validated_signal = thing1_pkg.score_validated(
        cik=cik_padded,
        sec_facts=facts if facts else None,
        fred_delta=None,
        is_financial=is_financial,
    )

    # Insufficient-data flag for Thing 1 too — propagate so the renderer
    # can show the right banner. Bank already handled by thing1_pkg.
    if not is_financial and not facts:
        validated_signal["validation_status"] = "unavailable"
        if "Unable to retrieve filings" not in " ".join(validated_signal.get("narrative_safe") or []):
            validated_signal.setdefault("narrative_safe", []).append(
                "Unable to retrieve SEC filings for this CIK."
            )
            validated_signal.setdefault("unsupported_reasons", []).append(
                "extraction_error: SEC EDGAR fetch failed."
            )

    # ── Section 2: Thing 2 (long-arc recursive phase tracker) ──
    phase_tracker_signal = _build_thing2_section(
        is_financial=is_financial,
        company_data=company_data,
        result=result,
        rows=rows,
        history_quarters=history_quarters,
    )

    # ── Section 3: Reconciliation ──────────────────────────────
    reconciliation = _build_reconciliation(validated_signal, phase_tracker_signal)

    # ── Forbidden-phrase filter ────────────────────────────────
    # Thing 1 narrative is only allowed terminal language when alert is True.
    # Thing 2 narrative is NEVER allowed terminal language.
    alert_active = validated_signal.get("alert") is True
    t1_filtered, t1_dropped = _filter_forbidden(
        validated_signal.get("narrative_safe") or [], allow_terminal=alert_active
    )
    validated_signal["narrative_safe"] = t1_filtered
    t2_filtered, t2_dropped = _filter_forbidden(
        phase_tracker_signal.get("narrative_safe") or [], allow_terminal=False
    )
    phase_tracker_signal["narrative_safe"] = t2_filtered

    # ── Top-level warnings ─────────────────────────────────────
    warnings = []
    if is_financial:
        warnings.append(
            "BANK_ADAPTER_REQUIRED: Regime 2 bank/deposit-funded calibration absent. "
            "Industrial cash-runway and debt heuristics do not apply."
        )
    if requested_report_type == "validated_financial_distress" and validated_signal.get("validation_status") != "validated":
        warnings.append(
            f"requested validated kernel; served validation_status="
            f"{validated_signal.get('validation_status')} (see unsupported_reasons)."
        )

    confidence_status = _confidence_status(
        history_sufficiency=history_sufficiency,
        validation_status=validated_signal.get("validation_status") or "unsupported",
    )

    packet = _sanitize_floats({
        # ── Identity (no scoring claims) ──
        "request_id": request_id,
        "cik": cik_padded,
        "entity_name": entity_name,
        "is_financial": bool(is_financial),
        "sic_code": int(sic),
        "latest_quarter": latest_quarter,
        "history_quarters": history_quarters,
        "history_sufficiency": history_sufficiency,
        "confidence_status": confidence_status,
        "input_presence": _input_presence(company_data) if company_data else _input_presence({}),
        "formula_visibility": "server_only",

        # ── Section 1 ──
        "validated_signal": validated_signal,
        # ── Section 2 ──
        "phase_tracker_signal": phase_tracker_signal,
        # ── Section 3 ──
        "reconciliation": reconciliation,
        # ── Cross-cutting ──
        "warnings": warnings,
        # ── Echoed safe context (telemetry) ──
        "requested_report_type": requested_report_type,
    })
    # Audit-only fields — server-internal, attached to the dict for the
    # log emitter to read. Not part of the wire contract; remove before
    # returning to the client.
    packet["_audit_internal"] = {
        "forbidden_filtered_t1": t1_dropped,
        "forbidden_filtered_t2": t2_dropped,
    }
    return packet


async def _score_safe(cik: str, requested_report_type: str, request_body: dict | None = None) -> dict:
    """Server-side: fetch SEC + SIC, run Thing 1 + Thing 2, return the
    sectioned safe packet. Emits one reconciliation/pattern log entry per call.

    The browser receives the safe packet plus a `request_id` it can use
    for support/debug correlation. The audit log is server-side only.
    """
    request_id = str(uuid.uuid4())
    started = time.time()
    request_body = request_body or {"cik": cik, "requested_report_type": requested_report_type}

    # ── Fetch SEC ──
    facts: dict = {}
    sic: int = 0
    try:
        facts, sic = await asyncio.gather(_fetch_sec_facts(cik), _fetch_sic_code(cik))
    except (HTTPException, Exception):
        # Fall through to the empty-packet path; the audit log will record
        # the extraction error via Thing 1's unsupported_reasons.
        facts = {}
        sic = 0

    is_financial = 6000 <= sic <= 6999

    # ── Run Thing 2 (timed) ──
    # Bank lock: do not feed Liabilities-as-Debt into the phase pipeline.
    #
    # Polyvagal context (Pass 2 input) resolution order:
    #   1. Explicit polyvagal_context (or polyvagalContext) in request_body
    #      — caller-supplied; takes precedence.
    #   2. Auto-populated from server-side data (command-board-data.json
    #      → peer cohort + domain phase proxy). Pass 3 scope. Empty
    #      means coupling stays in intrinsic_only mode.
    # See:
    #   memory: limen_thing2_polyvagal_coupling.md
    #   kernel: api/helix_app/thing2/phase_engine.py
    #            ::_compute_polyvagal_bias  / ::_apply_coupling
    polyvagal_context = None
    polyvagal_source = "none"
    if isinstance(request_body, dict):
        pc = request_body.get("polyvagal_context") or request_body.get("polyvagalContext")
        if isinstance(pc, dict) and pc:
            polyvagal_context = pc
            polyvagal_source = "request_body"

    if polyvagal_context is None:
        try:
            auto_ctx = _build_polyvagal_context_from_server(cik, sic)
            if auto_ctx:
                polyvagal_context = auto_ctx
                polyvagal_source = "server_auto"
        except Exception:
            # Auto-population is best-effort. If it fails, fall back to
            # intrinsic_only — never break the request.
            pass

    company_data: dict = {}
    result: dict = {}
    rows: list = []
    t2_started = time.time()
    # K2 always runs (relaxed 2026-05-29). Neutral intrinsic priors when EDGAR
    # facts are absent; the polyvagal context does the work. is_financial no
    # longer excludes — banks/insurers/REITs have polyvagal state too. Coverage
    # gap was 326 of 767 portals; this aims for every-portal coverage so we
    # don't render "kernel not working" anywhere.
    try:
        company_data = build_company_data(facts, is_financial=is_financial) if facts else {}
        result = run_pipeline(company_data, polyvagal_context=polyvagal_context)
        rows = result.get("rows", [])
    except Exception:
        company_data, result, rows = {}, {}, []
    t2_runtime_ms = int(round((time.time() - t2_started) * 1000))

    # Stamp the polyvagal source onto the result so _build_thing2_section
    # can surface it in the response (where the context came from is part
    # of the audit trail).
    if isinstance(result, dict):
        result["_polyvagal_context_source"] = polyvagal_source

    # ── Build packet (Thing 1 stub runs inside _build_safe_packet,
    #    timing for Thing 1 is bounded by the stub's hash check) ──
    t1_started = time.time()
    packet = _build_safe_packet(
        cik, facts, sic, is_financial, company_data, result, rows,
        requested_report_type, request_id=request_id,
    )
    t1_runtime_ms = int(round((time.time() - t1_started) * 1000)) - t2_runtime_ms
    if t1_runtime_ms < 0:
        t1_runtime_ms = 0

    # ── Build + emit audit log entry ──
    audit_internal = packet.pop("_audit_internal", {}) or {}
    finished = time.time()
    try:
        entry = _build_audit_entry(
            request_id=request_id,
            started_unix=started,
            finished_unix=finished,
            request_body=request_body,
            packet=packet,
            t1_runtime_ms=t1_runtime_ms,
            t2_runtime_ms=t2_runtime_ms,
            forbidden_filtered_t1=int(audit_internal.get("forbidden_filtered_t1", 0)),
            forbidden_filtered_t2=int(audit_internal.get("forbidden_filtered_t2", 0)),
        )
        _emit_audit(entry)
    except Exception:
        # Audit failure must never break the report. Log to stderr only.
        import sys, traceback
        sys.stderr.write("[reconciliation_log] emit failed:\n" + traceback.format_exc())

    return packet


@app.post("/api/helix/helix-report/score")
async def helix_report_score(req: HelixReportRequest):
    """Protected report endpoint. CIK + safe context only.

    The browser CANNOT submit raw companyData, thresholds, weights,
    feature rows, or kernel internals through this endpoint.

    Server-side: fetches SEC EDGAR + SIC, builds companyData, runs the
    server-side kernel, returns the safe-packet (labels and bands only).
    """
    if req.requested_report_type not in _REPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"unknown requested_report_type; allowed: {sorted(_REPORT_TYPES)}",
        )
    if req.source_surface and req.source_surface not in _SOURCE_SURFACES:
        # Telemetry-grade enforcement; fail open for unknown surfaces but flag.
        pass
    request_body = req.model_dump(exclude_none=True)
    return await _score_safe(req.cik, req.requested_report_type, request_body=request_body)


@app.get("/api/helix/score/{cik}")
async def score(cik: str):
    """DEPRECATED — backward-compat wrapper around /api/helix/helix-report/score.

    Returns the safe packet only. Raw rows, feature engineering, accumulator
    charge terms, threshold constants, and engine_meta are no longer exposed.
    Existing callers (helix-report.html, company-portal.html, business.html,
    kernel-comparison.html snapshot regen) should migrate to
    POST /api/helix/helix-report/score with a typed body.
    """
    packet = await _score_safe(cik, "partial_phase_snapshot")
    packet["_deprecated"] = "use POST /api/helix/helix-report/score"
    return packet


# ─── Thing 2 Self-Consistency Regression ──────────────────────
#
# This regression suite drives Thing 2 (api/thing2/phase_engine.py) against a
# small fixture of CIKs and asserts that its dominant-phase output matches
# expectation. It is a SELF-CONSISTENCY check on the long-arc tracker, NOT a
# Thing 1 (validated distress scorer) validation. The "trajectory" strings
# below are Thing 2 internal labels (which include "TERMINAL_DIVERGENCE" as a
# Thing 2 output) — they do NOT represent validated distress alerts.
#
# Thing 1 has its own validation evidence (PR-AUC 0.8143/0.8288) bound to
# api/thing1/VALIDATION_LOCK.json and recorded only when the real
# limen_backtest.py is imported in Phase 4.

REGRESSION_CASES = [
    {"cik": "320193",  "name": "Apple",       "expect": ["p4"],          "reject": [],       "traj": "STABLE"},
    {"cik": "789019",  "name": "Microsoft",   "expect": ["p6"],          "reject": [],       "traj": None},
    {"cik": "12927",   "name": "Boeing",      "expect": ["p7a"],         "reject": [],       "traj": "TERMINAL_DIVERGENCE"},
    {"cik": "1655210", "name": "Beyond Meat", "expect": ["p7a"],         "reject": [],       "traj": "TERMINAL_DIVERGENCE"},
    {"cik": "719739",  "name": "SVB",         "expect": ["p7a"],         "reject": [],       "traj": "TERMINAL_DIVERGENCE"},
    {"cik": "19617",   "name": "JPMorgan",    "expect": ["p6"],          "reject": [],       "traj": None},
    {"cik": "1645590", "name": "HPE",         "expect": ["p7b", "p6"],   "reject": ["p7a"],  "traj": None},
    {"cik": "1368148", "name": "Athersys",    "expect": ["p7a", "p9"],   "reject": ["p0"],   "traj": None},
    {"cik": "1018724", "name": "Amazon",     "expect": ["p4", "p5"],    "reject": ["p3"],   "traj": None},
]


async def _score_one(cik: str) -> dict:
    """Score a single CIK through Thing 2. Internal regression use only."""
    try:
        facts, sic = await asyncio.gather(_fetch_sec_facts(cik), _fetch_sic_code(cik))
        is_financial = 6000 <= sic <= 6999
        company_data = build_company_data(facts, is_financial=is_financial)
        result = run_pipeline(company_data)
        rows = result.get("rows", [])
        latest = rows[-1] if rows else {}
        dominant = get_dominant_phase(latest) or "p0"
        return {
            "dominant_phase": dominant,
            "trajectory": result.get("trajectory", "STABLE"),
            "composite": round(result.get("composite", 0.0), 4),
            "entity_name": facts.get("entityName", ""),
        }
    except Exception as e:
        return {"dominant_phase": "ERROR", "trajectory": "ERROR", "composite": 0, "entity_name": str(e)}


@app.get("/api/helix/regression")
async def regression():
    """Thing 2 self-consistency regression. NOT a Thing 1 validation."""
    tasks = [_score_one(case["cik"]) for case in REGRESSION_CASES]
    results = await asyncio.gather(*tasks)

    cases = []
    all_pass = True
    for case, res in zip(REGRESSION_CASES, results):
        actual_phase = res["dominant_phase"]
        actual_traj = res["trajectory"]

        phase_ok = actual_phase in case["expect"] if case["expect"] else True
        reject_ok = actual_phase not in case["reject"] if case["reject"] else True
        traj_ok = actual_traj == case["traj"] if case["traj"] else True
        passed = phase_ok and reject_ok and traj_ok

        if not passed:
            all_pass = False

        entry = {
            "cik": case["cik"],
            "name": case["name"],
            "pass": passed,
            "actual_phase": actual_phase,
            "actual_trajectory": actual_traj,
            "expected_phases": case["expect"],
            "rejected_phases": case["reject"],
        }
        if case["traj"]:
            entry["expected_trajectory"] = case["traj"]
        if not passed:
            reasons = []
            if not phase_ok:
                reasons.append(f"phase {actual_phase} not in {case['expect']}")
            if not reject_ok:
                reasons.append(f"phase {actual_phase} is rejected")
            if not traj_ok:
                reasons.append(f"trajectory {actual_traj} != {case['traj']}")
            entry["failure_reasons"] = reasons
        cases.append(entry)

    passed_count = sum(1 for c in cases if c["pass"])
    return {
        "all_pass": all_pass,
        "passed": passed_count,
        "total": len(cases),
        "cases": cases,
    }
