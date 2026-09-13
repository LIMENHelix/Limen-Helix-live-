/**
 * api/law-tools.js — Law Watch tool: WHAT IS OPEN FOR PUBLIC COMMENT RIGHT NOW.
 *
 *   GET /api/law-tools                      → proposed rules whose comment window closes soonest
 *   GET /api/law-tools?tool=comments&q=<topic>[&agency=<slug>]
 *   GET /api/law-tools?tool=meter           → Register week + OFAC recent-actions + CISA KEV
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

function buildUrl(extraQuery, agency) {
  var f = ['title', 'comments_close_on', 'html_url', 'agencies', 'publication_date', 'abstract',
           'document_number', 'regulations_dot_gov_info', 'type',
           // The three that turn a count into a reading:
           //   significant     — the agency's own flag for an economically significant rule ($100M+)
           //   cfr_references  — WHICH body of regulation changes, i.e. who is actually regulated
           //   action          — whether this is a real proposal, a correction, or a deadline extension
           'significant', 'cfr_references', 'action'];
  // The API cannot order by comment_date — only by publication date or relevance. Ordering by
  // publication is NOT the same as closing soonest, so pull a wide page and sort on the real
  // deadline below. Without this the "closing this week" count reads 0 while windows are shutting.
  var u = BASE + '?per_page=100&order=oldest'
    + '&conditions%5Bcomment_date%5D%5Bgte%5D=' + today()
    + '&conditions%5Btype%5D%5B%5D=PRORULE'
    + f.map(function (x) { return '&fields%5B%5D=' + x; }).join('');
  if (extraQuery) u += '&conditions%5Bterm%5D=' + encodeURIComponent(extraQuery);
  if (agency) u += '&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(agency);
  return u;
}

// Slugs the Federal Register API accepts. Shown on the desk so a visitor can
// scan by agency without inventing a slug.
var AGENCIES = [
  { slug: 'securities-and-exchange-commission', name: 'SEC' },
  { slug: 'environmental-protection-agency', name: 'EPA' },
  { slug: 'food-and-drug-administration', name: 'FDA' },
  { slug: 'internal-revenue-service', name: 'IRS' },
  { slug: 'labor-department', name: 'Labor' },
  { slug: 'homeland-security-department', name: 'DHS' },
  { slug: 'transportation-department', name: 'DOT' },
  { slug: 'commerce-department', name: 'Commerce' },
  { slug: 'agriculture-department', name: 'USDA' },
  { slug: 'health-and-human-services-department', name: 'HHS' },
  { slug: 'education-department', name: 'Education' },
  { slug: 'federal-communications-commission', name: 'FCC' },
  { slug: 'federal-trade-commission', name: 'FTC' },
  { slug: 'consumer-financial-protection-bureau', name: 'CFPB' },
  { slug: 'energy-department', name: 'Energy' },
  { slug: 'justice-department', name: 'Justice' }
];

function cleanAgency(raw) {
  var s = String(raw || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
  if (!s) return '';
  for (var i = 0; i < AGENCIES.length; i++) {
    if (AGENCIES[i].slug === s) return s;
  }
  return s.length >= 4 ? s : '';
}


// CFR title -> who is actually regulated, in words a person recognises. A rule citing 21 CFR
// is about food, drugs or medical devices no matter what the title says; one citing 49 CFR is
// about trucking, rail or aviation. This is the difference between "a rule was published" and
// "this affects your pharmacy".
var CFR_SECTOR = {
  7: 'farming and food production', 9: 'meat and poultry inspection', 10: 'energy and nuclear',
  12: 'banks and credit unions', 14: 'aviation and space', 15: 'trade and exports',
  16: 'consumer protection and advertising', 17: 'securities and commodities trading',
  19: 'customs and imports', 20: 'benefits and disability', 21: 'food, drugs and medical devices',
  22: 'foreign relations', 23: 'highways', 24: 'housing and mortgages', 25: 'tribal affairs',
  26: 'tax', 27: 'alcohol, tobacco and firearms', 29: 'workplaces and worker safety',
  30: 'mining', 31: 'money and financial crime', 32: 'defense', 33: 'waterways and ports',
  34: 'schools and student aid', 36: 'parks and public forests', 38: 'veterans',
  40: 'the environment and emissions', 41: 'federal contracting', 42: 'public health and Medicare',
  43: 'public lands', 45: 'welfare and human services', 46: 'shipping', 47: 'telecoms and broadband',
  48: 'federal procurement', 49: 'transport, trucking and rail', 50: 'wildlife and fisheries'
};

function sectors(refs) {
  if (!Array.isArray(refs)) return [];
  var seen = {}, out = [];
  refs.forEach(function (r) {
    var name = CFR_SECTOR[r && r.title];
    if (name && !seen[name]) { seen[name] = 1; out.push(name); }
  });
  return out;
}

// The `action` line tells you whether the window is real. A correction or an extension is not
// a new proposal, and presenting it as one inflates how much is genuinely open.
function actionKind(action) {
  var a = String(action || '').toLowerCase();
  if (/extension|reopening|reopen/.test(a)) return 'comment period extended';
  if (/correction/.test(a)) return 'correction to an earlier notice';
  if (/withdraw/.test(a)) return 'withdrawal';
  if (/final rule/.test(a)) return 'final rule';
  if (/advance notice|anprm/.test(a)) return 'early-stage, pre-proposal';
  if (/proposed rule|nprm/.test(a)) return 'proposed rule';
  return null;
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
    // WHAT IT DOES, not that it exists.
    sectors: sectors(x.cfr_references),
    significant: x.significant === true,
    actionKind: actionKind(x.action),
    action: (x.action || '').slice(0, 160) || null,
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
  // WHAT IS IN THEM, not how many there are. A count of open rules is a volume metric; what a
  // reader needs is which of these actually bite, on whom, and by when.
  var soon = all.filter(function (x) { return x.daysLeft != null && x.daysLeft <= 7; });
  var sig = all.filter(function (x) { return x.significant; });

  // Which parts of life have a window open right now, commonest first.
  var tally = {};
  all.forEach(function (x) { (x.sectors || []).forEach(function (n) { tally[n] = (tally[n] || 0) + 1; }); });
  var bySector = Object.keys(tally).map(function (n) { return { sector: n, open: tally[n] }; })
    .sort(function (a, b) { return b.open - a.open; }).slice(0, 8);

  // The single rule most worth a reader's attention: economically significant if any is,
  // otherwise simply the next window to shut. Named, with what it does and who it hits.
  var lead = (sig.length ? sig : all)[0] || null;

  var base = {
    ok: true,
    total: r.body.count || all.length,
    rows: rows,
    // counted across everything fetched, not just the 20 shown, or the number understates itself
    closingWeek: soon.length,
    significantOpen: sig.length,
    significantClosingWeek: soon.filter(function (x) { return x.significant; }).length,
    bySector: bySector,
    lead: lead ? {
      title: lead.title, sectors: lead.sectors, significant: lead.significant,
      actionKind: lead.actionKind, daysLeft: lead.daysLeft, closes: lead.closes,
      abstract: lead.abstract, agencies: lead.agencies, commentUrl: lead.commentUrl, url: lead.url
    } : null,
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

async function searchComments(qRaw, agencyRaw) {
  var q = T.cleanQuery(qRaw, 60);
  var agency = cleanAgency(agencyRaw);
  if (q.length < 3 && !agency) return { ok: false, reason: 'Enter at least three letters to search by topic, or pick an agency.' };
  return T.cachedQuery('law:tool:comments:v3:' + T.slugKey(q) + ':' + (agency || 'any'), TTL_Q, async function () {
    var r = await T.getJSON(buildUrl(q.length >= 3 ? q : null, agency || null), 12000);
    var extra = { query: q || null, agency: agency || null };
    var out = shape(r, extra);
    if (out.ok && !out.rows.length) {
      out.note = 'No proposed rule with an open comment window matches'
        + (q ? ' "' + q + '"' : '')
        + (agency ? ' at that agency' : '')
        + ' right now. Windows open and close constantly, so this is worth checking again.';
    }
    return out;
  });
}

function ymd(d) { return d.toISOString().slice(0, 10); }

async function registerWeek() {
  var weekAgo = ymd(new Date(Date.now() - 7 * 86400000));
  async function count(params) {
    var r = await T.getJSON(BASE + '?per_page=1&' + params, 10000);
    if (r.status !== 200 || !r.body) return null;
    return r.body.count != null ? r.body.count : null;
  }
  var docs = await count('conditions%5Bpublication_date%5D%5Bgte%5D=' + weekAgo);
  var rules = await count('conditions%5Btype%5D%5B%5D=RULE&conditions%5Bpublication_date%5D%5Bgte%5D=' + weekAgo);
  var prop = await count('conditions%5Btype%5D%5B%5D=PRORULE&conditions%5Bpublication_date%5D%5Bgte%5D=' + weekAgo);
  if (docs == null && rules == null && prop == null) {
    return { ok: false, reason: 'The Federal Register did not return this week\'s counts.' };
  }
  return {
    ok: true,
    docsWeek: docs, rulesWeek: rules, proposedWeek: prop,
    source: 'Federal Register',
    sourceUrl: 'https://www.federalregister.gov/documents/current',
    asOf: ymd(new Date())
  };
}

async function ofacMeter() {
  var r = await T.getText('https://ofac.treasury.gov/recent-actions', 12000, {
    'User-Agent': 'Mozilla/5.0 (compatible; LIMEN-Helix-LawWatch/1.0; +https://limenhelix.com/law)'
  });
  if (r.status !== 200 || !r.raw || r.raw.length < 200) {
    return { ok: false, reason: 'OFAC recent-actions did not respond.' };
  }
  var signals = (r.raw.match(/sanction|sdn|designation|prohibited|added to the|blocked|secondary sanctions/gi) || []).length;
  return {
    ok: true,
    signals: signals,
    source: 'OFAC Recent Actions (U.S. Treasury)',
    sourceUrl: 'https://ofac.treasury.gov/recent-actions',
    note: 'Count of sanction/designation phrases on Treasury\'s recent-actions page, not a person-level screen and not a count of new SDN names.'
  };
}

async function kevMeter() {
  var r = await T.getJSON('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', 15000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.vulnerabilities)) {
    return { ok: false, reason: 'CISA KEV did not respond.' };
  }
  var all = r.body.vulnerabilities;
  var newest = all.slice().sort(function (a, b) {
    return String(b.dateAdded || '').localeCompare(String(a.dateAdded || ''));
  })[0] || null;
  return {
    ok: true,
    count: all.length,
    catalogVersion: r.body.catalogVersion || null,
    dateReleased: r.body.dateReleased || null,
    newest: newest ? {
      cve: newest.cveID || null,
      name: newest.vulnerabilityName || null,
      added: newest.dateAdded || null
    } : null,
    source: 'CISA Known Exploited Vulnerabilities catalog',
    sourceUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    note: 'Confirmed exploitation in the wild. Dualed here as the cyber-enforcement pressure next to the Register desk, not as legal advice.'
  };
}

async function meters() {
  var got = await Promise.all([
    T.cached('law:tool:meter:register:v1', TTL, registerWeek).catch(function () { return { ok: false }; }),
    T.cached('law:tool:meter:ofac:v1', TTL, ofacMeter).catch(function () { return { ok: false }; }),
    T.cached('law:tool:meter:kev:v1', TTL, kevMeter).catch(function () { return { ok: false }; })
  ]);
  return {
    ok: true,
    register: got[0] && got[0].ok ? got[0] : null,
    ofac: got[1] && got[1].ok ? got[1] : null,
    kev: got[2] && got[2].ok ? got[2] : null,
    asOf: ymd(new Date()),
    note: 'Live meters sit next to the free docket scan. OFAC and KEV are public catalogs. This page describes filings; it is not legal advice.'
  };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'meter') return T.send(res, await meters());
    if (q.tool === 'comments' && (q.q || q.agency)) {
      return T.send(res, await searchComments(q.q, q.agency));
    }
    var out = await T.cached('law:tool:comments:open:v2', TTL, openComments);
    if (out && out.ok) out.agencies = AGENCIES;
    return T.send(res, out);
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
