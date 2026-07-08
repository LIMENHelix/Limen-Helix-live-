/**
 * lib/tech.js — TECHNOLOGY domain P3 core (instance #4). Turns tech layoff / shutdown events into
 * ranked distress deals. Signal = layoffs.fyi (national, single-source, free-with-attribution) — a
 * company shedding a large share of staff, or winding down, is a node stuck at a failed transition.
 *
 * Honest register: this is a LAGGING public signal (the layoff already happened). Market as "find +
 * connect FAST", NEVER "predict" — Technology has no validated kernel (see kernel-family-and-claim-
 * boundary / p3-horizon-ladder: rank 1-3 only, no foresight claim).
 *
 * Business model: sell the early-distress FEED (data, not brokerage) to the paying side in
 * lib/tech-buyers.js — distressed-software rollups, IP/asset buyers, wind-down advisors. Match by
 * severity (a full shutdown routes to asset/IP buyers; a partial layoff routes to talent/acqui-hire).
 *
 * Shared by scripts/tech-fetch.js (ingest) and handlers/technology-distress.js (read).
 */
'use strict';
// distress signal types, ordered by severity. Classified from % of staff cut + wind-down status.
var SIGNALS = [
  { key: 'shutdown', label: 'Shutdown / wind-down (100%)', sev: 100 },
  { key: 'mass',     label: 'Mass layoff (>=30% of staff)', sev: 74 },
  { key: 'major',    label: 'Major layoff (>=15% of staff)', sev: 56 },
  { key: 'layoff',   label: 'Layoff event', sev: 40 }
];
var SIG = {}; SIGNALS.forEach(function (s) { SIG[s.key] = s; });

function num(v) {
  if (v == null) return null;
  if (Array.isArray(v)) v = v[0];
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}
function str(v) { if (v == null) return ''; if (Array.isArray(v)) v = v.map(function (x) { return (x && x.name) || x; }).join(', '); if (v && v.name) v = v.name; return String(v).trim(); }
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// obj = { <columnName>: cellValue } for one layoffs.fyi row. Fuzzy-matched so a column rename
// upstream degrades gracefully instead of silently dropping the field.
function fromRow(obj) {
  var keys = Object.keys(obj || {});
  function pick(re) { for (var i = 0; i < keys.length; i++) if (re.test(keys[i])) return obj[keys[i]]; return null; }
  var company = str(pick(/^company\b/i)) || str(pick(/company/i));
  var pct = num(pick(/%|percent/i));
  // "# Laid Off" count — exclude the percent column
  var count = null;
  keys.forEach(function (k) { if (/laid.?off/i.test(k) && !/%|percent/i.test(k) && count == null) count = num(obj[k]); });
  var d = {
    source: 'layoffs.fyi',
    company: company,
    count: count,
    pct: pct,
    date: str(pick(/^date\b(?!.*added)/i)) || str(pick(/^date/i)),
    industry: str(pick(/industry/i)),
    stage: str(pick(/stage/i)),
    raised: num(pick(/raised/i)),
    country: str(pick(/country/i)),
    location: str(pick(/location|head.?quarter|hq|city/i)),
    url: str(pick(/source|link|url/i)) || 'https://layoffs.fyi'
  };
  d.signalType = classify(d);
  d.signalLabel = (SIG[d.signalType] || {}).label || d.signalType;
  d.key = (slug(company) + '|' + slug(d.date) + '|' + d.signalType).replace(/\|+$/, '');
  return d;
}

function classify(d) {
  var stage = (d.stage || '').toLowerCase();
  if (d.pct != null && d.pct >= 100) return 'shutdown';
  if (/wound down|shut|closed|acquired.*wind|ceased/.test(stage)) return 'shutdown';
  if (d.pct != null && d.pct >= 30) return 'mass';
  if (d.pct != null && d.pct >= 15) return 'major';
  return 'layoff';
}

function daysSince(ymd) { if (!ymd) return null; var t = Date.parse(ymd); return isNaN(t) ? null : Math.round((Date.now() - t) / 86400000); }

function scoreTech(d) {
  var reasons = [], sig = SIG[d.signalType] || {}, score = sig.sev || 30;
  reasons.push((sig.label || d.signalType || '').toUpperCase());
  // large absolute headcount = more IP / more talent / bigger asset base to route to a buyer
  if (d.count != null && d.count >= 500) { score += 8; reasons.push('SCALE-500+'); }
  else if (d.count != null && d.count >= 150) { score += 4; reasons.push('SCALE-150+'); }
  // well-funded startups have real IP + cap-table assets even in distress
  if (d.raised != null && d.raised >= 100) { score += 6; reasons.push('WELL-FUNDED'); }
  var ds = daysSince(d.date);
  if (ds != null && ds <= 30) { score += 8; reasons.push('FRESH-30D'); }
  else if (ds != null && ds > 180) { reasons.push('older'); }
  var tier, label;
  if (score >= 90) { tier = 1; label = 'CRITICAL'; }
  else if (score >= 64) { tier = 2; label = 'SEVERE'; }
  else if (score >= 46) { tier = 3; label = 'WATCH'; }
  else { tier = 4; label = 'EARLY'; }
  return { tier: tier, tierLabel: label, priority: score, workFirst: tier <= 2, signals: reasons };
}
function enrichTech(d) { var s = scoreTech(d); d.tier = s.tier; d.tierLabel = s.tierLabel; d.priority = s.priority; d.workFirst = s.workFirst; d.signals = s.signals; return d; }

module.exports = { SIGNALS: SIGNALS, SIG: SIG, fromRow: fromRow, classify: classify, scoreTech: scoreTech, enrichTech: enrichTech };
