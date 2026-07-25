/**
 * api/governance-tools.js — Governance Watch tool: WHO COLLECTED THE MONEY IN YOUR STATE.
 *
 *   GET /api/governance-tools                 → top federal contractors nationwide
 *   GET /api/governance-tools?tool=state&st=MO → who collected federal contract money in that state
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

var URL_CAT = 'https://api.usaspending.gov/api/v2/search/spending_by_category/recipient/';
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

async function query(filters, label) {
  var r = await T.postJSON(URL_CAT, { filters: filters, category: 'recipient', limit: 20 }, 18000);
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
  return T.cached('governance:tool:state:' + st, TTL, async function () {
    var f = baseFilters();
    f.place_of_performance_locations = [{ country: 'USA', state: st }];
    var out = await query(f, st);
    if (out.ok) out.state = st;
    return out;
  });
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'state' && q.st) return T.send(res, await byState(q.st));
    var out = await T.cached('governance:tool:national:v1', TTL, nationwide);
    out.states = STATES;
    return T.send(res, out);
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
