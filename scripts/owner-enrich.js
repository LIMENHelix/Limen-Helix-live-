/**
 * owner-enrich.js — attach OWNER + PROPERTY TYPE + a MOTIVATED-SELLER PRIORITY
 * to distressed deals, free. Multi-state (FL live; KS/CA plug in as sources land).
 *
 * WHAT IT DOES
 *  1. Routes each deal to its state's free owner source (by deal.state).
 *  2. Attaches owner name + mailing address (public record — same data BatchData resells).
 *  3. Tags PROPERTY TYPE from the assessor use code (single-fam / condo / vacant /
 *     church / commercial ...) and FILTERS to residential by default — no more
 *     $1M churches or vacant lots floating to the top of a "homes" list.
 *  4. Scores a MOTIVATED-SELLER PRIORITY and stamps a WORK-FIRST tier, so you call
 *     the highest-probability sellers first: probate/heirs > foreign/out-of-state
 *     absentee > trusts/LLCs > in-state absentee > owner-occupied.
 *  5. Ranks by that priority, weighted to the MOST RECENT (soonest auction) and
 *     HIGHEST VALUE, and writes a work-order CSV.
 *
 * STATE SOURCES (free owner name + mailing)
 *  FL — Florida Statewide Cadastral ArcGIS (all 67 counties, ~10.8M parcels). LIVE.
 *  KS — pending source verification (see STATE_ENRICHERS). Does NOT crash; reports status.
 *  CA — pending source verification (CA is largely closed on free statewide owner data).
 *
 * KEY (FL): statewide PARCEL_ID = county STRAP with all punctuation stripped
 * (Lee "32-44-24-C2-01206.0240" -> "324424C2012060240"). Exact-match only; LIKE/broad
 * scans time out on 10.8M rows.
 *
 * RUN: node scripts/owner-enrich.js <deals.json> [outCsv] [--all] [--state=FL]
 *   <deals.json>  array of deals (each needs .parcel and .state)
 *   --all         include non-residential (churches/commercial/vacant) instead of filtering them out
 *   --state=XX    force a single state's enricher for every deal (else routes by deal.state)
 *   writes <deals>.enriched.json  + a priority-ranked work-order CSV
 */
'use strict';
var fs = require('fs');

var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

var US_STATES = new Set(('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO ' +
  'MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC').split(' '));

/* ---------------------------------------------------------------------------
 * PROPERTY TYPE — Florida DOR use codes (DOR_UC).
 * ------------------------------------------------------------------------- */
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

// what we treat as a flippable/wholesale-able home
var RESIDENTIAL = new Set(['SINGLE-FAM', 'CONDO', 'MOBILE', 'MULTIFAM-<10', 'MULTIFAM-10+', 'RETIREMENT', 'COOP', 'MISC-RES']);
function isResidential(propType) { return RESIDENTIAL.has(propType); }

/* ---------------------------------------------------------------------------
 * MOTIVATED-SELLER SIGNALS — read from owner name + mailing vs property location.
 * ------------------------------------------------------------------------- */
