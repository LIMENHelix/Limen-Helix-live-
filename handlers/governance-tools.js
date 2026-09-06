/**
 * api/governance-tools.js — Governance Watch tool: WHO COLLECTED THE MONEY IN YOUR STATE.
 *
 *   GET /api/governance-tools                 → top federal contractors nationwide
 *   GET /api/governance-tools?tool=state&st=MO → who collected federal contract money in that state
 *   GET /api/governance-tools?tool=entity&q=  → recipient name as published
 *   GET /api/governance-tools?tool=uei&id=    → 12-character UEI
 *   GET /api/governance-tools?tool=naics&code= → 2-to-6 digit NAICS
 *   GET /api/governance-tools?tool=meter      → World Bank WGI (US)
 *
 * Why this: "how a bill becomes law" is civics an assistant already recites. What it cannot
 * tell you is which companies collected federal contract dollars in YOUR state this fiscal
 * year and how much. That is published, specific, and almost nobody looks.
 *
 * Source: USAspending.gov API (Treasury/OMB), keyless POST search.
 *
 * HONESTY: these are CONTRACT award amounts for the current fiscal year to date, which is
 * only one channel of federal spending. Grants, direct payments (Social Security, Medicare)
 * and loans are far larger in most states and are NOT counted here.
 */
var T = require('../lib/tool-fetch');
var PT = require('../lib/procurement-text');

var URL_CAT = 'https://api.usaspending.gov/api/v2/search/spending_by_category/recipient/';
var URL_AWARD = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
var TTL = 12 * 3600 * 1000;

var STATES = ('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND '
  + 'OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC').split(' ');

// Federal fiscal year starts 1 October.
function fyStart() {
  var now = new Date();
  var y = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return y + '-10-01';
}
function todayIso() { return new Date().toISOString().slice(0, 10); }

function baseFilters() {
  return {
    time_period: [{ start_date: fyStart(), end_date: todayIso() }],
    award_type_codes: ['A', 'B', 'C', 'D']   // contracts only
  };
}


// A ranked list of who collected the most is a leaderboard, not information. The question a
// reader has is what the money BOUGHT. spending_by_category returns names and totals only, so
// pull the individual awards too and carry their descriptions.
//
// Descriptions arrive as procurement shorthand and some are pure classification codes
// ("IGF::OT::IGF") that mean nothing to a reader. Those are reported as not stated rather than
// dressed up as an answer.

async function topAwards(filters) {
  var r = await T.postJSON(URL_AWARD, {
    filters: Object.assign({ award_type_codes: ['A', 'B', 'C', 'D'] }, filters),
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Awarding Agency', 'Start Date'],
    sort: 'Award Amount', order: 'desc', limit: 15
  }, 18000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) return [];
  return r.body.results.map(function (x) {
    return {
      recipient: x['Recipient Name'] || null,
      amount: Number(x['Award Amount']) || 0,
      bought: PT.plainDescription(x['Description']),
      agency: x['Awarding Agency'] || null,
      started: x['Start Date'] || null,
      awardId: x['Award ID'] || null
    };
  }).filter(function (x) { return x.recipient && x.amount; });
}

async function query(filters, label) {
  // both reads in parallel: who collected it, and what it bought
  var both = await Promise.all([
    T.postJSON(URL_CAT, { filters: filters, category: 'recipient', limit: 20 }, 18000),
    topAwards(filters).catch(function () { return []; })
  ]);
  var r = both[0];
  var awards = both[1];
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
    return { ok: false, reason: 'USAspending returned ' + (r.status || 'no response') + '.' };
  }
  // The API can return the same recipient more than once (different internal ids); fold them
  // together so a company is not shown twice with split totals.
  var byName = {};
  r.body.results.forEach(function (x) {
    var nm = String(x.name || 'Unnamed').trim();
    if (!byName[nm]) byName[nm] = { name: nm, amount: 0 };
    byName[nm].amount += (x.amount || 0);
  });
  var rows = Object.keys(byName).map(function (k) { return byName[k]; })
    .sort(function (a, b) { return b.amount - a.amount; }).slice(0, 15);
  if (!rows.length) return { ok: false, reason: 'USAspending returned no contract recipients for ' + label + '.' };
  var total = rows.reduce(function (s, x) { return s + x.amount; }, 0);
  return {
    ok: true, scope: label, rows: rows, shownTotal: total,
    // what the largest awards actually paid for
    awards: awards,
    describedAwards: awards.filter(function (a) { return a.bought; }).length,
    undescribedAwards: awards.filter(function (a) { return !a.bought; }).length,
    fyStart: fyStart(), asOf: todayIso(),
    source: 'USAspending.gov (U.S. Treasury)',
    sourceUrl: 'https://www.usaspending.gov/search',
    note: 'Federal CONTRACT awards for the current fiscal year to date, by the company that collected them. Contracts are only one channel: grants, direct payments such as Social Security and Medicare, and loans are larger in most states and are not counted here.'
  };
}

