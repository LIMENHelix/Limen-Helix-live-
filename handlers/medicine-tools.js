/**
 * api/medicine-tools.js — the three free Health Watch tools, server side.
 *
 *   GET /api/medicine-tools?tool=shortages          → current FDA drug shortages, summary
 *   GET /api/medicine-tools?tool=shortages&q=<drug> → is THIS drug in shortage right now
 *   GET /api/medicine-tools?tool=outbreaks          → WHO Disease Outbreak News, latest
 *   GET /api/medicine-tools?tool=recalls            → FDA food / drug / device recalls, plain language
 *   GET /api/medicine-tools                         → all three (no search)
 *
 * Same rules as agriculture-tools.js: every number is fetched, a failed source says so
 * with its reason, and nothing is estimated in its place. Health is the domain where a
 * confident wrong answer does the most damage, so the copy stays inside what the record
 * actually says and always points back to the FDA/WHO original.
 *
 * Sources (all keyless)
 *   openFDA  api.fda.gov/drug/shortages.json  and  /{food,drug,device}/enforcement.json
 *   WHO      who.int/api/news/diseaseoutbreaknews  (OData)
 */
var db = require('../lib/limen-db');

var TTL = { shortages: 6 * 3600 * 1000, outbreaks: 6 * 3600 * 1000, recalls: 3 * 3600 * 1000, search: 6 * 3600 * 1000 };
var KEY = { shortages: 'medicine:tool:shortages:v1', outbreaks: 'medicine:tool:outbreaks:v1', recalls: 'medicine:tool:recalls:v1' };

function getJSON(url, ms) {
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, ms || 10000);
  return fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'LIMEN-Helix/1.0', 'Accept': 'application/json' } })
    .then(function (r) {
      clearTimeout(tid);
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    })
    .catch(function (e) { clearTimeout(tid); return { status: 0, body: null, err: e.message || 'timeout' }; });
}

// openFDA dates arrive as YYYYMMDD or MM/DD/YYYY depending on the endpoint.
function isoDate(v) {
  if (!v) return null;
  var s = String(v);
  var m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[1] + '-' + m[2];
  m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? s.slice(0, 10) : null;
}

// ── 1. DRUG SHORTAGE LOOKUP ────────────────────────────────────────────────
// openFDA's generic_name carries the dosage form too ("Clonazepam Tablet"), so a phrase
// match on a bare drug name fails; the field tokenises, so a single-token search hits.
// A 404 from openFDA means ZERO MATCHES, not a fault — surfacing it as an error would tell
// someone their drug's status is unknown when the honest answer is "not on the list".
var SHORTAGE_BASE = 'https://api.fda.gov/drug/shortages.json';

function shortageRow(r) {
  return {
    drug: r.generic_name || null,
    status: r.status || null,
    company: r.company_name || null,
    dosageForm: r.dosage_form || null,
    presentation: r.presentation || null,
    category: r.therapeutic_category && r.therapeutic_category.length ? r.therapeutic_category[0] : null,
    reason: r.shortage_reason || null,
    updated: isoDate(r.update_date),
    posted: isoDate(r.initial_posting_date),
    discontinued: isoDate(r.discontinued_date)
  };
}

async function fetchShortages() {
  var cur = await getJSON(SHORTAGE_BASE + '?search=' + encodeURIComponent('status:"Current"') + '&limit=12&sort=update_date:desc');
  if (cur.status === 0) return { ok: false, reason: 'openFDA did not respond: ' + (cur.err || 'timeout') };
  if (cur.status !== 200 || !cur.body || !cur.body.results) return { ok: false, reason: 'openFDA returned ' + cur.status + ' for the shortage list.' };

  // headline counts by status, from openFDA's own aggregation rather than our own tally.
  // NOTE: count=status, NOT status.exact — this index has no .exact variant and 404s on it.
  var counts = await getJSON(SHORTAGE_BASE + '?count=status');
  var byStatus = {};
  if (counts.status === 200 && counts.body && counts.body.results) {
    counts.body.results.forEach(function (c) { byStatus[c.term] = c.count; });
  }
  return {
    ok: true,
    total: (cur.body.meta && cur.body.meta.results && cur.body.meta.results.total) || null,
    byStatus: byStatus,
    recent: cur.body.results.map(shortageRow),
    source: 'FDA Drug Shortages, via openFDA',
    sourceUrl: 'https://www.accessdata.fda.gov/scripts/drugshortages/',
    note: 'These are shortages the FDA has been told about by manufacturers. A drug missing from this list can still be unavailable at your pharmacy, which is a local supply problem rather than a national one.'
  };
}

