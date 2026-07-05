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

var CAD_FIELDS = 'OWN_NAME,OWN_ADDR1,OWN_ADDR2,OWN_CITY,OWN_STATE,OWN_ZIPCD,PHY_ADDR1,DOR_UC,JV,TOT_LVG_AR,ACT_YR_BLT';
var houseNo = function (s) { return ((String(s || '').match(/(\d+)/) || [])[1] || '').replace(/^0+/, ''); };

// build the enrichment result from a cadastral feature's attributes (shared by parcel + spatial paths)
function ownerFromAttrs(a, matchMode) {
  var mailLine = [a.OWN_ADDR1, a.OWN_ADDR2].filter(Boolean).join(' ').trim();
  var phy = String(a.PHY_ADDR1 || '').replace(/\s+/g, '').toUpperCase();
  var absentee = !!(mailLine && phy && mailLine.replace(/\s+/g, '').toUpperCase().indexOf(phy.slice(0, 8)) < 0);
  var owner = a.OWN_NAME ? {
    name: String(a.OWN_NAME).trim(), mailAddr: mailLine,
    mailCity: String(a.OWN_CITY || '').trim(), mailState: String(a.OWN_STATE || '').trim(),
    mailZip: String(a.OWN_ZIPCD || '').trim().slice(0, 5), absentee: absentee, matchMode: matchMode
  } : null;
  return {
    status: owner ? 'ok' : 'no-owner', owner: owner, propType: flPropType(a.DOR_UC), useCode: a.DOR_UC,
    assessedValue: a.JV != null ? Number(a.JV) : null,
    livingArea: a.TOT_LVG_AR != null ? Number(a.TOT_LVG_AR) : null, yearBuilt: a.ACT_YR_BLT || null
  };
}

/* ---- FL owner lookup by PARCEL_ID (works where the county publishes the statewide STRAP) ---- */
async function ownerForFL(parcel) {
  var pid = String(parcel || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!pid) return { status: 'no-parcel' };
  var url = FL_BASE + '?where=' + encodeURIComponent("PARCEL_ID='" + pid + "'") +
    '&outFields=' + encodeURIComponent(CAD_FIELDS) + '&returnGeometry=false&f=json';
  try {
    var r = await fetch(url, { headers: { accept: 'application/json' } });
    var j = await r.json();
    var a = j && j.features && j.features[0] && j.features[0].attributes;
    if (!a) return { status: 'no-match' };
    return ownerFromAttrs(a, 'parcel');
  } catch (e) { return { status: 'error', error: String(e && e.message || e) }; }
}

/* ---- SPATIAL FALLBACK: geocode address -> point-in-parcel. For counties whose RealAuction
   parcel id != the statewide PARCEL_ID (Duval RE#, St.Lucie/Brevard/Marion account numbers, etc).
   Attribute queries on non-indexed fields TIME OUT on the 10.8M-row layer, but SPATIAL queries
   use the spatial index (fast) and are county-agnostic. Guarded by a house-number match so a
   near-miss geocode can never attach a NEIGHBOR's owner — we'd rather leave it un-enriched. ---- */
async function geocodeCensus(addr) {
  try {
    var u = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=' +
      encodeURIComponent(addr) + '&benchmark=Public_AR_Current&format=json';
    var j = await (await fetch(u, { headers: { accept: 'application/json' } })).json();
    var m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
    return m ? { lon: m.coordinates.x, lat: m.coordinates.y } : null;
  } catch (e) { return null; }
}
async function parcelAtPoint(lon, lat, dist) {
  try {
    var u = FL_BASE + '?geometry=' + lon + ',' + lat + '&geometryType=esriGeometryPoint&inSR=4326' +
      '&spatialRel=esriSpatialRelIntersects' + (dist ? '&distance=' + dist + '&units=esriSRUnit_Meter' : '') +
      '&outFields=' + encodeURIComponent(CAD_FIELDS) + '&returnGeometry=false&f=json';
    var j = await (await fetch(u, { headers: { accept: 'application/json' } })).json();
    return j && j.features && j.features[0] ? j.features[0].attributes : null;
  } catch (e) { return null; }
}
async function ownerBySpatialFL(deal) {
  var street = deal.street || deal.address || '';
  var want = houseNo(street);
  if (!street || /^0?\s*unknown/i.test(street) || !want) return { status: 'no-address' };
  var g = await geocodeCensus(street + ', ' + (deal.city || '') + ', FL');
  if (!g) return { status: 'geocode-miss' };
  // exact point-in-parcel: accept if house# matches (or the parcel carries no address to check)
  var a = await parcelAtPoint(g.lon, g.lat, 0);
  if (a && a.OWN_NAME && Number(a.JV) > 0) {
    var got = houseNo(a.PHY_ADDR1);
    if (!got || got === want) return ownerFromAttrs(a, 'spatial-exact');
  }
  // small buffer for a near-miss geocode: require a STRICT house# match (never grab a neighbor)
  a = await parcelAtPoint(g.lon, g.lat, 12);
  if (a && a.OWN_NAME && Number(a.JV) > 0 && houseNo(a.PHY_ADDR1) === want) return ownerFromAttrs(a, 'spatial-buffer');
  return { status: 'spatial-no-match' };
}

