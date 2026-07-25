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

// Candidate data years, newest first. Scorecard's "latest" alias silently points at an older
// release: measured 2026-07-25, latest.earnings equalled the 2020 field exactly. Presenting
// that as current would misstate by years, so the release year is DETECTED per request and
// shown, rather than assumed or hard-coded to something that will drift.
var YEAR_CANDIDATES = [2024, 2023, 2022, 2021, 2020, 2019];
var EARN = '.earnings.10_yrs_after_entry.median';

var FIELDS = [
  'id', 'school.name', 'school.city', 'school.state', 'school.ownership',
  'latest.cost.attendance.academic_year',
  'latest.aid.median_debt.completers.overall',
  'latest' + EARN,
  'latest.completion.completion_rate_4yr_150nt',
  'latest.completion.completion_rate_less_than_4yr_150nt',
  'latest.admissions.admission_rate.overall',
  'latest.student.size'
].concat(YEAR_CANDIDATES.map(function (y) { return y + EARN; })).join(',');

// Which release does "latest" actually correspond to? Find the newest year field whose value
// matches it. Null when no year matches, in which case the card says the vintage is unknown
// rather than implying it is current.
function detectDataYear(rows) {
  for (var i = 0; i < YEAR_CANDIDATES.length; i++) {
    var y = YEAR_CANDIDATES[i];
    var matched = 0, compared = 0;
    for (var r = 0; r < rows.length; r++) {
      var lat = rows[r]['latest' + EARN], yr = rows[r][y + EARN];
      if (lat == null || yr == null) continue;
      compared++;
      if (Number(lat) === Number(yr)) matched++;
    }
    if (compared > 0 && matched === compared) return y;
  }
  return null;
}

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

  return T.cachedQuery('education:tool:school:v2:' + T.slugKey(q) + (st ? ':' + st : ''), TTL, async function () {
    var url = BASE + '?school.name=' + encodeURIComponent(q)
      + (st ? '&school.state=' + st : '')
      + '&fields=' + FIELDS + '&per_page=20&api_key=' + encodeURIComponent(key);
    var r = await T.getJSON(url, 14000);
    if (r.status === 429) return { ok: false, reason: 'The Department of Education API rate limit was hit. Try again shortly.' };
    if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
      return { ok: false, reason: 'College Scorecard returned ' + (r.status || 'no response') + '.' };
    }
    var dataYear = detectDataYear(r.body.results);
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
      dataYear: dataYear,
      cohortEnrolledAbout: dataYear ? dataYear - 10 : null,
      source: 'U.S. Department of Education, College Scorecard',
      sourceUrl: 'https://collegescorecard.ed.gov/',
      note: 'Earnings are the median 10 years after a student first enrolled, counting only those who received federal aid. Debt is the median owed by students who COMPLETED. Half of graduates earn less than the figure shown, and the field of study moves earnings far more than the school does.',
      // The vintage matters more here than anywhere else on the site and must not be buried.
      vintage: dataYear
        ? 'THIS IS NOT CURRENT-YEAR DATA. The newest College Scorecard release carrying these earnings is the ' + dataYear
          + ' data year, and "10 years after entry" means the students measured first enrolled around ' + (dataYear - 10)
          + '. Treat it as the most recent published evidence, not as what someone starting today would earn.'
        : 'The College Scorecard release year could not be determined on this read, so treat the earnings figure as several years old rather than current.',
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
