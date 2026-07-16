"""
DDGS search proxy - the production transport for the free ddg-search
enrichment backend (lib/lead-enrichment.js).

WHY THIS EXISTS: DuckDuckGo (and most engines) block plain serverless
fetches by TLS fingerprint - verified live: Node fetch gets the captcha
page. The `ddgs` library rides `primp`, which impersonates a real
browser's TLS handshake and rotates across engines (DDG, Bing, Brave,
Mojeek, ...). Running it as a Python function inside THIS deployment
gives the Node enrichment code a same-origin search transport with zero
external infrastructure.

Routes (rewrite /api/ddgs-search/(.*) -> /api/ddgs-search in vercel.json,
same pattern as /api/limen):
  GET /api/ddgs-search/health            liveness, no key needed
  GET /api/ddgs-search/search/text       ?query=...&max_results=8
  GET /api/ddgs-search/extract           ?url=... (text extraction, beats 403 bot-walls)

NEVER AN OPEN PROXY: search/extract require x-ddgs-key header (or ?key=)
matching DDGS_PROXY_KEY, LEAD_ADMIN_KEY, or SALES_ADMIN_KEY. If none of
those envs exist the routes return 503 (fail closed).

Honest caveat: engines may also block by datacenter IP reputation, which
TLS impersonation cannot fix. If searches consistently 502 from Vercel,
the fallback is hosting the same ddgs server on a non-datacenter IP and
pointing DDGS_API_URL at it.
"""

import os

# Vercel's filesystem is read-only outside /tmp; ddgs deps (fake-useragent
# et al.) may try to touch cache dirs under HOME. Same guard as api/limen.py.
os.environ.setdefault("HOME", "/tmp")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp")

from fastapi import FastAPI, HTTPException, Request  # noqa: E402

app = FastAPI(title="LIMEN DDGS proxy")


def _check_key(request: Request, key_qs: str) -> None:
    allowed = [
        k for k in (
            os.environ.get("DDGS_PROXY_KEY"),
            os.environ.get("LEAD_ADMIN_KEY"),
            os.environ.get("SALES_ADMIN_KEY"),
        ) if k
    ]
    if not allowed:
        raise HTTPException(status_code=503, detail="proxy key not configured (fail closed)")
    supplied = request.headers.get("x-ddgs-key") or key_qs or ""
    if supplied not in allowed:
        raise HTTPException(status_code=401, detail="bad key")


@app.get("/api/ddgs-search/health")
def health() -> dict:
    return {"ok": True, "service": "ddgs-proxy"}


@app.get("/api/ddgs-search/search/text")
def search_text(request: Request, query: str, max_results: int = 8, key: str = "") -> dict:
    _check_key(request, key)
    from ddgs import DDGS  # lazy: keep cold start cheap for health checks
    try:
        results = DDGS(timeout=10).text(query=query, max_results=min(max_results, 10))
        return {"results": results}
    except Exception as e:  # engine block / timeout -> caller falls back
        raise HTTPException(status_code=502, detail=f"search failed: {e}")


@app.get("/api/ddgs-search/extract")
def extract(request: Request, url: str, key: str = "") -> dict:
    _check_key(request, key)
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="http(s) urls only")
    from ddgs import DDGS
    try:
        return DDGS(timeout=10).extract(url=url, fmt="text_plain")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"extract failed: {e}")
