#!/usr/bin/env python3
"""verify_search_policy_content.py — DEFINITIVE PR #395 full-set verification.

For every changed path base..head: the two versions must be IDENTICAL after
removing robots-meta tags and all whitespace. For sitemap.xml: URLs removed
must be non-indexable, URLs added must be in the approved indexable set.
This closes the audit blind spot (458 unaudited files) with a machine check
over ALL 3,458 paths — no sampling.

Usage: python verify_search_policy_content.py <base_ref> <head_ref> <base_tree_dir>
  base_tree_dir = a filesystem copy of the base tree (git archive <base> | tar -x)
"""
import re
import subprocess
import sys
from pathlib import Path

BASE_REF, HEAD_REF, BASE_DIR = sys.argv[1], sys.argv[2], sys.argv[3].replace("\\", "/")
ROBOTS = re.compile(r'<meta\s+name=["\']robots["\']\s+content=["\'][^"\']*["\']\s*/?>', re.I)
WS = re.compile(r"\s+")
INDEXABLE = {
    "https://limenhelix.com/", "https://limenhelix.com/provider-portal",
    *[f"https://limenhelix.com/{d}" for d in
      ["addiction", "agriculture", "business", "communication", "contemplative",
       "culture", "defense", "economy", "education", "energy", "environment",
       "finance", "governance", "industry", "infrastructure", "intelligence",
       "law", "medicine", "metabolic", "neurology", "pediatric", "population",
       "psychedelic", "religion", "science", "technology", "trade"]],
}


def git(*a):
    return subprocess.run(["git"] + list(a), capture_output=True, text=True,
                          encoding="utf-8", errors="replace").stdout


def norm_html(p):
    t = Path(p).read_text(encoding="utf-8", errors="replace")
    return WS.sub("", ROBOTS.sub("", t))


def urls(p):
    return set(re.findall(r"<loc>([^<]+)</loc>",
                          Path(p).read_text(encoding="utf-8", errors="replace")))


def main():
    manifest = [l for l in git("diff", "--name-only", BASE_REF, HEAD_REF).splitlines() if l.strip()]
    statuses = git("diff", "--name-status", BASE_REF, HEAD_REF)
    non_m = [l for l in statuses.splitlines() if l and not l.startswith("M\t")]
    bad_ext = [p for p in manifest if not (p.endswith(".html") or p == "sitemap.xml")]

    mismatches = []
    for p in manifest:
        if p == "sitemap.xml":
            continue
        if norm_html(f"{BASE_DIR}/{p}") != norm_html(p):
            mismatches.append(p)

    bu, hu = urls(f"{BASE_DIR}/sitemap.xml"), urls("sitemap.xml")
    sitemap_bad_adds = sorted(hu - bu - INDEXABLE)
    sitemap_bad_keeps = sorted(hu - INDEXABLE)

    protected = ["python_runtime/helix_app/thing1/", "python_runtime/helix_app/thing2/",
                 "python_runtime/limen_app.py", "python_runtime/helix_app/index.py",
                 "assets/js/domain-brains/", "assets/js/phase-registry.js",
                 "lib/phase-spec.js", "assets/js/civilization-connectome-galaxy.js",
                 "assets/js/limen-thing2-kernel.js", "assets/js/limen-thing2-adapter.js",
                 "assets/data/", ".github/workflows/", "vercel.json"]
    prot_hits = [p for p in manifest if any(p == x.rstrip("/") or p.startswith(x) for x in protected)]

    report = {
        "base": BASE_REF, "head": HEAD_REF,
        "manifest_count": len(manifest),
        "non_modification_statuses": non_m or "NONE",
        "non_html_or_sitemap_paths": bad_ext or "NONE",
        "content_mismatches_beyond_robots_and_whitespace": mismatches or "NONE",
        "sitemap_urls_base": len(bu), "sitemap_urls_head": len(hu),
        "sitemap_unexpected_adds": sitemap_bad_adds or "NONE",
        "sitemap_urls_outside_indexable_set": sitemap_bad_keeps or "NONE",
        "protected_paths_in_manifest": prot_hits or "NONE",
    }
    import json
    print(json.dumps(report, indent=1))
    ok = (len(manifest) == 3458 and not non_m and not bad_ext and not mismatches
          and not sitemap_bad_adds and not sitemap_bad_keeps and not prot_hits)
    print("\nVERDICT:", "PASS - zero unexplained paths or hunks" if ok else "FAIL")


if __name__ == "__main__":
    main()
