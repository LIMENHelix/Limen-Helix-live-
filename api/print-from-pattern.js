/**
 * /api/print-from-pattern — bypass for printing a long-form filing document
 * from an APPROVED pattern in Redis that hasn't synced to bridge-patterns.json
 * yet.
 *
 * GET /api/print-from-pattern?slug=<portal>&lane=<patent|grant|sba|research>
 *                            &patternId=<pattern_id>[&format=docx|md]
 *
 * Reads the pattern object from Redis (limen:pattern-proposals), reads the
 * portal JSON from the function bundle, synthesizes a seed artifact from the
 * pattern + portal context, calls the long-form generator, returns DOCX
 * (default) or markdown. Same 20-30 page calibration for new-business-no-
 * investor as /api/print-document.
 *
 * Lets the operator preview filing documents immediately after approving a
 * pattern, without waiting for the local sync + bridge-rebuild round trip.
 */
const fs = require('node:fs');
const path = require('node:path');
const { generate } = require('./lib/long-form-generator.js');
const { renderToBuffer } = require('./lib/markdown-to-docx.js');

const PORTALS_DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const PATTERNS_PATH = path.join(__dirname, '..', 'assets', 'data', 'bridge-patterns.json');

function _redisEnabled() { return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN); }
async function _redisCmd(cmd) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (!r.ok) throw new Error('redis ' + cmd[0] + ' status ' + r.status + ': ' + JSON.stringify(j).slice(0, 200));
  return j && j.result;
}

function _loadPortal(slug) { try { return JSON.parse(fs.readFileSync(path.join(PORTALS_DIR, slug + '.json'), 'utf8')); } catch (e) { return null; } }

