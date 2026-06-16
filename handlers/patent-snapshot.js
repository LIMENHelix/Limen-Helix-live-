/**
 * api/patent-snapshot.js
 * Vercel serverless — USPTO patent applications feed for LIMEN
 *
 * Queries the USPTO Patent Applications Search API and converts
 * raw filing data into LIMEN patent opportunity signals.
 *
 * Endpoint: https://api.uspto.gov/api/v1/patent/applications/search
 * Auth: X-Api-Key header (env: USPTO_API_KEY)
 *
 * Response shape: { count, patentFileWrapperDataBag: [...] }
 * Domain classification uses USPC class + art unit number
 * (CPC bag is empty for most applications in this API).
 *
 * All scores are aggregate — no individual patent evaluation.
 * legalReviewRequired is always true.
 */

var TIMEOUT = 12000;
var MAX_ROWS = 25;
var DEFAULT_SEARCH = '*';

// Art unit ranges → LIMEN domain (USPTO examining groups)
var ART_UNIT_DOMAINS = [
  { min: 1600, max: 1699, primary: 'health',       secondary: 'research' },     // Biotech, Organic Chem
  { min: 1700, max: 1799, primary: 'environment',   secondary: 'health' },       // Chemical, Materials
  { min: 2100, max: 2199, primary: 'technology',    secondary: 'research' },     // Computer Architecture, Software
  { min: 2400, max: 2499, primary: 'technology',    secondary: null },           // Networking, Multiplex
  { min: 2600, max: 2699, primary: 'technology',    secondary: null },           // Communications
  { min: 2800, max: 2899, primary: 'technology',    secondary: 'energy' },       // Semiconductors
  { min: 3600, max: 3699, primary: 'supplyChain',   secondary: 'economy' },      // Transportation, Construction
  { min: 3700, max: 3799, primary: 'energy',        secondary: 'supplyChain' },  // Mechanical Engineering
  { min: 3900, max: 3999, primary: 'technology',    secondary: 'research' }      // Reexamination
];

// USPC class ranges → LIMEN domain (fallback when art unit unavailable)
var USPC_DOMAIN_MAP = {
  // Health / Medical
  '128': 'health', '424': 'health', '435': 'health', '514': 'health', '600': 'health', '601': 'health', '602': 'health', '604': 'health', '606': 'health', '607': 'health',
  // Technology / Computing
  '345': 'technology', '370': 'technology', '455': 'technology', '700': 'technology', '701': 'technology', '702': 'technology', '703': 'technology', '704': 'technology', '705': 'technology', '706': 'technology', '707': 'technology', '708': 'technology', '709': 'technology', '710': 'technology', '711': 'technology', '712': 'technology', '713': 'technology', '714': 'technology', '715': 'technology', '716': 'technology', '717': 'technology', '718': 'technology', '719': 'technology', '720': 'technology', '725': 'technology', '726': 'technology',
  // Energy / Electrical
  '290': 'energy', '310': 'energy', '318': 'energy', '320': 'energy', '322': 'energy', '323': 'energy', '324': 'energy', '361': 'energy', '362': 'energy', '363': 'energy', '429': 'energy',
  // Environment / Chemistry
  '422': 'environment', '423': 'environment', '502': 'environment', '504': 'environment', '507': 'environment', '520': 'environment', '521': 'environment', '523': 'environment', '524': 'environment', '525': 'environment', '526': 'environment', '528': 'environment', '530': 'environment', '544': 'environment', '546': 'environment', '548': 'environment', '549': 'environment', '552': 'environment', '554': 'environment', '556': 'environment', '558': 'environment', '560': 'environment', '562': 'environment', '564': 'environment', '568': 'environment', '570': 'environment',
  // Supply Chain / Mechanical
  '137': 'supplyChain', '141': 'supplyChain', '198': 'supplyChain', '209': 'supplyChain', '414': 'supplyChain', '426': 'supplyChain', '428': 'supplyChain', '463': 'supplyChain'
};