function signalsFor(deal, owner) {
  var s = { probate: false, foreign: false, outOfState: false, inState: false, trust: false, corporate: false, ownerOccupied: false };
  if (!owner) return s;
  var name = (owner.name || '').toUpperCase();

  // deceased owner / estate = the single most motivated seller
  if (/\b(HEIRS?|ESTATE OF|EST OF|DECEASED|DEC'?D|DECD|LIFE ESTATE|UNKNOWN HEIRS|SURVIVING)\b/.test(name)) s.probate = true;
  // cadastral truncates OWN_NAME to 30 chars, so "LIVING TRUST" often arrives as "LIVING TRUS" — match liberally
  if (/TRUST|TRUS\b|LIVING TR|REV(OC)?\w* TR|FAM(ILY)? TR|\bTR\b/.test(name)) s.trust = true;
  if (/\b(LLC|L\.L\.C|INC|CORP|CO\b|LP|LLP|HOLDINGS|PROPERTIES|INVESTMENTS|CAPITAL|REALTY|GROUP|VENTURES|PARTNERS|ENTERPRISES)\b/.test(name)) s.corporate = true;

  var absentee = !!owner.absentee;
  var mailSt = (owner.mailState || '').toUpperCase().trim();
  if (absentee) {
    if (mailSt && !US_STATES.has(mailSt)) s.foreign = true;          // e.g. CANADA — no US state
    else if (mailSt && mailSt !== (deal.state || '').toUpperCase()) s.outOfState = true;
    else s.inState = true;
  } else {
    s.ownerOccupied = true;
  }
  return s;
}

/* ---------------------------------------------------------------------------
 * PRIORITY SCORE + WORK-FIRST TIER.
 *   Higher = call sooner. Blends seller-motivation signals with value + urgency,
 *   guarding against tax-deed equity inflation (opening bid = back taxes, not price).
 * ------------------------------------------------------------------------- */
function daysToSale(saleDate) {
  // saleDate is "MM/DD/YYYY"; no Date.now() available in some envs, so parse both against a fixed ref is overkill —
  // we only need relative ordering, so return a sortable YYYYMMDD number (soonest first handled by caller).
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(saleDate || ''));
  if (!m) return null;
  return parseInt(m[3] + m[1] + m[2], 10); // YYYYMMDD
}

function scoreDeal(deal, owner, propType, sig) {
  var reasons = [];
  var score = 0;

  // --- seller motivation (the biggest lever) ---
  if (sig.probate) { score += 45; reasons.push('PROBATE/HEIRS'); }
  if (sig.foreign) { score += 38; reasons.push('FOREIGN-ABSENTEE'); }
  if (sig.outOfState) { score += 30; reasons.push('OUT-OF-STATE-ABSENTEE'); }
  if (sig.inState && !sig.probate) { score += 16; reasons.push('IN-STATE-ABSENTEE'); }
  if (sig.trust) { score += 18; reasons.push('TRUST'); }
  if (sig.corporate) { score += 12; reasons.push('CORPORATE/LLC'); }
  if (sig.ownerOccupied) { reasons.push('owner-occupied'); }

  // --- value (guard tax-deed inflation: a taxdeed's "equity" is vs back taxes, not price) ---
  var mv = deal.marketValue || 0;
  var eq = deal.equity || 0;
  var effEquity = deal.product === 'taxdeed' ? Math.min(eq, mv * 0.5) : eq; // haircut tax-deed spreads hard
  var valueScore = Math.min(22, Math.round(effEquity / 45000));
  score += valueScore;
  if (valueScore >= 15) reasons.push('HIGH-VALUE');

  // --- recency / urgency: soonest auction date gets a nudge (act now) ---
  var d2s = daysToSale(deal.saleDate);
  if (d2s) { score += 6; reasons.push('DATED-SALE'); }

  // --- tier ---
  var tier, label;
  var forceTop = sig.probate || sig.foreign;
  if (forceTop || score >= 58) { tier = 1; label = 'WORK-FIRST'; }
  else if (score >= 42) { tier = 2; label = 'STRONG'; }
  else if (score >= 26) { tier = 3; label = 'WARM'; }
  else { tier = 4; label = 'COLD'; }

  return { score: score, tier: tier, tierLabel: label, workFirst: tier <= 2, effEquity: effEquity, reasons: reasons };
}

/* ---------------------------------------------------------------------------
 * STATE ENRICHERS — one per state. Each returns:
 *   { status:'ok'|'no-match'|'source-pending'|'error', owner, propType, useCode,
 *     marketValue, livingArea, yearBuilt, buildings }
 * ------------------------------------------------------------------------- */
var FL_BASE = 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query';

async function enrichFL(deal) {
  var pid = String(deal.parcel || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!pid) return { status: 'no-parcel' };
  var fields = 'OWN_NAME,OWN_ADDR1,OWN_ADDR2,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,DOR_UC,JV,TOT_LVG_AR,ACT_YR_BLT,NO_BULDNG';
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
      name: String(a.OWN_NAME).trim(),
      mailAddr: mailLine,
      mailCity: String(a.OWN_CITY || '').trim(),
      mailState: String(a.OWN_STATE || '').trim(),
      mailZip: String(a.OWN_ZIPCD || '').trim().slice(0, 5),
      absentee: absentee
    } : null;
    var propType = flPropType(a.DOR_UC);
    return {
      status: owner ? 'ok' : 'no-owner',
      owner: owner,
      propType: propType,
      useCode: a.DOR_UC,
      marketValue: a.JV != null ? Number(a.JV) : null,   // authoritative just value (fixes scraper value drift)
      livingArea: a.TOT_LVG_AR != null ? Number(a.TOT_LVG_AR) : null,
      yearBuilt: a.ACT_YR_BLT || null,
      buildings: a.NO_BULDNG != null ? Number(a.NO_BULDNG) : null
    };
  } catch (e) { return { status: 'error', error: String(e && e.message || e) }; }
}