async function searchShortage(q) {
  var clean = String(q || '').trim().replace(/[^A-Za-z0-9 \-]/g, '').slice(0, 60);
  if (clean.length < 3) return { ok: false, reason: 'Enter at least three letters of the drug name.' };
  var cacheKey = 'medicine:tool:shortage-q:' + clean.toLowerCase().replace(/\s+/g, '-');
  try {
    var hit = await db.get(cacheKey);
    if (hit && hit.updatedMs && (Date.now() - hit.updatedMs) < TTL.search && hit.data) {
      var h = Object.assign({}, hit.data); h.cached = true; return h;
    }
  } catch (e) {}

  // token search, newest first; openFDA answers 404 when nothing matches
  var url = SHORTAGE_BASE + '?search=' + encodeURIComponent('generic_name:"' + clean + '"') + '&limit=20&sort=update_date:desc';
  var r = await getJSON(url);
  var out;
  if (r.status === 404) {
    out = { ok: true, query: clean, found: 0, rows: [], message: 'No FDA shortage record matches "' + clean + '" right now.' };
  } else if (r.status !== 200 || !r.body || !r.body.results) {
    return { ok: false, reason: 'openFDA returned ' + (r.status || 'no response') + ' for that search.' };
  } else {
    var rows = r.body.results.map(shortageRow);
    var current = rows.filter(function (x) { return x.status === 'Current'; });
    out = {
      ok: true, query: clean,
      found: (r.body.meta && r.body.meta.results && r.body.meta.results.total) || rows.length,
      currentCount: current.length,
      rows: rows
    };
  }
  out.source = 'FDA Drug Shortages, via openFDA';
  out.sourceUrl = 'https://www.accessdata.fda.gov/scripts/drugshortages/';
  try { await db.set(cacheKey, { updatedMs: Date.now(), data: out }, Math.round(TTL.search / 1000)); } catch (e) {}
  out.cached = false;
  return out;
}

// ── 2. OUTBREAK TRACKER ────────────────────────────────────────────────────
// WHO Disease Outbreak News is the authoritative "what is actually spreading" list. The
// OData feed gives a slug (ItemDefaultUrl) that resolves under /emergencies/disease-outbreak-news/item/.
async function fetchOutbreaks() {
  var url = 'https://www.who.int/api/news/diseaseoutbreaknews'
    + '?%24orderby=PublicationDateAndTime%20desc&%24top=14'
    + '&%24select=Title,PublicationDateAndTime,ItemDefaultUrl';
  var r = await getJSON(url, 12000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.value)) {
    return { ok: false, reason: 'WHO returned ' + (r.status || 'no response') + ' for the outbreak feed.' };
  }
  var rows = r.body.value.map(function (x) {
    var slug = String(x.ItemDefaultUrl || '').replace(/^\//, '');
    var title = String(x.Title || '').trim();
    // WHO titles read "Disease - Country" or "Disease, Country"; split for a cleaner row
    var parts = title.split(/\s+[-–]\s+|,\s+(?=[A-Z][^,]*$)/);
    return {
      title: title,
      disease: parts.length > 1 ? parts.slice(0, -1).join(' - ').trim() : title,
      where: parts.length > 1 ? parts[parts.length - 1].trim() : null,
      published: (x.PublicationDateAndTime || '').slice(0, 10) || null,
      url: slug ? 'https://www.who.int/emergencies/disease-outbreak-news/item/' + slug : null
    };
  }).filter(function (x) { return x.title; });
  if (!rows.length) return { ok: false, reason: 'WHO returned no outbreak items.' };
  return {
    ok: true, rows: rows,
    source: 'WHO Disease Outbreak News',
    sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news',
    note: 'WHO publishes these when an event has public-health significance beyond the country reporting it. A quiet week here does not mean nothing is spreading; it means nothing crossed WHO\'s reporting bar.'
  };
}

// ── 3. PLAIN-LANGUAGE RECALL ALERTS ────────────────────────────────────────
// FDA recall classes are legal categories with real meanings that the class number hides.
// These paraphrase the FDA's own definitions.
var CLASS_PLAIN = {
  'Class I': { risk: 'high', say: 'Reasonable chance this causes serious health problems or death. Stop using it.' },
  'Class II': { risk: 'medium', say: 'May cause a temporary or reversible health problem; small chance of something serious.' },
  'Class III': { risk: 'low', say: 'Unlikely to cause a health problem, but it breaks an FDA rule (often labelling).' }
};
var RECALL_KINDS = [
  { kind: 'food', label: 'Food', url: 'https://api.fda.gov/food/enforcement.json' },
  { kind: 'drug', label: 'Drugs', url: 'https://api.fda.gov/drug/enforcement.json' },
  { kind: 'device', label: 'Devices', url: 'https://api.fda.gov/device/enforcement.json' }
];

