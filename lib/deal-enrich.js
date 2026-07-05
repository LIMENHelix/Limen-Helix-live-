/**
 * lib/deal-enrich.js — shared P3 enrichment for distressed-property deals.
 *
 * Attaches, per deal: owner name + mailing address (FL statewide cadastral, free),
 * property TYPE (from the assessor use code), and a MOTIVATED-SELLER PRIORITY
 * (probate/heirs > foreign/out-of-state absentee > trust/LLC > in-state absentee >
 * owner-occupied), plus a work-first tier. This is the "P3 regulation" signal — it
 * turns a raw auction list into ranked opportunities.
 *
 * Used by: scripts/realauction-scrape.js (live daily pipeline) and
 *          scripts/owner-enrich.js (offline CLI on deal dumps).
 *
 * FL cadastral: PARCEL_ID = county STRAP with all punctuation stripped. Exact-match
 * queries only (LIKE/broad scans time out on ~10.8M rows).
 */
'use strict';

var FL_BASE = 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query';
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

var US_STATES = new Set(('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO ' +
  'MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC').split(' '));

/* ---- property type (FL DOR use codes) ---- */
function flPropType(code) {
  var c = parseInt(code, 10);
  if (isNaN(c)) return 'UNKNOWN';
  if (c === 0) return 'VACANT-RES';
  if (c === 1) return 'SINGLE-FAM';
  if (c === 2) return 'MOBILE';
  if (c === 3) return 'MULTIFAM-10+';
  if (c === 4) return 'CONDO';
  if (c === 5) return 'COOP';
  if (c === 6) return 'RETIREMENT';
  if (c === 7) return 'MISC-RES';
  if (c === 8) return 'MULTIFAM-<10';
  if (c === 9) return 'RES-COMMON';
  if (c >= 10 && c <= 39) return 'COMMERCIAL';
  if (c >= 40 && c <= 49) return 'INDUSTRIAL';
  if (c >= 50 && c <= 69) return 'AGRICULTURAL';
  if (c === 70) return 'VACANT-INST';
  if (c === 71) return 'CHURCH';
  if (c >= 72 && c <= 79) return 'INSTITUTIONAL';
  if (c >= 80 && c <= 89) return 'GOVERNMENT';
  return 'MISC/OTHER';
}
var RESIDENTIAL = new Set(['SINGLE-FAM', 'CONDO', 'MOBILE', 'MULTIFAM-<10', 'MULTIFAM-10+', 'RETIREMENT', 'COOP', 'MISC-RES']);
function isResidential(t) { return RESIDENTIAL.has(t); }

/* ---- motivated-seller signals ---- */
function signalsFor(deal, owner) {
  var s = { probate: false, foreign: false, outOfState: false, inState: false, trust: false, corporate: false, ownerOccupied: false };
  if (!owner) return s;
  var name = (owner.name || '').toUpperCase();
  if (/\b(HEIRS?|ESTATE OF|EST OF|DECEASED|DEC'?D|DECD|LIFE ESTATE|UNKNOWN HEIRS|SURVIVING)\b/.test(name)) s.probate = true;
  if (/TRUST|TRUS\b|LIVING TR|REV(OC)?\w* TR|FAM(ILY)? TR|\bTR\b/.test(name)) s.trust = true;
  if (/\b(LLC|L\.L\.C|INC|CORP|CO\b|LP|LLP|HOLDINGS|PROPERTIES|INVESTMENTS|CAPITAL|REALTY|GROUP|VENTURES|PARTNERS|ENTERPRISES)\b/.test(name)) s.corporate = true;
  var mailSt = (owner.mailState || '').toUpperCase().trim();
  if (owner.absentee) {
    if (mailSt && !US_STATES.has(mailSt)) s.foreign = true;
    else if (mailSt && mailSt !== (deal.state || '').toUpperCase()) s.outOfState = true;
    else s.inState = true;
  } else { s.ownerOccupied = true; }
  return s;
}

var VALUE_FLOOR = 25000; // below this = no real spread to broker

// effective equity: tax-deed "equity" is vs back taxes (opening bid), not price, so haircut it hard
function effEquityOf(deal) {
  var mv = deal.marketValue || deal.assessedValue || 0, eq = deal.equity || 0;
  return deal.product === 'taxdeed' ? Math.min(eq, mv * 0.5) : eq;
}

// re-apply the value floor to any (already-tiered) deal — used at read time so stored data
// scored under an older rule is corrected without a re-scrape.
function floorTier(deal, tier, label, reasons) {
  var ee = effEquityOf(deal);
  if (ee <= 0 && tier < 4) { return { tier: 4, tierLabel: 'COLD', add: 'UNDERWATER' }; }
  if (ee < VALUE_FLOOR && tier < 3) { return { tier: 3, tierLabel: 'WARM', add: 'THIN-EQUITY' }; }
  return null;
}

/* ---- priority score + work-first tier ---- */
function scoreDeal(deal, sig) {
  var reasons = [], score = 0;
  if (sig.probate) { score += 45; reasons.push('PROBATE/HEIRS'); }
  if (sig.foreign) { score += 38; reasons.push('FOREIGN-ABSENTEE'); }
  if (sig.outOfState) { score += 30; reasons.push('OUT-OF-STATE-ABSENTEE'); }
  if (sig.inState && !sig.probate) { score += 16; reasons.push('IN-STATE-ABSENTEE'); }
  if (sig.trust) { score += 18; reasons.push('TRUST'); }
  if (sig.corporate) { score += 12; reasons.push('CORPORATE/LLC'); }
  if (sig.ownerOccupied) reasons.push('owner-occupied');
  var effEquity = effEquityOf(deal);
  var valueScore = Math.min(22, Math.max(0, Math.round(effEquity / 45000)));
  score += valueScore;
  if (valueScore >= 15) reasons.push('HIGH-VALUE');
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(deal.saleDate || ''))) { score += 6; reasons.push('DATED-SALE'); }
  var tier, label, forceTop = sig.probate || sig.foreign;
  if (forceTop || score >= 58) { tier = 1; label = 'WORK-FIRST'; }
  else if (score >= 42) { tier = 2; label = 'STRONG'; }
  else if (score >= 26) { tier = 3; label = 'WARM'; }
  else { tier = 4; label = 'COLD'; }
  // VALUE FLOOR: a motivated seller with no equity is a short sale, not a spread — can't be work-first.
  var fl = floorTier(deal, tier, label, reasons);
  if (fl) { tier = fl.tier; label = fl.tierLabel; reasons.push(fl.add); }
  return { score: score, tier: tier, tierLabel: label, workFirst: tier <= 2, reasons: reasons };
}

