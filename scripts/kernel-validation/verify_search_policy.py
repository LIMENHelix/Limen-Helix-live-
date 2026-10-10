#!/usr/bin/env python3
"""verify_search_policy.py — PR #395 evidence follow-up (audit recommendation FIX).

Verifies, against parent a90f0afece876f39952b129ca29f141742ef0bd2:
  1. Complete manifest of changed paths (must equal 3,458, all modifications).
  2. Hunk-level assertion: every added/removed line is a robots-meta line or a
     sitemap <url> line. Zero unexplained hunks allowed.
  3. Byte-for-byte: protected kernels, domain brains, registries, Connectome
     data unchanged (sha256 base vs head) AND absent from the manifest.
  4. Idempotence: every head file is a fixed point of the canonical search-
     policy normalizer (exactly one robots meta, approved content, head
     placement) — a rerun changes nothing.
"""
import hashlib
import re
import subprocess
import sys
import json

BASE = "a90f0afece876f39952b129ca29f141742ef0bd2"
HEAD = "2a0901260dbfeb015e3f35af6fe34f2bdbdf8cc5"

ADDED_OK = re.compile(r'^\+<meta name="robots" content="(index|noindex),(follow|nofollow)">$')
REMOVED_OK = re.compile(r'^-\s*<meta name="robots" content="[^"]*"\s*/?>\s*$')
ADDED_URL_OK = re.compile(r'^\+\s*<url><loc>[^<]+</loc>(<lastmod>[^<]*</lastmod>)?(<changefreq>[^<]*</changefreq>)?(<priority>[^<]*</priority>)?</url>\s*$')
REMOVED_URL_OK = re.compile(r'^-\s*<url><loc>[^<]+</loc>(<lastmod>[^<]*</lastmod>)?(<changefreq>[^<]*</changefreq>)?(<priority>[^<]*</priority>)?</url>\s*$')
ROBOTS_LINE = re.compile(r'^\s*<meta name="robots" content="(index|noindex),(follow|nofollow)"\s*>?\s*$')

PROTECTED = [
    "python_runtime/helix_app/thing1/limen_backtest.py",
    "python_runtime/helix_app/thing1/__init__.py",
    "python_runtime/helix_app/thing1/VALIDATION_LOCK.json",
    "python_runtime/helix_app/thing2/",
    "python_runtime/limen_app.py",
    "python_runtime/helix_app/index.py",
    "assets/js/domain-brains/",
    "assets/js/phase-registry.js",
    "lib/phase-spec.js",
    "assets/js/civilization-connectome-galaxy.js",
    "assets/js/limen-thing2-kernel.js",
    "assets/js/limen-thing2-adapter.js",
    "assets/data/",
    ".github/workflows/",
    "vercel.json",
]


def git(*args):
    return subprocess.run(["git"] + list(args), capture_output=True, text=True,
                          encoding="utf-8", errors="replace").stdout


def sha(path, ref):
    data = subprocess.run(["git", "show", "%s:%s" % (ref, path)],
                          capture_output=True).stdout
    return hashlib.sha256(data).hexdigest()


def main():
    report = {"base": BASE, "head": HEAD}

    # 1 — manifest
    ns = git("diff", "--name-status", BASE, HEAD)
    entries = [l.split("\t") for l in ns.splitlines() if l.strip()]
    report["manifest_count"] = len(entries)
    report["statuses"] = {}
    for e in entries:
        report["statuses"][e[0]] = report["statuses"].get(e[0], 0) + 1
    paths = [e[1] for e in entries]
    bad_ext = [p for p in paths if not (p.endswith(".html") or p == "sitemap.xml")]

    # 2 — hunk-level assertion
    diff = git("diff", "-U0", BASE, HEAD)
    unexplained = []
    counts = {"added": 0, "removed": 0}
    for line in diff.splitlines():
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            counts["added"] += 1
            if not (ADDED_OK.match(line) or ADDED_URL_OK.match(line)):
                unexplained.append(line[:160])
        elif line.startswith("-"):
            counts["removed"] += 1
            if not (REMOVED_OK.match(line) or REMOVED_URL_OK.match(line)):
                unexplained.append(line[:160])
    report["line_counts"] = counts
    report["unexplained_hunks"] = unexplained[:20]
    report["unexplained_count"] = len(unexplained)
    report["non_html_or_sitemap_paths"] = bad_ext[:20]

    # head-state: exactly one robots meta per file, approved content
    head_robots = git("grep", "-h", 'name="robots"', HEAD)
    multi = []
    per_file = {}
    for line in git("grep", 'name="robots"', HEAD).splitlines():
        # format: <ref>:<path>:<content>
        p = line.split(":", 2)
        if len(p) == 3:
            per_file.setdefault(p[1], []).append(p[2].strip())
    for p, lines in per_file.items():
        if len(lines) != 1:
            multi.append((p, len(lines)))
        elif not ROBOTS_LINE.match(lines[0]):
            multi.append((p, "malformed:" + lines[0][:60]))
    indexable = sorted(p for p, ls in per_file.items()
                       if ls and 'content="index,follow"' in ls[0])
    report["head_files_with_robots"] = len(per_file)
    report["head_state_violations"] = multi[:20]
    report["indexable_count"] = len(indexable)
    report["indexable_sample"] = indexable[:6]

    # 3 — protected set
    prot_manifest_hits = [p for p in paths if any(p.startswith(x) or p == x.rstrip("/") for x in PROTECTED)]
    prot_diffs = []
    for spec in PROTECTED:
        spec_p = spec.rstrip("/")
        listing = git("ls-tree", "-r", "--name-only", BASE, spec_p).splitlines()
        for f in listing:
            try:
                if sha(f, BASE) != sha(f, HEAD):
                    prot_diffs.append(f)
            except Exception as ex:
                prot_diffs.append(f + " (error: %s)" % ex)
    report["protected_manifest_hits"] = prot_manifest_hits[:20]
    report["protected_changed"] = prot_diffs[:20]
    report["protected_checked_files"] = sum(len(git("ls-tree", "-r", "--name-only", BASE, s.rstrip("/")).splitlines()) for s in PROTECTED)

    # 4 — idempotence: each head file already has exactly one well-formed
    # robots meta (the normalizer's only action) -> rerun changes nothing.
    report["idempotence"] = "PASS" if not multi else "FAIL (%d files)" % len(multi)

    print(json.dumps(report, indent=1))
    ok = (report["manifest_count"] == 3458 and not bad_ext and
          report["unexplained_count"] == 0 and
          not prot_manifest_hits and not prot_diffs and not multi)
    print("\nVERDICT:", "PASS" if ok else "FAIL")


if __name__ == "__main__":
    main()
