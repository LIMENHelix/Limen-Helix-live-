/**
 * api/domain-snapshot-debug.js
 * Vercel serverless — debug view of domain-snapshot source health
 *
 * Operator-only diagnostic. Shows per-source success/failure, fallback
 * reasons, env var presence, and raw fetch diagnostics. Requires the
 * operator master key (x-limen-pass); fails closed. Secret-derived
 * material (key prefixes, suffixes, lengths, fingerprints) is never
 * returned — only set / NOT SET presence.
 */

var adminGate = require('../lib/admin-gate');

function operatorPass(req) {
  var headers = (req && req.headers) || {};
  return headers['x-limen-pass'] || headers['X-Limen-Pass'] || '';
}

module.exports = async function handler(req, res) {
  if (!adminGate.isMaster(operatorPass(req))) return adminGate.deny(res);

  res.setHeader('Cache-Control', 'no-cache');

  // Fetch the main snapshot to get live health data
  var snapshotUrl = (req.headers['x-forwarded-proto'] || 'https') + '://' + (req.headers.host || 'localhost') + '/api/domain-snapshot';
  var snapshotData = null;
  var fetchError = null;

  try {
    var resp = await fetch(snapshotUrl);
    snapshotData = await resp.json();
  } catch (e) {
    fetchError = e.message;
  }

  // Environment variable audit — presence only, never secret-derived material.
  var envStatus = {
    FRED_API_KEY: !!process.env.FRED_API_KEY ? 'set' : 'NOT SET',
    EIA_API_KEY: !!process.env.EIA_API_KEY ? 'set' : 'NOT SET',
    NOAA_TOKEN: !!process.env.NOAA_TOKEN ? 'set' : 'NOT SET'
  };

  // Source inventory
  var sourceInventory = [
    { name: 'FRED Unemployment', domain: 'economy', envVar: 'FRED_API_KEY', noKeyFallback: true },
    { name: 'BLS Employment', domain: 'economy', envVar: null, noKeyFallback: false, rateLimit: '25 req/day (v2 public)' },
    { name: 'EIA Petroleum', domain: 'energy', envVar: 'EIA_API_KEY', noKeyFallback: true },
    { name: 'FRED Crude Oil', domain: 'energy', envVar: 'FRED_API_KEY', noKeyFallback: true },
    { name: 'NOAA Climate', domain: 'environment', envVar: 'NOAA_TOKEN', noKeyFallback: true },
    { name: 'NOAA Alerts', domain: 'environment', envVar: null, noKeyFallback: false, rateLimit: 'none (public, needs User-Agent)' },
    { name: 'openFDA Events', domain: 'health', envVar: null, noKeyFallback: false },
    { name: 'openFDA Recalls', domain: 'health', envVar: null, noKeyFallback: false },
    { name: 'USPTO Patents', domain: 'technology', envVar: null, noKeyFallback: false },
    { name: 'arXiv CS', domain: 'technology', envVar: null, noKeyFallback: false, rateLimit: '3 req/s shared' },
    { name: 'PubMed', domain: 'research', envVar: null, noKeyFallback: false },
    { name: 'arXiv All', domain: 'research', envVar: null, noKeyFallback: false, rateLimit: '3 req/s shared (500ms stagger)' },
    { name: 'BLS Freight PPI', domain: 'supplyChain', envVar: null, noKeyFallback: false, rateLimit: '25 req/day shared' },
    { name: 'EIA Supply', domain: 'supplyChain', envVar: 'EIA_API_KEY', noKeyFallback: true }
  ];

  // Merge with live health data
  var sourceHealth = (snapshotData && snapshotData.sourceHealth) || {};
  var domainSummary = {};

  for (var i = 0; i < sourceInventory.length; i++) {
    var inv = sourceInventory[i];
    var health = sourceHealth[inv.name] || {};
    inv.liveStatus = health.status || 'unknown';
    inv.reason = health.reason || null;
    inv.fetchedAt = health.fetchedAt || null;
    inv.value = health.value;

    // Domain summary
    if (!domainSummary[inv.domain]) {
      domainSummary[inv.domain] = { live: 0, fallback: 0, sources: [] };
    }
    domainSummary[inv.domain].sources.push(inv.name);
    if (inv.liveStatus === 'live') {
      domainSummary[inv.domain].live++;
    } else {
      domainSummary[inv.domain].fallback++;
    }
  }

  // Build domain health overview
  var domainHealth = {};
  for (var dk in domainSummary) {
    var ds = domainSummary[dk];
    var status = 'FALLBACK';
    if (ds.live >= 2) status = 'LIVE';
    else if (ds.live === 1) status = 'PARTIAL';
    domainHealth[dk] = {
      status: status,
      liveSources: ds.live,
      fallbackSources: ds.fallback,
      sources: ds.sources
    };
  }

  // Compute overall health
  var totalLive = 0;
  var totalFallback = 0;
  for (var s = 0; s < sourceInventory.length; s++) {
    if (sourceInventory[s].liveStatus === 'live') totalLive++;
    else totalFallback++;
  }

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    overall: {
      totalSources: 14,
      live: totalLive,
      fallback: totalFallback,
      healthPct: Math.round((totalLive / 14) * 100) + '%'
    },
    envVars: envStatus,
    domainHealth: domainHealth,
    sources: sourceInventory,
    rawSourceHealth: sourceHealth,
    fetchError: fetchError
  });
};
