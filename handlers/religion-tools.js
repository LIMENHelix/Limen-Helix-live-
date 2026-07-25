/**
 * api/religion-tools.js — Faith & Community Watch tool: WHERE THE MONEY ACTUALLY GOES.
 *
 *   GET /api/religion-tools?tool=org&q=<congregation or charity name>[&state=MO]
 *   GET /api/religion-tools?tool=detail&ein=<ein>
 *
 * Why this: an assistant can describe what a 501(c)(3) is. It cannot tell you what a specific
 * congregation, relief agency or faith-based charity reported on its last Form 990 — revenue,
 * spending, and what it holds. That is a public filing almost nobody reads, and it is the one
 * thing worth knowing before giving.
 *
 * Source: ProPublica Nonprofit Explorer API (IRS Form 990 data), keyless.
 * Note on a real limitation: churches are NOT required to file a Form 990. A congregation with
 * no filings is normal and is not a red flag. The tool says so rather than implying otherwise.
 */
var T = require('../lib/tool-fetch');

var BASE = 'https://projects.propublica.org/nonprofits/api/v2';
var TTL = 24 * 3600 * 1000;

// The NTEE letter is the IRS's own activity classification. Only the ones a faith/community
// user is likely to hit are spelled out; anything else falls back to the raw code.
var NTEE = {
  A: 'Arts, culture and humanities', B: 'Education', C: 'Environment', D: 'Animals',
  E: 'Health care', F: 'Mental health and crisis intervention', G: 'Disease and disorders',
  H: 'Medical research', I: 'Crime and legal', J: 'Employment', K: 'Food and agriculture',
  L: 'Housing and shelter', M: 'Public safety and disaster relief', N: 'Recreation and sports',
  O: 'Youth development', P: 'Human services', Q: 'International and foreign affairs',
  R: 'Civil rights and advocacy', S: 'Community improvement', T: 'Philanthropy and grantmaking',
  U: 'Science and technology', V: 'Social science', W: 'Public and societal benefit',
  X: 'Religion related', Y: 'Mutual benefit', Z: 'Unknown'
};
function nteePlain(code) {
  var c = String(code || '').trim().charAt(0).toUpperCase();
  return NTEE[c] || null;
}
function usd(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }

async function searchOrg(qRaw, stateRaw) {
  var q = T.cleanQuery(qRaw, 70);
  if (q.length < 3) return { ok: false, reason: 'Enter at least three letters of the organisation name.' };
  var st = String(stateRaw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  var key = 'religion:tool:org:' + T.slugKey(q) + (st ? ':' + st : '');

  return T.cachedQuery(key, TTL, async function () {
    var url = BASE + '/search.json?q=' + encodeURIComponent(q) + (st ? '&state%5Bid%5D=' + st : '');
    var r = await T.getJSON(url, 12000);
    if (r.status !== 200 || !r.body || !Array.isArray(r.body.organizations)) {
      return { ok: false, reason: 'The nonprofit database returned ' + (r.status || 'no response') + '.' };
    }
    var rows = r.body.organizations.slice(0, 20).map(function (o) {
      return {
        ein: o.ein || null,
        einFormatted: o.strein || null,
        name: o.name || null,
        city: o.city || null,
        state: o.state || null,
        category: nteePlain(o.ntee_code),
        nteeCode: o.ntee_code || null,
        hasFilings: !!o.have_filings
      };
    });
    return {
      ok: true, query: q, state: st || null,
      found: r.body.total_results != null ? r.body.total_results : rows.length,
      rows: rows,
      source: 'ProPublica Nonprofit Explorer, from IRS Form 990 filings',
      sourceUrl: 'https://projects.propublica.org/nonprofits/',
      note: 'Churches, their integrated auxiliaries and conventions of churches are NOT required to file a Form 990. A congregation showing no filings is completely normal and is not a warning sign.'
    };
  });
}

async function orgDetail(einRaw) {
  var ein = String(einRaw || '').replace(/\D/g, '').slice(0, 9);
  if (ein.length < 7) return { ok: false, reason: 'That EIN does not look right.' };
  return T.cached('religion:tool:detail:' + ein, TTL, async function () {
    var r = await T.getJSON(BASE + '/organizations/' + ein + '.json', 12000);
    if (r.status === 404) return { ok: false, reason: 'No organisation found for EIN ' + ein + '.' };
    if (r.status !== 200 || !r.body || !r.body.organization) {
      return { ok: false, reason: 'The nonprofit database returned ' + (r.status || 'no response') + '.' };
    }
    var o = r.body.organization;
    var filings = (r.body.filings_with_data || []).slice(0, 5).map(function (f) {
      var rev = usd(f.totrevenue), exp = usd(f.totfuncexpns);
      return {
        year: f.tax_prd_yr || null,
        revenue: rev,
        expenses: exp,
        assets: usd(f.totassetsend),
        // the number people actually want: did it spend more than it took in
        surplus: (rev != null && exp != null) ? rev - exp : null,
        pdfUrl: f.pdf_url || null
      };
    });
    return {
      ok: true,
      ein: ein,
      name: o.name || null,
      city: o.city || null, state: o.state || null,
      category: nteePlain(o.ntee_code), nteeCode: o.ntee_code || null,
      filings: filings,
      filingsWithoutData: (r.body.filings_without_data || []).length,
      profileUrl: 'https://projects.propublica.org/nonprofits/organizations/' + ein,
      source: 'ProPublica Nonprofit Explorer, from IRS Form 990 filings',
      sourceUrl: 'https://projects.propublica.org/nonprofits/',
      note: filings.length
        ? 'Figures are as the organisation reported them to the IRS. A single year can look alarming for ordinary reasons (a building purchase, a bequest); the trend across years is the more honest read.'
        : 'This organisation has no Form 990 with extractable data. For a church that is expected, since churches are exempt from the filing requirement.'
    };
  });
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'detail' && q.ein) return T.send(res, await orgDetail(q.ein));
    if (q.tool === 'org' && q.q) return T.send(res, await searchOrg(q.q, q.state));
    return T.send(res, {
      ok: true, mode: 'idle',
      source: 'ProPublica Nonprofit Explorer, from IRS Form 990 filings',
      sourceUrl: 'https://projects.propublica.org/nonprofits/',
      note: 'Search any congregation, relief agency or faith-based charity by name to see what it reported to the IRS.'
    });
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
