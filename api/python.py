"""Single Vercel Python entry point for the LIMEN runtime.

Only files directly under ``api/`` are deployment functions.  The application
modules live in ``python_runtime/`` so Vercel does not mistake every kernel
module for a separate function and duplicate the scientific dependency layer.
The public routes keep their existing URLs through rewrites in vercel.json.
"""

import os
import sys


_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_RUNTIME = os.path.join(_ROOT, "python_runtime")
_HELIX = os.path.join(_RUNTIME, "helix_app")

sys.path.insert(0, _RUNTIME)
sys.path.insert(0, _HELIX)

from index import app  # noqa: E402
from ddgs_app import app as ddgs_app  # noqa: E402
from limen_app import app as limen_app  # noqa: E402


# Merge the route tables into one ASGI application and therefore one dependency
# bundle.  The main Helix app already owns the shared CORS middleware.
app.include_router(limen_app.router)
app.include_router(ddgs_app.router)
