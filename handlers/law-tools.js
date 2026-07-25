/**
 * api/law-tools.js — Law Watch tool: WHAT IS OPEN FOR PUBLIC COMMENT RIGHT NOW.
 *
 *   GET /api/law-tools                      → proposed rules whose comment window closes soonest
 *   GET /api/law-tools?tool=comments&q=<topic>
 *
 * Why this: "know your rights" is exactly the kind of general explanation an assistant already
 * does well. What it cannot do is tell you which federal rules are open for comment TODAY and
 * how many days you have left, because that set turns over constantly. Every row here is a
 * window a member of the public can still act inside, with the deadline and the filing link.
 *
 * Source: Federal Register API (federalregister.gov/api/v1), keyless.
 */
var T = require('../lib/tool-fetch');

var BASE = 'https://www.federalregister.gov/api/v1/documents.json';
var TTL = 6 * 3600 * 1000;
var TTL_Q = 6 * 3600 * 1000;

function today() { return new Date().toISOString().slice(0, 10); }
function daysLeft(closeIso) {
  if (!closeIso) return null;
  var d = Date.parse(closeIso + 'T23:59:59Z');
  if (!d) return null;
  return Math.max(0, Math.ceil((d - Date.now()) / 86400000));
}

function buildUrl(extraQuery) {
  var f = ['title', 'comments_close_on', 'html_url', 'agencies', 'publication_date', 'abstract', 'document_number', 'regulations_dot_gov_info', 'type'];
  // The API cannot order by comment_date — only by publication date or relevance. Ordering by
  // publication is NOT the same as closing soonest, so pull a wide page and sort on the real
  // deadline below. Without this the "closing this week" count reads 0 while windows are shutting.
  var u = BASE + '?per_page=100&order=oldest'
    + '&conditions%5Bcomment_date%5D%5Bgte%5D=' + today()
    + '&conditions%5Btype%5D%5B%5D=PRORULE'
    + f.map(function (x) { return '&fields%5B%5D=' + x; }).join('');
  if (extraQuery) u += '&conditions%5Bterm%5D=' + encodeURIComponent(extraQuery);
  return u;
}

function row(x) {
  var rd = x.regulations_dot_gov_info || {};
  var docketId = rd.docket_id || (Array.isArray(rd) ? null : rd.document_id) || null;
  return {
    title: (x.title || '').slice(0, 240) || null,
    agencies: (x.agencies || []).map(function (a) { return a.name; }).filter(Boolean),
    published: x.publication_date || null,
    closes: x.comments_close_on || null,
    daysLeft: daysLeft(x.comments_close_on),
    abstract: (x.abstract || '').slice(0, 400) || null,
    documentNumber: x.document_number || null,
    url: x.html_url || null,
    // regulations.gov is where a comment is actually filed; the Federal Register page links on
    // to it, so send people to the docket when we have one and to the rule page otherwise.
    commentUrl: docketId ? 'https://www.regulations.gov/docket/' + encodeURIComponent(docketId) : (x.html_url || null)
  };
}

function shape(r, extra) {
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
    return { ok: false, reason: 'The Federal Register returned ' + (r.status || 'no response') + '.' };
  }
  var all = r.body.results.map(row).filter(function (x) { return x.closes; });
  all.sort(function (a, b) { return String(a.closes).localeCompare(String(b.closes)); });   // soonest deadline first
  var rows = all.slice(0, 20);
  var base = {
    ok: true,
    total: r.body.count || all.length,
    rows: rows,
    // counted across everything fetched, not just the 20 shown, or the number understates itself
    closingWeek: all.filter(function (x) { return x.daysLeft != null && x.daysLeft <= 7; }).length,
    source: 'Federal Register',
    sourceUrl: 'https://www.federalregister.gov/documents/current',
    note: 'These are PROPOSED rules, not final ones, which is the only stage at which public comment carries weight. Agencies must consider substantive comments on the record. A comment from an ordinary member of the public counts; it does not need to be written by a lawyer.'
  };
  return Object.assign(base, extra || {});
}

async function openComments() {
  var r = await T.getJSON(buildUrl(null), 12000);
  return shape(r);
}

async function searchComments(qRaw) {
  var q = T.cleanQuery(qRaw, 60);
  if (q.length < 3) return { ok: false, reason: 'Enter at least three letters to search by topic.' };
  return T.cachedQuery('law:tool:comments:' + T.slugKey(q), TTL_Q, async function () {
    var r = await T.getJSON(buildUrl(q), 12000);
    var out = shape(r, { query: q });
    if (out.ok && !out.rows.length) {
      out.note = 'No proposed rule with an open comment window matches "' + q + '" right now. Windows open and close constantly, so this is worth checking again.';
    }
    return out;
  });
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'comments' && q.q) return T.send(res, await searchComments(q.q));
    return T.send(res, await T.cached('law:tool:comments:open:v1', TTL, openComments));
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