async function nationwide() { return query(baseFilters(), 'the United States'); }

async function byState(stRaw) {
  var st = String(stRaw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (STATES.indexOf(st) === -1) return { ok: false, reason: 'Pick a valid two-letter US state code.' };
  return T.cached('governance:tool:state:v2:' + st, TTL, async function () {
    var f = baseFilters();
    f.place_of_performance_locations = [{ country: 'USA', state: st }];
    var out = await query(f, st);
    if (out.ok) out.state = st;
    return out;
  });
}

function entityNote(out) {
  if (out && out.ok) {
    out.note = (out.note || '') + ' Names and UEIs are shown as USAspending published them. Two similar names are not treated as the same company.';
    out.resolution = 'as-published';
  }
  return out;
}

async function byEntity(qRaw) {
  var q = T.cleanQuery(qRaw, 80);
  if (q.length < 3) return { ok: false, reason: 'Enter at least three letters of the entity name.' };
  return T.cachedQuery('governance:tool:entity:v1:' + T.slugKey(q), TTL, async function () {
    var f = baseFilters();
    f.recipient_search_text = [q];
    var out = await query(f, q);
    if (out.ok) out.query = q;
    return entityNote(out);
  });
}

async function byUei(ueiRaw) {
  var uei = String(ueiRaw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (uei.length !== 12) return { ok: false, reason: 'A UEI is twelve letters and numbers.' };
  return T.cachedQuery('governance:tool:uei:v1:' + uei, TTL, async function () {
    var f = baseFilters();
    f.recipient_unique_ids = [uei];
    var out = await query(f, 'UEI ' + uei);
    if (out.ok) out.uei = uei;
    return entityNote(out);
  });
}

async function byNaics(codeRaw) {
  var code = String(codeRaw || '').replace(/\D/g, '').slice(0, 6);
  if (code.length < 2) return { ok: false, reason: 'Enter a 2-to-6 digit NAICS code.' };
  return T.cachedQuery('governance:tool:naics:v1:' + code, TTL, async function () {
    var f = baseFilters();
    f.naics_codes = [code];
    var out = await query(f, 'NAICS ' + code);
    if (out.ok) out.naics = code;
    return entityNote(out);
  });
}

var WGI = [
  { id: 'CC.EST', label: 'Control of Corruption' },
  { id: 'RL.EST', label: 'Rule of Law' },
  { id: 'RQ.EST', label: 'Regulatory Quality' },
  { id: 'PV.EST', label: 'Political Stability' },
  { id: 'VA.EST', label: 'Voice & Accountability' },
  { id: 'GE.EST', label: 'Government Effectiveness' }
];

function wbLatest(body) {
  if (!Array.isArray(body) || !Array.isArray(body[1]) || !body[1][0]) return null;
  var row = body[1][0];
  if (row.value == null || !isFinite(Number(row.value))) return null;
  return {
    value: Number(row.value),
    date: row.date || null,
    lastUpdated: body[0] && body[0].lastupdated || null
  };
}

async function wgiMeter() {
  var rows = [];
  for (var i = 0; i < WGI.length; i++) {
    var url = 'https://api.worldbank.org/v2/country/USA/indicator/' + WGI[i].id
      + '?format=json&mrnev=1';
    var r = await T.getJSON(url, 10000);
    var latest = (r.status === 200) ? wbLatest(r.body) : null;
    rows.push({
      id: WGI[i].id,
      label: WGI[i].label,
      value: latest ? latest.value : null,
      date: latest ? latest.date : null,
      lastUpdated: latest ? latest.lastUpdated : null
    });
  }
  var ok = rows.some(function (x) { return x.value != null; });
  if (!ok) return { ok: false, reason: 'World Bank WGI did not return a usable US reading.' };
  return {
    ok: true,
    country: 'United States',
    rows: rows,
    source: 'World Bank Worldwide Governance Indicators',
    sourceUrl: 'https://www.worldbank.org/en/publication/worldwide-governance-indicators',
    note: 'Estimate scores, roughly -2.5 to +2.5. Annual. Non-partisan institutional-quality readings, not a ranking of parties or candidates.',
    asOf: rows.filter(function (x) { return x.date; }).map(function (x) { return x.date; }).sort().slice(-1)[0] || null
  };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'meter') return T.send(res, await T.cached('governance:tool:wgi:v1', 24 * 3600 * 1000, wgiMeter));
    if (q.tool === 'entity' && q.q) return T.send(res, await byEntity(q.q));
    if (q.tool === 'uei' && q.id) return T.send(res, await byUei(q.id));
    if (q.tool === 'naics' && q.code) return T.send(res, await byNaics(q.code));
    if (q.tool === 'state' && q.st) return T.send(res, await byState(q.st));
    var out = await T.cached('governance:tool:national:v2', TTL, nationwide);
    out.states = STATES;
    return T.send(res, out);
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
