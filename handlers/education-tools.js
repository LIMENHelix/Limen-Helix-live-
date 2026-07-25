/**
 * api/education-tools.js — Education Watch tool: DOES THIS DEGREE PAY FOR ITSELF?
 *
 *   GET /api/education-tools?tool=school&q=<school name>[&state=MO]
 *
 * Why this: everyone is told college is an investment and almost nobody is shown the return.
 * The Department of Education publishes, for every school, what its students actually borrow
 * and what they actually earn a decade later. Those two numbers next to each other answer the
 * question the brochure never does, and no assistant can recite them for a specific school.
 *
 * The number that gets buried hardest is the completion rate. A school where most students
 * never finish is one where most students take the debt WITHOUT the degree, and that is the
 * part the sticker price hides.
 *
 * Source: U.S. Department of Education, College Scorecard, via api.data.gov.
 * Requires DAT_GOV_API_KEY (the name set in Vercel). DATA_GOV_API_KEY is accepted as a
 * fallback so a spelling difference between the two cannot silently disable the tool.
 *
 * Not advice. Medians hide enormous spread: half of graduates earn less than the figure shown,
 * and field of study moves it far more than the school does.
 */
var T = require('../lib/tool-fetch');

var BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools';
var TTL = 24 * 3600 * 1000;

var FIELDS = [
  'id', 'school.name', 'school.city', 'school.state', 'school.ownership',
  'latest.cost.attendance.academic_year',
  'latest.aid.median_debt.completers.overall',
  'latest.earnings.10_yrs_after_entry.median',
  'latest.completion.completion_rate_4yr_150nt',
  'latest.completion.completion_rate_less_than_4yr_150nt',
  'latest.admissions.admission_rate.overall',
  'latest.student.size'
].join(',');

var OWNERSHIP = { 1: 'Public', 2: 'Private nonprofit', 3: 'Private FOR-PROFIT' };

function n(v) { var x = parseFloat(v); return isFinite(x) ? x : null; }

function apiKey() {
  return process.env.DAT_GOV_API_KEY || process.env.DATA_GOV_API_KEY || null;
}

function shape(r) {
  var debt = n(r['latest.aid.median_debt.completers.overall']);
  var earn = n(r['latest.earnings.10_yrs_after_entry.median']);
  var cost = n(r['latest.cost.attendance.academic_year']);
  // Scorecard splits completion by institution length; take whichever is populated.
  var comp = n(r['latest.completion.completion_rate_4yr_150nt']);
  if (comp == null) comp = n(r['latest.completion.completion_rate_less_than_4yr_150nt']);

  return {
    id: r.id || null,
    name: r['school.name'] || null,
    city: r['school.city'] || null,
    state: r['school.state'] || null,
    ownership: OWNERSHIP[r['school.ownership']] || null,
    forProfit: r['school.ownership'] === 3,
    size: n(r['latest.student.size']),
    annualCost: cost,
    medianDebt: debt,
    medianEarnings10yr: earn,
    completionRate: comp,
    admissionRate: n(r['latest.admissions.admission_rate.overall']),
    // The comparison the brochure never prints. Below ~1.0 the debt is generally serviceable;
    // above it, a graduate owes more than a full year of what they will be earning a decade on.
    debtToEarnings: (debt != null && earn) ? +(debt / earn).toFixed(2) : null,
    // What four years at sticker price costs against that same earnings figure.
    fourYearCost: cost != null ? cost * 4 : null,
    scorecardUrl: r.id ? 'https://collegescorecard.ed.gov/school/?' + r.id : 'https://collegescorecard.ed.gov/'
  };
}

async function searchSchool(qRaw, stateRaw) {
  var key = apiKey();
  if (!key) return { ok: false, reason: 'DAT_GOV_API_KEY is not set on this deployment, so College Scorecard cannot be read.' };
  var q = T.cleanQuery(qRaw, 70);
  if (q.length < 3) return { ok: false, reason: 'Enter at least three letters of the school name.' };
  var st = String(stateRaw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);

  return T.cachedQuery('education:tool:school:' + T.slugKey(q) + (st ? ':' + st : ''), TTL, async function () {
    var url = BASE + '?school.name=' + encodeURIComponent(q)
      + (st ? '&school.state=' + st : '')
      + '&fields=' + FIELDS + '&per_page=20&api_key=' + encodeURIComponent(key);
    var r = await T.getJSON(url, 14000);
    if (r.status === 429) return { ok: false, reason: 'The Department of Education API rate limit was hit. Try again shortly.' };
    if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
      return { ok: false, reason: 'College Scorecard returned ' + (r.status || 'no response') + '.' };
    }
    var rows = r.body.results.map(shape).filter(function (x) { return x.name; });
    // schools with actual outcome data first; a row with no earnings answers nothing
    rows.sort(function (a, b) {
      var ax = (a.medianEarnings10yr != null ? 1 : 0), bx = (b.medianEarnings10yr != null ? 1 : 0);
      return (bx - ax) || ((b.size || 0) - (a.size || 0));
    });
    return {
      ok: true, query: q, state: st || null,
      found: (r.body.metadata && r.body.metadata.total) || rows.length,
      rows: rows,
      source: 'U.S. Department of Education, College Scorecard',
      sourceUrl: 'https://collegescorecard.ed.gov/',
      note: 'Earnings are the median 10 years after a student first enrolled, counting only those who received federal aid. Debt is the median owed by students who COMPLETED. Half of graduates earn less than the figure shown, and the field of study moves earnings far more than the school does.',
      warning: 'Completion rate is the number to read first. Where it is low, most students take on the debt and never receive the degree, and the debt is not dischargeable in bankruptcy.'
    };
  });
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'school' && q.q) return T.send(res, await searchSchool(q.q, q.state));
    return T.send(res, {
      ok: true, mode: 'idle', keyed: !!apiKey(),
      source: 'U.S. Department of Education, College Scorecard',
      sourceUrl: 'https://collegescorecard.ed.gov/',
      note: 'Search any US college to see what its students borrow, what they earn a decade later, and how many of them finish at all.'
    });
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
