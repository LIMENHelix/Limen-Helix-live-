"""Single Vercel Python entry point for the LIMEN runtime.

Only files directly under ``api/`` are deployment functions.  The application
modules live in ``python_runtime/`` so Vercel does not mistake every kernel
module for a separate function and duplicate the scientific dependency layer.
The public routes keep their existing URLs through rewrites in vercel.json.
"""

import json
import os
import sys

import httpx
from starlette.responses import JSONResponse


_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_RUNTIME = os.path.join(_ROOT, "python_runtime")
_HELIX = os.path.join(_RUNTIME, "helix_app")

sys.path.insert(0, _ROOT)
sys.path.insert(0, _RUNTIME)
sys.path.insert(0, _HELIX)

from python_runtime.helix_app.index import app  # noqa: E402
from python_runtime.ddgs_app import app as ddgs_app  # noqa: E402
from python_runtime.limen_app import app as limen_app  # noqa: E402
from python_runtime.control_gate import authorize, route_class  # noqa: E402


# Merge the route tables into one ASGI application and therefore one dependency
# bundle.  The main Helix app already owns the shared CORS middleware.
app.include_router(limen_app.router)
app.include_router(ddgs_app.router)


_GLOBAL_CONTROL_KEY = "limen:civilization_valve:global:emergency"


async def _global_control_record():
    """Read the same durable global control record used by the JS boundary."""

    url = os.environ.get("UPSTASH_REDIS_REST_URL", "")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
    if not url or not token:
        raise RuntimeError("redis-not-configured")
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=["GET", _GLOBAL_CONTROL_KEY],
        )
    response.raise_for_status()
    body = response.json()
    if body.get("error"):
        raise RuntimeError("redis-command-error")
    raw = body.get("result")
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise RuntimeError("redis-control-record-not-string")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise RuntimeError("redis-control-record-not-object")
    return parsed


@app.middleware("http")
async def staged_global_control(request, call_next):
    """Fail closed outside diagnostics when the staged global control is unreadable."""

    path = request.url.path
    method = request.method
    if route_class(path, method) == "diagnostic":
        response = await call_next(request)
        response.headers["X-Limen-Control-Class"] = "diagnostic"
        return response
    record = None
    available = True
    try:
        record = await _global_control_record()
    except Exception:
        available = False
    decision = authorize(path, method, record, control_available=available)
    if not decision.allowed:
        return JSONResponse(
            status_code=503,
            content={
                "ok": False,
                "error": decision.reason,
                "nukeStage": decision.stage,
                "routeClass": decision.route_class,
                "runtime": "python",
            },
            headers={"Cache-Control": "no-store"},
        )
    response = await call_next(request)
    response.headers["X-Limen-Control-Class"] = decision.route_class
    if decision.stage:
        response.headers["X-Limen-Nuke-Stage"] = decision.stage
    return response