// Application status → innovation pressure weight
var STATUS_WEIGHTS = {
  'Patented Case': 1.0,
  'Allowed -- Notice of Allowance Mailed': 0.9,
  'Docketed New Case - Ready for Examination': 0.7,
  'Sent to Classification contractor': 0.6,
  'Application Undergoing Preexam Processing': 0.5,
  'Non Final Action Mailed': 0.5,
  'Reexam Assigned to Examiner for Determination': 0.5,
  'Final Rejection Mailed': 0.3,
  'Abandoned -- Failure to Respond to an Office Action': 0.1,
  'Abandoned -- After Examiner\'s Answer or Board of Appeals Decision': 0.1
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120');

  var key = process.env.USPTO_API_KEY;
  if (!key) {
    return res.status(200).json({
      status: 'fallback',
      reason: 'USPTO_API_KEY not set',
      patent: fallbackSignal(),
      sourceHealth: { status: 'fallback', reason: 'USPTO_API_KEY not set', fetchedAt: Date.now() }
    });
  }

  var searchText = (req.query && req.query.q) || DEFAULT_SEARCH;
  var rows = Math.min(parseInt(req.query && req.query.rows, 10) || MAX_ROWS, MAX_ROWS);

  try {
    var data = await fetchUSPTO(key, searchText, rows);

    if (!data || !data.patentFileWrapperDataBag || !Array.isArray(data.patentFileWrapperDataBag)) {
      var shape = data ? Object.keys(data).join(',') : 'null';
      var dataType = typeof data;
      console.warn('[patent-snapshot] unexpected shape — type:', dataType, 'keys:', shape);
      return res.status(200).json({
        status: 'fallback',
        reason: 'unexpected response shape',
        debug: { type: dataType, keys: shape, hasCount: data ? ('count' in data) : false, hasBag: data ? ('patentFileWrapperDataBag' in data) : false },
        patent: fallbackSignal(),
        sourceHealth: { status: 'fallback', reason: 'unexpected response shape', fetchedAt: Date.now() }
      });
    }

    var parsed = parseApplications(data.patentFileWrapperDataBag);
    var signal = computeSignal(parsed, data.count || data.patentFileWrapperDataBag.length);

    return res.status(200).json({
      status: 'live',
      patent: signal,
      meta: {
        fetchedAt: Date.now(),
        totalRecords: data.count || null,
        returnedRecords: data.patentFileWrapperDataBag.length,
        searchText: searchText
      },
      sourceHealth: { status: 'live', reason: null, fetchedAt: Date.now(), value: data.patentFileWrapperDataBag.length }
    });

  } catch (e) {
    console.error('[patent-snapshot] error:', e.message);
    return res.status(200).json({
      status: 'fallback',
      reason: e.message,
      patent: fallbackSignal(),
      sourceHealth: { status: 'fallback', reason: e.message, fetchedAt: Date.now() }
    });
  }
};

// ─── USPTO Fetch ────────────────────────────────────────────────────────

async function fetchUSPTO(apiKey, searchText, rows) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, TIMEOUT);

  var url = 'https://api.uspto.gov/api/v1/patent/applications/search'
    + '?searchText=' + encodeURIComponent(searchText)
    + '&rows=' + rows
    + '&start=0'
    + '&sortField=lastIngestionDateTime'
    + '&sortOrder=desc';

  try {
    var resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json'
      }
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── Parse Applications ─────────────────────────────────────────────────

function parseApplications(bag) {
  var apps = [];
  for (var i = 0; i < bag.length; i++) {
    var r = bag[i];
    var meta = r.applicationMetaData || {};

    apps.push({
      applicationNumber: r.applicationNumberText || null,
      filingDate: meta.filingDate || null,
      effectiveFilingDate: meta.effectiveFilingDate || null,
      title: meta.inventionTitle || null,
      applicant: meta.firstApplicantName || null,
      inventor: meta.firstInventorName || null,
      uspcSymbol: meta.uspcSymbolText || null,
      artUnit: meta.groupArtUnitNumber || null,
      status: meta.applicationStatusDescriptionText || null,
      parentContinuity: r.parentContinuityBag || [],
      childContinuity: r.childContinuityBag || [],
      hasAssignment: !!(r.assignmentBag && r.assignmentBag.length),
      ingestionTimestamp: r.lastIngestionDateTime || null
    });
  }
  return apps;
}

