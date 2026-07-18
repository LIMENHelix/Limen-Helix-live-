/**
 * lib/memory-tiers.js — the five-tier memory model + evidence-gated promotion / explicit expiry.
 *
 * The Phase-0 audit found memory is flat capped ring buffers with no tiering. This formalizes the model
 * over the stores that already exist and adds the ONE missing tier — SEMANTIC (stabilized patterns) — with
 * a promotion rule that requires evidence + provenance, and expiry/pruning that is EXPLICIT (never silent).
 *
 *   working    → live snapshot / current cycle (transient; console_snapshot, not managed here)
 *   episodic   → time-stamped observations+outcomes: feedhist:<d> / forecasthist:<d> (RECORDER/RESOLVER)
 *   semantic   → stabilized cross-run patterns: semantic:<d>  ← THIS FILE promotes into it
 *   procedural → learned parameter state: brainwts:<d> (weights)
 *   audit      → immutable provenance: audit:<stream> (lib/audit-ledger)
 *
 * HONESTY: a promoted pattern is 'stabilized' (recurred across N consolidation runs), NEVER 'validated'
 * (that word is reserved for Thing1). It is observational and reversible. Pure: no Date/Redis; `now` supplied.
 */

var TIER_MAP = {
  working: { store: 'console_snapshot', durable: false, note: 'current cycle / recent state (transient cache)' },
  episodic: { store: 'feedhist:<domain> + forecasthist:<domain>', durable: true, note: 'recorded observations + forecasts + resolved outcomes' },
  semantic: { store: 'semantic:<domain>', durable: true, note: 'stabilized patterns promoted from episodic evidence (this file)' },
  procedural: { store: 'brainwts:<domain>', durable: true, note: 'learned K-layer weights + modulator' },
  audit: { store: 'audit:<stream>', durable: true, note: 'immutable hash-chained provenance' }
};

function r4(x) { return Math.round(x * 10000) / 10000; }

// Tally how often each consolidation recommendation KIND recurred across a domain's proposal history.
// proposals: consolidation:hist:<domain> (newest-first; each has generatedAt, recommendations[{kind,reason}]).
function tallyCandidates(proposals) {
  var byKind = {};
  (proposals || []).forEach(function (p) {
    if (!p || !Array.isArray(p.recommendations)) return;
    var gen = (typeof p.generatedAt === 'number') ? p.generatedAt : null;
    p.recommendations.forEach(function (rec) {
      if (!rec || !rec.kind || rec.kind === 'none') return;
      var c = byKind[rec.kind] || { kind: rec.kind, runs: 0, firstSeen: gen, lastSeen: gen, latestReason: rec.reason || null };
      c.runs++;
      if (gen !== null) { if (c.firstSeen === null || gen < c.firstSeen) c.firstSeen = gen; if (c.lastSeen === null || gen > c.lastSeen) c.lastSeen = gen; }
      c.latestReason = c.latestReason || rec.reason || null;
      byKind[rec.kind] = c;
    });
  });
  return Object.keys(byKind).map(function (k) { return byKind[k]; });
}

// Promote candidates that recurred >= minRuns into stabilized semantic records (merged with existing).
// Returns { semantic, promoted, held }. Every record carries provenance + reversible:true; status 'stabilized'.
function promote(domain, candidates, existingSemantic, opts) {
  opts = opts || {};
  var minRuns = opts.minRuns || 3;
  var existing = {};
  (existingSemantic || []).forEach(function (r) { if (r && r.pattern) existing[r.pattern] = r; });
  var promoted = [], held = [];
  (candidates || []).forEach(function (c) {
    if (c.runs < minRuns) { held.push({ pattern: c.kind, reason: 'only ' + c.runs + ' run(s) (< ' + minRuns + ')' }); return; }
    var prior = existing[c.kind];
    existing[c.kind] = {
      pattern: c.kind, status: 'stabilized', domain: domain,
      runs: c.runs, firstSeen: (prior && prior.firstSeen != null) ? Math.min(prior.firstSeen, c.firstSeen) : c.firstSeen,
      lastSeen: c.lastSeen, latestReason: c.latestReason,
      provenance: { tier: 'semantic', promotedFrom: 'consolidation:hist', evidenceRuns: c.runs },
      reversible: true, validated: false   // NEVER validated — observational stabilization only
    };
    promoted.push(c.kind);
  });
  return { semantic: Object.keys(existing).map(function (k) { return existing[k]; }), promoted: promoted, held: held };
}

// EXPLICIT expiry: a stabilized record decays out if not re-observed within ttlMs. Returns { kept, pruned }.
function pruneExpired(semantic, now, opts) {
  opts = opts || {};
  var ttlMs = opts.ttlMs || 30 * 24 * 3600 * 1000;   // 30 days without recurrence ⇒ expire
  var kept = [], pruned = [];
  (semantic || []).forEach(function (r) {
    if (r && typeof r.lastSeen === 'number' && typeof now === 'number' && (now - r.lastSeen) > ttlMs) {
      pruned.push({ pattern: r.pattern, reason: 'no recurrence in ' + Math.round((now - r.lastSeen) / 86400000) + 'd (> ttl)' });
    } else kept.push(r);
  });
  return { kept: kept, pruned: pruned };
}

module.exports = { TIER_MAP: TIER_MAP, tallyCandidates: tallyCandidates, promote: promote, pruneExpired: pruneExpired };
