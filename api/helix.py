import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "helix_app"))
from index import app  # noqa: F401, E402
