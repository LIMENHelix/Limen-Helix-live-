/**
 * api/finance-tools.js — Finance Watch tool: BANK HEALTH CHECK.
 *
 *   GET /api/finance-tools?tool=bank&q=<bank name>[&state=MO]
 *   GET /api/finance-tools?tool=bank                      → the largest US banks, for context
 *
 * Why this and not "a rate tracker": rates are one number an assistant can recite. What no
 * assistant can tell you is what YOUR bank's last call report said. This reads FDIC BankFind,
 * the quarterly regulatory filing every insured US bank must make, and puts the four numbers
 * that actually describe a bank next to each other.
 *
 * Source: FDIC BankFind API (banks.data.fdic.gov), keyless.
 * NOT a safety rating. FDIC insurance, not a bank's ratios, is what protects a depositor.
 */
var T = require('../lib/tool-fetch');

var FIELDS = 'NAME,CITY,STALP,ASSET,DEP,EQ,ROA,ROE,OFFDOM,ACTIVE,ESTYMD,CERT,BKCLASS,REPDTE';
var BASE = 'https://banks.data.fdic.gov/api/institutions';
var TTL_Q = 12 * 3600 * 1000;
var TTL_TOP = 24 * 3600 * 1000;

var CLASS_PLAIN = {
  N:  'National bank, regulated by the OCC',
  SM: 'State bank, member of the Federal Reserve',
  NM: 'State bank, not a Fed member, regulated by the FDIC',
  SB: 'Savings bank',
  SA: 'Savings association',
  OI: 'Insured US branch of a foreign bank'
};

function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }

// FDIC reports ASSET / DEP / EQ in THOUSANDS of dollars. Getting this wrong understates a
// bank by 1000x, so the conversion happens once, here, and the unit is carried in the payload.
function row(d) {
  var asset = num(d.ASSET), eq = num(d.EQ), dep = num(d.DEP);
  return {
    name: d.NAME || null,
    city: d.CITY || null,
    state: d.STALP || null,
    cert: d.CERT || null,
    active: d.ACTIVE === 1 || d.ACTIVE === '1',
    className: d.BKCLASS || null,
    classPlain: CLASS_PLAIN[d.BKCLASS] || null,
    established: d.ESTYMD || null,
    asOf: d.REPDTE || null,
    branches: num(d.OFFDOM),
    assetsUsd: asset != null ? asset * 1000 : null,
    depositsUsd: dep != null ? dep * 1000 : null,
    equityUsd: eq != null ? eq * 1000 : null,
    roa: num(d.ROA),
    roe: num(d.ROE),
    // equity / assets: the cushion between losses and depositors. Regulators use risk-weighted
    // ratios with a different denominator, so this is the plain leverage view, not a CET1 figure.
    equityToAssets: (eq != null && asset) ? +((eq / asset) * 100).toFixed(2) : null
  };
}

function readBody(r) {
  if (!r.body) return null;
  // BankFind returns { data: [ { data: {...} } ], meta: {...} }
  if (Array.isArray(r.body.data)) return r.body.data.map(function (x) { return x.data || x; });
  return null;
}

async function topBanks() {
  var url = BASE + '?filters=' + encodeURIComponent('ACTIVE:1') + '&fields=' + FIELDS
    + '&sort_by=ASSET&sort_order=DESC&limit=10&format=json';
  var r = await T.getJSON(url, 12000);
  var rows = readBody(r);
  if (r.status !== 200 || !rows) return { ok: false, reason: 'FDIC returned ' + (r.status || 'no response') + '.' };
  return {
    ok: true, mode: 'top', rows: rows.map(row),
    source: 'FDIC BankFind — quarterly Call Report data',
    sourceUrl: 'https://banks.data.fdic.gov/bankfind-suite/bankfind',
    note: 'Figures come from the bank\'s most recent quarterly Call Report, so they lag by up to three months. This is regulatory financial data, NOT a safety rating and NOT advice. What protects your money is FDIC insurance, which covers $250,000 per depositor, per bank, per ownership category.'
  };
}

async function searchBank(qRaw, stateRaw) {
  var q = T.cleanQuery(qRaw, 60);
  if (q.length < 3) return { ok: false, reason: 'Enter at least three letters of the bank name.' };
  var st = String(stateRaw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  var key = 'finance:tool:bank:' + T.slugKey(q) + (st ? ':' + st : '');

  return T.cachedQuery(key, TTL_Q, async function () {
    // ACTIVE:1 matters: BankFind carries every institution that ever existed, so an unfiltered
    // search puts long-dead banks (First Union, 1990s) above the one the user actually typed.
    var filters = 'ACTIVE:1' + (st ? ' AND STALP:' + st : '');
    var url = BASE + '?search=' + encodeURIComponent('NAME:"' + q + '"')
      + '&filters=' + encodeURIComponent(filters)
      + '&fields=' + FIELDS + '&limit=40&format=json';
    var r = await T.getJSON(url, 12000);
    var rows = readBody(r);
    if (r.status !== 200 || !rows) return { ok: false, reason: 'FDIC returned ' + (r.status || 'no response') + ' for that search.' };

    // FDIC's own relevance is loose (searching "Commerce Bank" surfaces banks in a town called
    // Commerce), and sorting purely by size buries the match under whoever is biggest. Rank by
    // how well the NAME matches first, and only use size to break ties.
    var ql = q.toLowerCase();
    var mapped = rows.map(row).map(function (b) {
      var n = String(b.name || '').toLowerCase();
      b._score = n === ql ? 3 : n.indexOf(ql) === 0 ? 2 : n.indexOf(ql) !== -1 ? 1 : 0;
      return b;
    });
    mapped.sort(function (a, b) { return (b._score - a._score) || ((b.assetsUsd || 0) - (a.assetsUsd || 0)); });
    mapped.forEach(function (b) { delete b._score; });

    return {
      ok: true, mode: 'search', query: q, state: st || null,
      found: (r.body.meta && r.body.meta.total) || mapped.length,
      rows: mapped.slice(0, 25),
      source: 'FDIC BankFind — quarterly Call Report data',
      sourceUrl: 'https://banks.data.fdic.gov/bankfind-suite/bankfind',
      note: 'Many banks share a name across states; check the city. Figures are from the most recent quarterly Call Report and lag by up to three months. Regulatory data, not a safety rating and not advice.'
    };
  });
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'bank' && q.q) return T.send(res, await searchBank(q.q, q.state));
    return T.send(res, await T.cached('finance:tool:topbanks:v1', TTL_TOP, topBanks));
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