// Placeholder enricher for states whose free owner source isn't wired yet.
// Reports honestly instead of crashing or faking data.
function pending(stateCode, note) {
  return async function () { return { status: 'source-pending', state: stateCode, note: note }; };
}

// State/source status (verified 2026-07-04):
//  FL — statewide cadastral, free, LIVE (all 67 counties).
//  KS — NO free statewide owner endpoint (ORKA's open REST is geometry-only; statewide Parcels
//       FeatureServer is token-gated). Owner data is free only per-county via county GIS/appraiser:
//       Johnson (aims.jocogov.org — REST root locked, needs the exact tax-parcel layer), Sedgwick
//       (gismaps.sedgwickcounty.org), Shawnee (data-sncoks-gis). Build a per-county connector map.
//  CA — LEGAL WALL: Gov Code §7928.205 bars posting owner name online, so LA/Orange/Sacramento/
//       Riverside/San Bernardino redact or omit owner in free services. The ONE free exception is
//       SAN DIEGO county (SanGIS GeocoderMerged) — VERIFIED owner name+mailing+OWNEROCC. Statewide
//       CA owner at scale = paid only (ParcelQuest / Regrid).
var STATE_ENRICHERS = {
  FL: enrichFL,
  KS: pending('KS', 'No free statewide owner source; per-county only (Johnson/Sedgwick/Shawnee). Needs county connectors + a KS distress-supply feed.'),
  CA: pending('CA', 'Free owner data ONLY in San Diego county (SanGIS, verified); rest of CA blocked by Gov Code §7928.205. Needs SD supply feed + APN field wire, or paid ParcelQuest/Regrid statewide.')
};

/* ---------------------------------------------------------------------------
 * MAIN
 * ------------------------------------------------------------------------- */
