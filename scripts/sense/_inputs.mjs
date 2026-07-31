// scripts/sense/_inputs.mjs — declared inputs for sense organs.
//
// THE BUG THIS EXISTS TO KILL, stated once:
//
//   A probe reads a path inside a try/catch, the read fails, and the failure is recorded as a
//   fact about the SYSTEM rather than a fact about the ENVIRONMENT.
//
// Three confirmed instances in two days, all in this directory or the code it audits:
//
//   lib/limen-stress-propagator.js   brain-connectome.json absent from the CI sparse checkout
//                                    -> inhibitoryEdgesLoaded: 0 -> read as "the system has no
//                                       regulation". It had six inhibitory edges the whole time.
//   organ-dead-links.mjs:121         company-portal-ui.js absent from the checkout
//                                    -> fallbackPresent = false -> finding escalated to HIGH.
//   organ-propagator.mjs             a hardcoded "NO downstream consumers" string, re-emitted at
//                                       MED for two months after the wiring existed.
//
// The shape is always the same: `catch (e) { x = <empty> }`, and downstream code cannot tell
// "read fine, genuinely empty" from "could not read". An empty corpus looks like a dead corpus.
//
// HOW TO USE, and the second half matters more than the first:
//
//   import { inputs } from './_inputs.mjs';
//   const io = inputs();
//   const lib = io.json(PATTERNS_PATH, 'bridge-patterns.json');
//   const files = io.dir(DIR, 'assets/data/companies/', f => f.endsWith('.json'));
//
//   1. Every accessor returns null on failure — NOT [] and NOT {} — so "missing" is distinguishable
//      from "empty" at the call site, which is the whole point.
//   2. GUARD THE FINDINGS. If an input is null, do not emit the findings that depend on it.
//      Reporting the miss while still emitting a false finding computed from nothing is worse
//      than either alone, because the false finding carries a severity and the miss does not.
//   3. Push io.attention(id) into the attention array. It is null when nothing is missing.
//
// A read that legitimately skips one item inside a loop (a single unparseable portal among 800)
// is NOT this bug and should stay a plain try/catch. This is only for inputs a finding rests on.
import fs from 'node:fs';

export function inputs() {
  const missing = [];

  function note(label, e) {
    missing.push(label + (e && e.code ? ' (' + e.code + ')' : ''));
    return null;
  }

  return {
    missing,

    /** Parsed JSON, or null if unreadable/unparseable. */
    json(p, label) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return note(label || p, e); }
    },

    /** File contents as a string, or null. */
    text(p, label) {
      try { return fs.readFileSync(p, 'utf8'); } catch (e) { return note(label || p, e); }
    },

    /** Directory listing (optionally filtered), or null. Never [] on failure. */
    dir(p, label, filter) {
      try { const f = fs.readdirSync(p); return typeof filter === 'function' ? f.filter(filter) : f; }
      catch (e) { return note(label || p, e); }
    },

    /**
     * Existence of a file that a finding depends on. Returns true/false, and records the path as
     * missing ONLY when the containing directory is itself unreadable — because "the directory is
     * not checked out" and "the file was never created" are different facts and only the second
     * is about the system.
     */
    probe(p, label, dirPath) {
      if (dirPath) { try { fs.readdirSync(dirPath); } catch (e) { note(label || p, e); return null; } }
      return fs.existsSync(p);
    },

    /**
     * The attention item, or null when every input read. Deliberately LOW: an unreadable input is
     * a gap in the audit, not a defect in the system, and must never outrank a real finding.
     */
    attention(organId) {
      if (!missing.length) return null;
      return {
        issue: 'Organ could not read required input(s) — findings below are incomplete',
        severity: 'low',
        count: missing.length,
        action: 'INPUT MISSING, not a system finding: ' + missing.join(', ') +
                '. Usually the sparse checkout in .github/workflows/immune-system.yml. ' +
                'Findings that depend on these inputs were suppressed, not guessed.',
        organ: organId
      };
    }
  };
}