// ─── Domain classification from art unit + USPC ─────────────────────────

function classifyDomain(app) {
  // Primary: art unit number ranges
  var artUnit = app.artUnit;
  if (artUnit && typeof artUnit === 'string') {
    var auNum = parseInt(artUnit, 10);
    if (!isNaN(auNum)) {
      for (var i = 0; i < ART_UNIT_DOMAINS.length; i++) {
        var range = ART_UNIT_DOMAINS[i];
        if (auNum >= range.min && auNum <= range.max) {
          return { primary: range.primary, secondary: range.secondary };
        }
      }
    }
  }

  // Fallback: USPC class number
  var uspc = app.uspcSymbol;
  if (uspc) {
    var uspcClass = uspc.split('/')[0].trim();
    var domain = USPC_DOMAIN_MAP[uspcClass];
    if (domain) return { primary: domain, secondary: null };
  }

  // Default: technology (most patent filings are tech-adjacent)
  return { primary: 'technology', secondary: null };
}

// ─── Compute LIMEN Signal ───────────────────────────────────────────────

function computeSignal(apps, totalRecords) {
  var now = Date.now();
  var count = apps.length;
  if (count === 0) return fallbackSignal();

  // ── Filing rate: applications with filing date in last 30 days
  var recent30d = 0;
  var thirtyDaysAgo = now - (30 * 86400000);
  for (var i = 0; i < count; i++) {
    var fd = apps[i].effectiveFilingDate || apps[i].filingDate;
    if (fd && new Date(fd).getTime() > thirtyDaysAgo) recent30d++;
  }

  // ── Domain distribution via art unit + USPC classification
  var domainCounts = {};
  var domainsHit = {};
  for (var j = 0; j < count; j++) {
    var cls = classifyDomain(apps[j]);
    domainCounts[cls.primary] = (domainCounts[cls.primary] || 0) + 1;
    domainsHit[cls.primary] = true;
    if (cls.secondary) {
      domainCounts[cls.secondary] = (domainCounts[cls.secondary] || 0) + 1;
      domainsHit[cls.secondary] = true;
    }
  }

  // ── Classification spread: entropy of domain distribution
  var classificationSpread = 0;
  var domainKeys = Object.keys(domainCounts);
  var totalClassified = 0;
  for (var dk = 0; dk < domainKeys.length; dk++) totalClassified += domainCounts[domainKeys[dk]];
  if (totalClassified > 0) {
    for (var es = 0; es < domainKeys.length; es++) {
      var p = domainCounts[domainKeys[es]] / totalClassified;
      if (p > 0) classificationSpread -= p * Math.log(p) / Math.log(2);
    }
    // Normalize: max entropy for 7 domains = log2(7) ≈ 2.807
    classificationSpread = clamp(classificationSpread / 2.807, 0, 1);
  }

  // ── Assignee concentration (HHI)
  var assigneeCounts = {};
  var assigneeTotal = 0;
  for (var a = 0; a < count; a++) {
    var name = apps[a].applicant;
    if (name) {
      var normalized = name.toUpperCase().trim();
      assigneeCounts[normalized] = (assigneeCounts[normalized] || 0) + 1;
      assigneeTotal++;
    }
  }
  var assigneeConcentration = 0;
  if (assigneeTotal > 0) {
    var hhi = 0;
    var assigneeNames = Object.keys(assigneeCounts);
    for (var ac = 0; ac < assigneeNames.length; ac++) {
      var share = assigneeCounts[assigneeNames[ac]] / assigneeTotal;
      hhi += share * share;
    }
    assigneeConcentration = round(hhi);
  }

  // ── Continuity depth
  var continuitySum = 0;
  for (var cd = 0; cd < count; cd++) {
    continuitySum += (apps[cd].parentContinuity.length || 0) + (apps[cd].childContinuity.length || 0);
  }
  var continuityDepth = round(continuitySum / count);

  // ── Innovation pressure: weighted status score
  var statusSum = 0;
  var statusCount = 0;
  for (var sp = 0; sp < count; sp++) {
    var st = apps[sp].status;
    if (st) {
      statusSum += STATUS_WEIGHTS[st] || 0.4;
      statusCount++;
    }
  }
  var innovationPressure = statusCount > 0 ? round(statusSum / statusCount) : 0.4;

  // ── Cross-domain activity
  var crossDomainActivity = round(Object.keys(domainsHit).length / 7);

  // ── Novelty score: composite of spread + cross-domain + recency
  var recencyRatio = count > 0 ? clamp(recent30d / count, 0, 1) : 0;
  var noveltyScore = round(
    classificationSpread * 0.35 +
    crossDomainActivity * 0.35 +
    recencyRatio * 0.30
  );

  // ── Filing rate normalized
  var filingRate = totalRecords > 0 ? round(clamp(totalRecords / 200000, 0, 1)) : round(clamp(recent30d / 50, 0, 1));

  // ── Art unit breakdown
  var artUnitGroups = {};
  for (var au = 0; au < count; au++) {
    var unit = apps[au].artUnit;
    if (unit) {
      var grp = (typeof unit === 'string' ? unit.substring(0, 2) : String(unit).substring(0, 2)) + 'xx';
      artUnitGroups[grp] = (artUnitGroups[grp] || 0) + 1;
    }
  }
  var topArtUnits = Object.keys(artUnitGroups)
    .sort(function (a, b) { return artUnitGroups[b] - artUnitGroups[a]; })
    .slice(0, 5)
    .map(function (g) { return { group: g, count: artUnitGroups[g] }; });

  // ── Recent applications sample (5 max)
  var recentApps = [];
  for (var ra = 0; ra < Math.min(5, count); ra++) {
    recentApps.push({
      title: apps[ra].title,
      filingDate: apps[ra].effectiveFilingDate || apps[ra].filingDate,
      artUnit: apps[ra].artUnit,
      uspc: apps[ra].uspcSymbol,
      status: apps[ra].status
    });
  }

  // ── Stress
  var stress = round(clamp(
    innovationPressure * 0.40 +
    (1 - assigneeConcentration) * 0.20 +
    crossDomainActivity * 0.20 +
    filingRate * 0.20,
    0, 1
  ));

  return {
    filingRate: filingRate,
    recentApplications: recentApps,
    assigneeConcentration: assigneeConcentration,
    classificationSpread: round(classificationSpread),
    continuityDepth: continuityDepth,
    innovationPressure: innovationPressure,
    crossDomainActivity: crossDomainActivity,
    noveltyScore: noveltyScore,
    stress: stress,
    label: count + ' applications across ' + Object.keys(domainsHit).length + ' domains',
    signal: 'patent activity: ' + (totalRecords || count) + ' total, novelty ' + noveltyScore,
    domainBreakdown: domainCounts,
    topArtUnits: topArtUnits,
    totalRecords: totalRecords || count,
    legalReviewRequired: true
  };
}

// ─── Fallback ───────────────────────────────────────────────────────────

function fallbackSignal() {
  return {
    filingRate: 0,
    recentApplications: [],
    assigneeConcentration: 0,
    classificationSpread: 0,
    continuityDepth: 0,
    innovationPressure: 0,
    crossDomainActivity: 0,
    noveltyScore: 0,
    stress: 0,
    label: 'patent data unavailable',
    signal: 'no patent feed',
    domainBreakdown: {},
    topArtUnits: [],
    totalRecords: 0,
    legalReviewRequired: true
  };
}

// ─── Utilities ──────────────────────────────────────────────────────────

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function round(v) { return Math.round(v * 100) / 100; }
