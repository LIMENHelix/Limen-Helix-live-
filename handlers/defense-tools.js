/**
 * api/defense-tools.js — Defense Watch tool: WHAT THE PENTAGON JUST BOUGHT.
 *
 *   GET /api/defense-tools            → the largest DoD contract awards of the current FY
 *   GET /api/defense-tools?tool=who   → the companies collecting the most DoD money
 *
 * Why this: threat-level commentary is opinion an assistant can generate endlessly. The
 * contract file is the opposite: named companies, exact dollars, and what the money bought,
 * published by Treasury. It is the closest thing to a receipt for the defence budget.
 *
 * Source: USAspending.gov API, keyless POST search.
 *
 * HONESTY, and this one matters a lot: "Award Amount" on a contract vehicle is its TOTAL
 * POTENTIAL VALUE over all option years, NOT money already spent. A $51B award is a ceiling
 * the government may draw against for a decade, not a cheque that cleared. Reporting these as
 * spending would be flatly wrong, so the payload and the card both say so.
 */
var T = require('../lib/tool-fetch');

var URL_AWARD = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
var URL_CAT = 'https://api.usaspending.gov/api/v2/search/spending_by_category/recipient/';
var TTL = 12 * 3600 * 1000;

function fyStart() {
  var now = new Date();
  var y = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return y + '-10-01';
}
function todayIso() { return new Date().toISOString().slice(0, 10); }

function dodFilters() {
  return {
    time_period: [{ start_date: fyStart(), end_date: todayIso() }],
    award_type_codes: ['A', 'B', 'C', 'D'],
    agencies: [{ type: 'awarding', tier: 'toptier', name: 'Department of Defense' }]
  };
}

async function topAwards() {
  var r = await T.postJSON(URL_AWARD, {
    filters: dodFilters(),
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Awarding Sub Agency', 'Start Date'],
    limit: 20, sort: 'Award Amount', order: 'desc', subawards: false
  }, 18000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
    return { ok: false, reason: 'USAspending returned ' + (r.status || 'no response') + ' for DoD awards.' };
  }
  var rows = r.body.results.map(function (x) {
    return {
      recipient: x['Recipient Name'] || null,
      amount: x['Award Amount'] || null,
      description: (x['Description'] || '').slice(0, 220) || null,
      branch: x['Awarding Sub Agency'] || null,
      started: x['Start Date'] || null,
      awardId: x['Award ID'] || null,
      url: x.generated_internal_id ? 'https://www.usaspending.gov/award/' + encodeURIComponent(x.generated_internal_id) : 'https://www.usaspending.gov/search'
    };
  }).filter(function (x) { return x.recipient && x.amount; });
  if (!rows.length) return { ok: false, reason: 'USAspending returned no DoD awards for this fiscal year.' };
  return {
    ok: true, rows: rows, fyStart: fyStart(), asOf: todayIso(),
    source: 'USAspending.gov (U.S. Treasury)',
    sourceUrl: 'https://www.usaspending.gov/search',
    note: 'These are the largest Department of Defense contract awards of the current fiscal year, ranked by total award value.',
    caveat: 'Award value is the contract CEILING across all option years, not money already paid. A multi-billion figure is what the government may draw against over the life of the deal, often a decade. It is not this year\'s spending.'
  };
}

async function topRecipients() {
  var r = await T.postJSON(URL_CAT, { filters: dodFilters(), category: 'recipient', limit: 20 }, 18000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
    return { ok: false, reason: 'USAspending returned ' + (r.status || 'no response') + ' for DoD recipients.' };
  }
  var byName = {};
  r.body.results.forEach(function (x) {
    var nm = String(x.name || 'Unnamed').trim();
    if (!byName[nm]) byName[nm] = { name: nm, amount: 0 };
    byName[nm].amount += (x.amount || 0);
  });
  var rows = Object.keys(byName).map(function (k) { return byName[k]; })
    .sort(function (a, b) { return b.amount - a.amount; }).slice(0, 15);
  if (!rows.length) return { ok: false, reason: 'USAspending returned no DoD recipients.' };
  return {
    ok: true, rows: rows, fyStart: fyStart(), asOf: todayIso(),
    source: 'USAspending.gov (U.S. Treasury)',
    sourceUrl: 'https://www.usaspending.gov/search',
    note: 'Companies ranked by Department of Defense contract dollars obligated this fiscal year.'
  };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'who') return T.send(res, await T.cached('defense:tool:who:v1', TTL, topRecipients));
    return T.send(res, await T.cached('defense:tool:awards:v1', TTL, topAwards));
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