// Outcome source for the validation tracker: the cadastral carries the most-recent recorded
// sale (price/year/month) + just value. If a flagged parcel later shows a sale dated after we
// first saw it, it transacted — discount = sale price / just value. Free ground truth.
async function saleInfoFL(parcel) {
  var pid = String(parcel || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!pid) return null;
  var url = FL_BASE + '?where=' + encodeURIComponent("PARCEL_ID='" + pid + "'") +
    '&outFields=' + encodeURIComponent('JV,SALE_PRC1,SALE_YR1,SALE_MO1') + '&returnGeometry=false&f=json';
  try {
    var r = await fetch(url, { headers: { accept: 'application/json' } });
    var a = r && (await r.json()); a = a && a.features && a.features[0] && a.features[0].attributes;
    if (!a) return null;
    return { jv: a.JV != null ? Number(a.JV) : null, salePrice: a.SALE_PRC1 != null ? Number(a.SALE_PRC1) : null, saleYr: a.SALE_YR1 ? Number(a.SALE_YR1) : null, saleMo: a.SALE_MO1 ? Number(a.SALE_MO1) : null };
  } catch (e) { return null; }
}

/* ===== OHIO owner lookup (per-county auditor ArcGIS; NO statewide mailing feed) =====
   Ohio has no single free statewide cadastral with mailing+value like FL. Each county
   auditor publishes owner + mailing address on its own ArcGIS REST layer, with its OWN
   parcel-id format + field names. Config below verified live 2026-07-05 for the 8 biggest
   metros (most of the OH sheriff-sale volume). Smaller/unmapped counties fall back to the
   statewide ODNR landbase for owner NAME only (no mailing -> rankable by name signal but
   not yet mailable). Value already comes from the scrape (Appraised Value - Opening Bid),
   so this only needs to add owner + mailing + absentee. */
var OH_COUNTIES = {
  Cuyahoga:   { url: 'https://gis.cuyahogacounty.us/server/rest/services/MyPLACE/Parcels_WMA_GJOIN_WGS84/MapServer/2',
                pf: 'parcelpin', own: ['deeded_owner', 'parcel_owner'],
                struct: { street: 'mail_addr_street', unit: 'mail_unit', city: 'mail_city', state: 'mail_state', zip: 'mail_zip' }, val: 'certified_tax_total' },
  Franklin:   { url: 'https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/MapServer/0',
                pf: 'PARCELID', own: ['OWNERNME1'], st: ['PSTLADDRES'], csz: 'PSTLCITYSTZIP', val: 'TOTVALUEBASE' },
  Hamilton:   { url: 'https://services.arcgis.com/JyZag7oO4NteHGiq/arcgis/rest/services/Open_Data/FeatureServer/51',
                pf: 'PARCELID', own: ['OWNNM1'], st: ['MLADR1'], csz: 'MLADR2', val: 'MKT_TOTAL_VAL' },
  Summit:     { url: 'https://scgis.summitoh.net/hosted/rest/services/parcels_web_GEODATA_Tax_Parcels/MapServer/0',
                pf: 'parcelid', own: ['ownernme1'],
                struct: { street: 'pstladdress', city: 'pstlcity', state: 'pstlstate', zip: 'pstlzip5' }, val: 'cntmarval' },
  Stark:      { url: 'https://scgisa.starkcountyohio.gov/arcgis/rest/services/Auditor/StarkCountyParcels/MapServer/0',
                pf: 'PIN', own: ['OWNER'], st: ['OWNER_ADDRESS', 'OWNER_ADDR1'], val: 'APPRAISED_TOTAL_VALUE' },
  Montgomery: { url: 'https://gis.mcohio.org/server/rest/services/VantagePoints/AUDGIS_B1/MapServer/7',
                pf: 'PARID', own: ['SDE.WEB_CAMA.OWNER_NAME1'], st: ['SDE.WEB_CAMA.MAILING_ADDR1', 'SDE.WEB_CAMA.MAILING_ADDR2'], csz: 'SDE.WEB_CAMA.MAILING_ADDR3', val: 'SDE.WEB_CAMA.APPRTOTAL' },
  Butler:     { url: 'https://maps.butlercountyauditor.org/arcgis/rest/services/PARCELSEARCH/MapServer/0',
                pf: 'PIN', own: ['OWNER'], st: ['MAILADR1', 'MAILADR2'], csz: 'MAILADR3', val: 'MKTVAL24' },
  Lucas:      { url: 'https://lcaudgis.co.lucas.oh.us/gisaudserver/rest/services/TylerProduction/Auditor_GIS_Layers/MapServer/5',
                pf: 'PARID', own: ['OWNER'], st: ['MAILING_ADDRESS'], val: null }
};
var ODNR_PARCELS = 'https://gis.ohiodnr.gov/arcgis/rest/services/OIT_Services/odnr_landbase/MapServer/4/query';