/* ---- FL owner lookup (cadastral) ---- */
async function ownerForFL(parcel) {
  var pid = String(parcel || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!pid) return { status: 'no-parcel' };
  var fields = 'OWN_NAME,OWN_ADDR1,OWN_ADDR2,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,DOR_UC,JV,TOT_LVG_AR,ACT_YR_BLT';
  var url = FL_BASE + '?where=' + encodeURIComponent("PARCEL_ID='" + pid + "'") +
    '&outFields=' + encodeURIComponent(fields) + '&returnGeometry=false&f=json';
  try {
    var r = await fetch(url, { headers: { accept: 'application/json' } });
    var j = await r.json();
    var a = j && j.features && j.features[0] && j.features[0].attributes;
    if (!a) return { status: 'no-match' };
    var mailLine = [a.OWN_ADDR1, a.OWN_ADDR2].filter(Boolean).join(' ').trim();
    var phy = String(a.PHY_ADDR1 || '').replace(/\s+/g, '').toUpperCase();
    var absentee = !!(mailLine && phy && mailLine.replace(/\s+/g, '').toUpperCase().indexOf(phy.slice(0, 8)) < 0);
    var owner = a.OWN_NAME ? {
      name: String(a.OWN_NAME).trim(), mailAddr: mailLine,
      mailCity: String(a.OWN_CITY || '').trim(), mailState: String(a.OWN_STATE || '').trim(),
      mailZip: String(a.OWN_ZIPCD || '').trim().slice(0, 5), absentee: absentee
    } : null;
    return {
      status: owner ? 'ok' : 'no-owner', owner: owner, propType: flPropType(a.DOR_UC), useCode: a.DOR_UC,
      assessedValue: a.JV != null ? Number(a.JV) : null,
      livingArea: a.TOT_LVG_AR != null ? Number(a.TOT_LVG_AR) : null, yearBuilt: a.ACT_YR_BLT || null
    };
  } catch (e) { return { status: 'error', error: String(e && e.message || e) }; }
}

// per-state owner enricher registry (FL live; others pending — see p3-regulation-business memory)
var ENRICHERS = { FL: ownerForFL };

/* ---- enrich one deal in place ---- */
async function enrichDeal(deal) {
  var st = (deal.state || 'FL').toUpperCase();
  var fn = ENRICHERS[st];
  var res = fn ? await fn(deal.parcel) : { status: 'no-enricher' };
  deal.enrichStatus = res.status;
  deal.owner = res.owner || null;
  deal.propType = res.propType || null;
  deal.residential = deal.propType ? isResidential(deal.propType) : null;
  if (res.assessedValue != null) deal.assessedValue = res.assessedValue;
  if (res.livingArea != null) deal.livingArea = res.livingArea;
  if (res.yearBuilt) deal.yearBuilt = res.yearBuilt;
  var sig = signalsFor(deal, deal.owner);
  deal.signals = sig;
  var sc = scoreDeal(deal, sig);
  deal.priority = sc.score; deal.tier = sc.tier; deal.tierLabel = sc.tierLabel;
  deal.workFirst = sc.workFirst; deal.priorityReasons = sc.reasons;
  return deal;
}

/* ---- enrich a list (polite, sequential) ---- */
async function enrichDeals(deals, opts) {
  opts = opts || {};
  var gap = opts.gap == null ? 140 : opts.gap;
  var hit = 0;
  for (var i = 0; i < deals.length; i++) {
    await enrichDeal(deals[i]);
    if (deals[i].enrichStatus === 'ok') hit++;
    if (opts.log && i % 20 === 0) process.stdout.write('.');
    if (gap) await wait(gap);
  }
  if (opts.log) process.stdout.write('\n  enriched owner for ' + hit + '/' + deals.length + '\n');
  return deals;
}

module.exports = {
  flPropType: flPropType, isResidential: isResidential, RESIDENTIAL: RESIDENTIAL,
  signalsFor: signalsFor, scoreDeal: scoreDeal, ownerForFL: ownerForFL,
  enrichDeal: enrichDeal, enrichDeals: enrichDeals, ENRICHERS: ENRICHERS,
  effEquityOf: effEquityOf, floorTier: floorTier, VALUE_FLOOR: VALUE_FLOOR
};
