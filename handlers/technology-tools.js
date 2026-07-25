/**
 * api/technology-tools.js — Tech Watch tool: IS THIS BEING EXPLOITED RIGHT NOW?
 *
 *   GET /api/technology-tools                       → newest additions + ransomware tally
 *   GET /api/technology-tools?tool=kev&q=<vendor|product|CVE>
 *
 * Why this: an assistant can explain what a CVE is. It cannot tell you what CISA added to the
 * actively-exploited catalog this week, because the catalog moves faster than any model's
 * training data. KEV is not "vulnerabilities that exist" — it is the far smaller set with
 * CONFIRMED exploitation in the wild, which is the only list worth acting on first.
 *
 * Source: CISA Known Exploited Vulnerabilities catalog, keyless JSON (~1.5MB, 1,650+ entries).
 * The whole catalog is fetched once and cached; searches run in memory against the cache.
 */
var T = require('../lib/tool-fetch');

var KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
var KEY = 'technology:tool:kev:v1';
var TTL = 12 * 3600 * 1000;   // CISA updates on weekdays; twice a day is plenty

function entry(v) {
  return {
    cve: v.cveID || null,
    vendor: v.vendorProject || null,
    product: v.product || null,
    name: v.vulnerabilityName || null,
    added: v.dateAdded || null,
    due: v.dueDate || null,
    ransomware: String(v.knownRansomwareCampaignUse || '').toLowerCase() === 'known',
    description: (v.shortDescription || '').slice(0, 400) || null,
    action: (v.requiredAction || '').slice(0, 300) || null,
    url: v.cveID ? 'https://nvd.nist.gov/vuln/detail/' + encodeURIComponent(v.cveID) : null
  };
}

async function loadCatalog() {
  var r = await T.getJSON(KEV_URL, 20000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.vulnerabilities)) {
    return { ok: false, reason: 'CISA returned ' + (r.status || 'no response') + ' for the exploited-vulnerability catalog.' };
  }
  var all = r.body.vulnerabilities.map(entry);
  // newest first by dateAdded
  all.sort(function (a, b) { return String(b.added || '').localeCompare(String(a.added || '')); });

  var vendors = {};
  all.forEach(function (v) { if (v.vendor) vendors[v.vendor] = (vendors[v.vendor] || 0) + 1; });
  var topVendors = Object.keys(vendors).map(function (k) { return { vendor: k, count: vendors[k] }; })
    .sort(function (a, b) { return b.count - a.count; }).slice(0, 12);

  // "added in the last 30 days" is the part that is actually news
  var cut = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  var recent = all.filter(function (v) { return v.added && v.added >= cut; });

  return {
    ok: true,
    catalogVersion: r.body.catalogVersion || null,
    total: all.length,
    ransomwareCount: all.filter(function (v) { return v.ransomware; }).length,
    recentCount: recent.length,
    recent: recent.slice(0, 15),
    topVendors: topVendors,
    all: all,     // cached for in-memory search; stripped before the default response is sent
    source: 'CISA Known Exploited Vulnerabilities catalog',
    sourceUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    note: 'Every entry here has CONFIRMED exploitation in the wild, which is a much smaller and more urgent set than "known vulnerabilities". US federal civilian agencies are bound by a due date to fix each one; that date is a useful yardstick for everyone else. Absence from this list does not mean software is safe.'
  };
}

function publicView(cat) {
  var out = Object.assign({}, cat);
  delete out.all;      // the 1,650-entry array never goes over the wire
  return out;
}

function search(cat, qRaw) {
  var q = T.cleanQuery(qRaw, 60).toLowerCase();
  if (q.length < 2) return { ok: false, reason: 'Enter at least two characters.' };
  var hits = (cat.all || []).filter(function (v) {
    return (v.vendor && v.vendor.toLowerCase().indexOf(q) !== -1)
      || (v.product && v.product.toLowerCase().indexOf(q) !== -1)
      || (v.cve && v.cve.toLowerCase().indexOf(q) !== -1)
      || (v.name && v.name.toLowerCase().indexOf(q) !== -1);
  });
  var today = new Date().toISOString().slice(0, 10);
  return {
    ok: true, query: q, found: hits.length,
    ransomware: hits.filter(function (v) { return v.ransomware; }).length,
    overdue: hits.filter(function (v) { return v.due && v.due < today; }).length,
    rows: hits.slice(0, 25),
    catalogVersion: cat.catalogVersion,
    source: cat.source, sourceUrl: cat.sourceUrl,
    note: hits.length
      ? 'Ordered newest first. "Ransomware" means CISA has linked this flaw to a known ransomware campaign. The due date is the federal remediation deadline.'
      : 'Nothing in the actively-exploited catalog matches that. That is good news, but it is not a clean bill of health: KEV only lists flaws with confirmed exploitation.'
  };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    var cat = await T.cached(KEY, TTL, loadCatalog);
    if (!cat.ok) return T.send(res, cat);
    if (q.tool === 'kev' && q.q) return T.send(res, search(cat, q.q));
    return T.send(res, publicView(cat));
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
