/**
 * api/limen-ingest.js
 * Vercel serverless — Minimal feed ingestion endpoint
 *
 * POST /api/limen-ingest
 *
 * Accepts normalized external events (manual, zapier).
 * Validates, normalizes, dedupes, returns bounded delta.
 * Stateless — client handles localStorage audit + event emission.
 *
 * No autonomous actions. No direct stress overwrite.
 * Ingestion nudges domain signal, does not replace it.
 */

var KNOWN_DOMAINS = [
  'economy', 'energy', 'environment', 'health', 'technology', 'research',
  'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry',
  'education', 'communication', 'culture', 'defense', 'religion',
  'population', 'law', 'finance', 'intelligence', 'trade'
];

var KNOWN_TYPES = ['signal', 'alert', 'event'];
var KNOWN_SOURCES = ['manual', 'zapier'];

var TYPE_WEIGHT = { signal: 1.0, alert: 1.2, event: 0.8 };
var SOURCE_WEIGHT = { manual: 1.0, zapier: 0.9 };
var MAX_DELTA = 0.25;
var MAX_TITLE_LEN = 120;
var MAX_SUMMARY_LEN = 500;
var MAX_BODY_SIZE = 2048;

// In-memory dedupe (per cold-start, ~5 min window on Vercel)
var _recentKeys = {};
var _DEDUPE_WINDOW_MS = 5 * 60 * 1000;

function _dedupeKey(body) {
  return [body.source, body.domain, body.type,
    Math.floor((body.timestamp || Date.now()) / 60000), // 1-min bucket
    (body.meta && body.meta.externalId) || ''
  ].join('::');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
    return;
  }

  // Parse body
  var body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: 'MALFORMED_JSON', message: 'Could not parse request body' });
    return;
  }

  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'EMPTY_BODY', message: 'Request body required' });
    return;
  }

  // Size check
  var bodyStr = JSON.stringify(body);
  if (bodyStr.length > MAX_BODY_SIZE) {
    res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'Max ' + MAX_BODY_SIZE + ' bytes', size: bodyStr.length });
    return;
  }

  // Validate required fields
  var errors = [];

  // Domain
  var domain = (body.domain || '').toString().trim().toLowerCase();
  // Normalize camelCase variants
  if (domain === 'supplychain') domain = 'supplyChain';
  if (KNOWN_DOMAINS.indexOf(domain) === -1) {
    errors.push({ field: 'domain', message: 'Unknown domain: ' + body.domain, allowed: KNOWN_DOMAINS });
  }

  // Type
  var type = (body.type || '').toString().trim().toLowerCase();
  if (KNOWN_TYPES.indexOf(type) === -1) {
    errors.push({ field: 'type', message: 'Unknown type: ' + body.type, allowed: KNOWN_TYPES });
  }

  // Source
  var source = (body.source || '').toString().trim().toLowerCase();
  if (KNOWN_SOURCES.indexOf(source) === -1) {
    errors.push({ field: 'source', message: 'Unknown source: ' + body.source, allowed: KNOWN_SOURCES });
  }

  // Magnitude
  var magnitude = parseFloat(body.magnitude);
  if (isNaN(magnitude) || magnitude < 0 || magnitude > 1) {
    errors.push({ field: 'magnitude', message: 'Magnitude must be 0-1 numeric', value: body.magnitude });
  }

  // Optional field length
  var title = (body.title || '').toString().substring(0, MAX_TITLE_LEN);
  var summary = (body.summary || '').toString().substring(0, MAX_SUMMARY_LEN);

  if (errors.length > 0) {
    res.status(400).json({
      error: 'VALIDATION_FAILED',
      accepted: false,
      errors: errors
    });
    return;
  }

  // Dedupe check
  var key = _dedupeKey({ source: source, domain: domain, type: type, timestamp: body.timestamp, meta: body.meta });
  var now = Date.now();
  var deduped = false;
  if (_recentKeys[key] && (now - _recentKeys[key]) < _DEDUPE_WINDOW_MS) {
    deduped = true;
  }
  _recentKeys[key] = now;

  // Clean old dedupe keys (prevent memory leak)
  var keyList = Object.keys(_recentKeys);
  if (keyList.length > 500) {
    for (var ki = 0; ki < keyList.length; ki++) {
      if (now - _recentKeys[keyList[ki]] > _DEDUPE_WINDOW_MS) delete _recentKeys[keyList[ki]];
    }
  }

  // Normalize: compute bounded delta
  var typeW = TYPE_WEIGHT[type] || 1.0;
  var srcW = SOURCE_WEIGHT[source] || 1.0;
  var appliedDelta = Math.min(MAX_DELTA, magnitude * typeW * srcW);
  appliedDelta = Math.round(appliedDelta * 1000) / 1000;

  // If deduped, zero the delta (don't double-apply)
  if (deduped) appliedDelta = 0;

  var ingestId = 'ing_' + now + '_' + Math.random().toString(36).substr(2, 4);

  var result = {
    id: ingestId,
    accepted: true,
    deduped: deduped,
    timestamp: body.timestamp || now,
    receivedAt: now,
    domain: domain,
    type: type,
    source: source,
    magnitude: magnitude,
    appliedDelta: appliedDelta,
    title: title,
    summary: summary,
    meta: body.meta || {},
    normalization: {
      typeWeight: typeW,
      sourceWeight: srcW,
      maxDelta: MAX_DELTA,
      formula: 'min(' + MAX_DELTA + ', magnitude * typeWeight * sourceWeight)'
    }
  };

  res.status(200).json(result);
};