function ohStr(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); }
function ohFirst(a, fields) { for (var i = 0; i < fields.length; i++) { var v = ohStr(a[fields[i]]); if (v) return v; } return ''; }
// pull "CITY ST ZIP" (or "CITY, ST ZIP") off the end of a mailing line
function parseCSZ(s) {
  var t = ohStr(s);
  var m = t.match(/([A-Za-z .'\-]+?)[, ]+([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/);
  if (m) return { city: m[1].trim(), state: m[2], zip: m[3] };
  var m2 = t.match(/\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/);
  if (m2) return { city: '', state: m2[1], zip: m2[2] };
  return { city: '', state: '', zip: '' };
}
// candidate parcel encodings across OH counties (Franklin needs dashes, Montgomery keeps spaces, etc)
function ohParcelCandidates(parcel) {
  var raw = ohStr(parcel), cands = {};
  if (raw) { cands[raw] = 1; cands[raw.toUpperCase()] = 1; }
  var digits = raw.replace(/[^0-9A-Za-z]/g, '');
  if (digits) { cands[digits] = 1; if (digits.length >= 6) cands[digits.slice(0, 3) + '-' + digits.slice(3)] = 1; }
  return Object.keys(cands).filter(Boolean);
}
function ohOwnerFromAttrs(a, cfg, deal, matchMode) {
  var name = ohFirst(a, cfg.own);
  if (!name) return { status: 'no-owner' };
  var street = '', city = '', state = '', zip = '';
  if (cfg.struct) {
    street = [a[cfg.struct.street], a[cfg.struct.unit]].map(ohStr).filter(Boolean).join(' ').trim();
    city = ohStr(a[cfg.struct.city]); state = ohStr(a[cfg.struct.state]); zip = ohStr(a[cfg.struct.zip]).slice(0, 5);
  } else {
    street = ohFirst(a, cfg.st);
    if (cfg.csz) { var csz = parseCSZ(a[cfg.csz]); city = csz.city; state = csz.state; zip = csz.zip; }
    else { var m = ohStr(street).match(/\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/); if (m) { state = m[1]; zip = m[2]; } }
    // peel any trailing STATE+ZIP off line1, then a trailing known city token — leaving a clean street
    street = ohStr(street).replace(/\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/, '').trim();
    if (city) street = street.replace(new RegExp('[,\\s]+' + city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'), '').trim();
  }
  var propHN = houseNo(deal && (deal.street || deal.address)), mailHN = houseNo(street);
  var absentee = !!(propHN && mailHN && propHN !== mailHN);
  var valRaw = cfg.val ? Number(ohStr(a[cfg.val]).replace(/[^0-9.]/g, '')) : NaN;
  return {
    status: 'ok',
    owner: { name: name, mailAddr: street, mailCity: city, mailState: state, mailZip: zip, absentee: absentee, matchMode: matchMode },
    assessedValue: (valRaw && valRaw > 0) ? valRaw : null
  };
}
async function ohCountyLookup(parcel, deal, cfg) {
  var cands = ohParcelCandidates(parcel);
  if (!cands.length) return { status: 'no-parcel' };
  var inList = cands.map(function (c) { return "'" + c.replace(/'/g, "''") + "'"; }).join(',');
  var url = cfg.url + '/query?where=' + encodeURIComponent(cfg.pf + ' IN (' + inList + ')') + '&outFields=*&returnGeometry=false&f=json';
  try {
    var j = await (await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) })).json();
    var a = j && j.features && j.features[0] && j.features[0].attributes;
    if (!a) return { status: 'no-match' };
    return ohOwnerFromAttrs(a, cfg, deal, 'oh-' + (deal.county || 'county').toLowerCase());
  } catch (e) { return { status: 'error', error: String(e && e.message || e) }; }
}
// statewide ODNR fallback: owner NAME only, keyed on PIN + COUNTY (title-case)
async function ownerNameOH(parcel, county) {
  var cands = ohParcelCandidates(parcel);
  if (!cands.length || !county) return { status: 'no-match' };
  var inList = cands.map(function (c) { return "'" + c.replace(/'/g, "''") + "'"; }).join(',');
  var where = 'PIN IN (' + inList + ") AND COUNTY='" + county.replace(/'/g, "''") + "'";
  var url = ODNR_PARCELS + '?where=' + encodeURIComponent(where) + '&outFields=OWNER1,OWNER2&returnGeometry=false&f=json';
  try {
    var j = await (await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) })).json();
    var a = j && j.features && j.features[0] && j.features[0].attributes;
    if (!a || !ohStr(a.OWNER1)) return { status: 'no-match' };
    var nm = ohStr(a.OWNER1) + (ohStr(a.OWNER2) ? ' ' + ohStr(a.OWNER2) : '');
    return { status: 'ok', owner: { name: nm, mailAddr: '', mailCity: '', mailState: '', mailZip: '', absentee: false, matchMode: 'oh-statewide-name' } };
  } catch (e) { return { status: 'error', error: String(e && e.message || e) }; }
}
async function ownerForOH(parcel, deal) {
  var county = deal && deal.county;
  var cfg = county && OH_COUNTIES[county];
  if (cfg) {
    var res = await ohCountyLookup(parcel, deal, cfg);
    if (res && res.owner) return res;
  }
  return await ownerNameOH(parcel, county); // name-only fallback for the ~31 smaller counties
}

// per-state owner enricher registry (FL cadastral + spatial; OH per-county auditor + ODNR fallback)
var ENRICHERS = { FL: ownerForFL, OH: ownerForOH };

/* ---- enrich one deal in place ---- */
async function enrichDeal(deal) {
  var st = (deal.state || 'FL').toUpperCase();
  var fn = ENRICHERS[st];
  var res = fn ? await fn(deal.parcel, deal) : { status: 'no-enricher' };
  // FL spatial fallback: county publishes a non-statewide parcel id -> resolve owner by location
  if (st === 'FL' && !res.owner) {
    var sp = await ownerBySpatialFL(deal);
    if (sp.owner) res = sp; else deal.spatialStatus = sp.status;
  }
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

/* ---- enrich a list (bounded concurrency; the spatial fallback's geocode step is slow, so a
   small pool keeps the daily cron reasonable without hammering the public services) ---- */
async function enrichDeals(deals, opts) {
  opts = opts || {};
  var conc = opts.concurrency || 5;
  var i = 0, hit = 0, done = 0;
  async function worker() {
    while (i < deals.length) {
      var idx = i++;
      await enrichDeal(deals[idx]);
      if (deals[idx].enrichStatus === 'ok') hit++;
      if (opts.log && (++done % 20 === 0)) process.stdout.write('.');
    }
  }
  var pool = [];
  for (var w = 0; w < conc; w++) pool.push(worker());
  await Promise.all(pool);
  if (opts.log) {
    var viaSpatial = deals.filter(function (d) { return d.owner && d.owner.matchMode && d.owner.matchMode.indexOf('spatial') === 0; }).length;
    process.stdout.write('\n  enriched owner for ' + hit + '/' + deals.length + ' (' + viaSpatial + ' via spatial fallback)\n');
  }
  return deals;
}

module.exports = {
  flPropType: flPropType, isResidential: isResidential, RESIDENTIAL: RESIDENTIAL,
  signalsFor: signalsFor, scoreDeal: scoreDeal, ownerForFL: ownerForFL, ownerForOH: ownerForOH,
  enrichDeal: enrichDeal, enrichDeals: enrichDeals, ENRICHERS: ENRICHERS,
  effEquityOf: effEquityOf, floorTier: floorTier, VALUE_FLOOR: VALUE_FLOOR,
  ownerBySpatialFL: ownerBySpatialFL, geocodeCensus: geocodeCensus, saleInfoFL: saleInfoFL
};
