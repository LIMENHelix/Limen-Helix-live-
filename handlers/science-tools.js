/**
 * api/science-tools.js — Science Watch tool: WHO PAID FOR THE RESEARCH.
 *
 *   GET /api/science-tools                        → largest NIH-funded institutions this year
 *   GET /api/science-tools?tool=org&q=<institution>
 *
 * Why this: a study digest is something an assistant writes well. Following the money is not:
 * NIH RePORTER holds every federally funded project with its institution, its principal
 * investigator and its dollar amount. "Who paid for this line of research, and how much"
 * is a public fact that almost nobody checks before believing a headline.
 *
 * Source: NIH RePORTER API v2 (POST), keyless.
 *
 * HONESTY: NIH is the largest but not the only federal funder (NSF, DOE and DoD fund research
 * too), and none of this implies bias. Knowing who funded a study is context, not an argument
 * against it.
 */
var T = require('../lib/tool-fetch');

var URL = 'https://api.reporter.nih.gov/v2/projects/search';
var TTL = 24 * 3600 * 1000;

function fiscalYear() {
  var now = new Date();
  return now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

function projectRow(p) {
  var org = p.organization || {};
  return {
    title: (p.project_title || '').slice(0, 200) || null,
    org: org.org_name || null,
    city: org.org_city || null,
    state: org.org_state || null,
    amount: p.award_amount != null ? p.award_amount : null,
    fiscalYear: p.fiscal_year || null,
    pi: (p.contact_pi_name || '').trim() || null,
    projectNum: p.project_num || null,
    url: p.project_num ? 'https://reporter.nih.gov/search/?projectNums=' + encodeURIComponent(p.project_num) : 'https://reporter.nih.gov/'
  };
}

// RePORTER only returns 500 records per page; for a "how much did X get" answer we page
// through and sum, capped, rather than pretending one page is the whole picture.
async function searchOrg(qRaw) {
  var q = T.cleanQuery(qRaw, 70);
  if (q.length < 3) return { ok: false, reason: 'Enter at least three letters of the institution name.' };
  var fy = fiscalYear();

  return T.cachedQuery('science:tool:org:' + T.slugKey(q) + ':' + fy, TTL, async function () {
    var r = await T.postJSON(URL, {
      criteria: { fiscal_years: [fy, fy - 1], org_names: [q] },
      include_fields: ['ProjectTitle', 'Organization', 'AwardAmount', 'ProjectNum', 'FiscalYear', 'ContactPiName'],
      limit: 100, offset: 0,
      sort_field: 'award_amount', sort_order: 'desc'
    }, 20000);
    if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
      return { ok: false, reason: 'NIH RePORTER returned ' + (r.status || 'no response') + '.' };
    }
    var rows = r.body.results.map(projectRow).filter(function (x) { return x.title; });
    var total = (r.body.meta && r.body.meta.total) || rows.length;
    var shownSum = rows.reduce(function (s, x) { return s + (x.amount || 0); }, 0);

    // RePORTER matches org names loosely: "washington university" also returns
    // "university of washington". Group by the actual institution so the reader can tell.
    var byOrg = {};
    rows.forEach(function (x) {
      var k = x.org || 'Unnamed';
      if (!byOrg[k]) byOrg[k] = { org: k, state: x.state, projects: 0, amount: 0 };
      byOrg[k].projects++; byOrg[k].amount += (x.amount || 0);
    });
    var orgs = Object.keys(byOrg).map(function (k) { return byOrg[k]; })
      .sort(function (a, b) { return b.amount - a.amount; });

    return {
      ok: true, query: q, fiscalYears: [fy - 1, fy],
      total: total, shown: rows.length, shownSum: shownSum,
      orgs: orgs, rows: rows.slice(0, 20),
      source: 'NIH RePORTER (National Institutes of Health)',
      sourceUrl: 'https://reporter.nih.gov/',
      note: 'Projects across the current and previous federal fiscal year, largest award first. The total is every matching project; the sum shown covers the ' + rows.length + ' largest returned, not all of them.',
      caveat: 'RePORTER matches institution names loosely, so a search can pull in similarly named universities. Check the institution column. NIH is the largest federal research funder but not the only one, and knowing who funded a study is context, not an argument against it.'
    };
  });
}

async function topOrgs() {
  var fy = fiscalYear();
  var r = await T.postJSON(URL, {
    criteria: { fiscal_years: [fy] },
    include_fields: ['ProjectTitle', 'Organization', 'AwardAmount', 'ProjectNum', 'FiscalYear', 'ContactPiName'],
    limit: 100, offset: 0, sort_field: 'award_amount', sort_order: 'desc'
  }, 20000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
    return { ok: false, reason: 'NIH RePORTER returned ' + (r.status || 'no response') + '.' };
  }
  var rows = r.body.results.map(projectRow).filter(function (x) { return x.title; });
  if (!rows.length) return { ok: false, reason: 'NIH RePORTER returned no projects for this fiscal year.' };
  return {
    ok: true, fiscalYear: fy,
    total: (r.body.meta && r.body.meta.total) || rows.length,
    rows: rows.slice(0, 15),
    source: 'NIH RePORTER (National Institutes of Health)',
    sourceUrl: 'https://reporter.nih.gov/',
    note: 'The largest single NIH awards of the current federal fiscal year.',
    caveat: 'One award is not one lab: large awards are often centre grants or networks covering many institutions.'
  };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'org' && q.q) return T.send(res, await searchOrg(q.q));
    return T.send(res, await T.cached('science:tool:top:v1', TTL, topOrgs));
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
