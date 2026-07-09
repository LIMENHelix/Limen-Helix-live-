/**
 * lib/medicine.js — MEDICINE domain P3 core (instance #5). Turns FDA drug/device recalls into ranked
 * distress deals. Signal = openFDA enforcement (drug + device), national + single-source + free + a
 * clean public API (unlike the layoffs.fyi Airtable scrape). A recalled drug/device is a node stuck
 * at a failed safety transition — caught BEFORE the mass-tort legal-ad blitz = "first regulating."
 *
 * Native asset (operator: "P3 doesn't have to be real estate"): DRUG/DEVICE SAFETY, not property.
 * Business model: sell the early-recall FEED (data, not case brokering) to mass-tort plaintiff firms
 * (lib/plaintiff-firms.js). We surface monetizable safety failures; the FIRM qualifies + signs the
 * claimant, so the compliance weight (attorney advertising / TCPA / HIPAA) sits on their side.
 *
 * Honest register: LAGGING signal (the recall already issued), NO validated kernel -> rank 1-3 only,
 * "find + connect fast" NEVER "predict" ([[p3-horizon-ladder]] ceiling). Not every recall is a viable
 * tort (a foreign tablet in one bottle is not) — the feed surfaces CANDIDATES, ranked by severity.
 *
 * Shared by scripts/medicine-fetch.js (ingest) and handlers/medicine-distress.js (read).
 */
'use strict';
// distress signal types = FDA recall classification, most severe first.
var SIGNALS = [
  { key: 'classI',   label: 'Class I recall (serious harm / death risk)', sev: 90 },
  { key: 'classII',  label: 'Class II recall (temporary / reversible harm)', sev: 60 },
  { key: 'classIII', label: 'Class III recall (unlikely to harm)', sev: 34 }
];
var SIG = {}; SIGNALS.forEach(function (s) { SIG[s.key] = s; });
var CLASS_TO_SIG = { 'class i': 'classI', 'class ii': 'classII', 'class iii': 'classIII' };
// reason keywords that historically anchor real mass torts (nitrosamine/NDMA = valsartan/Zantac, etc.)
var TORT_HOT = /nitrosamine|ndma|ndea|carcinogen|cancer|death|serious injur|failed|contaminat|sterility|particulate|burn|laceration|overdose|mislabel|superpotent|subpotent/i;

function ymd(fdaDate) {
  var s = String(fdaDate || '');
  return s.length === 8 ? (s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8)) : s;
}
function first(a) { return Array.isArray(a) ? a[0] : a; }

function fromRecall(r, productType) {
  var of = r.openfda || {};
  var cls = String(r.classification || '').toLowerCase();
  var d = {
    source: 'openFDA',
    productType: productType || r.product_type || 'drug',   // 'drug' | 'device'
    firm: r.recalling_firm || '',
    brand: first(of.brand_name) || '',
    generic: first(of.generic_name) || '',
    product: r.product_description || '',
    reason: r.reason_for_recall || '',
    classification: r.classification || '',
    status: r.status || '',
    mandated: /mandated/i.test(r.voluntary_mandated || ''),
    distribution: r.distribution_pattern || '',
    state: r.state || '', country: r.country || '',
    date: ymd(r.report_date), initiated: ymd(r.recall_initiation_date),
    recallNumber: r.recall_number || '',
    // inventory-match keys (Tuned Monitoring): lot/serial string + NDC when openFDA has it.
    // code_info is the authoritative affected-lot list; NDC is often absent on enforcement records.
    codeInfo: r.code_info || '',
    ndc: first(of.product_ndc) || first(of.package_ndc) || '',
    signalType: CLASS_TO_SIG[cls] || 'classIII'
  };
  d.signalLabel = (SIG[d.signalType] || {}).label || d.signalType;
  d.url = 'https://www.google.com/search?q=' + encodeURIComponent((d.firm || '') + ' recall ' + (d.recallNumber || d.product.slice(0, 40)));
  d.key = ('med|' + (d.recallNumber || (d.firm + '|' + d.product).slice(0, 60))).replace(/[^0-9a-z|.\-]/gi, '');
  return d;
}

function daysSince(ymdStr) { if (!ymdStr) return null; var t = Date.parse(ymdStr); return isNaN(t) ? null : Math.round((Date.now() - t) / 86400000); }

function scoreMedicine(d) {
  var reasons = [], sig = SIG[d.signalType] || {}, score = sig.sev || 30;
  reasons.push((sig.label || d.signalType || '').toUpperCase());
  if (d.mandated) { score += 8; reasons.push('FDA-MANDATED'); }
  if (TORT_HOT.test(d.reason)) { score += 8; reasons.push('TORT-PATTERN'); }
  if (/nationwide|nation-wide|all\b|us\b/i.test(d.distribution)) { score += 5; reasons.push('NATIONWIDE'); }
  if (d.productType === 'device') { score += 3; reasons.push('DEVICE'); }
  var ds = daysSince(d.date);
  if (ds != null && ds <= 45) { score += 8; reasons.push('FRESH-45D'); }
  else if (ds != null && ds > 365) { reasons.push('older'); }
  var tier, label;
  if (score >= 96) { tier = 1; label = 'CRITICAL'; }
  else if (score >= 66) { tier = 2; label = 'SEVERE'; }
  else if (score >= 46) { tier = 3; label = 'WATCH'; }
  else { tier = 4; label = 'LOW'; }
  return { tier: tier, tierLabel: label, priority: score, workFirst: tier <= 2, signals: reasons };
}
function enrichMedicine(d) { var s = scoreMedicine(d); d.tier = s.tier; d.tierLabel = s.tierLabel; d.priority = s.priority; d.workFirst = s.workFirst; d.signals = s.signals; return d; }

module.exports = { SIGNALS: SIGNALS, SIG: SIG, CLASS_TO_SIG: CLASS_TO_SIG, fromRecall: fromRecall, scoreMedicine: scoreMedicine, enrichMedicine: enrichMedicine };