async function _findPattern(patternId) {
  // Check bridge-patterns.json file first (if synced)
  try {
    const lib = JSON.parse(fs.readFileSync(PATTERNS_PATH, 'utf8'));
    const found = (lib.patterns || []).find(p => p.id === patternId);
    if (found) return { source: 'bridge-patterns.json', pattern: found };
  } catch (e) {}
  // Then check Redis approvals
  if (_redisEnabled()) {
    try {
      const raw = await _redisCmd(['LRANGE', 'limen:pattern-proposals', '0', '500']);
      const proposals = (raw || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
      const found = proposals.find(p => p.pattern && p.pattern.id === patternId);
      if (found) return { source: 'redis-proposals (status: ' + found.status + ')', pattern: found.pattern };
    } catch (e) {}
  }
  return null;
}

function _synthesizeSeed(pattern, lane, portal) {
  const da = (pattern.derivedAngles || {})[lane] || {};
  return {
    lane,
    patternId: pattern.id,
    confidence: pattern.bridge && pattern.bridge.confidence,
    artifact: {
      title: 'Synthesized seed from approved pattern ' + pattern.id + ' for ' + (portal.name || portal.slug || '?'),
      synthesizedFromPattern: true,
      derivedAngle: da,
      bridgeRationale: pattern.bridge && pattern.bridge.rationale
    }
  };
}

// Document section outline per lane (what the generated DOCX will contain) —
// used by the preview so the operator sees the structure before generating.
function _laneOutline(lane) {
  switch (lane) {
    case 'patent':   return ['Title', 'Abstract', 'Background', 'Summary of the Invention', 'Detailed Description', 'Claims'];
    case 'grant':    return ['Specific Aims', 'Significance', 'Innovation', 'Approach / Research Strategy', 'Commercialization', 'Budget Justification'];
    case 'sba':      return ['Executive Summary', 'Business Overview', 'Market & Competition', 'Use of Funds', 'Financial Projections', 'Repayment Plan', 'Risk & Mitigation'];
    case 'research': return ['Study Information', 'Hypotheses', 'Design Plan', 'Sampling Plan', 'Variables', 'Analysis Plan'];
    default:         return [];
  }
}

function _bridgeFromPattern(pattern) {
  return {
    patternId: pattern.id,
    neuralRegion: pattern.neural && pattern.neural.region,
    neuralRegionLabel: pattern.neural && pattern.neural.regionLabel,
    businessSignature: pattern.business && pattern.business.signature,
    mappingType: pattern.bridge && pattern.bridge.mappingType,
    confidence: pattern.bridge && pattern.bridge.confidence,
    matchedIndicators: (pattern.business && pattern.business.indicators || []).map(i => i.id),
    derivedAngles: pattern.derivedAngles || {},
    knownTreatments: (pattern.neural && pattern.neural.knownTreatments) || [],
    bridge: pattern.bridge
  };
}

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const slug = q.slug;
    const lane = q.lane;
    const patternId = q.patternId;
    const format = (q.format || 'docx').toLowerCase();
    const agency = (q.agency || 'nsf').toLowerCase();   // grant lane: nsf (default) | nih

    if (!slug || !lane || !patternId) return res.status(400).json({ error: 'slug + lane + patternId all required' });
    if (!['patent', 'grant', 'sba', 'research'].includes(lane)) return res.status(400).json({ error: 'lane must be patent | grant | sba | research' });

    const portal = _loadPortal(slug);
    if (!portal) return res.status(404).json({ error: 'portal not found: ' + slug });

    const found = await _findPattern(patternId);
    if (!found) return res.status(404).json({ error: 'pattern not found in bridge-patterns.json or Redis: ' + patternId });

    // PREVIEW mode — return what the document will be built from (bridge, lane
    // angle, section outline) WITHOUT the Anthropic generation. Lets the operator
    // see + approve before committing to the ~30-90s paid call (the master-inbox
    // "blind print" gap). No tokens spent.
    if (q.preview === '1' || q.preview === 'true') {
      const n = found.pattern.neural || {};
      const b = found.pattern.business || {};
      const br = found.pattern.bridge || {};
      return res.status(200).json({
        ok: true, preview: true,
        entity: portal.name || slug, ticker: portal.ticker || null,
        lane, patternId, patternSource: found.source,
        neural: { region: n.region, regionLabel: n.regionLabel, state: n.state, mechanism: n.mechanism },
        business: { signature: (b.signature || '').replace(/_/g, ' '), description: b.description },
        bridge: { mappingType: br.mappingType, confidence: br.confidence, rationale: br.rationale },
        derivedAngle: (found.pattern.derivedAngles || {})[lane] || {},
        sectionOutline: _laneOutline(lane),
        note: '20-30 page DOCX generated from the above via Claude Sonnet (~30-90s).'
      });
    }

    const seed = _synthesizeSeed(found.pattern, lane, portal);
    const bridge = _bridgeFromPattern(found.pattern);

    console.log('[print-from-pattern] generating', { slug, lane, patternId, patternSource: found.source });
    // 16000-token single calls run 2-3 min and 504 at the HTTP gateway (~60-100s).
    // 6000 tokens returns in ~45-60s (no timeout) and yields ~12-15 pages — which is
    // the right size anyway (NSF/NIH cap the project description at 15 pages).
    // For true 20-30 page output, an async job pattern is needed (generate → Redis → poll).
    const result = await generate({ lane, seedArtifact: seed, bridge, portal, maxTokens: 6000, agency });
    if (!result.ok) return res.status(502).json({ error: 'long-form generation failed', details: result.error });

    if (format === 'md' || format === 'markdown') {
      const fname = (portal.ticker || slug).toUpperCase() + '__' + lane + '__' + patternId.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 50) + '.md';
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="' + fname + '"');
      res.setHeader('X-Limen-Pattern-Source', found.source);
      return res.status(200).send(result.markdown);
    }

    const titlePrefix = lane === 'patent' ? 'PATENT APPLICATION' : lane === 'grant' ? ((agency === 'nih' ? 'NIH' : 'NSF') + ' SBIR PHASE I') : lane === 'sba' ? 'SBA MICROLOAN' : 'PREREGISTRATION';
    const buf = await renderToBuffer(result.markdown, {
      title: titlePrefix + ' — ' + (portal.name || slug),
      subject: patternId,
      description: 'LIMEN Helix · pattern ' + patternId + ' · source: ' + found.source
    });
    const fname = (portal.ticker || slug).toUpperCase() + '__' + lane + '__' + patternId.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) + '__' + new Date().toISOString().slice(0, 10) + '.docx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="' + fname + '"');
    res.setHeader('X-Limen-Tokens-Used', String(result.tokensUsed || 0));
    res.setHeader('X-Limen-Pattern-Source', found.source);
    return res.status(200).send(buf);
  } catch (err) {
    console.error('[print-from-pattern]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
};