async function fetchRecallKind(k) {
  var r = await getJSON(k.url + '?limit=8&sort=report_date:desc');
  if (r.status === 404) return { kind: k.kind, label: k.label, ok: true, rows: [] };
  if (r.status !== 200 || !r.body || !r.body.results) {
    return { kind: k.kind, label: k.label, ok: false, reason: 'openFDA returned ' + (r.status || 'no response') };
  }
  return {
    kind: k.kind, label: k.label, ok: true,
    rows: r.body.results.map(function (x) {
      var cls = x.classification || null;
      var plain = cls && CLASS_PLAIN[cls] ? CLASS_PLAIN[cls] : null;
      return {
        product: (x.product_description || '').slice(0, 220) || null,
        firm: x.recalling_firm || null,
        reason: (x.reason_for_recall || '').slice(0, 220) || null,
        classification: cls,
        risk: plain ? plain.risk : null,
        plain: plain ? plain.say : null,
        status: x.status || null,
        state: x.state || null,
        distribution: (x.distribution_pattern || '').slice(0, 150) || null,
        reported: isoDate(x.report_date),
        started: isoDate(x.recall_initiation_date),
        recallNumber: x.recall_number || null
      };
    })
  };
}

async function fetchRecalls() {
  var groups = await Promise.all(RECALL_KINDS.map(fetchRecallKind));
  var any = groups.filter(function (g) { return g.ok && g.rows.length; });
  if (!any.length) return { ok: false, reason: 'openFDA returned no recall records on this read.' };
  var classOne = 0;
  groups.forEach(function (g) { (g.rows || []).forEach(function (r) { if (r.classification === 'Class I') classOne++; }); });
  return {
    ok: true, groups: groups, classOneCount: classOne,
    source: 'FDA enforcement reports, via openFDA',
    sourceUrl: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
    note: 'These are the FDA\'s own enforcement records. "Ongoing" means the recall is still being carried out, not that the product is still on shelves. Recalls are reported with a lag of days to weeks.'
  };
}

// ── cache + dispatch ───────────────────────────────────────────────────────
async function cached(tool, fn) {
  var now = Date.now();
  try {
    var c = await db.get(KEY[tool]);
    if (c && c.updatedMs && (now - c.updatedMs) < TTL[tool] && c.data && c.data.ok) {
      var hit = Object.assign({}, c.data); hit.cached = true; hit.updated = c.updated; return hit;
    }
  } catch (e) {}
  var data = await fn();
  if (data && data.ok) {
    try { await db.set(KEY[tool], { updated: new Date(now).toISOString(), updatedMs: now, data: data }); } catch (e) {}
    data.cached = false; data.updated = new Date(now).toISOString();
    return data;
  }
  try {
    var stale = await db.get(KEY[tool]);
    if (stale && stale.data && stale.data.ok) {
      var s = Object.assign({}, stale.data);
      s.cached = true; s.stale = true; s.updated = stale.updated;
      s.staleReason = (data && data.reason) || 'upstream unavailable';
      return s;
    }
  } catch (e) {}
  return data || { ok: false, reason: 'unavailable' };
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  var q = req.query || {};
  var tool = q.tool || 'all';
  try {
    if (tool === 'shortages' && q.q) { res.statusCode = 200; return res.end(JSON.stringify(await searchShortage(q.q))); }
    if (tool === 'shortages') { res.statusCode = 200; return res.end(JSON.stringify(await cached('shortages', fetchShortages))); }
    if (tool === 'outbreaks') { res.statusCode = 200; return res.end(JSON.stringify(await cached('outbreaks', fetchOutbreaks))); }
    if (tool === 'recalls') { res.statusCode = 200; return res.end(JSON.stringify(await cached('recalls', fetchRecalls))); }
    var all = await Promise.all([cached('shortages', fetchShortages), cached('outbreaks', fetchOutbreaks), cached('recalls', fetchRecalls)]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, shortages: all[0], outbreaks: all[1], recalls: all[2] }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, reason: e.message || 'handler error' }));
  }
};
