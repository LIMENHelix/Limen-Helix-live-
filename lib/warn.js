/**
 * lib/warn.js — INDUSTRY domain P3 core. Turns a WARN notice (plant closing / mass layoff) into a
 * ranked distress deal. The distress signal is legally mandated (WARN Act = 60-day notice), free,
 * and dated. A permanent closure of a manufacturing plant = a fire-sale of equipment + inventory +
 * the building, which lib/liquidators.js matches to paying counterparties.
 *
 * Sources normalize to one shape; scoreWarn ranks by: closure > layoff (full asset dump), scale
 * (# affected = asset-size proxy), industry (manufacturing/wholesale = tangible assets), imminence.
 * Shared by scripts/warn-fetch.js (ingest) and handlers/industry.js (read).
 */
'use strict';
function num(v) { var n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; }
function day(v) { var s = String(v || ''); var m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3]; var d = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return d ? d[3] + '-' + ('0' + d[1]).slice(-2) + '-' + ('0' + d[2]).slice(-2) : ''; }
function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

/* ---- per-source normalizers -> common deal shape ---- */
function normTX(r) {
  return shape({ state: 'TX', company: r.job_site_name, city: r.city_name, county: (r.county_name || '').replace(/ County$/i, ''),
    affected: r.total_layoff_number, noticeDate: r.notice_date, effectiveDate: r.layoff_date });
}
function normOR(r) {
  return shape({ state: 'OR', company: r.company_name || r.warn, city: r.city,
    affected: r.laid_off, noticeDate: r.received_date, effectiveDate: r.layoff_date, closureType: r.layoff_type });
}
function normCA(r) { // r = row object keyed by the .xlsx headers
  return shape({ state: 'CA', company: r['Company'], address: r['Address'], county: (r['County/Parish'] || '').replace(/ (County|Parish)$/i, ''),
    affected: r['No. Of Employees'], noticeDate: r['Notice Date'], effectiveDate: r['Effective Date'],
    closureType: r['Layoff/Closure'], industry: r['Related Industry'] });
}
function shape(o) {
  var d = {
    source: 'WARN', state: o.state, company: clean(o.company), address: clean(o.address), city: clean(o.city), county: clean(o.county),
    affected: num(o.affected), noticeDate: day(o.noticeDate), effectiveDate: day(o.effectiveDate),
    closureType: clean(o.closureType), industry: clean(o.industry)
  };
  d.key = (d.state + '|' + d.company + '|' + d.effectiveDate).toUpperCase().replace(/[^A-Z0-9|]/g, '');
  return d;
}

/* ---- P3 ranking ---- */
function daysUntil(ymd) {
  if (!ymd) return null;
  var t = Date.parse(ymd + 'T00:00:00Z'); if (isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86400000);
}
function scoreWarn(d) {
  var reasons = [], score = 0;
  var ct = (d.closureType || '').toLowerCase();
  var isClosure = ct ? /clos/.test(ct) : null; // null when the source doesn't state a type (TX)
  if (isClosure === true) { score += 40; reasons.push('PERMANENT-CLOSURE'); }
  else if (isClosure === false) { reasons.push('layoff-only'); }
  else { score += 15; reasons.push('type-unknown'); }
  var n = d.affected || 0;
  if (n >= 500) { score += 30; reasons.push('MASSIVE-500+'); }
  else if (n >= 200) { score += 22; reasons.push('LARGE-200+'); }
  else if (n >= 75) { score += 14; reasons.push('MID-75+'); }
  else if (n >= 25) { score += 6; reasons.push('SMALL-25+'); }
  var ind = (d.industry || '').toLowerCase();
  if (/manufactur|\b3[123]\b|31-33/.test(ind)) { score += 20; reasons.push('MANUFACTURING'); }
  else if (/wholesale|warehous|distribut|logistic|\b42\b/.test(ind)) { score += 12; reasons.push('WHOLESALE/DISTRIB'); }
  else if (/retail|4[45]/.test(ind)) { score += 6; reasons.push('RETAIL'); }
  var days = daysUntil(d.effectiveDate);
  if (days != null && days >= 0 && days <= 90) { score += 8; reasons.push('IMMINENT'); }
  if (days != null && days < 0) reasons.push('past-effective');
  var tier, label;
  if (isClosure && score >= 68) { tier = 1; label = 'WORK-FIRST'; }
  else if (score >= 48) { tier = 2; label = 'STRONG'; }
  else if (score >= 28) { tier = 3; label = 'WARM'; }
  else { tier = 4; label = 'COLD'; }
  return { tier: tier, tierLabel: label, priority: score, workFirst: tier <= 2, signals: reasons, isClosure: isClosure };
}
function enrichWarn(d) { var s = scoreWarn(d); d.tier = s.tier; d.tierLabel = s.tierLabel; d.priority = s.priority; d.workFirst = s.workFirst; d.signals = s.signals; d.isClosure = s.isClosure; return d; }

module.exports = { normTX: normTX, normOR: normOR, normCA: normCA, shape: shape, scoreWarn: scoreWarn, enrichWarn: enrichWarn, num: num, day: day, clean: clean };