function csvCell(s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

async function main() {
  var args = process.argv.slice(2);
  var inPath = args.find(function (a) { return !a.startsWith('--'); });
  var outCsv = args.filter(function (a) { return !a.startsWith('--'); })[1];
  var includeAll = args.indexOf('--all') >= 0;
  var forceState = (args.find(function (a) { return a.indexOf('--state=') === 0; }) || '').split('=')[1];

  if (!inPath || !fs.existsSync(inPath)) {
    console.error('usage: node scripts/owner-enrich.js <deals.json> [outCsv] [--all] [--state=FL]');
    process.exit(1);
  }
  outCsv = outCsv || inPath.replace(/\.json$/, '') + '.workorder.csv';
  var deals = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  if (!Array.isArray(deals)) deals = deals.deals || [];

  console.log('enriching ' + deals.length + ' deals (owner + type + priority)...');
  var byState = {}; var pendingStates = {};

  for (var i = 0; i < deals.length; i++) {
    var d = deals[i];
    var st = (forceState || d.state || 'FL').toUpperCase();
    var fn = STATE_ENRICHERS[st];
    var res = fn ? await fn(d) : { status: 'no-enricher', state: st };

    d.enrichStatus = res.status;
    d.owner = res.owner || null;
    d.propType = res.propType || null;
    if (res.marketValue != null) { d.assessedValue = res.marketValue; }   // keep authoritative just value alongside scraped one
    d.livingArea = res.livingArea != null ? res.livingArea : d.livingArea;
    d.yearBuilt = res.yearBuilt || d.yearBuilt;

    if (res.status === 'source-pending' || res.status === 'no-enricher') {
      pendingStates[st] = res.note || ('no enricher registered for ' + st);
    }

    // signals + priority (only meaningful when we actually got owner + type)
    var sig = signalsFor(d, d.owner);
    d.signals = sig;
    var sc = scoreDeal(d, d.owner, d.propType, sig);
    d.priority = sc.score;
    d.tier = sc.tier;
    d.tierLabel = sc.tierLabel;
    d.workFirst = sc.workFirst;
    d.priorityReasons = sc.reasons;
    d.residential = d.propType ? isResidential(d.propType) : null;

    byState[st] = (byState[st] || 0) + (res.status === 'ok' ? 1 : 0);
    process.stdout.write(res.status === 'ok' ? '.' : (res.status === 'source-pending' ? '~' : 'x'));
    if (fn === enrichFL) await wait(140); // polite to the FL service
  }
  process.stdout.write('\n');

  // filter: residential-only by default (non-res kept in enriched.json, excluded from work order)
  var enrichable = deals.filter(function (d) { return d.propType != null; });
  var work = enrichable.filter(function (d) { return includeAll || d.residential; });
  var excluded = enrichable.filter(function (d) { return !includeAll && !d.residential; });

  // RANK: work-first tier, then priority score, then value, then soonest sale
  work.sort(function (a, b) {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.priority !== a.priority) return b.priority - a.priority;
    if ((b.equity || 0) !== (a.equity || 0)) return (b.equity || 0) - (a.equity || 0);
    return (daysToSale(a.saleDate) || 99999999) - (daysToSale(b.saleDate) || 99999999);
  });

  // write enriched json (everything)
  var enrichedPath = inPath.replace(/\.json$/, '') + '.enriched.json';
  fs.writeFileSync(enrichedPath, JSON.stringify(deals, null, 1));

  // write the work-order CSV (residential, priority-ranked)
  var head = ['work_order', 'tier', 'tier_label', 'priority', 'work_first', 'signals', 'prop_type',
    'equity', 'assessed_value', 'living_sqft', 'year_built', 'owner_name', 'absentee',
    'mail_addr', 'mail_city', 'mail_state', 'mail_zip', 'property_address', 'property_city',
    'property_state', 'property_zip', 'sale_date', 'county', 'case_number', 'parcel'];
  var rows = [head];
  work.forEach(function (d, i) {
    var o = d.owner || {};
    rows.push([i + 1, d.tier, d.tierLabel, d.priority, d.workFirst ? 'YES' : '', (d.priorityReasons || []).join('|'), d.propType,
      d.equity, d.assessedValue, d.livingArea, d.yearBuilt, o.name || '', o.absentee ? 'YES' : '',
      o.mailAddr || d.street, o.mailCity || d.city, o.mailState || d.state, o.mailZip || d.zip,
      d.street, d.city, d.state, d.zip, d.saleDate, d.county, d.caseNumber, d.parcel]);
  });
  fs.writeFileSync(outCsv, rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'));

  // ---- report ----
  console.log('\nowner matched: ' + Object.keys(byState).map(function (s) { return s + '=' + byState[s]; }).join(' ') +
    '   | work list: ' + work.length + '   | excluded non-residential: ' + excluded.length);
  if (Object.keys(pendingStates).length) {
    console.log('\n⚠ STATES PENDING A FREE OWNER SOURCE:');
    Object.keys(pendingStates).forEach(function (s) { console.log('   ' + s + ': ' + pendingStates[s]); });
  }
  if (excluded.length) {
    console.log('\nexcluded (non-residential, in enriched.json, use --all to include):');
    excluded.slice(0, 10).forEach(function (d) { console.log('   ' + String(d.propType).padEnd(12) + ' $' + d.equity + '  ' + d.street + ', ' + d.city); });
  }

  var t1 = work.filter(function (d) { return d.tier === 1; });
  console.log('\n=== WORK-FIRST (tier 1) — ' + t1.length + ' ===');
  t1.forEach(function (d, i) {
    var o = d.owner || {};
    console.log('  ' + (i + 1) + '. [' + d.priority + '] ' + (o.name || '(no owner)') + '  |  ' + d.street + ', ' + d.city + ', ' + d.state +
      '  |  $' + d.equity + ' eq  |  ' + (d.priorityReasons || []).join(', '));
    if (o.absentee) console.log('        mail-> ' + o.mailAddr + ', ' + o.mailCity + ' ' + o.mailState + ' ' + o.mailZip);
  });
  console.log('\nwrote ' + enrichedPath);
  console.log('wrote ' + outCsv + '  (priority-ranked work order)');
}
main().catch(function (e) { console.error('FATAL', e); process.exit(1); });
