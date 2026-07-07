/**
 * lib/edgar.js — FINANCE domain P3 core. Turns SEC EDGAR distress filings into ranked deals.
 * The signal is national + single-source + free (unlike the county-fragmented real-estate feed):
 * an 8-K with a distress Item code, or a going-concern 10-K/10-Q. Hard, dated corporate distress.
 *
 * Business model: NOT brokering companies (that's broker-dealer/FINRA). Sell this early-distress
 * feed as data to distressed-debt funds, restructuring advisors, and special-situations PE
 * (lib/distress-funds.js). Data, not deals — no closer/license problem.
 *
 * Shared by scripts/edgar-fetch.js (ingest) and handlers/finance-distress.js (read).
 */
'use strict';
// distress signal types, ordered by severity. `q` = EDGAR full-text query; results are classified
// by their 8-K `items` array where possible (authoritative), else by the form/keyword.
// q = a quoted full-text phrase (the fetcher URL-encodes it). For the item-based 8-K signals we
// query a distinctive keyword and let the authoritative `items` array do the precise classification.
var SIGNALS = [
  { key: 'bankruptcy', label: 'Bankruptcy filing (Ch. 11/7)', sev: 100, item: '1.03', q: '"chapter 11"', forms: '8-K' },
  { key: 'default', label: 'Debt default / acceleration', sev: 82, item: '2.04', q: '"triggering event"', forms: '8-K' },
  { key: 'delisting', label: 'Delisting / listing-rule failure', sev: 66, item: '3.01', q: '"delisting"', forms: '8-K' },
  { key: 'nonreliance', label: 'Financials non-reliance (restatement)', sev: 58, item: '4.02', q: '"non-reliance"', forms: '8-K' },
  { key: 'goingconcern', label: 'Going-concern doubt', sev: 54, item: '', q: '"substantial doubt"', forms: '10-Q,10-K' },
  { key: 'latefiling', label: 'Late filing (NT)', sev: 38, item: '', q: '"unable to file"', forms: 'NT 10-K,NT 10-Q' }
];
var ITEM_TO_SIGNAL = { '1.03': 'bankruptcy', '2.04': 'default', '3.01': 'delisting', '4.02': 'nonreliance' };
var SIG = {}; SIGNALS.forEach(function (s) { SIG[s.key] = s; });

function parseNames(dn) {
  var s = String(dn || '').replace(/\s+/g, ' ').trim();
  var company = s.replace(/\s*\(.*$/, '').trim();
  var cikM = s.match(/\(CIK\s*(\d+)\)/i);
  var tickM = s.match(/\(([A-Z][A-Z0-9.,\s-]*)\)\s*\(CIK/i);
  return { company: company, ticker: tickM ? tickM[1].replace(/\s+/g, '').replace(/,$/, '') : '', cik: cikM ? cikM[1] : '' };
}

// build a deal from a full-text-search hit + the query's default signal type
function fromHit(hit, defaultType) {
  var s = hit._source || {}, nm = parseNames((s.display_names || [])[0]);
  var items = s.items || [];
  // 8-K items are authoritative: pick the most severe distress item present
  var type = defaultType;
  var best = -1;
  items.forEach(function (it) { var k = ITEM_TO_SIGNAL[it]; if (k && SIG[k] && SIG[k].sev > best) { best = SIG[k].sev; type = k; } });
  var sig = SIG[type] || SIG[defaultType] || {};
  return {
    source: 'EDGAR', signalType: type, signalLabel: sig.label || type,
    company: nm.company, ticker: nm.ticker, cik: nm.cik,
    form: s.root_form || s.file_type || '', items: items, filingDate: s.file_date || '',
    accession: (s._id || hit._id || '').split(':')[0] || '',
    key: (nm.cik + '|' + type).replace(/[^0-9a-z|]/gi, '')
  };
}

function daysSince(ymd) { if (!ymd) return null; var t = Date.parse(ymd + 'T00:00:00Z'); return isNaN(t) ? null : Math.round((Date.now() - t) / 86400000); }
function scoreEdgar(d) {
  var reasons = [], sig = SIG[d.signalType] || {}, score = sig.sev || 30;
  reasons.push((sig.label || d.signalType || '').toUpperCase());
  // multiple distress items in one 8-K = compounding (e.g. bankruptcy + default)
  var distressItems = (d.items || []).filter(function (it) { return ITEM_TO_SIGNAL[it]; });
  if (distressItems.length > 1) { score += 8; reasons.push('MULTI-EVENT'); }
  var ds = daysSince(d.filingDate);
  if (ds != null && ds <= 30) { score += 8; reasons.push('FRESH-30D'); }
  else if (ds != null && ds > 120) { reasons.push('older'); }
  var tier, label;
  if (score >= 90) { tier = 1; label = 'CRITICAL'; }
  else if (score >= 62) { tier = 2; label = 'SEVERE'; }
  else if (score >= 45) { tier = 3; label = 'WATCH'; }
  else { tier = 4; label = 'EARLY'; }
  return { tier: tier, tierLabel: label, priority: score, workFirst: tier <= 2, signals: reasons };
}
function enrichEdgar(d) { var s = scoreEdgar(d); d.tier = s.tier; d.tierLabel = s.tierLabel; d.priority = s.priority; d.workFirst = s.workFirst; d.signals = s.signals; return d; }

module.exports = { SIGNALS: SIGNALS, SIG: SIG, ITEM_TO_SIGNAL: ITEM_TO_SIGNAL, parseNames: parseNames, fromHit: fromHit, scoreEdgar: scoreEdgar, enrichEdgar: enrichEdgar };
